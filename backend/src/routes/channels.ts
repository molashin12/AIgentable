import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, channelSchemas, validateId, validatePagination } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Apply authentication and tenant requirement to all routes
router.use(authenticate);
router.use(requireTenant);

// Channel configuration helpers
const validateChannelConfig = (type: string, config: Record<string, any>): boolean => {
  switch (type) {
    case 'WHATSAPP':
      return !!(config.phoneNumberId && config.accessToken && config.verifyToken);
    case 'FACEBOOK':
      return !!(config.pageId && config.accessToken && config.verifyToken);
    case 'INSTAGRAM':
      return !!(config.pageId && config.accessToken);
    case 'TELEGRAM':
      return !!(config.botToken && config.webhookUrl);
    case 'EMAIL':
      return !!(config.smtpHost && config.smtpPort && config.username && config.password);
    case 'SMS':
      return !!(config.accountSid && config.authToken && config.phoneNumber);
    case 'WEBCHAT':
      return !!(config.widgetId && config.allowedDomains);
    default:
      return false;
  }
};

const generateWebhookSecret = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const generateWebhookUrl = (channelId: string, type: string): string => {
  const baseUrl = config.webhookBaseUrl || 'https://api.aigentable.com';
  return `${baseUrl}/webhooks/${type.toLowerCase()}/${channelId}`;
};

// Get all channels for tenant
router.get('/', validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const { type, status, agentId } = req.query;
  const tenantId = req.user!.tenantId;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build where clause
  const where: any = { tenantId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (agentId) where.agentId = agentId;

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    }),
    prisma.channel.count({ where }),
  ]);

  // Remove sensitive config data from response
  const sanitizedChannels = channels.map((channel: any) => ({
    ...channel,
    config: {
      ...((channel.config && typeof channel.config === 'object') ? channel.config : {}),
      accessToken: (channel.config as any)?.accessToken ? '***' : undefined,
        botToken: (channel.config as any)?.botToken ? '***' : undefined,
        password: (channel.config as any)?.password ? '***' : undefined,
        authToken: (channel.config as any)?.authToken ? '***' : undefined,
    },
  }));

  res.json({
    success: true,
    data: {
      channels: sanitizedChannels,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

// Get channel by ID
router.get('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const channel = await prisma.channel.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: {
          conversations: true,
        },
      },
    },
  });

  if (!channel) {
    throw new NotFoundError('Channel');
  }

  // Remove sensitive config data
  const sanitizedChannel = {
    ...channel,
    config: {
      ...((channel.config && typeof channel.config === 'object') ? channel.config : {}),
      accessToken: (channel.config as any)?.accessToken ? '***' : undefined,
        botToken: (channel.config as any)?.botToken ? '***' : undefined,
        password: (channel.config as any)?.password ? '***' : undefined,
        authToken: (channel.config as any)?.authToken ? '***' : undefined,
    },
  };

  res.json({
    success: true,
    data: { channel: sanitizedChannel },
  });
}));

// Create new channel
router.post('/', validateBody(channelSchemas.create), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, type, config: channelConfig, isActive } = req.body;
  const tenantId = req.user!.tenantId;

  // Validate channel configuration
  if (!validateChannelConfig(type, channelConfig)) {
    throw new ValidationError(`Invalid configuration for ${type} channel`);
  }

  // Check for duplicate channel names within tenant
  const existingChannel = await prisma.channel.findFirst({
    where: { name, tenantId },
  });
  if (existingChannel) {
    throw new ConflictError('Channel name already exists');
  }

  // Generate webhook secret and URL
  const webhookSecret = generateWebhookSecret();
  const webhookUrl = generateWebhookUrl(crypto.randomUUID(), type);

  // Create channel
  const channel = await prisma.channel.create({
    data: {
      name,
      type,
      config: {
        ...channelConfig,
        webhookSecret,
        webhookUrl,
      },
      isActive: isActive ?? true,
      tenantId,
    },
  });

  // Update webhook URL with actual channel ID
  const updatedWebhookUrl = generateWebhookUrl(channel.id, type);
  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      config: {
        ...(channel.config as any),
        webhookUrl: updatedWebhookUrl,
      },
    },
  });

  logger.business('Channel created', {
    channelId: channel.id,
    name,
    type,
    tenantId,
    userId: req.user!.id,
  });

  // Remove sensitive data from response
  const sanitizedChannel = {
    ...channel,
    config: {
      ...((channel.config && typeof channel.config === 'object') ? channel.config : {}),
      webhookUrl: updatedWebhookUrl,
      accessToken: (channel.config as any)?.accessToken ? '***' : undefined,
      botToken: (channel.config as any)?.botToken ? '***' : undefined,
      password: (channel.config as any)?.password ? '***' : undefined,
      authToken: (channel.config as any)?.authToken ? '***' : undefined,
    },
  };

  res.status(201).json({
    success: true,
    message: 'Channel created successfully',
    data: { channel: sanitizedChannel },
  });
}));

