import express from 'express';
import { z } from 'zod';
import apiKeyService from '../services/apiKeyService';
import { authenticate, requireTenant } from '../middleware/auth';
import { API_PERMISSIONS, ApiPermission } from '../middleware/apiKeyAuth';
import { validateQuery, validateBody } from '../middleware/validation';
import logger from '../utils/logger';

const router = express.Router();

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

const listApiKeysSchema = z.object({
  userId: z.string().optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)).optional(),
});

const statsQuerySchema = z.object({
  days: z.string().transform(val => Math.min(parseInt(val) || 30, 365)).optional(),
});

/**
 * POST /api/api-keys
 * Generate a new API key
 */
router.post('/',
  authenticate,
  requireTenant,
  validateBody(createApiKeySchema),
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const { name, permissions, rateLimit, expiresAt } = req.body;
      const tenantId = req.tenant.id;
      const userId = req.user.id;
      
      // Validate permissions
      const validPermissions = Object.values(API_PERMISSIONS);
      const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p as ApiPermission));
      
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          error: 'Invalid permissions',
          message: `Invalid permissions: ${invalidPermissions.join(', ')}`,
          validPermissions,
        });
      }
      
      const result = await apiKeyService.generateApiKey(tenantId, userId, {
        name,
        permissions,
        rateLimit,
        expiresAt,
      });
      
      res.status(201).json({
        message: 'API key generated successfully',
        apiKey: {
          id: result.apiKey.id,
          name: result.apiKey.name,
          keyPrefix: result.apiKey.keyPrefix,
          permissions: result.apiKey.permissions,
          rateLimit: result.apiKey.rateLimit,
          expiresAt: result.apiKey.expiresAt,
          createdAt: result.apiKey.createdAt,
        },
        key: result.plainKey, // Only returned once
        warning: 'Store this key securely. It will not be shown again.',
      });
    } catch (error) {
      logger.error('Failed to generate API key', { error, tenantId: req.tenant?.id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate API key',
      });
    }
  }
);

/**
 * GET /api/api-keys
 * List API keys for the tenant
 */
router.get('/',
  authenticate,
  requireTenant,
  validateQuery(listApiKeysSchema),
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const { userId, page = 1, limit = 20 } = req.query;
      const tenantId = req.tenant.id;
      
      const apiKeys = await apiKeyService.listApiKeys(tenantId, userId);
      
      // Paginate results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedKeys = apiKeys.slice(startIndex, endIndex);
      
      // Remove sensitive data
      const sanitizedKeys = paginatedKeys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        usageCount: key.usageCount,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      }));
      
      res.json({
        apiKeys: sanitizedKeys,
        pagination: {
          page,
          limit,
          total: apiKeys.length,
          totalPages: Math.ceil(apiKeys.length / limit),
          hasNext: endIndex < apiKeys.length,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('Failed to list API keys', { error, tenantId: req.tenant?.id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list API keys',
      });
    }
  }
);

/**
 * GET /api/api-keys/:id
 * Get API key details
 */
router.get('/:id',
  authenticate,
  requireTenant,
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const { id } = req.params;
      const tenantId = req.tenant.id;
      
      const apiKeys = await apiKeyService.listApiKeys(tenantId);
      const apiKey = apiKeys.find(key => key.id === id);
      
      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your tenant',
        });
      }
      
      res.json({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        usageCount: apiKey.usageCount,
        lastUsedAt: apiKey.lastUsedAt,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      });
    } catch (error) {
      logger.error('Failed to get API key', { error, apiKeyId: req.params.id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get API key details',
      });
    }
  }
);

/**
 * PUT /api/api-keys/:id
 * Update API key
 */
