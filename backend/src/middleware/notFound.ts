import { Request, Response } from 'express';
import logger from '../utils/logger';

export const notFound = (req: Request, res: Response): void => {
  const message = `Route ${req.originalUrl} not found`;
  
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.status(404).json({
    success: false,
    error: {
      message,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
};

export default notFound;