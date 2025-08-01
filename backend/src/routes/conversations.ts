import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, conversationSchemas, validateId, validatePagination } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';
import { chromadb } from '../config/chromadb';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../server';
import { 
  broadcastConversationUpdate, 
  broadcastDashboardUpdate, 
  broadcastNotification 
} from '../sockets/socketHandlers';
import { messageProcessor } from '../services/messageProcessor';
import { analyticsService } from '../services/analyticsService';
import { z } from 'zod';

const router = express.Router();
const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Apply authentication and tenant requirement to all routes
router.use(authenticate);
router.use(requireTenant);

// Helper function to generate conversation summary
const generateConversationSummary = async (messages: any[]): Promise<string> => {
  if (messages.length === 0) return '';
  
  const messageTexts = messages
    .filter(msg => msg.content && msg.content.trim())
    .slice(-10) // Last 10 messages
    .map(msg => `${msg.sender}: ${msg.content}`)
    .join('\n');

  if (!messageTexts) return '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize this conversation in 1-2 sentences. Focus on the main topic and any resolution or outcome.',
        },
        {
          role: 'user',
          content: messageTexts,
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    logger.warn('Failed to generate conversation summary:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return '';
  }
};

// Get all conversations for tenant
router.get('/', validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
  const { channelId, agentId, status, priority, search } = req.query;
  const tenantId = req.user!.tenantId;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build where clause
  const where: Record<string, any> = { tenantId };
  if (channelId) where.channelId = channelId;
  if (agentId) where.agentId = agentId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { customerEmail: { contains: search, mode: 'insensitive' } },
      { tags: { hasSome: [search] } },
    ];
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            sender: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  // Format conversations with last message
  const formattedConversations = conversations.map(conv => ({
    ...conv,
    lastMessage: conv.messages[0] || null,
    messages: undefined, // Remove messages array from response
  }));

  res.json({
    success: true,
    data: {
      conversations: formattedConversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

// Get conversation by ID
router.get('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { includeMessages = 'true' } = req.query;
  const tenantId = req.user!.tenantId;

  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
      ...(includeMessages === 'true' && {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      }),
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  res.json({
    success: true,
    data: { conversation },
  });
}));

// Create new conversation
router.post('/', validateBody(conversationSchemas.create), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    channelId,
    agentId,
    customerName,
    customerEmail,
    customerPhone,
    customerMetadata,
    priority,
    tags,
  } = req.body;
  const tenantId = req.user!.tenantId;

  // Verify channel exists and belongs to tenant
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, tenantId },
  });
  if (!channel) {
    throw new NotFoundError('Channel');
  }

  // Verify agent exists if provided
  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) {
      throw new NotFoundError('Agent');
    }
  }

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: {
      channelId,
      agentId: agentId || null,
      customerName: customerName || 'Unknown Customer',
      customerEmail,
      customerPhone,
      metadata: customerMetadata || {},
      priority: priority || 'MEDIUM',
      tags: tags || [],
      status: 'ACTIVE',
      tenantId,
    },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  logger.business('Conversation created', {
    conversationId: conversation.id,
    channelId,
    agentId,
    customerName,
    tenantId,
    userId: req.user!.id,
  });

  // Emit real-time events
  try {
    const io = getIO();
    
    // Broadcast conversation creation to tenant users
    broadcastConversationUpdate(io, conversation.id, {
      type: 'CONVERSATION_CREATED',
      conversation,
      timestamp: new Date()
    });
    
    // Update dashboard metrics
    await broadcastDashboardUpdate(io, tenantId);
    
    // Send notification to assigned agent if any
    if (agentId) {
      const notification = {
        id: uuidv4(),
        type: 'CONVERSATION_ASSIGNED' as const,
        title: 'New Conversation Assigned',
        message: `You have been assigned a new conversation with ${customerName}`,
        data: { conversationId: conversation.id },
        createdAt: new Date(),
        read: false
      };
      
      broadcastNotification(io, tenantId, notification);
    }
  } catch (error) {
    logger.error('Failed to emit real-time events for conversation creation', {
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Conversation created successfully',
    data: { conversation },
  });
}));

