import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { chromadb } from '../config/chromadb';
import { authenticate, requireTenant, authorize, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, tenantSchemas, validateId, validatePagination } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
  AuthorizationError,
  InternalServerError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';
import crypto from 'crypto';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get current tenant info
router.get('/current', 
  requireTenant,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: true,
        _count: {
          select: {
            users: { where: { status: 'ACTIVE' } },
            agents: true,
            conversations: true,
            documents: true,
            channels: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    res.json({
      success: true,
      data: { tenant },
    });
  })
);

// Update tenant settings (admin only)
router.put('/settings', 
  requireTenant,
  authorize('ADMIN'),
  validateBody(tenantSchemas.update),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { name, settings, metadata } = req.body;

    // Check if name is being changed and if it's already taken
    if (name) {
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          name,
          id: { not: tenantId },
        },
      });
      if (existingTenant) {
        throw new ConflictError('Tenant name already exists');
      }
    }

    // Get current tenant for merging settings
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!currentTenant) {
      throw new NotFoundError('Tenant');
    }

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name && { name }),
        ...(settings && {
          settings: settings,
        }),
        ...(metadata && { 
          metadata: metadata,
        }),
        updatedAt: new Date(),
      },
      include: {
        subscriptions: true,
        _count: {
          select: {
            users: { where: { status: 'ACTIVE' } },
            agents: true,
            conversations: true,
            documents: true,
            channels: true,
          },
        },
      },
    });

    logger.business('Tenant settings updated', {
      tenantId,
      changes: Object.keys(req.body),
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Tenant settings updated successfully',
      data: { tenant },
    });
  })
);

// Get tenant usage statistics
router.get('/usage', 
  requireTenant,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get usage statistics
    const [tenant, usage] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: true,
        },
      }),
      Promise.all([
        // Total counts
        prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
        prisma.agent.count({ where: { tenantId } }),
        prisma.document.count({ where: { tenantId } }),
        prisma.channel.count({ where: { tenantId } }),
        prisma.conversation.count({ where: { tenantId } }),
        
        // Period-specific counts
        prisma.conversation.count({
          where: {
            tenantId,
            createdAt: { gte: startDate },
          },
        }),
        prisma.message.count({
          where: {
            conversation: { tenantId },
            createdAt: { gte: startDate },
          },
        }),
        
        // Storage usage (approximate)
        prisma.document.aggregate({
          where: { tenantId },
          _sum: { size: true },
        }),
      ]),
    ]);

    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    const [
      totalUsers,
      totalAgents,
      totalDocuments,
      totalChannels,
      totalConversations,
      periodConversations,
      periodMessages,
      storageUsage,
    ] = usage;

    // Get plan limits
    const planLimits = {
      FREE: {
        users: 2,
        agents: 1,
        documents: 10,
        channels: 2,
        conversations: 100,
        storage: 100 * 1024 * 1024, // 100MB
      },
      BASIC: {
        users: 10,
        agents: 5,
        documents: 100,
        channels: 5,
        conversations: 1000,
        storage: 1024 * 1024 * 1024, // 1GB
      },
      PRO: {
        users: 50,
        agents: 20,
        documents: 1000,
        channels: 20,
        conversations: 10000,
        storage: 10 * 1024 * 1024 * 1024, // 10GB
      },
      ENTERPRISE: {
        users: -1, // Unlimited
        agents: -1,
        documents: -1,
        channels: -1,
        conversations: -1,
        storage: -1,
      },
    };

    const currentLimits = planLimits[tenant.plan as keyof typeof planLimits];
    const storageUsedBytes = storageUsage._sum.size || 0;

    const usageData = {
      plan: tenant.plan,
      period,
      current: {
        users: totalUsers,
        agents: totalAgents,
        documents: totalDocuments,
        channels: totalChannels,
        conversations: totalConversations,
        storage: storageUsedBytes,
      },
      limits: currentLimits,
      periodActivity: {
        conversations: periodConversations,
        messages: periodMessages,
      },
      utilization: {
        users: currentLimits.users === -1 ? 0 : (totalUsers / currentLimits.users) * 100,
        agents: currentLimits.agents === -1 ? 0 : (totalAgents / currentLimits.agents) * 100,
        documents: currentLimits.documents === -1 ? 0 : (totalDocuments / currentLimits.documents) * 100,
        channels: currentLimits.channels === -1 ? 0 : (totalChannels / currentLimits.channels) * 100,
        conversations: currentLimits.conversations === -1 ? 0 : (totalConversations / currentLimits.conversations) * 100,
        storage: currentLimits.storage === -1 ? 0 : (storageUsedBytes / currentLimits.storage) * 100,
      },
    };

    res.json({
      success: true,
      data: { usage: usageData },
    });
  })
);

