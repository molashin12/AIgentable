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
import OpenAI from 'openai';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

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
      ...agentData,
      tenantId,
      createdBy: req.user!.id,
    },
  });

  logger.business('Agent created', {
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    tenantId,
    userId: req.user!.id,
  });

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

    // Get relevant documents from ChromaDB
    let relevantDocs: any[] = [];
    try {
      relevantDocs = await chromadb.searchDocuments(tenantId, message, 3, {
        agentId: id,
      });
    } catch (error) {
      logger.warn('Failed to search documents in ChromaDB:', error);
    }

    // Prepare system prompt with context
    let systemPrompt = agent.prompt || `You are ${agent.name}, a helpful AI assistant.`;
    
    if (relevantDocs.length > 0) {
      const contextDocs = relevantDocs.map((doc: any) => doc.document).join('\n\n');
      systemPrompt += `\n\nRelevant information from knowledge base:\n${contextDocs}`;
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: agent.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Save AI response
    const aiMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: aiResponse,
        type: 'TEXT',
        sender: 'AGENT',
        metadata: {
          model: agent.model,
          tokensUsed,
          relevantDocs: relevantDocs.length,
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
    logger.ai('Chat completion', agent.model, tokensUsed, undefined, {
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
          model: agent.model,
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
      throw new AIError('OpenAI API configuration error');
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
    
    const completion = await openai.chat.completions.create({
      model: agent.model,
      messages: [
        {
          role: 'system',
          content: agent.prompt || `You are ${agent.name}, a helpful AI assistant.`,
        },
        {
          role: 'user',
          content: testMessage,
        },
      ],
      temperature: agent.temperature,
      max_tokens: Math.min(agent.maxTokens, 100), // Limit for test
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';
    const tokensUsed = completion.usage?.total_tokens || 0;

    logger.ai('Agent test', agent.model, tokensUsed, undefined, {
      agentId: id,
      tenantId,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Agent test completed successfully',
      data: {
        testMessage,
        response,
        tokensUsed,
        model: agent.model,
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