import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
const { body, validationResult, query, param } = require('express-validator');
import helmet from 'helmet';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import { config } from '../config/config';

// Enhanced rate limiting with Redis store
class RedisRateLimitStore {
  private prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; timeToExpire: number }> {
    const redisKey = `${this.prefix}:${key}`;
    const client = redis.getClient();
    
    const multi = client.multi();
    multi.incr(redisKey);
    multi.expire(redisKey, Math.ceil(this.windowMs / 1000));
    multi.ttl(redisKey);
    
    const results = await multi.exec();
    const totalHits = results?.[0]?.[1] as number || 0;
    const ttl = results?.[2]?.[1] as number || 0;
    
    return {
      totalHits,
      timeToExpire: ttl * 1000,
    };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await redis.getClient().decr(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    await redis.getClient().del(redisKey);
  }
}

// Advanced rate limiting configurations
export const createAdvancedRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  const store = new RedisRateLimitStore('rate_limit', options.windowMs);
  
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use user ID if authenticated, otherwise IP
      return (req as any).user?.id || req.ip;
    }),
    store: {
      incr: async (key: string) => {
        const result = await store.increment(key);
        return result;
      },
      decrement: async (key: string) => {
        await store.decrement(key);
      },
      resetKey: async (key: string) => {
        await store.resetKey(key);
      },
    } as any,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        userId: (req as any).user?.id,
      });
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      });
    },
  });
};

// Different rate limits for different endpoints
export const authRateLimit = createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const apiRateLimit = createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many API requests, please try again later.',
});

export const strictRateLimit = createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests to sensitive endpoint, please try again later.',
});

// Slow down middleware for gradual response delays
export const createSlowDown = (options: {
  windowMs: number;
  delayAfter: number;
  delayMs: number;
  maxDelayMs?: number;
}) => {
  return slowDown({
    windowMs: options.windowMs,
    delayAfter: options.delayAfter,
    delayMs: options.delayMs,
    maxDelayMs: options.maxDelayMs || 20000, // Max 20 seconds delay
    keyGenerator: (req: Request) => {
      return (req as any).user?.id || req.ip;
    },
  });
};

// Enhanced helmet configuration
export const enhancedHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
});

// Request validation middleware
export const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Request validation failed', {
        errors: errors.array(),
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    next();
  };
};

// Common validation rules
export const commonValidations = {
  email: body('email').isEmail().normalizeEmail(),
  password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  uuid: param('id').isUUID(),
  pagination: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  search: query('q').optional().isLength({ min: 1, max: 100 }).trim(),
};

// IP whitelist middleware
export const createIPWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const clientIP = req.ip;
    
    if (!allowedIPs.includes(clientIP || '')) {
      logger.warn('IP not in whitelist', {
        ip: clientIP,
        path: req.path,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource.',
      });
    }
    
    next();
  };
};

// Request size limiter
export const createRequestSizeLimiter = (maxSize: string) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logger.warn('Request size exceeded', {
          size: sizeInBytes,
          maxSize: maxSizeInBytes,
          path: req.path,
          ip: req.ip,
        });
        
        return res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds maximum allowed size of ${maxSize}.`,
        });
      }
    }
    
    next();
  };
};

// Helper function to parse size strings
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
}

// Suspicious activity detector
export const suspiciousActivityDetector = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const clientIP = req.ip;
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec\s*\(/i, // Command injection
    /eval\s*\(/i, // Code injection
  ];
  
  const requestString = `${req.url} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.error('Suspicious activity detected', {
        ip: clientIP,
        userAgent,
        path,
        pattern: pattern.toString(),
        request: requestString,
      });
      
      // Block the request
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Suspicious activity detected.',
      });
    }
  }
  
  // Check for bot-like behavior
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
  ];
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot) {
    // Apply stricter rate limiting for bots
    const botKey = `bot:${clientIP}`;
    const botRequests = await redis.getClient().incr(botKey);
    await redis.getClient().expire(botKey, 3600); // 1 hour window
    
    if (botRequests > 10) { // Max 10 requests per hour for bots
      logger.warn('Bot rate limit exceeded', {
        ip: clientIP,
        userAgent,
        requests: botRequests,
      });
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Bot rate limit exceeded.',
      });
    }
  }
  
  next();
};

// CORS configuration with dynamic origins
export const createDynamicCORS = (allowedOrigins: string[] | ((origin: string) => boolean)) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const origin = req.get('Origin');
    
    if (origin) {
      let isAllowed = false;
      
      if (Array.isArray(allowedOrigins)) {
        isAllowed = allowedOrigins.includes(origin);
      } else if (typeof allowedOrigins === 'function') {
        isAllowed = allowedOrigins(origin);
      }
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        logger.warn('CORS origin not allowed', {
          origin,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  };
};

// Request logging with security context
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request start
  logger.info('Request started', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): any {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString(),
    });
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// API key validation middleware
export const validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const apiKey = req.get('X-API-Key') || req.query.api_key as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required.',
    });
  }
  
  try {
    // Check if API key exists and is valid
    const keyData = await redis.get(`api_key:${apiKey}`);
    
    if (!keyData) {
      logger.warn('Invalid API key used', {
        apiKey: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key.',
      });
    }
    
    const keyInfo = JSON.parse(keyData);
    
    // Check if key is expired
    if (keyInfo.expiresAt && new Date(keyInfo.expiresAt) < new Date()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has expired.',
      });
    }
    
    // Check rate limits for this API key
    const rateLimitKey = `api_key_rate:${apiKey}`;
    const requests = await redis.getClient().incr(rateLimitKey);
    await redis.getClient().expire(rateLimitKey, 3600); // 1 hour window
    
    if (requests > (keyInfo.rateLimit || 1000)) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'API key rate limit exceeded.',
      });
    }
    
    // Add key info to request
    (req as any).apiKey = keyInfo;
    
    next();
  } catch (error) {
    logger.error('API key validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate API key.',
    });
  }
};

// Content type validation
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const contentType = req.get('Content-Type');
    
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      // Skip validation for empty body requests
      if (!req.body || Object.keys(req.body).length === 0) {
        return next();
      }
      
      if (!contentType || !allowedTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()))) {
        logger.warn('Invalid content type', {
          contentType,
          allowedTypes,
          path: req.path,
          ip: req.ip,
          method: req.method,
          hasBody: !!req.body,
        });
        
        return res.status(415).json({
          error: 'Unsupported Media Type',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
          received: contentType || 'none',
        });
      }
    }
    
    next();
  };
};