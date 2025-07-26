import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { database } from '../config/database';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import { config } from '../config/config';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    queryTime: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  redis: {
    connections: number;
    memory: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private requestMetrics: Map<string, { count: number; totalTime: number; errors: number }> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Start monitoring system metrics
   */
  public startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn('Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Keep only last 1000 metrics (about 16 hours at 1-minute intervals)
        if (this.metrics.length > 1000) {
          this.metrics = this.metrics.slice(-1000);
        }

        // Check for alerts
        await this.checkAlerts(metrics);

        // Store metrics in Redis for real-time access
        await redis.set('system:metrics:latest', JSON.stringify(metrics), 300); // 5 minutes TTL

        this.emit('metrics', metrics);
      } catch (error) {
        logger.error('Error collecting metrics:', error);
      }
    }, intervalMs);

    logger.info('System monitoring started', { intervalMs });
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    logger.info('System monitoring stopped');
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date();

    // CPU and Memory metrics
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const loadAverage = require('os').loadavg();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();

    // Database metrics
    const dbHealth = await database.healthCheck();
    const dbConnections = await this.getDatabaseConnections();

    // Redis metrics
    const redisHealth = await redis.healthCheck();
    const redisInfo = await this.getRedisInfo();

    // API metrics
    const apiMetrics = this.getApiMetrics();

    return {
      timestamp,
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage,
      },
      memory: {
        used: memUsage.heapUsed,
        free: freeMemory,
        total: totalMemory,
        percentage: ((totalMemory - freeMemory) / totalMemory) * 100,
      },
      database: {
        connections: dbConnections,
        queryTime: dbHealth.latency || 0,
        status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      },
      redis: {
        connections: redisInfo.connections,
        memory: redisInfo.memory,
        status: redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      },
      api: apiMetrics,
    };
  }

  /**
   * Get database connection count
   */
  private async getDatabaseConnections(): Promise<number> {
    try {
      const result = await database.getClient().$queryRaw`
        SELECT count(*) as connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      ` as any[];
      return parseInt(result[0]?.connections || '0');
    } catch (error) {
      logger.error('Error getting database connections:', error);
      return 0;
    }
  }

  /**
   * Get Redis information
   */
  private async getRedisInfo(): Promise<{ connections: number; memory: number }> {
    try {
      const info = await redis.getClient().info('clients');
      const memInfo = await redis.getClient().info('memory');
      
      const connections = parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0');
      const memory = parseInt(memInfo.match(/used_memory:(\d+)/)?.[1] || '0');
      
      return { connections, memory };
    } catch (error) {
      logger.error('Error getting Redis info:', error);
      return { connections: 0, memory: 0 };
    }
  }

  /**
   * Get API metrics
   */
  private getApiMetrics(): { requestsPerMinute: number; averageResponseTime: number; errorRate: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    let totalRequests = 0;
    let totalTime = 0;
    let totalErrors = 0;

    for (const [endpoint, metrics] of this.requestMetrics.entries()) {
      totalRequests += metrics.count;
      totalTime += metrics.totalTime;
      totalErrors += metrics.errors;
    }

    return {
      requestsPerMinute: totalRequests,
      averageResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
    };
  }

  /**
   * Record API request metrics
   */
  public recordApiRequest(endpoint: string, responseTime: number, isError: boolean = false): void {
    const metrics = this.requestMetrics.get(endpoint) || { count: 0, totalTime: 0, errors: 0 };
    
    metrics.count++;
    metrics.totalTime += responseTime;
    if (isError) {
      metrics.errors++;
    }

    this.requestMetrics.set(endpoint, metrics);

    // Reset metrics every minute
    setTimeout(() => {
      this.requestMetrics.delete(endpoint);
    }, 60000);
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    // Skip alerts in development environment
    if (config.nodeEnv === 'development') {
      return;
    }
    
    const alerts: Alert[] = [];

    // Memory usage alert
    if (metrics.memory.percentage > 90) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'critical',
        title: 'High Memory Usage',
        message: `Memory usage is at ${metrics.memory.percentage.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
        metadata: { memoryPercentage: metrics.memory.percentage },
      });
    } else if (metrics.memory.percentage > 80) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'warning',
        title: 'Elevated Memory Usage',
        message: `Memory usage is at ${metrics.memory.percentage.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
        metadata: { memoryPercentage: metrics.memory.percentage },
      });
    }

    // Database response time alert
    if (metrics.database.queryTime > 1000) {
      alerts.push({
        id: `db-latency-${Date.now()}`,
        type: 'warning',
        title: 'Slow Database Response',
        message: `Database query time is ${metrics.database.queryTime}ms`,
        timestamp: new Date(),
        resolved: false,
        metadata: { queryTime: metrics.database.queryTime },
      });
    }

    // API error rate alert
    if (metrics.api.errorRate > 10) {
      alerts.push({
        id: `api-errors-${Date.now()}`,
        type: 'critical',
        title: 'High API Error Rate',
        message: `API error rate is ${metrics.api.errorRate.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
        metadata: { errorRate: metrics.api.errorRate },
      });
    }

    // Service health alerts
    if (metrics.database.status !== 'healthy') {
      alerts.push({
        id: `db-health-${Date.now()}`,
        type: 'critical',
        title: 'Database Health Issue',
        message: `Database status: ${metrics.database.status}`,
        timestamp: new Date(),
        resolved: false,
        metadata: { status: metrics.database.status },
      });
    }

    if (metrics.redis.status !== 'healthy') {
      alerts.push({
        id: `redis-health-${Date.now()}`,
        type: 'critical',
        title: 'Redis Health Issue',
        message: `Redis status: ${metrics.redis.status}`,
        timestamp: new Date(),
        resolved: false,
        metadata: { status: metrics.redis.status },
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Process and store alert
   */
  private async processAlert(alert: Alert): Promise<void> {
    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Store in Redis for real-time access
    await redis.getClient().lpush('system:alerts', JSON.stringify(alert));
    await redis.getClient().ltrim('system:alerts', 0, 999); // Keep last 1000 alerts

    // Log alert
    logger[alert.type === 'critical' ? 'error' : 'warn']('System Alert', {
      id: alert.id,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
    });

    // Emit alert event
    this.emit('alert', alert);

    // Send notifications for critical alerts
    if (alert.type === 'critical') {
      await this.sendCriticalAlertNotification(alert);
    }
  }

  /**
   * Send critical alert notification
   */
  private async sendCriticalAlertNotification(alert: Alert): Promise<void> {
    try {
      // Here you would integrate with your notification system
      // For example: Slack, email, SMS, etc.
      logger.error('CRITICAL ALERT - Immediate attention required', {
        alert: alert.title,
        message: alert.message,
        timestamp: alert.timestamp,
      });

      // You could also integrate with external services like:
      // - Slack webhooks
      // - Email notifications
      // - SMS alerts
      // - PagerDuty
    } catch (error) {
      logger.error('Failed to send critical alert notification:', error);
    }
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit: number = 100): SystemMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  public getAllAlerts(limit: number = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Resolve alert
   */
  public async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      
      // Update in Redis
      const alertsJson = await redis.getClient().lrange('system:alerts', 0, -1);
      const updatedAlerts = alertsJson.map((alertStr: string) => {
        const alertObj = JSON.parse(alertStr);
        if (alertObj.id === alertId) {
          alertObj.resolved = true;
        }
        return JSON.stringify(alertObj);
      });
      
      await redis.getClient().del('system:alerts');
      if (updatedAlerts.length > 0) {
        await redis.getClient().lpush('system:alerts', ...updatedAlerts);
      }

      logger.info('Alert resolved', { alertId, title: alert.title });
      return true;
    }
    return false;
  }

  /**
   * Get system health summary
   */
  public getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, string>;
    alerts: number;
    uptime: number;
  } {
    const currentMetrics = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (currentMetrics) {
      const criticalAlerts = activeAlerts.filter(a => a.type === 'critical');
      const warningAlerts = activeAlerts.filter(a => a.type === 'warning');
      
      if (criticalAlerts.length > 0 || 
          currentMetrics.database.status === 'unhealthy' || 
          currentMetrics.redis.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (warningAlerts.length > 0 || 
                 currentMetrics.memory.percentage > 80 || 
                 currentMetrics.api.errorRate > 5) {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      services: {
        database: currentMetrics?.database.status || 'unknown',
        redis: currentMetrics?.redis.status || 'unknown',
        api: (currentMetrics?.api.errorRate ?? 0) < 5 ? 'healthy' : 'degraded',
      },
      alerts: activeAlerts.length,
      uptime: process.uptime(),
    };
  }
}

export const monitoringService = MonitoringService.getInstance();
export default monitoringService;