import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.code,
        }));
        
        logger.warn('Body validation failed', {
          errors,
          url: req.url,
          method: req.method,
          ip: req.ip,
        });
        
        res.status(400).json({
          error: 'Validation failed',
          message: 'Request body validation failed',
          details: errors,
        });
        return;
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Validation processing failed',
      });
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.code,
        }));
        
        logger.warn('Query validation failed', {
          errors,
          url: req.url,
          method: req.method,
          ip: req.ip,
        });
        
        res.status(400).json({
          error: 'Validation failed',
          message: 'Query parameters validation failed',
          details: errors,
        });
        return;
      }
      
      req.query = result.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Validation processing failed',
      });
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.code,
        }));
        
        logger.warn('Params validation failed', {
          errors,
          url: req.url,
          method: req.method,
          ip: req.ip,
        });
        
        res.status(400).json({
          error: 'Validation failed',
          message: 'URL parameters validation failed',
          details: errors,
        });
        return;
      }
      
      req.params = result.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Validation processing failed',
      });
    }
  };
};