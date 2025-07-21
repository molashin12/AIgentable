import Redis from 'ioredis';
import { config } from './config';
import logger from '../utils/logger';

class RedisConnection {
  private static instance: RedisConnection;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected: boolean = false;

  private constructor() {
    const redisConfig = {
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      db: 0,
    };

    // Main Redis client
    this.client = new Redis(redisConfig);
    
    // Separate clients for pub/sub
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.setupEventHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Subscriber events
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
    });

    // Publisher events
    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });

    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', error);
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);
      
      // Test the connection
      await this.client.ping();
      logger.info('Successfully connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect(),
      ]);
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  public async healthCheck(): Promise<{ status: string; timestamp: Date; latency?: number }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        latency,
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }

  // Cache operations
  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  // JSON operations
  public async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis JSON GET error for key ${key}:`, error);
      return null;
    }
  }

  public async setJSON<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);
      return await this.set(key, jsonValue, ttl);
    } catch (error) {
      logger.error(`Redis JSON SET error for key ${key}:`, error);
      return false;
    }
  }

  // Hash operations
  public async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      logger.error(`Redis HGET error for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  public async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (error) {
      logger.error(`Redis HSET error for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  public async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      logger.error(`Redis HGETALL error for key ${key}:`, error);
      return null;
    }
  }

  // List operations
  public async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lpush(key, ...values);
    } catch (error) {
      logger.error(`Redis LPUSH error for key ${key}:`, error);
      return 0;
    }
  }

  public async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error(`Redis RPOP error for key ${key}:`, error);
      return null;
    }
  }

  // Pub/Sub operations
  public async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.publisher.publish(channel, message);
    } catch (error) {
      logger.error(`Redis PUBLISH error for channel ${channel}:`, error);
      return 0;
    }
  }

  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      logger.error(`Redis SUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  public async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      logger.error(`Redis UNSUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  // Session operations
  public async getSession(sessionId: string): Promise<any | null> {
    return await this.getJSON(`session:${sessionId}`);
  }

  public async setSession(sessionId: string, sessionData: any, ttl: number = config.sessionMaxAge / 1000): Promise<boolean> {
    return await this.setJSON(`session:${sessionId}`, sessionData, ttl);
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    return await this.del(`session:${sessionId}`);
  }

  // Rate limiting
  public async incrementRateLimit(key: string, windowMs: number): Promise<number> {
    try {
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(windowMs / 1000));
      const results = await multi.exec();
      return results?.[0]?.[1] as number || 0;
    } catch (error) {
      logger.error(`Redis rate limit error for key ${key}:`, error);
      return 0;
    }
  }

  // Cache invalidation patterns
  public async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        return await this.client.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error(`Redis pattern invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export const redis = RedisConnection.getInstance();
export const redisClient = redis;
export const connectRedis = () => redis.connect();
export default redis;

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await redis.disconnect();
});

process.on('SIGINT', async () => {
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redis.disconnect();
  process.exit(0);
});