import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { chromadb, getChromaClient } from '../config/chromadb';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, agentSchemas, validateId, validatePagination } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ConflictError,
  ValidationError,
  AIError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import { aiProvider, ChatMessage } from '../services/aiProvider';
import { getIO } from '../server';
import { 
  broadcastDashboardUpdate, 
  broadcastNotification 
} from '../sockets/socketHandlers';

const router = express.Router();

// Apply authentication and tenant requirement to all routes
router.use(authenticate);
router.use(requireTenant);

// Get all agents for tenant
router.get('/', validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const tenantId = req.user!.tenantId;

  const skip = (Number(page) - 1) * Number(limit);

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where: { tenantId },
      skip,
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        _count: {
          select: {
            conversations: true,
            documents: true,
          },
        },
      },
    }),
    prisma.agent.count({
      where: { tenantId },
    }),
  ]);

  res.json({
    success: true,
    data: {
      agents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

// Get agent by ID
router.get('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const agent = await prisma.agent.findFirst({
    where: { id, tenantId },
    include: {
      documents: {
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          createdAt: true,
        },
      },
      channelAgents: {
        select: {
          id: true,
          isActive: true,
          channel: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          conversations: true,
          documents: true,
        },
      },
    },
  });

  if (!agent) {
    throw new NotFoundError('Agent');
  }

  res.json({
    success: true,
    data: { agent },
  });
}));

// Create new agent
router.post('/', validateBody(agentSchemas.create), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const agentData = req.body;

  // Check if agent name is unique within tenant
  const existingAgent = await prisma.agent.findFirst({
    where: {
      name: agentData.name,
      tenantId,
    },
  });

  if (existingAgent) {
    throw new ConflictError('Agent with this name already exists');
  }

  // Create agent
  const agent = await prisma.agent.create({
    data: {
      name: agentData.name,
      description: agentData.description,
      prompt: agentData.systemPrompt || 'You are a helpful AI assistant.',
      personality: agentData.personality || {},
      role: agentData.role || 'assistant',
      temperature: agentData.temperature,
      maxTokens: agentData.maxTokens,
      isActive: agentData.isActive,
      tenantId,
      creatorId: req.user!.id,
    },
  });

  logger.business('Agent created', {
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    tenantId,
    userId: req.user!.id,
  });

  // Emit real-time events
  try {
    const io = getIO();
    
    // Update dashboard metrics
    await broadcastDashboardUpdate(io, tenantId);
    
    // Send notification about new agent
    const notification = {
      id: uuidv4(),
      type: 'AGENT_CREATED' as const,
      title: 'New Agent Created',
      message: `Agent "${agent.name}" has been created and is ready to assist`,
      data: { agentId: agent.id, agentName: agent.name },
      createdAt: new Date(),
      read: false
    };
    
    broadcastNotification(io, tenantId, notification);
  } catch (error) {
    logger.error('Failed to emit real-time events for agent creation', {
      agentId: agent.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  res.status(201).json({
    success: true,
    message: 'Agent created successfully',
    data: { agent },
  });
}));

// Update agent
router.put('/:id', validateId, validateBody(agentSchemas.update), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const updateData = req.body;

  // Check if agent exists and belongs to tenant
  const existingAgent = await prisma.agent.findFirst({
    where: { id, tenantId },
  });

  if (!existingAgent) {
    throw new NotFoundError('Agent');
  }

  // Check if name is unique (if being updated)
  if (updateData.name && updateData.name !== existingAgent.name) {
    const nameConflict = await prisma.agent.findFirst({
      where: {
        name: updateData.name,
        tenantId,
        id: { not: id },
      },
    });

    if (nameConflict) {
      throw new ConflictError('Agent with this name already exists');
    }
  }

  // Update agent
  const agent = await prisma.agent.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
  });

  logger.business('Agent updated', {
    agentId: agent.id,
    agentName: agent.name,
    changes: Object.keys(updateData),
    tenantId,
    userId: req.user!.id,
  });

  // Emit real-time events
  try {
    const io = getIO();
    
    // Emit agent status update event
    io.to(`tenant:${tenantId}`).emit('agent_status_changed', {
      agentId: agent.id,
      agentName: agent.name,
      status: agent.status,
      isActive: agent.isActive,
      changes: Object.keys(updateData),
      timestamp: new Date()
    });
    
    // Update dashboard metrics if status changed
    if (updateData.status || updateData.isActive !== undefined) {
      await broadcastDashboardUpdate(io, tenantId);
    }
    
    // Send notification for important status changes
    if (updateData.status === 'INACTIVE' || updateData.isActive === false) {
      const notification = {
        id: uuidv4(),
        type: 'AGENT_STATUS_CHANGED' as const,
        title: 'Agent Status Changed',
        message: `Agent "${agent.name}" is now ${updateData.status === 'INACTIVE' ? 'inactive' : 'offline'}`,
        data: { agentId: agent.id, agentName: agent.name, status: agent.status },
        createdAt: new Date(),
        read: false
      };
      
      broadcastNotification(io, tenantId, notification);
    } else if (updateData.status === 'ACTIVE' || updateData.isActive === true) {
      const notification = {
        id: uuidv4(),
        type: 'AGENT_STATUS_CHANGED' as const,
        title: 'Agent Status Changed',
        message: `Agent "${agent.name}" is now ${updateData.status === 'ACTIVE' ? 'active' : 'online'}`,
        data: { agentId: agent.id, agentName: agent.name, status: agent.status },
        createdAt: new Date(),
        read: false
      };
      
      broadcastNotification(io, tenantId, notification);
    }
  } catch (error) {
    logger.error('Failed to emit real-time events for agent update', {
      agentId: agent.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  res.json({
    success: true,
    message: 'Agent updated successfully',
    data: { agent },
  });
}));