// Update conversation
router.put('/:id', validateId, validateBody(conversationSchemas.update), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const updateData = req.body;

  // Check if conversation exists and belongs to tenant
  const existingConversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!existingConversation) {
    throw new NotFoundError('Conversation');
  }

  // Verify agent if provided
  if (updateData.agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: updateData.agentId, tenantId },
    });
    if (!agent) {
      throw new NotFoundError('Agent');
    }
  }

  // Update conversation
  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  logger.business('Conversation updated', {
    conversationId: id,
    changes: Object.keys(updateData),
    tenantId,
    userId: req.user!.id,
  });

  // Emit real-time events
  try {
    const io = getIO();
    
    // Broadcast conversation update to tenant users
    broadcastConversationUpdate(io, id, {
      type: 'CONVERSATION_UPDATED',
      conversation,
      changes: Object.keys(updateData),
      timestamp: new Date()
    });
    
    // Update dashboard metrics if status changed
    if (updateData.status) {
      await broadcastDashboardUpdate(io, tenantId);
    }
    
    // Send notification for important status changes
    if (updateData.status === 'RESOLVED') {
      const notification = {
        id: uuidv4(),
        type: 'CONVERSATION_RESOLVED' as const,
        title: 'Conversation Resolved',
        message: `Conversation with ${conversation.customerName} has been resolved`,
        data: { conversationId: id },
        createdAt: new Date(),
        read: false
      };
      
      broadcastNotification(io, tenantId, notification);
    }
  } catch (error) {
    logger.error('Failed to emit real-time events for conversation update', {
      conversationId: id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  res.json({
    success: true,
    message: 'Conversation updated successfully',
    data: { conversation },
  });
}));

