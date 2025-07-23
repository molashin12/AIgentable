import express from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  ValidationError,
  NotFoundError,
} from '../utils/errors';
import logger from '../utils/logger';
import searchService from '../services/searchService';

const router = express.Router();

// Apply authentication and tenant middleware to all routes
router.use(authenticate);
router.use(requireTenant);

// Validation schemas
const searchQuerySchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortField: z.string().default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  
  // Date filters
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  
  // Status filters
  status: z.string().optional(),
  priority: z.string().optional(),
  
  // User filters
  agentIds: z.string().optional(),
  customerIds: z.string().optional(),
  
  // Channel filters
  channels: z.string().optional(),
  
  // Conversation filters
  hasUnreadMessages: z.coerce.boolean().optional(),
  isAssigned: z.coerce.boolean().optional(),
  tags: z.string().optional(),
  
  // Message filters
  messageTypes: z.string().optional(),
  hasAttachments: z.coerce.boolean().optional(),
  
  // Sentiment filters
  sentiment: z.string().optional(),
});

const searchAnalyticsSchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

/**
 * @route GET /api/v1/search/conversations
 * @desc Search conversations with full-text search and filtering
 * @access Private
 */
router.get('/conversations', 
  validateQuery(searchQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const {
      query,
      page,
      limit,
      sortField,
      sortDirection,
      dateFrom,
      dateTo,
      status,
      priority,
      agentIds,
      customerIds,
      channels,
      hasUnreadMessages,
      isAssigned,
      tags,
      sentiment,
    } = req.query;

    // Parse array parameters
    const parseArrayParam = (param: string | undefined): string[] | undefined => {
      if (!param) return undefined;
      return param.split(',').map(item => item.trim()).filter(Boolean);
    };

    // Parse boolean parameters
    const parseBooleanParam = (param: any): boolean | undefined => {
      if (param === undefined || param === null) return undefined;
      if (typeof param === 'boolean') return param;
      if (typeof param === 'string') {
        return param.toLowerCase() === 'true';
      }
      return undefined;
    };

    const searchQuery = {
      query: query as string,
      filters: {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        status: parseArrayParam(status as string),
        priority: parseArrayParam(priority as string),
        agentIds: parseArrayParam(agentIds as string),
        customerIds: parseArrayParam(customerIds as string),
        channels: parseArrayParam(channels as string),
        hasUnreadMessages: parseBooleanParam(hasUnreadMessages),
        isAssigned: parseBooleanParam(isAssigned),
        tags: parseArrayParam(tags as string),
        sentiment: parseArrayParam(sentiment as string),
      },
      sort: {
        field: sortField as string,
        direction: sortDirection as 'asc' | 'desc',
      },
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    };

    const result = await searchService.searchConversations(tenantId, searchQuery);

    logger.info('Conversations search completed', {
      tenantId,
      query: query || 'no query',
      total: result.total,
      searchTime: result.searchTime,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/search/messages
 * @desc Search messages with full-text search and filtering
 * @access Private
 */
router.get('/messages',
  validateQuery(searchQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const {
      query,
      page,
      limit,
      sortField,
      sortDirection,
      dateFrom,
      dateTo,
      messageTypes,
      hasAttachments,
      sentiment,
    } = req.query;

    // Parse array parameters
    const parseArrayParam = (param: string | undefined): string[] | undefined => {
      if (!param) return undefined;
      return param.split(',').map(item => item.trim()).filter(Boolean);
    };

    // Parse boolean parameters
    const parseBooleanParam = (param: any): boolean | undefined => {
      if (param === undefined || param === null) return undefined;
      if (typeof param === 'boolean') return param;
      if (typeof param === 'string') {
        return param.toLowerCase() === 'true';
      }
      return undefined;
    };

    const searchQuery = {
      query: query as string,
      filters: {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        messageTypes: parseArrayParam(messageTypes as string),
        hasAttachments: parseBooleanParam(hasAttachments),
        sentiment: parseArrayParam(sentiment as string),
      },
      sort: {
        field: sortField as string,
        direction: sortDirection as 'asc' | 'desc',
      },
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    };

    const result = await searchService.searchMessages(tenantId, searchQuery);

    logger.info('Messages search completed', {
      tenantId,
      query: query || 'no query',
      total: result.total,
      searchTime: result.searchTime,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/search/analytics
 * @desc Get search analytics and statistics
 * @access Private
 */
router.get('/analytics',
  validateQuery(searchAnalyticsSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { days } = req.query;

    const analytics = await searchService.getSearchAnalytics(tenantId, Number(days) || 30);

    logger.info('Search analytics retrieved', {
      tenantId,
      days,
      totalSearches: analytics.totalSearches,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: analytics,
    });
  })
);

/**
 * @route GET /api/v1/search/suggestions
 * @desc Get search suggestions based on query
 * @access Private
 */
router.get('/suggestions',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { query, type = 'all' } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      throw new ValidationError('Query must be at least 2 characters long');
    }

    const suggestions = await searchService.getSearchSuggestions(
      tenantId,
      query as string,
      type as string
    );

    res.json({
      success: true,
      data: {
        query,
        suggestions,
      },
    });
  })
);

/**
 * @route POST /api/v1/search/save
 * @desc Save a search query for later use
 * @access Private
 */
const saveSearchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  searchQuery: z.object({
    query: z.string().optional(),
    filters: z.record(z.any()).optional(),
    sort: z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    }).optional(),
  }),
  type: z.enum(['conversations', 'messages']),
  isPublic: z.boolean().default(false),
});

router.post('/save',
  validateBody(saveSearchSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const { name, description, searchQuery, type, isPublic } = req.body;

    const savedSearch = await searchService.saveSearch({
      tenantId,
      userId,
      name,
      description,
      searchQuery,
      type,
      isPublic,
    });

    logger.info('Search query saved', {
      tenantId,
      userId,
      searchId: savedSearch.id,
      name,
      type,
    });

    res.status(201).json({
      success: true,
      data: savedSearch,
    });
  })
);

/**
 * @route GET /api/v1/search/saved
 * @desc Get saved search queries
 * @access Private
 */
router.get('/saved',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const { type, includePublic = 'true' } = req.query;

    const savedSearches = await searchService.getSavedSearches({
      tenantId,
      userId,
      type: type as string,
      includePublic: includePublic === 'true',
    });

    res.json({
      success: true,
      data: savedSearches,
    });
  })
);

/**
 * @route DELETE /api/v1/search/saved/:id
 * @desc Delete a saved search query
 * @access Private
 */
router.delete('/saved/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const { id } = req.params;

    await searchService.deleteSavedSearch({
      id,
      tenantId,
      userId,
    });

    logger.info('Saved search deleted', {
      tenantId,
      userId,
      searchId: id,
    });

    res.json({
      success: true,
      message: 'Saved search deleted successfully',
    });
  })
);

/**
 * @route GET /api/v1/search/facets
 * @desc Get search facets for filtering
 * @access Private
 */
router.get('/facets',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { type = 'conversations' } = req.query;

    const facets = await searchService.getSearchFacets(tenantId, type as string);

    res.json({
      success: true,
      data: facets,
    });
  })
);

export default router;