// Update subscription (admin only)
router.put('/subscription', 
  requireTenant,
  authorize('ADMIN'),
  validateBody(tenantSchemas.subscription),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { plan, billingCycle, paymentMethod } = req.body;

    // Get current tenant and subscription
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptions: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    // Calculate new billing dates
    const now = new Date();
    let nextBillingDate: Date;
    
    if (billingCycle === 'MONTHLY') {
      nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    } else {
      nextBillingDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    }

    // Find existing subscription for this tenant
    const existingSubscription = await prisma.subscription.findFirst({
      where: { tenantId },
    });

    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan,
          status: 'ACTIVE',
          billingCycle,
          nextBillingDate,
          ...(paymentMethod && { paymentMethod }),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new subscription
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          plan,
          status: 'ACTIVE',
          billingCycle: billingCycle || 'MONTHLY',
          startDate: now,
          endDate: nextBillingDate,
          amount: 0,
        },
      });
    }

    // Update tenant plan
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
      include: {
        subscriptions: true,
        _count: {
          select: {
            users: { where: { status: 'ACTIVE' } },
            agents: true,
            conversations: true,
            documents: true,
            channels: true,
          },
        },
      },
    });

    logger.business('Subscription updated', {
      tenantId,
      oldPlan: tenant.plan,
      newPlan: plan,
      billingCycle,
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: { 
        tenant: updatedTenant,
        subscription,
      },
    });
  })
);

// Get billing history (admin only)
router.get('/billing', 
  requireTenant,
  authorize('ADMIN'),
  validatePagination,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { page, limit } = req.query;

    // Get subscription
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // For now, return mock billing history
    // In a real implementation, this would come from a billing service like Stripe
    const billingHistory = {
      subscription,
      invoices: [], // Would be populated from billing service
      paymentMethods: {}, // Would be populated from billing service
      nextBilling: {
        date: subscription.endDate,
        amount: getPlanPrice(subscription.plan, subscription.billingCycle),
        currency: 'USD',
      },
    };

    res.json({
      success: true,
      data: { billing: billingHistory },
    });
  })
);