// Delete agent
router.delete('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Check if agent exists and belongs to tenant
  const agent = await prisma.agent.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: {
          conversations: true,
          channelAgents: true,
        },
      },
    },
  });

  if (!agent) {
    throw new NotFoundError('Agent');
  }

  // Check if agent has active conversations or channels
  if (agent._count.conversations > 0 || agent._count.channelAgents > 0) {
    throw new ValidationError('Cannot delete agent with active conversations or channels');
  }

  // Delete agent and related data
  await prisma.$transaction(async (tx: any) => {
    // Delete documents
    await tx.document.deleteMany({
      where: { agentId: id },
    });

    // Delete agent
    await tx.agent.delete({
      where: { id },
    });
  });

  // Delete from ChromaDB
  try {
    const documents = await chromadb.getDocumentsByAgent(tenantId, id);
    if (documents.length > 0) {
      for (const doc of documents) {
        await chromadb.deleteDocuments(tenantId, doc.metadata.documentId);
      }
    }
  } catch (error) {
    logger.error('Failed to delete agent documents from ChromaDB:', error);
  }

  logger.business('Agent deleted', {
    agentId: id,
    agentName: agent.name,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Agent deleted successfully',
  });
}));

// Chat with agent
router.post('/:id/chat', validateId, validateBody(agentSchemas.chat), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { message, conversationId, context } = req.body;
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  // Get agent
  const agent = await prisma.agent.findFirst({
    where: { id, tenantId, isActive: true },
  });

  if (!agent) {
    throw new NotFoundError('Agent');
  }

  let conversation;
  
  // Get or create conversation
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        status: { in: ['ACTIVE'] },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context
        },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation');
    }
  } else {
    // Create new conversation - need to get a default channel first
    const defaultChannel = await prisma.channel.findFirst({
      where: { tenantId, isActive: true },
    });
    
    if (!defaultChannel) {
      throw new ValidationError('No active channel found for tenant');
    }
    
    conversation = await prisma.conversation.create({
      data: {
        tenantId,
        channelId: defaultChannel.id,
        agentId: id,
        status: 'ACTIVE',
        metadata: {
          customerInfo: {
            name: `${req.user!.firstName} ${req.user!.lastName}`,
            email: req.user!.email,
            userId: userId,
          },
        },
      },
      include: {
        messages: true,
      },
    });
  }

  try {
    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: message,
        type: 'TEXT',
        sender: 'CUSTOMER',
        metadata: context || {},
      },
    });

    // Prepare conversation history
    const conversationHistory = conversation.messages.map((msg: any) => {
      let role: 'user' | 'assistant' | 'system';
      switch (msg.sender) {
        case 'CUSTOMER':
          role = 'user';
          break;
        case 'AGENT':
        case 'HUMAN':
          role = 'assistant';
          break;
        case 'SYSTEM':
          role = 'system';
          break;
        default:
          role = 'assistant';
      }
      return {
        role,
        content: msg.content,
      };
    });

    // Add current message
    conversationHistory.push({
      role: 'user',
      content: message,
    });

    // Get relevant documents from ChromaDB using advanced search
    let relevantDocs: any[] = [];
    let searchMetadata: any = {};
    try {
      // Use hybrid search for better results
      relevantDocs = await chromadb.advancedSearch(tenantId, message, {
        strategy: 'hybrid',
        nResults: 5,
        agentId: id,
        minSimilarity: 0.6,
        enableReranking: true,
        keywordWeight: 0.3,
        semanticWeight: 0.7,
      });
      
      searchMetadata = {
        strategy: 'hybrid',
        documentsFound: relevantDocs.length,
        avgSimilarity: relevantDocs.length > 0 
          ? relevantDocs.reduce((sum, doc) => sum + (1 - doc.distance), 0) / relevantDocs.length 
          : 0,
      };
      
      // Filter out low-quality results
      relevantDocs = relevantDocs.filter(doc => (1 - doc.distance) >= 0.6);
      
      logger.info('Advanced search completed for agent chat', {
        agentId: id,
        tenantId,
        query: message.substring(0, 100),
        resultsFound: relevantDocs.length,
        avgSimilarity: searchMetadata.avgSimilarity,
      });
    } catch (error) {
      logger.warn('Failed to search documents in ChromaDB:', error);
      // Fallback to basic semantic search if advanced search fails
      try {
        relevantDocs = await chromadb.semanticSearch(tenantId, message, {
          nResults: 3,
          agentId: id,
          minSimilarity: 0.7,
        });
        searchMetadata = {
          strategy: 'semantic_fallback',
          documentsFound: relevantDocs.length,
        };
      } catch (fallbackError) {
        logger.error('Fallback search also failed:', fallbackError);
      }
    }

    // Prepare system prompt with enhanced context
    let systemPrompt = agent.prompt || `You are ${agent.name}, a helpful AI assistant.`;
    
    if (relevantDocs.length > 0) {
      // Sort by relevance and take top results
      const sortedDocs = relevantDocs
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3); // Limit to top 3 for context window
      
      const contextDocs = sortedDocs.map((doc: any, index: number) => {
        const similarity = ((1 - doc.distance) * 100).toFixed(1);
        const source = doc.metadata?.fileName || 'Unknown source';
        return `[Source ${index + 1}: ${source} (${similarity}% relevant)]\n${doc.document}`;
      }).join('\n\n');
      
      systemPrompt += `\n\nRelevant information from knowledge base:\n${contextDocs}\n\nPlease use this information to provide accurate and helpful responses. If the information is not directly relevant to the user's question, you may acknowledge this and provide general assistance.`;
    }

    // Prepare messages for AI provider
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    // Call AI provider
    const completion = await aiProvider.generateChatCompletion(messages, {
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });

    const aiResponse = completion.content || 'I apologize, but I could not generate a response.';
    const tokensUsed = completion.tokensUsed;

    // Save AI response
    const aiMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: aiResponse,
        type: 'TEXT',
        sender: 'AGENT',
        metadata: {
          model: completion.model,
          provider: completion.provider,
          tokensUsed,
          relevantDocs: relevantDocs.length,
          searchMetadata,
        },
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
      },
    });

    // Log AI usage
    logger.ai('Chat completion', completion.model, tokensUsed, completion.provider, {
      agentId: id,
      conversationId: conversation.id,
      tenantId,
      userId,
    });

    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          status: conversation.status,
        },
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        aiMessage: {
          id: aiMessage.id,
          content: aiMessage.content,
          createdAt: aiMessage.createdAt,
        },
        metadata: {
          tokensUsed,
          relevantDocs: relevantDocs.length,
          model: completion.model,
          provider: completion.provider,
          searchStrategy: searchMetadata.strategy,
          avgSimilarity: searchMetadata.avgSimilarity,
        },
      },
    });
  } catch (error) {
    logger.error('Chat completion failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      agentId: id,
      tenantId,
      userId,
    });

    if (error instanceof Error && error.message.includes('API key')) {
      throw new AIError('AI API configuration error');
    } else if (error instanceof Error && error.message.includes('rate limit')) {
      throw new AIError('Rate limit exceeded. Please try again later.');
    } else {
      throw new AIError('Failed to generate response. Please try again.');
    }
  }
}));

