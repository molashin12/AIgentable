import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest, commonValidations } from '../middleware/securityMiddleware';
import { monitoringService } from '../services/monitoringService';
import { backupService } from '../services/backupService';
import { cachingService } from '../services/cachingService';
import { database } from '../config/database';
import { redis } from '../config/redis';
import logger from '../utils/logger';

const router = Router();

// Validation schemas
const createBackupSchema = z.object({
  type: z.enum(['full', 'incremental']).default('full'),
});

const restoreBackupSchema = z.object({
  backupId: z.string().min(1),
  components: z.object({
    database: z.boolean().default(true),
    redis: z.boolean().default(true),
    uploads: z.boolean().default(true),
    logs: z.boolean().default(false),
  }),
});

const exportDataSchema = z.object({
  format: z.enum(['json', 'csv', 'sql']).default('json'),
});

const resolveAlertSchema = z.object({
  alertId: z.string().min(1),
});

const cacheOperationSchema = z.object({
  key: z.string().min(1),
  value: z.any().optional(),
  ttl: z.number().positive().optional(),
});

// System health endpoint
router.get('/health', async (req, res) => {
  try {
    const healthSummary = monitoringService.getHealthSummary();
    const currentMetrics = monitoringService.getCurrentMetrics();
    
    res.json({
      status: healthSummary.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: healthSummary.services,
      alerts: healthSummary.alerts,
      metrics: currentMetrics ? {
        memory: {
          usage: currentMetrics.memory.percentage,
          used: currentMetrics.memory.used,
          total: currentMetrics.memory.total,
        },
        database: {
          status: currentMetrics.database.status,
          queryTime: currentMetrics.database.queryTime,
          connections: currentMetrics.database.connections,
        },
        redis: {
          status: currentMetrics.redis.status,
          connections: currentMetrics.redis.connections,
          memory: currentMetrics.redis.memory,
        },
        api: {
          requestsPerMinute: currentMetrics.api.requestsPerMinute,
          averageResponseTime: currentMetrics.api.averageResponseTime,
          errorRate: currentMetrics.api.errorRate,
        },
      } : null,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed system metrics (admin only)
router.get('/metrics',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const metrics = monitoringService.getMetricsHistory(limit);
      const cacheInfo = await cachingService.getCacheInfo();
      
      res.json({
        metrics,
        cache: cacheInfo,
        stats: cachingService.getStats(),
      });
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      res.status(500).json({
        error: 'Failed to retrieve system metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// System alerts (admin only)
router.get('/alerts',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const activeOnly = req.query.active === 'true';
      const limit = parseInt(req.query.limit as string) || 100;
      
      const alerts = activeOnly 
        ? monitoringService.getActiveAlerts()
        : monitoringService.getAllAlerts(limit);
      
      res.json({ alerts });
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      res.status(500).json({
        error: 'Failed to retrieve alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Resolve alert (admin only)
router.post('/alerts/resolve',
  authenticate,
  authorize('admin'),
  validateRequest([
    z.object({ body: resolveAlertSchema }).parse,
  ]),
  async (req, res) => {
    try {
      const { alertId } = req.body;
      const resolved = await monitoringService.resolveAlert(alertId);
      
      if (resolved) {
        res.json({ message: 'Alert resolved successfully' });
      } else {
        res.status(404).json({ error: 'Alert not found' });
      }
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
      res.status(500).json({
        error: 'Failed to resolve alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Create backup (admin only)
router.post('/backup',
  authenticate,
  authorize('admin'),
  validateRequest([
    z.object({ body: createBackupSchema }).parse,
  ]),
  async (req, res) => {
    try {
      const { type } = req.body;
      const backup = await backupService.createBackup(type);
      
      res.json({
        message: 'Backup created successfully',
        backup: {
          id: backup.id,
          type: backup.type,
          timestamp: backup.timestamp,
          size: backup.size,
          duration: backup.duration,
          status: backup.status,
        },
      });
    } catch (error) {
      logger.error('Backup creation failed:', error);
      res.status(500).json({
        error: 'Backup creation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get backup history (admin only)
router.get('/backup/history',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const backups = backupService.getBackupHistory();
      const storageUsage = await backupService.getStorageUsage();
      
      res.json({
        backups,
        storage: storageUsage,
      });
    } catch (error) {
      logger.error('Failed to get backup history:', error);
      res.status(500).json({
        error: 'Failed to retrieve backup history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Restore from backup (admin only)
router.post('/backup/restore',
  authenticate,
  authorize('admin'),
  validateRequest([
    z.object({ body: restoreBackupSchema }).parse,
  ]),
  async (req, res) => {
    try {
      const { backupId, components } = req.body;
      
      await backupService.restoreFromBackup({
        backupId,
        components,
      });
      
      res.json({ message: 'Restore completed successfully' });
    } catch (error) {
      logger.error('Restore failed:', error);
      res.status(500).json({
        error: 'Restore failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Verify backup integrity (admin only)
router.post('/backup/:backupId/verify',
  authenticate,
  authorize('admin'),
  validateRequest([commonValidations.uuid]),
  async (req, res) => {
    try {
      const { backupId } = req.params;
      const isValid = await backupService.verifyBackup(backupId);
      
      res.json({
        backupId,
        valid: isValid,
        message: isValid ? 'Backup integrity verified' : 'Backup integrity check failed',
      });
    } catch (error) {
      logger.error('Backup verification failed:', error);
      res.status(500).json({
        error: 'Backup verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Export data (admin only)
router.post('/export',
  authenticate,
  authorize('admin'),
  validateRequest([
    z.object({ body: exportDataSchema }).parse,
  ]),
  async (req, res) => {
    try {
      const { format } = req.body;
      const exportPath = await backupService.exportData(format);
      
      res.json({
        message: 'Data export completed successfully',
        exportPath,
        format,
      });
    } catch (error) {
      logger.error('Data export failed:', error);
      res.status(500).json({
        error: 'Data export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Cache management endpoints (admin only)
router.get('/cache/stats',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const stats = cachingService.getStats();
      const info = await cachingService.getCacheInfo();
      
      res.json({
        stats,
        info,
      });
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Clear cache by pattern (admin only)
router.delete('/cache',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const pattern = req.query.pattern as string || '*';
      const cleared = await cachingService.clearByPattern(pattern);
      
      res.json({
        message: `Cleared ${cleared} cache entries`,
        pattern,
        cleared,
      });
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Reset cache statistics (admin only)
router.post('/cache/reset-stats',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      cachingService.resetStats();
      res.json({ message: 'Cache statistics reset successfully' });
    } catch (error) {
      logger.error('Failed to reset cache stats:', error);
      res.status(500).json({
        error: 'Failed to reset cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Database operations (admin only)
router.get('/database/stats',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const client = database.getClient();
      
      // Get database statistics
      const stats = await client.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      ` as any[];
      
      // Get database size
      const sizeResult = await client.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      ` as any[];
      
      // Get connection info
      const connections = await client.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
      ` as any[];
      
      res.json({
        tables: stats,
        size: sizeResult[0]?.size,
        connections: connections[0],
      });
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve database statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Run database maintenance (admin only)
router.post('/database/maintenance',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const client = database.getClient();
      
      // Run VACUUM ANALYZE on all tables
      await client.$executeRaw`VACUUM ANALYZE`;
      
      logger.info('Database maintenance completed');
      res.json({ message: 'Database maintenance completed successfully' });
    } catch (error) {
      logger.error('Database maintenance failed:', error);
      res.status(500).json({
        error: 'Database maintenance failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// System logs (admin only)
router.get('/logs',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const level = req.query.level as string || 'info';
      const limit = parseInt(req.query.limit as string) || 100;
      const since = req.query.since as string;
      
      // This is a simplified log retrieval
      // In production, you'd integrate with your logging system
      const logs = {
        message: 'Log retrieval not fully implemented',
        note: 'Integrate with your logging system (e.g., Winston, ELK stack)',
        parameters: { level, limit, since },
      };
      
      res.json({ logs });
    } catch (error) {
      logger.error('Failed to retrieve logs:', error);
      res.status(500).json({
        error: 'Failed to retrieve logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// System configuration (admin only)
router.get('/config',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      // Return safe configuration (no secrets)
      const safeConfig = {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        features: {
          monitoring: true,
          backup: true,
          caching: true,
          security: true,
        },
      };
      
      res.json({ config: safeConfig });
    } catch (error) {
      logger.error('Failed to get system config:', error);
      res.status(500).json({
        error: 'Failed to retrieve system configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;