import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireTenant, authorize, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, apiKeySchemas, validateId, validatePagination } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireTenant);
router.use(authorize('ADMIN')); // Only admins can manage API keys

// Get all API keys
router.get('/', 
  validatePagination,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { status, search } = req.query;
    const tenantId = req.user!.tenantId;

    const skip = (Number(page) - 1) * Number(limit);
    
    // Build where clause - filter by user's tenant through user relation
    const where: any = {
      user: {
        tenantId: tenantId
      }
    };
    if (status) where.isActive = status === 'ACTIVE';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy as string]: sortOrder },
        select: {
          id: true,
          name: true,
          permissions: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          lastUsed: true,
          userId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
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

// Get API key by ID
router.get('/:id', 
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        lastUsed: true,
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundError('API key');
    }

    res.json({
      success: true,
      data: { apiKey },
    });
  })
);

// Create new API key
router.post('/', 
  validateBody(apiKeySchemas.create),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, permissions, expiresAt, description } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    // Check if API key name already exists for this tenant
    const existingApiKey = await prisma.apiKey.findFirst({
      where: {
        name,
        user: {
          tenantId: tenantId
        }
      },
    });

    if (existingApiKey) {
      throw new ConflictError('API key with this name already exists');
    }

    // Generate API key
    const keyValue = `ak_${crypto.randomBytes(32).toString('hex')}`;

    // Create API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key: keyValue,
        permissions: permissions || ['read'],
        isActive: true,
        userId: userId,
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    logger.security('API key created', {
      apiKeyId: apiKey.id,
      name,
      permissions,
      tenantId,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: { 
        apiKey,
        key: keyValue, // Only returned once during creation
        warning: 'Please save this key securely. It will not be shown again.',
      },
    });
  })
);

// Update API key
router.put('/:id', 
  validateId,
  validateBody(apiKeySchemas.update),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const updateData = req.body;
    const userId = req.user!.id;

    // Check if API key exists and belongs to tenant
    const existingApiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
      },
    });

    if (!existingApiKey) {
      throw new NotFoundError('API key');
    }

    // Check if name is being changed and if it's already taken
    if (updateData.name && updateData.name !== existingApiKey.name) {
      const nameExists = await prisma.apiKey.findFirst({
        where: {
          name: updateData.name,
          user: {
            tenantId: tenantId
          },
          id: { not: id },
        },
      });
      if (nameExists) {
        throw new ConflictError('API key name already exists');
      }
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
        updatedAt: true,
        lastUsed: true,
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    logger.security('API key updated', {
      apiKeyId: id,
      changes: Object.keys(updateData),
      tenantId,
      updatedBy: userId,
    });

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: { apiKey },
    });
  })
);

// Delete API key
router.delete('/:id', 
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    // Check if API key exists and belongs to tenant
    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
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
      deletedBy: userId,
    });

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  })
);

// Regenerate API key
router.post('/:id/regenerate', 
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    // Check if API key exists and belongs to tenant
    const existingApiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
      },
    });

    if (!existingApiKey) {
      throw new NotFoundError('API key');
    }

    // Generate new API key
    const keyValue = `ak_${crypto.randomBytes(32).toString('hex')}`;

    // Update API key with new key
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        key: keyValue,
        updatedAt: new Date(),
        lastUsed: null, // Reset usage tracking
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    logger.security('API key regenerated', {
      apiKeyId: id,
      name: existingApiKey.name,
      tenantId,
      regeneratedBy: userId,
    });

    res.json({
      success: true,
      message: 'API key regenerated successfully',
      data: { 
        apiKey,
        key: keyValue, // Only returned once
        warning: 'Please save this key securely. The old key is now invalid.',
      },
    });
  })
);

// Update API key status (activate/deactivate)
router.patch('/:id/status', 
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      throw new ValidationError('Invalid status. Must be ACTIVE or INACTIVE');
    }

    // Check if API key exists and belongs to tenant
    const existingApiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
      },
    });

    if (!existingApiKey) {
      throw new NotFoundError('API key');
    }

    // Update status
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        isActive: status === 'ACTIVE',
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        lastUsed: true,
        userId: true,
      },
    });

    logger.security('API key status changed', {
      apiKeyId: id,
      oldStatus: existingApiKey.isActive ? 'ACTIVE' : 'INACTIVE',
      newStatus: status,
      tenantId,
      changedBy: userId,
    });

    res.json({
      success: true,
      message: `API key ${status.toLowerCase()} successfully`,
      data: { apiKey },
    });
  })
);

// Get API key usage statistics
router.get('/:id/usage', 
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { period = '30d' } = req.query;
    const tenantId = req.user!.tenantId;

    // Check if API key exists and belongs to tenant
    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
      },
      select: {
        id: true,
        name: true,
        lastUsed: true,
        createdAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundError('API key');
    }

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

    // In a real implementation, you would track API usage in a separate table
    // For now, we'll return basic usage information
    const usage = {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
      },
      period,
      totalUsage: 0, // Would be tracked in separate usage table
      lastUsed: apiKey.lastUsed,
      createdAt: apiKey.createdAt,
      // Mock data for demonstration
      periodUsage: 0,
      dailyUsage: [], // Would contain daily usage statistics
      topEndpoints: [], // Would contain most used endpoints
      errorRate: 0, // Would contain error rate statistics
    };

    res.json({
      success: true,
      data: { usage },
    });
  })
);

// Test API key (validate without incrementing usage)
router.post('/:id/test', 
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Check if API key exists and belongs to tenant
    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        id, 
        user: {
          tenantId: tenantId
        }
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        expiresAt: true,
        permissions: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundError('API key');
    }

    // Check if API key is valid
    const now = new Date();
    const isValid = apiKey.isActive && 
                   (!apiKey.expiresAt || apiKey.expiresAt > now);

    const testResult = {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
      },
      isValid,
      status: apiKey.isActive ? 'ACTIVE' : 'INACTIVE',
      expiresAt: apiKey.expiresAt,
      permissions: apiKey.permissions,
      issues: [] as string[],
    };

    // Add issues if any
    if (!apiKey.isActive) {
      testResult.issues.push('API key is INACTIVE');
    }
    if (apiKey.expiresAt && apiKey.expiresAt <= now) {
      testResult.issues.push('API key has expired');
    }

    logger.security('API key tested', {
      apiKeyId: id,
      isValid,
      tenantId,
      testedBy: req.user!.id,
    });

    res.json({
      success: true,
      data: { test: testResult },
    });
  })
);

// Get API key permissions info
router.get('/permissions/info', 
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const availablePermissions = {
      read: {
        name: 'Read',
        description: 'Read access to resources',
        endpoints: ['GET /api/*'],
      },
      write: {
        name: 'Write',
        description: 'Create and update resources',
        endpoints: ['POST /api/*', 'PUT /api/*', 'PATCH /api/*'],
      },
      delete: {
        name: 'Delete',
        description: 'Delete resources',
        endpoints: ['DELETE /api/*'],
      },
      admin: {
        name: 'Admin',
        description: 'Full administrative access',
        endpoints: ['ALL /api/*'],
      },
    };

    res.json({
      success: true,
      data: { permissions: availablePermissions },
    });
  })
);

export default router;