// Get agent analytics
router.get('/:id/analytics', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Verify agent exists and belongs to tenant
  const agent = await prisma.agent.findFirst({
    where: { id, tenantId },
  });

  if (!agent) {
    throw new NotFoundError('Agent');
  }

  // Get analytics data
  const [conversationStats, messageStats, documentStats] = await Promise.all([
    // Conversation statistics
    prisma.conversation.groupBy({
      by: ['status'],
      where: {
        agentId: id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _count: true,
    }),
    
    // Message statistics
    prisma.message.aggregate({
      where: {
        conversation: {
          agentId: id,
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _count: true,
    }),
    
    // Document statistics
    prisma.document.aggregate({
      where: {
        agentId: id,
      },
      _count: true,
      _sum: {
        size: true,
      },
    }),
  ]);

  // Calculate response time (simplified)
  const avgResponseTime = await prisma.$queryRaw`
    SELECT AVG(EXTRACT(EPOCH FROM (ai_msg.created_at - user_msg.created_at))) as avg_response_time
    FROM messages ai_msg
    JOIN messages user_msg ON ai_msg.conversation_id = user_msg.conversation_id
    JOIN conversations c ON ai_msg.conversation_id = c.id
    WHERE c.agent_id = ${id}
      AND ai_msg.sender = 'AGENT'
      AND user_msg.sender = 'CUSTOMER'
      AND ai_msg.created_at > user_msg.created_at
      AND ai_msg.created_at >= NOW() - INTERVAL '30 days'
  ` as { avg_response_time: number }[];

  res.json({
    success: true,
    data: {
      conversations: {
        total: conversationStats.reduce((sum: number, stat: { _count: number }) => sum + stat._count, 0),
        byStatus: conversationStats.reduce((acc: Record<string, number>, stat: { status: string; _count: number }) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
      },
      messages: {
        total: messageStats._count,
      },
      documents: {
        total: documentStats._count,
        totalSize: documentStats._sum.size || 0,
      },
      performance: {
        avgResponseTime: avgResponseTime[0]?.avg_response_time || 0,
      },
    },
  });
}));

// Test agent configuration
router.post('/:id/test', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Get agent
  const agent = await prisma.agent.findFirst({
    where: { id, tenantId },
  });

  if (!agent) {
    throw new NotFoundError('Agent');
  }

  try {
    // Test with a simple message
    const testMessage = 'Hello, this is a test message. Please respond briefly.';
    
    const completion = await aiProvider.generateChatCompletion([
      {
        role: 'system',
        content: agent.prompt || `You are ${agent.name}, a helpful AI assistant.`,
      },
      {
        role: 'user',
        content: testMessage,
      },
    ], {
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: Math.min(agent.maxTokens, 100), // Limit for test
    });

    const response = completion.content || 'No response generated';
    const tokensUsed = completion.tokensUsed || 0;

    logger.ai('Agent test', completion.model, tokensUsed, undefined, {
      agentId: id,
      tenantId,
      userId: req.user!.id,
      provider: completion.provider,
    });

    res.json({
      success: true,
      message: 'Agent test completed successfully',
      data: {
        testMessage,
        response,
        tokensUsed,
        model: completion.model,
        provider: completion.provider,
        responseTime: Date.now(), // Simplified
      },
    });
  } catch (error) {
    logger.error('Agent test failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      agentId: id,
      tenantId,
    });

    throw new AIError('Agent test failed. Please check your configuration.');
  }
}));

export default router;