// Send message in conversation
router.post('/:id/messages', validateId, validateBody(conversationSchemas.sendMessage), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { content, sender, messageType, metadata, attachments } = req.body;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
    include: {
      agent: true,
      channel: true,
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId: id,
      content,
      sender: sender || 'CUSTOMER',
      type: messageType || 'TEXT',
      metadata: metadata || {},

    },

  });

  // Update conversation's last activity
  await prisma.conversation.update({
    where: { id },
    data: {
      updatedAt: new Date(),
      ...(conversation.status === 'RESOLVED' && { status: 'ACTIVE' }),
    },
  });

  // If sender is customer and agent is assigned, generate AI response
  let aiResponse = null;
  if ((sender || 'CUSTOMER') === 'CUSTOMER' && conversation.agent && conversation.agent.isActive) {
    try {
      // Get conversation context
      const recentMessages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Get relevant documents from knowledge base
      let contextDocuments: string[] = [];
      try {
        const searchResults = await chromadb.searchDocuments(
          tenantId,
          content,
          3,
          { agentId: conversation.agentId }
        );
        contextDocuments = searchResults.map(result => result.document);
      } catch (error) {
        logger.warn('Failed to search knowledge base:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Build context for AI
      const systemPrompt = conversation.agent.prompt || 'You are a helpful customer service assistant.';
      const conversationHistory = recentMessages
        .reverse()
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');
      
      const knowledgeContext = contextDocuments.length > 0
        ? `\n\nRelevant information:\n${contextDocuments.join('\n\n')}`
        : '';

      // Generate AI response
      const aiCompletion = await openai.chat.completions.create({
        model: conversation.agent.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}${knowledgeContext}`,
          },
          {
            role: 'user',
            content: `Conversation history:\n${conversationHistory}\n\nPlease respond to the customer's latest message.`,
          },
        ],
        max_tokens: conversation.agent.maxTokens || 500,
        temperature: conversation.agent.temperature || 0.7,
      });

      const aiContent = aiCompletion.choices[0]?.message?.content;
      if (aiContent) {
        aiResponse = await prisma.message.create({
          data: {
            conversationId: id,
            content: aiContent,
            sender: 'AGENT',
            type: 'TEXT',
            metadata: {
              aiGenerated: true,
              model: conversation.agent.model || 'gpt-3.5-turbo',
              tokensUsed: aiCompletion.usage?.total_tokens || 0,
            },
          },
        });

        logger.ai('AI response generated', {
          conversationId: id,
          agentId: conversation.agentId,
          model: conversation.agent.model,
          tokensUsed: aiCompletion.usage?.total_tokens,
          tenantId,
        });
      }
    } catch (error) {
      logger.error('Failed to generate AI response:', {
        conversationId: id,
        agentId: conversation.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.business('Message sent', {
    messageId: message.id,
    conversationId: id,
    sender,
    messageType,
    hasAttachments: !!attachments?.length,
    aiResponseGenerated: !!aiResponse,
    tenantId,
    userId: req.user!.id,
  });

  // Emit real-time events
  try {
    const io = getIO();
    
    // Broadcast new message to conversation participants and monitors
    broadcastConversationUpdate(io, id, {
      type: 'MESSAGE_SENT',
      message,
      conversationId: id,
      timestamp: new Date()
    });
    
    // If AI response was generated, broadcast it too
    if (aiResponse) {
      broadcastConversationUpdate(io, id, {
        type: 'AI_RESPONSE_GENERATED',
        message: aiResponse,
        conversationId: id,
        timestamp: new Date()
      });
    }
    
    // Update dashboard metrics
    await broadcastDashboardUpdate(io, tenantId);
    
    // Send notification for new customer messages to assigned agent
    if ((sender || 'CUSTOMER') === 'CUSTOMER' && conversation.agent) {
      const notification = {
        id: uuidv4(),
        type: 'NEW_MESSAGE' as const,
        title: 'New Customer Message',
        message: `${conversation.customerName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        data: { 
          conversationId: id,
          messageId: message.id,
          customerName: conversation.customerName
        },
        createdAt: new Date(),
        read: false
      };
      
      broadcastNotification(io, tenantId, notification);
    }
  } catch (error) {
    logger.error('Failed to emit real-time events for message', {
      messageId: message.id,
      conversationId: id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      message,
      aiResponse,
    },
  });
}));

// Get conversation messages
router.get('/:id/messages', validateId, validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { page, limit, sortBy = 'createdAt', sortOrder = 'asc' } = req.query;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: id },
      skip,
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
    }),
    prisma.message.count({ where: { conversationId: id } }),
  ]);

  res.json({
    success: true,
    data: {
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

// Close/resolve conversation
router.post('/:id/close', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason, summary } = req.body;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          content: true,
          sender: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  if (conversation.status === 'RESOLVED') {
    throw new ValidationError('Conversation is already resolved');
  }

  // Generate summary if not provided
  let conversationSummary = summary;
  if (!conversationSummary && conversation.messages.length > 0) {
    conversationSummary = await generateConversationSummary(conversation.messages);
  }

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      metadata: {
        ...(conversation.metadata as object || {}),
        resolvedBy: req.user!.id,
        resolvedReason: reason,
        summary: conversationSummary,
      },
    },
  });

  logger.business('Conversation closed', {
    conversationId: id,
    reason,
    summary: conversationSummary,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Conversation closed successfully',
    data: { conversation: updatedConversation },
  });
}));

// Reopen conversation
router.post('/:id/reopen', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  if (conversation.status !== 'RESOLVED') {
    throw new ValidationError('Only resolved conversations can be reopened');
  }

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      metadata: {
        ...(conversation.metadata as object || {}),
        reopenedBy: req.user!.id,
        reopenedAt: new Date().toISOString(),
      },
    },
  });

  logger.business('Conversation reopened', {
    conversationId: id,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Conversation reopened successfully',
    data: { conversation: updatedConversation },
  });
}));

// Transfer conversation to another agent
router.post('/:id/transfer', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { agentId, reason } = req.body;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  // Verify target agent exists
  const targetAgent = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
  });
  if (!targetAgent) {
    throw new NotFoundError('Target agent');
  }

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: {
      agentId,
      metadata: {
        ...(conversation.metadata as object || {}),
        transferredBy: req.user!.id,
        transferredAt: new Date().toISOString(),
        transferReason: reason,
        previousAgentId: conversation.agentId,
      },
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Create system message about transfer
  await prisma.message.create({
    data: {
      conversationId: id,
      content: `Conversation transferred to ${targetAgent.name}${reason ? `. Reason: ${reason}` : ''}`,
      sender: 'SYSTEM',
      type: 'TEXT',
      metadata: {
        transferredFrom: conversation.agentId,
        transferredTo: agentId,
        transferredBy: req.user!.id,
      },
    },
  });

  logger.business('Conversation transferred', {
    conversationId: id,
    fromAgentId: conversation.agentId,
    toAgentId: agentId,
    reason,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Conversation transferred successfully',
    data: { conversation: updatedConversation },
  });
}));

// Add tags to conversation
router.post('/:id/tags', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { tags } = req.body;
  const tenantId = req.user!.tenantId;

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new ValidationError('Tags must be a non-empty array');
  }

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  // Add new tags to existing ones
  const existingTags = conversation.tags || [];
  const newTags = [...new Set([...existingTags, ...tags])];

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: { tags: newTags },
  });

  logger.business('Tags added to conversation', {
    conversationId: id,
    addedTags: tags,
    totalTags: newTags.length,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Tags added successfully',
    data: { conversation: updatedConversation },
  });
}));

// Remove tags from conversation
router.delete('/:id/tags', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { tags } = req.body;
  const tenantId = req.user!.tenantId;

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new ValidationError('Tags must be a non-empty array');
  }

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  // Remove tags from existing ones
  const existingTags = conversation.tags || [];
  const newTags = existingTags.filter(tag => !tags.includes(tag));

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: { tags: newTags },
  });

  logger.business('Tags removed from conversation', {
    conversationId: id,
    removedTags: tags,
    remainingTags: newTags.length,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Tags removed successfully',
    data: { conversation: updatedConversation },
  });
}));

// Get conversation statistics
router.get('/stats/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d' } = req.query;
  const tenantId = req.user!.tenantId;

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const [totalStats, statusStats, channelStats, priorityStats, responseTimeStats] = await Promise.all([
    // Total conversations
    prisma.conversation.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
    
    // By status
    prisma.conversation.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
    
    // By channel
    prisma.conversation.groupBy({
      by: ['channelId'],
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
    
    // By priority
    prisma.conversation.groupBy({
      by: ['priority'],
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
    
    // Average response time (simplified) - using status RESOLVED instead of resolvedAt
    prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
        status: 'RESOLVED',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  // Calculate average response time
  const avgResponseTime = responseTimeStats.length > 0
    ? responseTimeStats.reduce((sum, conv) => {
        const responseTime = conv.updatedAt.getTime() - conv.createdAt.getTime();
        return sum + responseTime;
      }, 0) / responseTimeStats.length
    : 0;

  res.json({
    success: true,
    data: {
      period,
      total: totalStats._count,
      byStatus: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count,
      })),
      byChannel: channelStats.map(stat => ({
        channelId: stat.channelId,
        count: stat._count,
      })),
      byPriority: priorityStats.map(stat => ({
        priority: stat.priority,
        count: stat._count,
      })),
      avgResponseTimeMs: Math.round(avgResponseTime),
      avgResponseTimeHours: Math.round(avgResponseTime / (1000 * 60 * 60) * 100) / 100,
    },
  });
}));

// Send message to conversation
router.post('/:id/messages', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { content, sender = 'USER', metadata = {} } = req.body;
  const tenantId = req.user!.tenantId;

  // Validate input
  const messageSchema = z.object({
    content: z.string().min(1, 'Message content is required'),
    sender: z.enum(['USER', 'AGENT', 'SYSTEM']).default('USER'),
    metadata: z.record(z.any()).default({}),
  });

  const validation = messageSchema.safeParse({ content, sender, metadata });
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid message data',
      details: validation.error.errors,
    });
  }

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
    include: {
      agent: true,
      channel: true,
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  try {
    // Map sender types to match messageProcessor expectations
    const senderMapping: Record<string, 'CUSTOMER' | 'AGENT'> = {
      'USER': 'CUSTOMER',
      'AGENT': 'AGENT',
      'SYSTEM': 'AGENT', // System messages are treated as agent messages
    };

    // Process the message using the message processor service
    const result = await messageProcessor.processMessage({
      conversationId: id,
      agentId: conversation.agentId || '',
      tenantId,
      message: validation.data.content,
      sender: senderMapping[validation.data.sender],
      metadata: validation.data.metadata,
    });

    // Update analytics
    await analyticsService.updateRealTimeMetrics(tenantId, 'message_sent');

    logger.business('Message sent to conversation', {
      conversationId: id,
      messageId: result.messageId,
      sender: validation.data.sender,
      tenantId,
      userId: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: result,
      },
    });
  } catch (error) {
    logger.error('Failed to process message', {
      conversationId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId: req.user!.id,
    });

    return res.status(500).json({
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Get conversation messages with pagination
router.get('/:id/messages', validateId, validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { page, limit, sortOrder = 'asc' } = req.query;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: id },
      skip,
      take: Number(limit),
      orderBy: { createdAt: sortOrder as 'asc' | 'desc' },
    }),
    prisma.message.count({ where: { conversationId: id } }),
  ]);

  res.json({
    success: true,
    data: {
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

// Generate AI response for conversation
router.post('/:id/ai-response', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { prompt, includeContext = true } = req.body;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
    include: {
      agent: true,
      channel: true,
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  if (!conversation.agent) {
    return res.status(400).json({
      error: 'No agent assigned to this conversation',
    });
  }

  try {
    // Generate AI response using the message processor
    const response = await messageProcessor.generateAIResponseForConversation({
      conversationId: id,
      agentId: conversation.agentId!,
      prompt: prompt || 'Please provide a helpful response based on the conversation context.',
      includeContext,
      tenantId,
    });

    // Update analytics
    await analyticsService.updateRealTimeMetrics(tenantId, 'agent_response');

    logger.business('AI response generated for conversation', {
      conversationId: id,
      agentId: conversation.agentId,
      responseLength: response.content.length,
      tenantId,
      userId: req.user!.id,
    });

    return res.json({
      success: true,
      message: 'AI response generated successfully',
      data: { response },
    });
  } catch (error) {
    logger.error('Failed to generate AI response', {
      conversationId: id,
      agentId: conversation.agentId,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId: req.user!.id,
    });

    return res.status(500).json({
      error: 'Failed to generate AI response',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Get conversation analytics
router.get('/:id/analytics', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Check if conversation exists and belongs to tenant
  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation');
  }

  try {
    // Get conversation-specific analytics
    const [messageStats, responseTimeStats] = await Promise.all([
      prisma.message.groupBy({
        by: ['sender'],
        where: { conversationId: id },
        _count: { id: true },
      }),
      prisma.message.findMany({
        where: { 
          conversationId: id,
          sender: 'AGENT',
        },
        select: {
          createdAt: true,
          metadata: true,
        },
      }),
    ]);

    // Calculate response times from metadata
    const responseTimes = responseTimeStats
      .map(msg => (msg.metadata as any)?.responseTime)
      .filter(time => typeof time === 'number');

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const analytics = {
      messageStats: messageStats.map(stat => ({
        sender: stat.sender,
        count: stat._count.id,
      })),
      totalMessages: messageStats.reduce((sum, stat) => sum + stat._count.id, 0),
      averageResponseTime: Math.round(avgResponseTime),
      conversationDuration: conversation.updatedAt.getTime() - conversation.createdAt.getTime(),
      status: conversation.status,
      priority: conversation.priority,
    };

    return res.json({
      success: true,
      data: { analytics },
    });
  } catch (error) {
    logger.error('Failed to get conversation analytics', {
      conversationId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId: req.user!.id,
    });

    return res.status(500).json({
      error: 'Failed to get conversation analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

export default router;