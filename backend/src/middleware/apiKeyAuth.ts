import { Request, Response, NextFunction } from 'express';
import apiKeyService from '../services/apiKeyService';
import logger from '../utils/logger';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    tenantId: string;
    userId: string;
    permissions: string[];
    rateLimit: number;
  };
}

/**
 * Middleware to authenticate API key requests
 */
export const authenticateApiKey = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Missing or invalid authorization header',
        message: 'Please provide a valid API key in the Authorization header as "Bearer <api_key>"',
      });
      return;
    }
    
    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate API key
    const validatedKey = await apiKeyService.validateApiKey(apiKey);
    
    if (!validatedKey) {
      res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has expired',
      });
      return;
    }
    
    // Check rate limit
    const rateLimitInfo = await apiKeyService.checkRateLimit(
      validatedKey.id,
      validatedKey.rateLimit
    );
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
      'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
      'X-RateLimit-Reset': rateLimitInfo.resetTime.toString(),
    });
    
    if (!rateLimitInfo.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Rate limit of ${rateLimitInfo.limit} requests per hour exceeded`,
        retryAfter: rateLimitInfo.retryAfter,
      });
      return;
    }
    
    // Attach API key info to request
    req.apiKey = {
      id: validatedKey.id,
      tenantId: validatedKey.tenantId,
      userId: validatedKey.userId,
      permissions: validatedKey.permissions,
      rateLimit: validatedKey.rateLimit,
    };
    
    // Track usage (async, don't wait)
    const startTime = Date.now();
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      apiKeyService.trackUsage(
        validatedKey.id,
        req.path,
        req.method,
        res.statusCode,
        responseTime,
        req.get('User-Agent'),
        req.ip
      ).catch(error => {
        logger.error('Failed to track API key usage', { error });
      });
    });
    
    next();
  } catch (error) {
    logger.error('API key authentication error', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while authenticating the API key',
    });
  }
};

/**
 * Middleware to check if API key has required permissions
 */
export const requirePermissions = (requiredPermissions: string[]) => {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'API key authentication is required for this endpoint',
      });
      return;
    }
    
    const hasPermission = requiredPermissions.every(permission => 
      req.apiKey!.permissions.includes(permission) || 
      req.apiKey!.permissions.includes('*')
    );
    
    if (!hasPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This API key does not have the required permissions: ${requiredPermissions.join(', ')}`,
        required: requiredPermissions,
        current: req.apiKey.permissions,
      });
      return;
    }
    
    next();
  };
};

/**
 * Middleware to set tenant context from API key
 */
export const setTenantFromApiKey = (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
  if (req.apiKey) {
    // Set tenant context for downstream middleware
    (req as any).tenant = { id: req.apiKey.tenantId };
    (req as any).user = { id: req.apiKey.userId };
  }
  next();
};

/**
 * Available permissions for API keys
 */
export const API_PERMISSIONS = {
  // Conversation permissions
  CONVERSATIONS_READ: 'conversations:read',
  CONVERSATIONS_WRITE: 'conversations:write',
  CONVERSATIONS_DELETE: 'conversations:delete',
  
  // Message permissions
  MESSAGES_READ: 'messages:read',
  MESSAGES_WRITE: 'messages:write',
  MESSAGES_DELETE: 'messages:delete',
  
  // Analytics permissions
  ANALYTICS_READ: 'analytics:read',
  
  // Webhook permissions
  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_WRITE: 'webhooks:write',
  
  // User permissions
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  
  // Admin permissions
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
  
  // All permissions
  ALL: '*',
} as const;

export type ApiPermission = typeof API_PERMISSIONS[keyof typeof API_PERMISSIONS];