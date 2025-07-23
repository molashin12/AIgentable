import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Helper function to convert Prisma ApiKey to our ApiKey interface
function convertPrismaApiKey(prismaApiKey: any): ApiKey {
  return {
    ...prismaApiKey,
    lastUsedAt: prismaApiKey.lastUsedAt || undefined,
    expiresAt: prismaApiKey.expiresAt || undefined,
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  tenantId: string;
  userId: string;
  permissions: string[];
  rateLimit: number;
  usageCount: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

export interface ApiKeyStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
  }>;
}

export interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class ApiKeyService {
  private readonly KEY_PREFIX = 'ak_';
  private readonly RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
  private readonly DEFAULT_RATE_LIMIT = 1000;

  /**
   * Generate a new API key
   */
  async generateApiKey(
    tenantId: string,
    userId: string,
    request: CreateApiKeyRequest
  ): Promise<{ apiKey: ApiKey; plainKey: string }> {
    try {
      // Generate random key
      const randomBytes = crypto.randomBytes(32);
      const plainKey = `${this.KEY_PREFIX}${randomBytes.toString('hex')}`;
      const keyPrefix = plainKey.substring(0, 12); // First 12 characters for identification
      
      // Hash the key for storage
      const hashedKey = await bcrypt.hash(plainKey, 12);
      
      // Create API key record
      const prismaApiKey = await prisma.apiKey.create({
        data: {
          name: request.name,
          keyPrefix,
          hashedKey,
          tenantId,
          userId,
          permissions: request.permissions,
          rateLimit: request.rateLimit || this.DEFAULT_RATE_LIMIT,
          usageCount: 0,
          expiresAt: request.expiresAt,
          isActive: true,
        },
      });
      
      const apiKey = convertPrismaApiKey(prismaApiKey);
      
      logger.info('API key generated', {
        apiKeyId: apiKey.id,
        tenantId,
        userId,
        name: request.name,
        permissions: request.permissions,
      });
      
      return { apiKey, plainKey };
    } catch (error) {
      logger.error('Failed to generate API key', { error, tenantId, userId });
      throw new Error('Failed to generate API key');
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(plainKey: string): Promise<ApiKey | null> {
    try {
      if (!plainKey.startsWith(this.KEY_PREFIX)) {
        return null;
      }
      
      const keyPrefix = plainKey.substring(0, 12);
      
      // Find API key by prefix
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          keyPrefix,
          isActive: true,
        },
      });
      
      // Check each key with matching prefix
      for (const apiKey of apiKeys) {
        const isValid = await bcrypt.compare(plainKey, apiKey.hashedKey);
        if (isValid) {
          // Check if key is expired
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            logger.warn('Expired API key used', { apiKeyId: apiKey.id });
            return null;
          }
          
          // Update last used timestamp
          await this.updateLastUsed(apiKey.id);
          
          return convertPrismaApiKey(apiKey);
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to validate API key', { error });
      return null;
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(apiKeyId: string, rateLimit: number): Promise<RateLimitInfo> {
    try {
      const key = `rate_limit:${apiKeyId}`;
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - this.RATE_LIMIT_WINDOW;
      
      // Remove old entries
      await redis.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      const currentCount = await redis.zcard(key);
      
      if (currentCount >= rateLimit) {
        const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime = oldestRequest.length > 0 
          ? parseInt(oldestRequest[1]) + this.RATE_LIMIT_WINDOW
          : now + this.RATE_LIMIT_WINDOW;
        
        return {
          allowed: false,
          limit: rateLimit,
          remaining: 0,
          resetTime,
          retryAfter: resetTime - now,
        };
      }
      
      // Add current request
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, this.RATE_LIMIT_WINDOW);
      
      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - currentCount - 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      };
    } catch (error) {
      logger.error('Failed to check rate limit', { error, apiKeyId });
      // Allow request on error to avoid blocking legitimate traffic
      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - 1,
        resetTime: Math.floor(Date.now() / 1000) + this.RATE_LIMIT_WINDOW,
      };
    }
  }

  /**
   * Track API key usage
   */
  async trackUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      // Record usage in database
      await prisma.apiKeyUsage.create({
        data: {
          apiKeyId,
          endpoint,
          method,
          statusCode,
          responseTime,
          userAgent,
          ipAddress,
          timestamp: new Date(),
        },
      });
      
      // Update usage count and last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          lastUsedAt: new Date(),
          usageCount: {
            increment: 1,
          },
        },
      });
      
      // Cache recent usage for analytics
      const cacheKey = `usage:${apiKeyId}:${new Date().toISOString().split('T')[0]}`;
      await redis.incr(cacheKey);
      await redis.expire(cacheKey, 86400 * 7); // Keep for 7 days
      
    } catch (error) {
      logger.error('Failed to track API key usage', { error, apiKeyId });
    }
  }

  /**
   * Get API key statistics
   */
  async getApiKeyStats(apiKeyId: string, days: number = 30): Promise<ApiKeyStats> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      // Get usage data
      const usage = await prisma.apiKeyUsage.findMany({
        where: {
          apiKeyId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      const totalRequests = usage.length;
      const today = new Date().toISOString().split('T')[0];
      const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const requestsToday = usage.filter((u: any) => 
        u.timestamp.toISOString().split('T')[0] === today
      ).length;
      
      const requestsThisWeek = usage.filter((u: any) => u.timestamp >= thisWeek).length;
      const requestsThisMonth = usage.filter((u: any) => u.timestamp >= thisMonth).length;
      
      const averageResponseTime = totalRequests > 0 
        ? usage.reduce((sum: number, u: any) => sum + u.responseTime, 0) / totalRequests
        : 0;
      
      const errorCount = usage.filter((u: any) => u.statusCode >= 400).length;
      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
      
      // Top endpoints
      const endpointCounts = usage.reduce((acc: Record<string, number>, u: any) => {
        const key = `${u.method} ${u.endpoint}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topEndpoints = Object.entries(endpointCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }));
      
      // Daily usage
      const dailyUsage = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const requests = usage.filter((u: any) => 
          u.timestamp.toISOString().split('T')[0] === dateStr
        ).length;
        dailyUsage.push({ date: dateStr, requests });
      }
      
      return {
        totalRequests,
        requestsToday,
        requestsThisWeek,
        requestsThisMonth,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        topEndpoints,
        dailyUsage,
      };
    } catch (error) {
      logger.error('Failed to get API key stats', { error, apiKeyId });
      throw new Error('Failed to get API key statistics');
    }
  }

  /**
   * List API keys for a tenant
   */
  async listApiKeys(tenantId: string, userId?: string): Promise<ApiKey[]> {
    try {
      const where: any = { tenantId };
      if (userId) {
        where.userId = userId;
      }
      
      const prismaApiKeys = await prisma.apiKey.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      return prismaApiKeys.map(convertPrismaApiKey);
    } catch (error) {
      logger.error('Failed to list API keys', { error, tenantId, userId });
      throw new Error('Failed to list API keys');
    }
  }

  /**
   * Update API key
   */
  async updateApiKey(
    apiKeyId: string,
    updates: {
      name?: string;
      permissions?: string[];
      rateLimit?: number;
      isActive?: boolean;
      expiresAt?: Date;
    }
  ): Promise<ApiKey> {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.permissions !== undefined) updateData.permissions = updates.permissions;
      if (updates.rateLimit !== undefined) updateData.rateLimit = updates.rateLimit;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.expiresAt !== undefined) updateData.expiresAt = updates.expiresAt;
      
      const updatedApiKey = await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: updateData,
      });
      
      return convertPrismaApiKey(updatedApiKey);
    } catch (error) {
      logger.error('Failed to update API key', { error, apiKeyId });
      throw new Error('Failed to update API key');
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(apiKeyId: string): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { isActive: false },
      });
      
      logger.info('API key deleted', { apiKeyId });
    } catch (error) {
      logger.error('Failed to delete API key', { error, apiKeyId });
      throw new Error('Failed to delete API key');
    }
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(apiKeyId: string): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      logger.error('Failed to update last used timestamp', { error, apiKeyId });
    }
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await prisma.apiKey.updateMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
      
      logger.info('Cleaned up expired API keys', { count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired API keys', { error });
      return 0;
    }
  }
}

export default new ApiKeyService();