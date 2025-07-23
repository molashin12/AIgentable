import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { cachingService } from './cachingService';

interface QueryStats {
  query: string;
  duration: number;
  timestamp: Date;
  cached: boolean;
}

interface DatabaseStats {
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: QueryStats[];
  cacheHitRate: number;
  connectionPoolStats: {
    active: number;
    idle: number;
    total: number;
  };
}

interface OptimizationConfig {
  slowQueryThreshold: number; // milliseconds
  cacheDefaultTTL: number; // seconds
  enableQueryLogging: boolean;
  maxSlowQueries: number;
}

class DatabaseOptimizationService {
  private queryStats: QueryStats[] = [];
  private config: OptimizationConfig;
  private totalQueries = 0;
  private totalQueryTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.config = {
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
      cacheDefaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
      enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
      maxSlowQueries: parseInt(process.env.MAX_SLOW_QUERIES || '100'),
    };
  }

  /**
   * Wrap a database query with performance monitoring and caching
   */
  async optimizedQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: {
      ttl?: number;
      skipCache?: boolean;
      tags?: string[];
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const { ttl = this.config.cacheDefaultTTL, skipCache = false, tags = [] } = options;

    // Try cache first
    if (!skipCache) {
      try {
        const cached = await cachingService.get<T>(queryKey);
        if (cached !== null) {
          this.recordQuery(queryKey, Date.now() - startTime, true);
          this.cacheHits++;
          return cached;
        }
      } catch (error) {
        logger.warn('Cache retrieval failed:', error);
      }
    }

    // Execute query
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      this.recordQuery(queryKey, duration, false);
      this.cacheMisses++;

      // Cache the result
      if (!skipCache && result !== null && result !== undefined) {
        try {
          await cachingService.set(queryKey, result, { ttl });
        } catch (error) {
          logger.warn('Cache storage failed:', error);
        }
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQuery(queryKey, duration, false);
      throw error;
    }
  }

  /**
   * Record query statistics
   */
  private recordQuery(query: string, duration: number, cached: boolean): void {
    this.totalQueries++;
    this.totalQueryTime += duration;

    const queryStats: QueryStats = {
      query,
      duration,
      timestamp: new Date(),
      cached,
    };

    if (this.config.enableQueryLogging) {
      if (duration > this.config.slowQueryThreshold) {
        logger.warn(`Slow query detected: ${query} (${duration}ms)`);
        
        // Keep only the most recent slow queries
        this.queryStats.push(queryStats);
        if (this.queryStats.length > this.config.maxSlowQueries) {
          this.queryStats.shift();
        }
      }
    }
  }

  /**
   * Get database performance statistics
   */
  getStats(): DatabaseStats {
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) * 100 : 0;

    return {
      totalQueries: this.totalQueries,
      averageQueryTime: this.totalQueries > 0 ? this.totalQueryTime / this.totalQueries : 0,
      slowQueries: this.queryStats.slice(-10), // Last 10 slow queries
      cacheHitRate,
      connectionPoolStats: {
        active: 0, // Prisma doesn't expose this directly
        idle: 0,
        total: 0,
      },
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.queryStats = [];
    this.totalQueries = 0;
    this.totalQueryTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('Database optimization statistics reset');
  }

  /**
   * Analyze and suggest optimizations
   */
  async analyzePerformance(): Promise<{
    suggestions: string[];
    criticalIssues: string[];
  }> {
    const stats = this.getStats();
    const suggestions: string[] = [];
    const criticalIssues: string[] = [];

    // Check average query time
    if (stats.averageQueryTime > 500) {
      criticalIssues.push(`High average query time: ${stats.averageQueryTime.toFixed(2)}ms`);
      suggestions.push('Consider adding database indexes for frequently queried fields');
    }

    // Check cache hit rate
    if (stats.cacheHitRate < 50) {
      suggestions.push(`Low cache hit rate: ${stats.cacheHitRate.toFixed(2)}%. Consider increasing cache TTL or improving cache keys`);
    }

    // Check for frequent slow queries
    const slowQueryPatterns = new Map<string, number>();
    stats.slowQueries.forEach(query => {
      const pattern = this.extractQueryPattern(query.query);
      slowQueryPatterns.set(pattern, (slowQueryPatterns.get(pattern) || 0) + 1);
    });

    slowQueryPatterns.forEach((count, pattern) => {
      if (count > 5) {
        criticalIssues.push(`Frequent slow query pattern: ${pattern} (${count} occurrences)`);
        suggestions.push(`Optimize query pattern: ${pattern}`);
      }
    });

    return { suggestions, criticalIssues };
  }

  /**
   * Extract query pattern for analysis
   */
  private extractQueryPattern(query: string): string {
    // Simple pattern extraction - remove specific values
    return query
      .replace(/['"][^'"]*['"]/g, '"VALUE"')
      .replace(/\b\d+\b/g, 'NUMBER')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Perform database maintenance tasks
   */
  async performMaintenance(): Promise<{
    tasksCompleted: string[];
    errors: string[];
  }> {
    const tasksCompleted: string[] = [];
    const errors: string[] = [];

    try {
      // Clear expired cache entries
      await cachingService.clearByPattern('expired:*');
      tasksCompleted.push('Cleared expired cache entries');
    } catch (error) {
      errors.push(`Failed to clear expired cache: ${error}`);
    }

    try {
      // Reset query statistics if they're getting too large
      if (this.queryStats.length > this.config.maxSlowQueries * 2) {
        this.queryStats = this.queryStats.slice(-this.config.maxSlowQueries);
        tasksCompleted.push('Trimmed query statistics');
      }
    } catch (error) {
      errors.push(`Failed to trim query statistics: ${error}`);
    }

    logger.info('Database maintenance completed', {
      tasksCompleted: tasksCompleted.length,
      errors: errors.length,
    });

    return { tasksCompleted, errors };
  }

  /**
   * Get configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Database optimization configuration updated', newConfig);
  }
}

export const databaseOptimizationService = new DatabaseOptimizationService();
export { DatabaseOptimizationService, QueryStats, DatabaseStats, OptimizationConfig };