import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config/config';

// Ensure logs directory exists
const logsDir = path.dirname(config.logFile);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` | Meta: ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create transports
const transports: winston.transport[] = [
  // File transport for all logs
  new winston.transports.File({
    filename: config.logFile,
    level: config.logLevel,
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  }),
  
  // Separate file for errors
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  }),
];

// Add console transport for development
if (config.nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat,
    })
  );
} else {
  // In production, only log warnings and errors to console
  transports.push(
    new winston.transports.Console({
      level: 'warn',
      format: consoleFormat,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test',
});

// Create custom logger with extended methods
const customLogger = logger as any;

// Add request logging helper
customLogger.request = (req: any, res: any, responseTime?: number) => {
  const { method, url, ip, headers } = req;
  const { statusCode } = res;
  
  const logData = {
    method,
    url,
    ip,
    statusCode,
    userAgent: headers['user-agent'],
    responseTime: responseTime ? `${responseTime}ms` : undefined,
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
  };
  
  if (statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

// Add database logging helper
customLogger.database = (operation: string, table: string, duration?: number, error?: any) => {
  const logData = {
    operation,
    table,
    duration: duration ? `${duration}ms` : undefined,
  };
  
  if (error) {
    logger.error(`Database ${operation} failed`, { ...logData, error: error.message });
  } else {
    logger.debug(`Database ${operation}`, logData);
  }
};

// Add security logging helper
customLogger.security = (event: string, details: any, level: 'info' | 'warn' | 'error' = 'warn') => {
  logger[level](`Security Event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Add performance logging helper
customLogger.performance = (operation: string, duration: number, metadata?: any) => {
  const logData = {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  };
  
  if (duration > 1000) {
    logger.warn('Slow Operation', logData);
  } else {
    logger.debug('Performance', logData);
  }
};

// Add business logic logging helper
customLogger.business = (event: string, details: any) => {
  logger.info(`Business Event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Add integration logging helper
customLogger.integration = (service: string, operation: string, success: boolean, details?: any) => {
  const logData = {
    service,
    operation,
    success,
    timestamp: new Date().toISOString(),
    ...details,
  };
  
  if (success) {
    logger.info(`Integration Success: ${service}`, logData);
  } else {
    logger.error(`Integration Failed: ${service}`, logData);
  }
};

// Add AI/ML logging helper
customLogger.ai = (operation: string, model: string, tokens?: number, cost?: number, details?: any) => {
  logger.info(`AI Operation: ${operation}`, {
    operation,
    model,
    tokens,
    cost,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Add webhook logging helper
customLogger.webhook = (source: string, event: string, success: boolean, details?: any) => {
  const logData = {
    source,
    event,
    success,
    timestamp: new Date().toISOString(),
    ...details,
  };
  
  if (success) {
    logger.info(`Webhook Received: ${source}`, logData);
  } else {
    logger.error(`Webhook Failed: ${source}`, logData);
  }
};

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: logFormat,
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: logFormat,
  })
);

// Create a stream for Morgan HTTP logging
(logger as any).stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Export logger with extended functionality
export default customLogger;

// Export specific log levels for convenience
export const logInfo = logger.info.bind(logger);
export const logError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logDebug = logger.debug.bind(logger);

// Export helpers
export const logRequest = customLogger.request;
export const logDatabase = customLogger.database;
export const logSecurity = customLogger.security;
export const logPerformance = customLogger.performance;
export const logBusiness = customLogger.business;
export const logIntegration = customLogger.integration;
export const logAI = customLogger.ai;
export const logWebhook = customLogger.webhook;

// Performance timer utility
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private metadata?: any;

  constructor(operation: string, metadata?: any) {
    this.operation = operation;
    this.metadata = metadata;
    this.startTime = Date.now();
  }

  end(): number {
    const duration = Date.now() - this.startTime;
    customLogger.performance(this.operation, duration, this.metadata);
    return duration;
  }
}

// Create performance timer
export const createTimer = (operation: string, metadata?: any): PerformanceTimer => {
  return new PerformanceTimer(operation, metadata);
};

// Log startup information
logger.info('Logger initialized', {
  logLevel: config.logLevel,
  logFile: config.logFile,
  nodeEnv: config.nodeEnv,
  timestamp: new Date().toISOString(),
});