// Update channel
router.put('/:id', validateId, validateBody(channelSchemas.update), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const updateData = req.body;

  // Check if channel exists and belongs to tenant
  const existingChannel = await prisma.channel.findFirst({
    where: { id, tenantId },
  });

  if (!existingChannel) {
    throw new NotFoundError('Channel');
  }

  // Validate configuration if provided
  if (updateData.config) {
    const mergedConfig = { 
      ...((existingChannel.config && typeof existingChannel.config === 'object') ? existingChannel.config : {}), 
      ...updateData.config 
    };
    if (!validateChannelConfig(existingChannel.type, mergedConfig)) {
      throw new ValidationError(`Invalid configuration for ${existingChannel.type} channel`);
    }
    updateData.config = mergedConfig;
  }

  // Remove agentId from updateData if present (not supported in direct channel updates)
  if (updateData.agentId) {
    delete updateData.agentId;
  }

  // Check for duplicate names if name is being updated
  if (updateData.name && updateData.name !== existingChannel.name) {
    const duplicateChannel = await prisma.channel.findFirst({
      where: { name: updateData.name, tenantId, id: { not: id } },
    });
    if (duplicateChannel) {
      throw new ConflictError('Channel name already exists');
    }
  }

  // Update channel
  const channel = await prisma.channel.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: {
      channelAgents: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Transform channelAgents data to include agent info
  const transformedChannel = {
    ...channel,
    agents: channel.channelAgents?.map((ca: any) => ({
      id: ca.agent.id,
      name: ca.agent.name,
      isActive: ca.isActive,
    })) || [],
    channelAgents: undefined, // Remove from response
  };

  logger.business('Channel updated', {
    channelId: id,
    changes: Object.keys(updateData),
    tenantId,
    userId: req.user!.id,
  });

  // Remove sensitive data from response
  const sanitizedChannel = {
    ...transformedChannel,
    config: {
      ...((channel.config && typeof channel.config === 'object') ? channel.config : {}),
      accessToken: (channel.config as any)?.accessToken ? '***' : undefined,
        botToken: (channel.config as any)?.botToken ? '***' : undefined,
        password: (channel.config as any)?.password ? '***' : undefined,
        authToken: (channel.config as any)?.authToken ? '***' : undefined,
    },
  };

  res.json({
    success: true,
    message: 'Channel updated successfully',
    data: { channel: sanitizedChannel },
  });
}));

// Delete channel
router.delete('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Check if channel exists and belongs to tenant
  const channel = await prisma.channel.findFirst({
    where: { id, tenantId },
    include: {
      _count: true,
    },
  });

  // Get conversation count separately if needed
  const conversationCount = await prisma.conversation.count({
    where: { channelId: id },
  });

  if (!channel) {
    throw new NotFoundError('Channel');
  }

  // Check if channel has active conversations
  if (conversationCount > 0) {
    throw new ValidationError('Cannot delete channel with existing conversations');
  }

  // Delete channel
  await prisma.channel.delete({
    where: { id },
  });

  logger.business('Channel deleted', {
    channelId: id,
    name: channel.name,
    type: channel.type,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Channel deleted successfully',
  });
}));

// Test channel connection
router.post('/:id/test', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const channel = await prisma.channel.findFirst({
    where: { id, tenantId },
  });

  if (!channel) {
    throw new NotFoundError('Channel');
  }

  let testResult = { success: false, message: '', details: {} };

  try {
    switch (channel.type) {
      case 'WHATSAPP':
        // Test WhatsApp Business API
        const whatsappResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${(channel.config as any)?.phoneNumberId}`,
          {
            headers: {
              Authorization: `Bearer ${(channel.config as any)?.accessToken}`,
            },
          }
        );
        testResult = {
          success: true,
          message: 'WhatsApp connection successful',
          details: {
            phoneNumber: whatsappResponse.data.display_phone_number,
            status: whatsappResponse.data.status,
          },
        };
        break;

      case 'FACEBOOK':
        // Test Facebook Page API
        const facebookResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${(channel.config as any)?.pageId}`,
          {
            params: {
              fields: 'name,category,verification_status',
              access_token: (channel.config as any)?.accessToken,
            },
          }
        );
        testResult = {
          success: true,
          message: 'Facebook connection successful',
          details: {
            pageName: facebookResponse.data.name,
            category: facebookResponse.data.category,
            verified: facebookResponse.data.verification_status === 'blue_verified',
          },
        };
        break;

      case 'INSTAGRAM':
        // Test Instagram API
        const instagramResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${(channel.config as any)?.pageId}`,
          {
            params: {
              fields: 'instagram_business_account',
              access_token: (channel.config as any)?.accessToken,
            },
          }
        );
        testResult = {
          success: true,
          message: 'Instagram connection successful',
          details: {
            businessAccount: !!instagramResponse.data.instagram_business_account,
          },
        };
        break;

      case 'TELEGRAM':
        // Test Telegram Bot API
        const telegramResponse = await axios.get(
          `https://api.telegram.org/bot${(channel.config as any)?.botToken}/getMe`
        );
        testResult = {
          success: true,
          message: 'Telegram connection successful',
          details: {
            botName: telegramResponse.data.result.first_name,
            username: telegramResponse.data.result.username,
          },
        };
        break;

      case 'WEBSITE':
        testResult = {
          success: true,
          message: 'Website configuration is valid',
          details: {
            widgetId: (channel.config as any)?.widgetId,
            allowedDomains: (channel.config as any)?.allowedDomains,
          },
        };
        break;

      case 'API':
        testResult = {
          success: true,
          message: 'API configuration appears valid',
          details: {
            apiKey: (channel.config as any)?.apiKey ? 'Configured' : 'Not configured',
          },
        };
        break;

      default:
        throw new ValidationError(`Testing not supported for ${channel.type} channels`);
    }

    // Update last tested timestamp
    await prisma.channel.update({
      where: { id },
      data: {
        config: {
          ...(channel.config as any || {}),
          lastTested: new Date().toISOString(),
        },
      },
    });

    logger.integration('Channel test successful', {
      channelId: id,
      type: channel.type,
      tenantId,
      userId: req.user!.id,
    });
  } catch (error) {
    testResult = {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };

    logger.integration('Channel test failed', {
      channelId: id,
      type: channel.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId: req.user!.id,
    });
  }

  res.json({
    success: testResult.success,
    message: testResult.message,
    data: testResult.details,
  });
}));

