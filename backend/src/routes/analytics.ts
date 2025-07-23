import * as express from 'express';
import { Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { analyticsService, AnalyticsTimeRange } from '../services/analyticsService';
import logger from '../utils/logger';
import { validateQuery, analyticsSchemas } from '../utils/validation';
import * as Joi from 'joi';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas
const timeRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  period: Joi.string().valid('hour', 'day', 'week', 'month', 'year').default('day'),
});

const agentAnalyticsSchema = Joi.object({
  agentId: Joi.string().optional(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  period: Joi.string().valid('hour', 'day', 'week', 'month', 'year').default('day'),
});

const reportSchema = Joi.object({
  includeAgents: Joi.boolean().default(true),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  period: Joi.string().valid('hour', 'day', 'week', 'month', 'year').default('day'),
});

/**
 * @route GET /api/analytics/conversations
 * @desc Get conversation analytics for a tenant
 * @access Private
 */
router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Validate query parameters
    const { error, value } = timeRangeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details,
      });
    }

    const timeRange: AnalyticsTimeRange = {
      startDate: value.startDate,
      endDate: value.endDate,
      period: value.period,
    };

    const analytics = await analyticsService.getConversationAnalytics(tenantId, timeRange);

    logger.info('Conversation analytics retrieved', {
      tenantId,
      timeRange,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      data: analytics,
      timeRange,
    });
  } catch (error) {
    logger.error('Failed to get conversation analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to retrieve conversation analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/analytics/agents
 * @desc Get agent analytics for a tenant
 * @access Private
 */
router.get('/agents', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Validate query parameters
    const { error, value } = agentAnalyticsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details,
      });
    }

    const timeRange: AnalyticsTimeRange = {
      startDate: value.startDate,
      endDate: value.endDate,
      period: value.period,
    };

    const analytics = await analyticsService.getAgentAnalytics(
      tenantId,
      value.agentId,
      timeRange
    );

    logger.info('Agent analytics retrieved', {
      tenantId,
      agentId: value.agentId,
      timeRange,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      data: analytics,
      timeRange,
    });
  } catch (error) {
    logger.error('Failed to get agent analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to retrieve agent analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/analytics/agents/:agentId
 * @desc Get analytics for a specific agent
 * @access Private
 */
router.get('/agents/:agentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { agentId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Validate query parameters
    const { error, value } = timeRangeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details,
      });
    }

    const timeRange: AnalyticsTimeRange = {
      startDate: value.startDate,
      endDate: value.endDate,
      period: value.period,
    };

    const analytics = await analyticsService.getAgentAnalytics(tenantId, agentId, timeRange);

    if (analytics.length === 0) {
      return res.status(404).json({ error: 'Agent not found or no data available' });
    }

    logger.info('Specific agent analytics retrieved', {
      tenantId,
      agentId,
      timeRange,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      data: analytics[0], // Return single agent data
      timeRange,
    });
  } catch (error) {
    logger.error('Failed to get specific agent analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      agentId: req.params.agentId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to retrieve agent analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard metrics for a tenant
 * @access Private
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const metrics = await analyticsService.getDashboardMetrics(tenantId);

    logger.info('Dashboard metrics retrieved', {
      tenantId,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      data: metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get dashboard metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to retrieve dashboard metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /api/analytics/metrics/update
 * @desc Trigger real-time metrics update
 * @access Private
 */
router.post('/metrics/update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { event } = req.body;
    const validEvents = ['conversation_created', 'message_sent', 'conversation_completed', 'agent_response'];
    
    if (!event || !validEvents.includes(event)) {
      return res.status(400).json({
        error: 'Invalid event type',
        validEvents,
      });
    }

    await analyticsService.updateRealTimeMetrics(tenantId, event);

    logger.info('Real-time metrics updated', {
      tenantId,
      event,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      message: 'Metrics updated successfully',
      event,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to update real-time metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to update metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/analytics/report
 * @desc Generate comprehensive analytics report
 * @access Private
 */
router.get('/report', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Validate query parameters
    const { error, value } = reportSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details,
      });
    }

    const timeRange: AnalyticsTimeRange = {
      startDate: value.startDate,
      endDate: value.endDate,
      period: value.period,
    };

    const report = await analyticsService.generateAnalyticsReport(
      tenantId,
      timeRange,
      value.includeAgents
    );

    logger.info('Analytics report generated', {
      tenantId,
      timeRange,
      includeAgents: value.includeAgents,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      data: report,
      timeRange,
    });
  } catch (error) {
    logger.error('Failed to generate analytics report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to generate analytics report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/analytics/export
 * @desc Export analytics data in various formats
 * @access Private
 */
router.get('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const { format = 'json' } = req.query;
    const validFormats = ['json', 'csv'];
    
    if (!validFormats.includes(format as string)) {
      return res.status(400).json({
        error: 'Invalid export format',
        validFormats,
      });
    }

    // Validate time range parameters
    const { error, value } = timeRangeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details,
      });
    }

    const timeRange: AnalyticsTimeRange = {
      startDate: value.startDate,
      endDate: value.endDate,
      period: value.period,
    };

    const report = await analyticsService.generateAnalyticsReport(tenantId, timeRange, true);

    if (format === 'csv') {
      // Convert to CSV format (simplified implementation)
      const csvData = [
        'Metric,Value',
        `Total Conversations,${report.conversations.totalConversations}`,
        `Active Conversations,${report.conversations.activeConversations}`,
        `Completed Conversations,${report.conversations.completedConversations}`,
        `Average Response Time,${report.conversations.averageResponseTime}`,
        `Total Messages,${report.conversations.messageVolume.total}`,
        `User Messages,${report.conversations.messageVolume.userMessages}`,
        `Agent Messages,${report.conversations.messageVolume.agentMessages}`,
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${tenantId}-${Date.now()}.csv"`);
      return res.send(csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${tenantId}-${Date.now()}.json"`);
      return res.json(report);
    }

    logger.info('Analytics data exported', {
      tenantId,
      format,
      timeRange,
      userId: req.user?.id,
    });
  } catch (error) {
    logger.error('Failed to export analytics data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(500).json({
      error: 'Failed to export analytics data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/analytics/health
 * @desc Check analytics service health
 * @access Private
 */
router.get('/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Simple health check - try to get dashboard metrics
    const startTime = Date.now();
    await analyticsService.getDashboardMetrics(tenantId);
    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      timestamp: new Date(),
      services: {
        analytics: 'operational',
        cache: 'operational',
        database: 'operational',
      },
    });
  } catch (error) {
    logger.error('Analytics health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
    });

    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    });
  }
});

export default router;