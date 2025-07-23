import { redis } from '../config/redis';
import logger from '../utils/logger';
import { performance } from 'perf_hooks';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  compress?: boolean; // Compress large values
  serialize?: boolean; // Serialize objects
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  averageGetTime: number;
  averageSetTime: number;
}

class CachingService {
  private static instance: CachingService;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
    averageGetTime: 0,
    averageSetTime: 0,
  };
  private getTimes: number[] = [];
  private setTimes: number[] = [];
  private defaultTTL: number = 3600; // 1 hour default
  private defaultPrefix: string = 'cache';

  private constructor() {}

  public static getInstance(): CachingService {
    if (!CachingService.instance) {
      CachingService.instance = new CachingService();
    }
    return CachingService.instance;
  }

  /**
   * Get value from cache
   */
  public async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const value = await redis.get(fullKey);
      
      const endTime = performance.now();
      this.recordGetTime(endTime - startTime);
      
      if (value === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
      
      this.stats.hits++;
      this.updateHitRate();
      
      // Deserialize if needed
      if (options.serialize !== false) {
        try {
          return JSON.parse(value);
        } catch {
          return value as T;
        }
      }
      
      return value as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      
      let serializedValue: string;
      
      // Serialize if needed
      if (options.serialize !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }
      
      // Compress if enabled and value is large
      if (options.compress && serializedValue.length > 1024) {
        serializedValue = await this.compress(serializedValue);
      }
      
      await redis.set(fullKey, serializedValue, ttl);
      
      const endTime = performance.now();
      this.recordSetTime(endTime - startTime);
      
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redis.del(fullKey);
      
      this.stats.deletes++;
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redis.exists(fullKey);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  public async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const startTime = performance.now();
    
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      const values = await redis.getClient().mget(...fullKeys);
      
      const endTime = performance.now();
      this.recordGetTime(endTime - startTime);
      
      return values.map((value: string | null, index: number) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        
        // Deserialize if needed
        if (options.serialize !== false) {
          try {
            return JSON.parse(value);
          } catch {
            return value as T;
          }
        }
        
        return value as T;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null);
    } finally {
      this.updateHitRate();
    }
  }

  /**
   * Set multiple values in cache
   */
  public async mset(keyValuePairs: Record<string, any>, options: CacheOptions = {}): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      const ttl = options.ttl || this.defaultTTL;
      const pipeline = redis.getClient().pipeline();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const fullKey = this.buildKey(key, options.prefix);
        
        let serializedValue: string;
        
        // Serialize if needed
        if (options.serialize !== false && typeof value === 'object') {
          serializedValue = JSON.stringify(value);
        } else {
          serializedValue = String(value);
        }
        
        // Compress if enabled and value is large
        if (options.compress && serializedValue.length > 1024) {
          serializedValue = await this.compress(serializedValue);
        }
        
        pipeline.setex(fullKey, ttl, serializedValue);
      }
      
      await pipeline.exec();
      
      const endTime = performance.now();
      this.recordSetTime(endTime - startTime);
      
      this.stats.sets += Object.keys(keyValuePairs).length;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mset error:', { keyValuePairs: Object.keys(keyValuePairs), error });
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  public async mdel(keys: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      const result = await redis.getClient().del(...fullKeys);
      this.stats.deletes += fullKeys.length;
      return fullKeys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mdel error:', { keys, error });
      return 0;
    }
  }

  /**
   * Get or set pattern - get value, if not exists, set it using the provided function
   */
  public async getOrSet<T = any>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cachedValue = await this.get<T>(key, options);
    
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    // If not in cache, fetch and set
    try {
      const value = await fetchFunction();
      await this.set(key, value, options);
      return value;
    } catch (error) {
      logger.error('Cache getOrSet fetch error:', { key, error });
      throw error;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  public async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redis.getClient().incrby(fullKey, amount);
      
      // Set TTL if this is a new key
      const ttl = options.ttl || this.defaultTTL;
      await redis.expire(fullKey, ttl);
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache increment error:', { key, amount, error });
      throw error;
    }
  }

  /**
   * Decrement a numeric value in cache
   */
  public async decrement(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const result = await redis.getClient().decrby(fullKey, amount);
      
      // Set TTL if this is a new key
      const ttl = options.ttl || this.defaultTTL;
      await redis.expire(fullKey, ttl);
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache decrement error:', { key, amount, error });
      throw error;
    }
  }

  /**
   * Add item to a list in cache
   */
  public async listPush(key: string, value: any, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      
      let serializedValue: string;
      if (options.serialize !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }
      
      const result = await redis.lpush(fullKey, serializedValue);
      
      // Set TTL
      const ttl = options.ttl || this.defaultTTL;
      await redis.expire(fullKey, ttl);
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache listPush error:', { key, error });
      throw error;
    }
  }

  /**
   * Get items from a list in cache
   */
  public async listRange<T = any>(key: string, start: number = 0, end: number = -1, options: CacheOptions = {}): Promise<T[]> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const values = await redis.getClient().lrange(fullKey, start, end);
      
      return values.map((value: string) => {
        if (options.serialize !== false) {
          try {
            return JSON.parse(value);
          } catch {
            return value as T;
          }
        }
        return value as T;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache listRange error:', { key, start, end, error });
      return [];
    }
  }

  /**
   * Add item to a set in cache
   */
  public async setAdd(key: string, value: any, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      
      let serializedValue: string;
      if (options.serialize !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }
      
      const result = await redis.getClient().sadd(fullKey, serializedValue);
      
      // Set TTL
      const ttl = options.ttl || this.defaultTTL;
      await redis.expire(fullKey, ttl);
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache setAdd error:', { key, error });
      throw error;
    }
  }

  /**
   * Get all members of a set in cache
   */
  public async setMembers<T = any>(key: string, options: CacheOptions = {}): Promise<T[]> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const values = await redis.getClient().smembers(fullKey);
      
      return values.map((value: string) => {
        if (options.serialize !== false) {
          try {
            return JSON.parse(value);
          } catch {
            return value as T;
          }
        }
        return value as T;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache setMembers error:', { key, error });
      return [];
    }
  }

  /**
   * Clear cache by pattern
   */
  public async clearByPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, options.prefix);
      const keys = await redis.getClient().keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await redis.getClient().del(...keys);
      this.stats.deletes += keys.length;
      
      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clearByPattern error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      averageGetTime: 0,
      averageSetTime: 0,
    };
    this.getTimes = [];
    this.setTimes = [];
  }

  /**
   * Get cache info from Redis
   */
  public async getCacheInfo(): Promise<any> {
    try {
      const info = await redis.getClient().info('memory');
      const keyspace = await redis.getClient().info('keyspace');
      
      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        stats: this.getStats(),
      };
    } catch (error) {
      logger.error('Failed to get cache info:', error);
      return null;
    }
  }

  /**
   * Warm up cache with predefined data
   */
  public async warmUp(data: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    logger.info('Starting cache warm-up', { keys: Object.keys(data).length });
    
    try {
      await this.mset(data, options);
      logger.info('Cache warm-up completed successfully');
    } catch (error) {
      logger.error('Cache warm-up failed:', error);
      throw error;
    }
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.defaultPrefix;
    return `${keyPrefix}:${key}`;
  }

  /**
   * Compress string using gzip
   */
  private async compress(data: string): Promise<string> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err: any, compressed: Buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(compressed.toString('base64'));
        }
      });
    });
  }

  /**
   * Decompress string using gzip
   */
  private async decompress(data: string): Promise<string> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(data, 'base64');
      zlib.gunzip(buffer, (err: any, decompressed: Buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(decompressed.toString());
        }
      });
    });
  }

  /**
   * Record get operation time
   */
  private recordGetTime(time: number): void {
    this.getTimes.push(time);
    
    // Keep only last 1000 measurements
    if (this.getTimes.length > 1000) {
      this.getTimes = this.getTimes.slice(-1000);
    }
    
    this.stats.averageGetTime = this.getTimes.reduce((a, b) => a + b, 0) / this.getTimes.length;
  }

  /**
   * Record set operation time
   */
  private recordSetTime(time: number): void {
    this.setTimes.push(time);
    
    // Keep only last 1000 measurements
    if (this.setTimes.length > 1000) {
      this.setTimes = this.setTimes.slice(-1000);
    }
    
    this.stats.averageSetTime = this.setTimes.reduce((a, b) => a + b, 0) / this.setTimes.length;
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Parse Redis info string
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    info.split('\r\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          // Try to parse as number
          const numValue = parseFloat(value);
          result[key] = isNaN(numValue) ? value : numValue;
        }
      }
    });
    
    return result;
  }
}

// Cache decorators for methods
export function Cacheable(options: CacheOptions & { keyGenerator?: (...args: any[]) => string } = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cache = CachingService.getInstance();
      
      // Generate cache key
      let cacheKey: string;
      if (options.keyGenerator) {
        cacheKey = options.keyGenerator(...args);
      } else {
        cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      }
      
      // Try to get from cache
      const cachedResult = await cache.get(cacheKey, options);
      if (cachedResult !== null) {
        return cachedResult;
      }
      
      // Execute method and cache result
      const result = await method.apply(this, args);
      await cache.set(cacheKey, result, options);
      
      return result;
    };
    
    return descriptor;
  };
}

// Cache invalidation decorator
export function CacheInvalidate(patterns: string[] | ((args: any[]) => string[])) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      const cache = CachingService.getInstance();
      
      // Get patterns to invalidate
      const invalidationPatterns = typeof patterns === 'function' ? patterns(args) : patterns;
      
      // Invalidate cache patterns
      for (const pattern of invalidationPatterns) {
        await cache.clearByPattern(pattern);
      }
      
      return result;
    };
    
    return descriptor;
  };
}

export const cachingService = CachingService.getInstance();
export default cachingService;