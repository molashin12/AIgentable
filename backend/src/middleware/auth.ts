import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/config';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    tenant?: {
      id: string;
      name: string;
      plan: string;
      status: string;
    };
  };
  tenantId?: string;
}

class AuthService {
  // Generate JWT tokens
  public generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
    const accessToken = jwt.sign(
      payload,
      config.jwtSecret as string,
      {
        expiresIn: config.jwtExpiresIn,
        issuer: 'aigentable',
        audience: 'aigentable-api',
      } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      payload,
      config.jwtRefreshSecret as string,
      {
        expiresIn: config.jwtRefreshExpiresIn,
        issuer: 'aigentable',
        audience: 'aigentable-api',
      } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  // Verify JWT token
  public verifyToken(token: string, isRefreshToken: boolean = false): JWTPayload {
    try {
      const secret = isRefreshToken ? config.jwtRefreshSecret : config.jwtSecret;
      return jwt.verify(token, secret, {
        issuer: 'aigentable',
        audience: 'aigentable-api',
      }) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid token');
      }
      throw new ApiError(401, 'Token verification failed');
    }
  }

  // Hash password
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  // Compare password
  public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Store refresh token in Redis
  public async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    const ttl = 30 * 24 * 60 * 60; // 30 days in seconds
    await redis.set(key, refreshToken, ttl);
  }

  // Validate refresh token from Redis
  public async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const key = `refresh_token:${userId}`;
    const storedToken = await redis.get(key);
    return storedToken === refreshToken;
  }

  // Revoke refresh token
  public async revokeRefreshToken(userId: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    await redis.del(key);
  }

  // Blacklist access token
  public async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = this.verifyToken(token);
      const key = `blacklist:${token}`;
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.set(key, '1', ttl);
      }
    } catch (error) {
      // Token is already invalid, no need to blacklist
    }
  }

  // Check if token is blacklisted
  public async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:${token}`;
    return await redis.exists(key);
  }
}

export const authService = new AuthService();

// Authentication middleware
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Access token required');
    }

    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    if (await authService.isTokenBlacklisted(token)) {
      throw new ApiError(401, 'Token has been revoked');
    }

    // Verify token
    const payload = authService.verifyToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(401, 'User account is not active');
    }

    if (user.tenant?.status !== 'ACTIVE') {
      throw new ApiError(401, 'Tenant account is not active');
    }

    if (!user.tenantId) {
      throw new ApiError(401, 'User has no associated tenant');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant,
    };

    logger.debug('User authenticated', {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.security('Authentication failed', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Authentication failed',
      });
    }
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticate(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.security('Authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
      });
      
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

// Tenant isolation middleware
export const requireTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.tenantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context required',
    });
    return;
  }

  // Set tenantId on request for easy access
  req.tenantId = req.user.tenantId;

  next();
};

// API key authentication middleware
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new ApiError(401, 'API key required');
    }

    // Validate API key using service
    const apiKeyService = (await import('../services/apiKeyService')).default;
    const apiKeyRecord = await apiKeyService.validateApiKey(apiKey);

    if (!apiKeyRecord) {
      throw new ApiError(401, 'Invalid API key');
    }

    if (!apiKeyRecord.isActive) {
      throw new ApiError(401, 'API key is not active');
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      throw new ApiError(401, 'API key has expired');
    }

    // Get user with tenant info
    const user = await prisma.user.findUnique({
      where: { id: apiKeyRecord.userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
            status: true,
          },
        },
      },
    }) as any;

    if (!user) {
      throw new ApiError(401, 'User not found for API key');
    }

    if (user.tenant?.status !== 'ACTIVE') {
      throw new ApiError(401, 'Tenant account is not active');
    }

    // Last used timestamp is already updated by validateApiKey

    // Attach tenant info to request
    req.user = {
      id: 'api-key',
      email: 'api@aigentable.com',
      firstName: 'API',
      lastName: 'User',
      role: 'API',
      tenantId: user.tenantId as string,
      tenant: user.tenant,
    };

    logger.debug('API key authenticated', {
      apiKeyId: apiKeyRecord.id,
      tenantId: user.tenantId,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.security('API key authentication failed', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'API key authentication failed',
      });
    }
  }
};

// Rate limiting by user
export const rateLimitByUser = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    const key = `rate_limit:user:${req.user.id}`;
    const current = await redis.incrementRateLimit(key, windowMs);

    if (current > maxRequests) {
      logger.security('Rate limit exceeded', {
        userId: req.user.id,
        ip: req.ip,
        requests: current,
        limit: maxRequests,
      });
      
      res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000),
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString(),
    });

    next();
  };
};