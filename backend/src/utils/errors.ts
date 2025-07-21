import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { config } from '../config/config';

// Custom error class for API errors
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error class
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// Authentication error class
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

// Authorization error class
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

// Not found error class
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

// Conflict error class
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

// Rate limit error class
export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(429, message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

// Internal server error class
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'INTERNAL_SERVER_ERROR', undefined, false);
    this.name = 'InternalServerError';
  }
}

// Service unavailable error class
export class ServiceUnavailableError extends ApiError {
  constructor(service: string) {
    super(503, `${service} service is currently unavailable`, 'SERVICE_UNAVAILABLE_ERROR');
    this.name = 'ServiceUnavailableError';
  }
}

// Database error class
export class DatabaseError extends ApiError {
  constructor(message: string, details?: any) {
    super(500, message, 'DATABASE_ERROR', details, false);
    this.name = 'DatabaseError';
  }
}

// External API error class
export class ExternalApiError extends ApiError {
  constructor(service: string, message: string, statusCode: number = 502) {
    super(statusCode, `${service} API error: ${message}`, 'EXTERNAL_API_ERROR');
    this.name = 'ExternalApiError';
  }
}

// File upload error class
export class FileUploadError extends ApiError {
  constructor(message: string) {
    super(400, message, 'FILE_UPLOAD_ERROR');
    this.name = 'FileUploadError';
  }
}

// Tenant error class
export class TenantError extends ApiError {
  constructor(message: string) {
    super(400, message, 'TENANT_ERROR');
    this.name = 'TenantError';
  }
}

// AI/ML error class
export class AIError extends ApiError {
  constructor(message: string, details?: any) {
    super(500, message, 'AI_ERROR', details);
    this.name = 'AIError';
  }
}

// Webhook error class
export class WebhookError extends ApiError {
  constructor(message: string, details?: any) {
    super(400, message, 'WEBHOOK_ERROR', details);
    this.name = 'WebhookError';
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  path: string;
  requestId?: string;
  stack?: string;
}

// Error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let apiError: ApiError;

  // Convert known errors to ApiError
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error.name === 'ValidationError') {
    apiError = new ValidationError(error.message);
  } else if (error.name === 'CastError') {
    apiError = new ValidationError('Invalid ID format');
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if ((error as any).code === 11000) {
      apiError = new ConflictError('Duplicate entry');
    } else {
      apiError = new DatabaseError('Database operation failed');
    }
  } else if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    switch (prismaError.code) {
      case 'P2002':
        apiError = new ConflictError('Unique constraint violation');
        break;
      case 'P2025':
        apiError = new NotFoundError('Record');
        break;
      case 'P2003':
        apiError = new ValidationError('Foreign key constraint failed');
        break;
      default:
        apiError = new DatabaseError('Database operation failed', prismaError.meta);
    }
  } else if (error.name === 'PrismaClientValidationError') {
    apiError = new ValidationError('Invalid data provided');
  } else if (error.name === 'JsonWebTokenError') {
    apiError = new AuthenticationError('Invalid token');
  } else if (error.name === 'TokenExpiredError') {
    apiError = new AuthenticationError('Token expired');
  } else if (error.name === 'MulterError') {
    const multerError = error as any;
    if (multerError.code === 'LIMIT_FILE_SIZE') {
      apiError = new FileUploadError('File size too large');
    } else if (multerError.code === 'LIMIT_FILE_COUNT') {
      apiError = new FileUploadError('Too many files');
    } else {
      apiError = new FileUploadError('File upload failed');
    }
  } else {
    // Unknown error - log it and return generic error
    logger.error('Unhandled error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    apiError = new InternalServerError();
  }

  // Log operational errors as warnings, non-operational as errors
  if (apiError.isOperational) {
    logger.warn('Operational error:', {
      name: apiError.name,
      message: apiError.message,
      statusCode: apiError.statusCode,
      code: apiError.code,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId,
    });
  } else {
    logger.error('Non-operational error:', {
      name: apiError.name,
      message: apiError.message,
      statusCode: apiError.statusCode,
      code: apiError.code,
      stack: apiError.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId,
    });
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    message: apiError.message,
    code: apiError.code,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.headers['x-request-id'] as string,
  };

  // Include details in development or for validation errors
  if (config.nodeEnv === 'development' || apiError instanceof ValidationError) {
    errorResponse.details = apiError.details;
  }

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    errorResponse.stack = apiError.stack;
  }

  // Send error response
  res.status(apiError.statusCode).json(errorResponse);
};

// 404 handler middleware
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError('Endpoint');
  
  logger.warn('Endpoint not found:', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(404).json({
    success: false,
    message: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error factory functions
export const createValidationError = (message: string, details?: any): ValidationError => {
  return new ValidationError(message, details);
};

export const createNotFoundError = (resource: string): NotFoundError => {
  return new NotFoundError(resource);
};

export const createConflictError = (message: string): ConflictError => {
  return new ConflictError(message);
};

export const createAuthenticationError = (message?: string): AuthenticationError => {
  return new AuthenticationError(message);
};

export const createAuthorizationError = (message?: string): AuthorizationError => {
  return new AuthorizationError(message);
};

export const createRateLimitError = (message?: string): RateLimitError => {
  return new RateLimitError(message);
};

export const createInternalServerError = (message?: string): InternalServerError => {
  return new InternalServerError(message);
};

export const createServiceUnavailableError = (service: string): ServiceUnavailableError => {
  return new ServiceUnavailableError(service);
};

export const createDatabaseError = (message: string, details?: any): DatabaseError => {
  return new DatabaseError(message, details);
};

export const createExternalApiError = (service: string, message: string, statusCode?: number): ExternalApiError => {
  return new ExternalApiError(service, message, statusCode);
};

export const createFileUploadError = (message: string): FileUploadError => {
  return new FileUploadError(message);
};

export const createTenantError = (message: string): TenantError => {
  return new TenantError(message);
};

export const createAIError = (message: string, details?: any): AIError => {
  return new AIError(message, details);
};

export const createWebhookError = (message: string, details?: any): WebhookError => {
  return new WebhookError(message, details);
};

// Global error handlers for uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
  
  // Graceful shutdown
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
  });
  
  // Graceful shutdown
  process.exit(1);
});