// Get channel webhook configuration
router.get('/:id/webhook', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const channel = await prisma.channel.findFirst({
    where: { id, tenantId },
  });

  if (!channel) {
    throw new NotFoundError('Channel');
  }

  res.json({
    success: true,
    data: {
      webhookUrl: (channel.config as any)?.webhookUrl,
      verifyToken: (channel.config as any)?.verifyToken,
      // Don't expose webhook secret in response
    },
  });
}));

// Regenerate webhook secret
router.post('/:id/webhook/regenerate', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const channel = await prisma.channel.findFirst({
    where: { id, tenantId },
  });

  if (!channel) {
    throw new NotFoundError('Channel');
  }

  // Generate new webhook secret
  const newWebhookSecret = generateWebhookSecret();

  // Update channel
  await prisma.channel.update({
    where: { id },
    data: {
      config: {
        ...(channel.config as any || {}),
        webhookSecret: newWebhookSecret,
      },
    },
  });

  logger.security('Webhook secret regenerated', {
    channelId: id,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Webhook secret regenerated successfully',
  });
}));

// Get channel statistics
router.get('/:id/stats', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { period = '7d' } = req.query;
  const tenantId = req.user!.tenantId;

  const channel = await prisma.channel.findFirst({
    where: { id, tenantId },
  });

  if (!channel) {
    throw new NotFoundError('Channel');
  }

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

  const [conversationStats, messageStats] = await Promise.all([
    // Conversation statistics
    prisma.conversation.aggregate({
      where: {
        channelId: id,
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
    
    // Message statistics
    prisma.message.aggregate({
      where: {
        conversation: {
          channelId: id,
        },
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
  ]);

  // Get conversation status breakdown
  const statusBreakdown = await prisma.conversation.groupBy({
    by: ['status'],
    where: {
      channelId: id,
      createdAt: { gte: startDate },
    },
    _count: true,
  });

  res.json({
    success: true,
    data: {
      period,
      conversations: {
        total: conversationStats._count,
        byStatus: statusBreakdown.map((stat: any) => ({
          status: stat.status,
          count: stat._count,
        })),
      },
      messages: {
        total: messageStats._count,
      },
    },
  });
}));

// Get supported channel types
router.get('/types/supported', asyncHandler(async (req: Request, res: Response) => {
  const supportedTypes = [
    {
      type: 'WHATSAPP',
      name: 'WhatsApp Business',
      description: 'Connect with customers via WhatsApp Business API',
      requiredConfig: ['phoneNumberId', 'accessToken', 'verifyToken'],
      features: ['text', 'media', 'templates', 'buttons'],
    },
    {
      type: 'FACEBOOK',
      name: 'Facebook Messenger',
      description: 'Connect with customers via Facebook Messenger',
      requiredConfig: ['pageId', 'accessToken', 'verifyToken'],
      features: ['text', 'media', 'quick_replies', 'persistent_menu'],
    },
    {
      type: 'INSTAGRAM',
      name: 'Instagram Direct',
      description: 'Connect with customers via Instagram Direct Messages',
      requiredConfig: ['pageId', 'accessToken'],
      features: ['text', 'media', 'story_mentions'],
    },
    {
      type: 'TELEGRAM',
      name: 'Telegram Bot',
      description: 'Connect with customers via Telegram Bot API',
      requiredConfig: ['botToken', 'webhookUrl'],
      features: ['text', 'media', 'inline_keyboards', 'commands'],
    },
    {
      type: 'WEBSITE',
      name: 'Website Chat',
      description: 'Embed chat widget on your website',
      requiredConfig: ['widgetId', 'allowedDomains'],
      features: ['text', 'media', 'typing_indicators', 'file_upload'],
    },
    {
      type: 'API',
      name: 'API Integration',
      description: 'Connect via REST API',
      requiredConfig: ['apiKey', 'webhookUrl'],
      features: ['text', 'media', 'custom_payloads'],
    },
  ];

  res.json({
    success: true,
    data: { supportedTypes },
  });
}));

export default router;