router.put('/:id',
  authenticate,
  requireTenant,
  validateBody(updateApiKeySchema),
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const { id } = req.params;
      const tenantId = req.tenant.id;
      const updates = req.body;
      
      // Verify API key belongs to tenant
      const apiKeys = await apiKeyService.listApiKeys(tenantId);
      const apiKey = apiKeys.find(key => key.id === id);
      
      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your tenant',
        });
      }
      
      // Validate permissions if provided
      if (updates.permissions) {
        const validPermissions = Object.values(API_PERMISSIONS);
        const invalidPermissions = updates.permissions.filter((p: string) => !validPermissions.includes(p as ApiPermission));
        
        if (invalidPermissions.length > 0) {
          return res.status(400).json({
            error: 'Invalid permissions',
            message: `Invalid permissions: ${invalidPermissions.join(', ')}`,
            validPermissions,
          });
        }
      }
      
      const updatedKey = await apiKeyService.updateApiKey(id, updates);
      
      res.json({
        message: 'API key updated successfully',
        apiKey: {
          id: updatedKey.id,
          name: updatedKey.name,
          keyPrefix: updatedKey.keyPrefix,
          permissions: updatedKey.permissions,
          rateLimit: updatedKey.rateLimit,
          usageCount: updatedKey.usageCount,
          lastUsedAt: updatedKey.lastUsedAt,
          expiresAt: updatedKey.expiresAt,
          isActive: updatedKey.isActive,
          createdAt: updatedKey.createdAt,
          updatedAt: updatedKey.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to update API key', { error, apiKeyId: req.params.id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update API key',
      });
    }
  }
);

/**
 * DELETE /api/api-keys/:id
 * Delete (deactivate) API key
 */
router.delete('/:id',
  authenticate,
  requireTenant,
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const { id } = req.params;
      const tenantId = req.tenant.id;
      
      // Verify API key belongs to tenant
      const apiKeys = await apiKeyService.listApiKeys(tenantId);
      const apiKey = apiKeys.find(key => key.id === id);
      
      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your tenant',
        });
      }
      
      await apiKeyService.deleteApiKey(id);
      
      res.json({
        message: 'API key deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete API key', { error, apiKeyId: req.params.id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete API key',
      });
    }
  }
);

/**
 * GET /api/api-keys/:id/stats
 * Get API key usage statistics
 */
router.get('/:id/stats',
  authenticate,
  requireTenant,
  validateQuery(statsQuerySchema),
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const { id } = req.params;
      const { days = 30 } = req.query;
      const tenantId = req.tenant.id;
      
      // Verify API key belongs to tenant
      const apiKeys = await apiKeyService.listApiKeys(tenantId);
      const apiKey = apiKeys.find(key => key.id === id);
      
      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your tenant',
        });
      }
      
      const stats = await apiKeyService.getApiKeyStats(id, days);
      
      res.json({
        apiKeyId: id,
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
        stats,
      });
    } catch (error) {
      logger.error('Failed to get API key stats', { error, apiKeyId: req.params.id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get API key statistics',
      });
    }
  }
);

/**
 * GET /api/api-keys/permissions
 * Get available permissions
 */
router.get('/permissions',
  authenticate,
  requireTenant,
  // @ts-ignore
  async (req: any, res): Promise<any> => {
    try {
      const permissions = Object.entries(API_PERMISSIONS).map(([key, value]) => ({
        key,
        value,
        description: getPermissionDescription(value),
      }));
      
      res.json({
        permissions,
      });
    } catch (error) {
      logger.error('Failed to get permissions', { error });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get available permissions',
      });
    }
  }
);

/**
 * Helper function to get permission descriptions
 */
function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    'conversations:read': 'Read conversations and their details',
    'conversations:write': 'Create and update conversations',
    'conversations:delete': 'Delete conversations',
    'messages:read': 'Read messages within conversations',
    'messages:write': 'Send and update messages',
    'messages:delete': 'Delete messages',
    'analytics:read': 'Access analytics and reporting data',
    'webhooks:read': 'Read webhook configurations',
    'webhooks:write': 'Create and update webhook configurations',
    'users:read': 'Read user information',
    'users:write': 'Create and update user information',
    'admin:read': 'Read administrative data',
    'admin:write': 'Perform administrative actions',
    '*': 'Full access to all resources and actions',
  };
  
  return descriptions[permission] || 'Unknown permission';
}

export default router;