// Generate API key (admin only)
router.post('/api-keys', 
  requireTenant,
  authorize('ADMIN'),
  validateBody(tenantSchemas.update),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { name, permissions, expiresAt } = req.body;

    // Generate API key
    const keyValue = `ak_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(keyValue).digest('hex');

    // Create API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash: hashedKey,
        permissions: permissions || ['read'],
        tenantId,
        createdBy: req.user!.id,
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    logger.security('API key created', {
      apiKeyId: apiKey.id,
      name,
      permissions,
      tenantId,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: { 
        apiKey,
        key: keyValue, // Only returned once
      },
    });
  })
);

// List API keys (admin only)
router.get('/api-keys', 
  requireTenant,
  authorize('ADMIN'),
  validatePagination,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { page, limit, status } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = { tenantId };
    if (status) where.status = status;

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          permissions: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
          lastUsedAt: true,
          userId: true,
        },
      }),
      prisma.apiKey.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        apiKeys,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

// Update API key (admin only)
router.put('/api-keys/:id', 
  requireTenant,
  authorize('ADMIN'),
  validateId,
  validateBody(tenantSchemas.update),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const updateData = req.body;

    // Check if API key exists and belongs to tenant
    const existingApiKey = await prisma.apiKey.findFirst({
      where: { 
        id,
        user: {
          tenantId,
        },
      },
    });

    if (!existingApiKey) {
      throw new NotFoundError('API key');
    }

    // Update API key
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    logger.security('API key updated', {
      apiKeyId: id,
      changes: Object.keys(updateData),
      tenantId,
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: { apiKey },
    });
  })
);

// Delete API key (admin only)
router.delete('/api-keys/:id', 
  requireTenant,
  authorize('ADMIN'),
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Check if API key exists and belongs to tenant
    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        id,
        user: {
          tenantId,
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundError('API key');
    }

    // Delete API key
    await prisma.apiKey.delete({
      where: { id },
    });

    logger.security('API key deleted', {
      apiKeyId: id,
      name: apiKey.name,
      tenantId,
      deletedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  })
);

// Get tenant activity log (admin only)
router.get('/activity', 
  requireTenant,
  authorize('ADMIN'),
  validatePagination,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { page, limit, type, userId } = req.query;

    // This would typically come from an audit log table
    // For now, we'll return recent activities from various tables
    const activities = await Promise.all([
      // Recent user activities
      prisma.user.findMany({
        where: { 
          tenantId,
          ...(userId && { id: userId as string }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      
      // Recent conversations
      prisma.conversation.findMany({
        where: { tenantId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          customerName: true,
          customerEmail: true,
          agent: {
            select: { id: true, name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    const [recentUsers, recentConversations] = activities;

    // Format activity data
    const activityLog = [
      ...recentUsers.map(user => ({
        type: 'user_activity',
        timestamp: user.lastLogin || user.updatedAt,
        description: `User ${user.firstName} ${user.lastName} last activity`,
        userId: user.id,
        metadata: { email: user.email },
      })),
      ...recentConversations.map(conv => ({
        type: 'conversation_activity',
        timestamp: conv.updatedAt,
        description: `Conversation ${conv.status}`,
        conversationId: conv.id,
        metadata: { 
          customer: conv.customerName || conv.customerEmail,
          agent: conv.agent?.name,
        },
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: { 
        activities: activityLog.slice(0, Number(limit)),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: activityLog.length,
          pages: Math.ceil(activityLog.length / Number(limit)),
        },
      },
    });
  })
);

// Delete tenant (super admin only - dangerous operation)
router.delete('/:id', 
  authorize('SUPER_ADMIN'), // Only super admins can delete tenants
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { confirm } = req.body;

    // Require explicit confirmation
    if (confirm !== 'DELETE_TENANT') {
      throw new ValidationError('Confirmation required. Set confirm: "DELETE_TENANT" in request body.');
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            agents: true,
            conversations: true,
            documents: true,
            channels: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    try {
      // Start transaction for safe deletion
      await prisma.$transaction(async (tx) => {
        // Delete all related data in correct order
        await tx.message.deleteMany({ where: { conversation: { tenantId: id } } });
        await tx.conversation.deleteMany({ where: { tenantId: id } });
        await tx.document.deleteMany({ where: { tenantId: id } });
        await tx.channel.deleteMany({ where: { tenantId: id } });
        await tx.agent.deleteMany({ where: { tenantId: id } });
        await tx.apiKey.deleteMany({ where: { user: { tenantId: id } } });
        await tx.subscription.deleteMany({ where: { tenantId: id } });
        await tx.user.deleteMany({ where: { tenantId: id } });
        
        // Finally delete the tenant
        await tx.tenant.delete({ where: { id } });
      });

      // Clean up ChromaDB collection
      try {
        await chromadb.deleteCollection(id);
        logger.info(`ChromaDB collection deleted for tenant ${id}`);
      } catch (chromaError) {
        logger.warn(`Failed to delete ChromaDB collection for tenant ${id}:`, chromaError);
        // Don't fail the entire operation if ChromaDB cleanup fails
      }

      logger.security('Tenant deleted', {
        tenantId: id,
        tenantName: tenant.name,
        deletedBy: req.user!.id,
        counts: tenant._count,
      });

      res.json({
        success: true,
        message: 'Tenant and all associated data deleted successfully',
        data: {
          deletedTenant: {
            id: tenant.id,
            name: tenant.name,
            counts: tenant._count,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to delete tenant:', {
        tenantId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalServerError('Failed to delete tenant and associated data');
    }
  })
);

// Cleanup tenant collections (admin only)
router.post('/cleanup-collections', 
  requireTenant,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;

    try {
      // Get document count before cleanup
      const documentCount = await chromadb.getDocumentCount(tenantId);
      
      // Delete and recreate the collection to clean up orphaned data
      await chromadb.deleteCollection(tenantId);
      await chromadb.getTenantCollection(tenantId); // This will recreate it
      
      logger.info(`Collection cleanup completed for tenant ${tenantId}`, {
        documentsRemoved: documentCount,
      });

      res.json({
        success: true,
        message: 'Collection cleanup completed successfully',
        data: {
          documentsRemoved: documentCount,
        },
      });
    } catch (error) {
      logger.error(`Collection cleanup failed for tenant ${tenantId}:`, error);
      throw new InternalServerError('Failed to cleanup collection');
    }
  })
);

// Helper function to get plan pricing
function getPlanPrice(plan: string, billingCycle: string): number {
  const prices = {
    FREE: { MONTHLY: 0, YEARLY: 0 },
    BASIC: { MONTHLY: 29, YEARLY: 290 },
    PRO: { MONTHLY: 99, YEARLY: 990 },
    ENTERPRISE: { MONTHLY: 299, YEARLY: 2990 },
  };

  return prices[plan as keyof typeof prices]?.[billingCycle as keyof typeof prices.FREE] || 0;
}

export default router;