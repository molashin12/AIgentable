import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { config } from '../config/config';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = 500, message } = error;

  // Log error details
  logger.error('Error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId,
    },
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (error.name === 'UnauthorizedError' || error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  } else if (error.name === 'TooManyRequestsError') {
    statusCode = 429;
    message = 'Too Many Requests';
  }

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  };

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error.message;
  }

  // Include request ID if available
  if ((req as any).requestId) {
    errorResponse.error.requestId = (req as any).requestId;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error handler wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
  
  // Graceful shutdown
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Graceful shutdown
  process.exit(1);
});

export default errorHandler;