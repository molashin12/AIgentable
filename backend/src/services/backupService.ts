import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { database } from '../config/database';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import { config } from '../config/config';

export interface BackupConfig {
  schedule: string; // Cron expression
  retention: {
    daily: number; // Days to keep daily backups
    weekly: number; // Weeks to keep weekly backups
    monthly: number; // Months to keep monthly backups
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    s3?: {
      enabled: boolean;
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  compression: boolean;
  encryption: {
    enabled: boolean;
    key?: string;
  };
}

export interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental';
  timestamp: Date;
  size: number;
  duration: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  files: {
    database: string;
    redis?: string;
    uploads?: string;
    logs?: string;
  };
  checksum: string;
}

export interface RestoreOptions {
  backupId: string;
  components: {
    database: boolean;
    redis: boolean;
    uploads: boolean;
    logs: boolean;
  };
  targetTimestamp?: Date;
}

class BackupService {
  private static instance: BackupService;
  private config: BackupConfig;
  private backupHistory: BackupMetadata[] = [];
  private isRunning: boolean = false;
  private scheduledBackup?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 12,
      },
      storage: {
        local: {
          enabled: true,
          path: path.join(process.cwd(), 'backups'),
        },
      },
      compression: true,
      encryption: {
        enabled: false,
      },
    };
  }

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Initialize backup service
   */
  public async initialize(customConfig?: Partial<BackupConfig>): Promise<void> {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    // Ensure backup directory exists
    if (this.config.storage.local.enabled) {
      await fs.mkdir(this.config.storage.local.path, { recursive: true });
    }

    // Load backup history
    await this.loadBackupHistory();

    // Schedule automatic backups
    this.scheduleBackups();

    logger.info('Backup service initialized', {
      schedule: this.config.schedule,
      storage: this.config.storage,
    });
  }

  /**
   * Schedule automatic backups
   */
  private scheduleBackups(): void {
    // Simple daily backup scheduling (in production, use a proper cron library)
    const scheduleNextBackup = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // 2 AM

      const msUntilBackup = tomorrow.getTime() - now.getTime();

      this.scheduledBackup = setTimeout(async () => {
        try {
          await this.createBackup('full');
        } catch (error) {
          logger.error('Scheduled backup failed:', error);
        }
        scheduleNextBackup(); // Schedule next backup
      }, msUntilBackup);

      logger.info('Next backup scheduled', { scheduledFor: tomorrow });
    };

    scheduleNextBackup();
  }

  /**
   * Create a backup
   */
  public async createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupMetadata> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    const backupId = `backup_${Date.now()}_${type}`;
    const timestamp = new Date();
    const startTime = Date.now();

    const metadata: BackupMetadata = {
      id: backupId,
      type,
      timestamp,
      size: 0,
      duration: 0,
      status: 'pending',
      files: {
        database: '',
        redis: '',
        uploads: '',
        logs: '',
      },
      checksum: '',
    };

    try {
      this.isRunning = true;
      metadata.status = 'running';
      this.backupHistory.push(metadata);

      logger.info('Starting backup', { backupId, type });

      // Create backup directory
      const backupDir = path.join(this.config.storage.local.path, backupId);
      await fs.mkdir(backupDir, { recursive: true });

      // Backup database
      const dbBackupPath = await this.backupDatabase(backupDir);
      metadata.files.database = dbBackupPath;

      // Backup Redis
      const redisBackupPath = await this.backupRedis(backupDir);
      metadata.files.redis = redisBackupPath;

      // Backup uploads
      const uploadsBackupPath = await this.backupUploads(backupDir);
      metadata.files.uploads = uploadsBackupPath;

      // Backup logs
      const logsBackupPath = await this.backupLogs(backupDir);
      metadata.files.logs = logsBackupPath;

      // Calculate total size
      metadata.size = await this.calculateBackupSize(backupDir);

      // Generate checksum
      metadata.checksum = await this.generateChecksum(backupDir);

      // Compress if enabled
      if (this.config.compression) {
        await this.compressBackup(backupDir);
      }

      metadata.duration = Date.now() - startTime;
      metadata.status = 'completed';

      // Save metadata
      await this.saveBackupMetadata(metadata);

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.info('Backup completed successfully', {
        backupId,
        duration: metadata.duration,
        size: metadata.size,
      });

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      metadata.duration = Date.now() - startTime;

      logger.error('Backup failed', { backupId, error });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Backup database
   */
  private async backupDatabase(backupDir: string): Promise<string> {
    const filename = 'database.sql';
    const filepath = path.join(backupDir, filename);

    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        '--host', process.env.DATABASE_HOST || 'localhost',
        '--port', process.env.DATABASE_PORT || '5432',
        '--username', process.env.DATABASE_USER || 'postgres',
        '--dbname', process.env.DATABASE_NAME || 'aigentable',
        '--no-password',
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
      ], {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DATABASE_PASSWORD || '',
        },
      });

      const writeStream = createWriteStream(filepath);
      pgDump.stdout.pipe(writeStream);

      pgDump.stderr.on('data', (data) => {
        logger.debug('pg_dump stderr:', data.toString());
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve(filepath);
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      pgDump.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Backup Redis
   */
  private async backupRedis(backupDir: string): Promise<string> {
    const filename = 'redis.rdb';
    const filepath = path.join(backupDir, filename);

    try {
      // Trigger Redis BGSAVE
      await redis.getClient().bgsave();

      // Wait for background save to complete
      let saveInProgress = true;
      while (saveInProgress) {
        const info = await redis.getClient().info('persistence');
        saveInProgress = info.includes('rdb_bgsave_in_progress:1');
        if (saveInProgress) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Copy RDB file (this is a simplified approach)
      // In production, you'd get the actual Redis data directory
      // Get Redis data directory (fallback to default)
      const redisDir = '/var/lib/redis'; // Default Redis data directory
      const rdbFile = path.join(redisDir, 'dump.rdb');

      try {
        await fs.copyFile(rdbFile, filepath);
      } catch (error) {
        // If we can't copy the RDB file, create a backup using Redis commands
        logger.warn('Could not copy RDB file, creating manual backup');
        await this.createRedisManualBackup(filepath);
      }

      return filepath;
    } catch (error) {
      logger.error('Redis backup failed:', error);
      throw error;
    }
  }

  /**
   * Create manual Redis backup
   */
  private async createRedisManualBackup(filepath: string): Promise<void> {
    const client = redis.getClient();
    const backup: Record<string, any> = {};

    try {
      // Get all keys
      const keys = await client.keys('*');
      
      for (const key of keys) {
        const type = await client.type(key);
        const ttl = await client.ttl(key);
        
        let value;
        switch (type) {
          case 'string':
            value = await client.get(key);
            break;
          case 'list':
            value = await client.lrange(key, 0, -1);
            break;
          case 'set':
            value = await client.smembers(key);
            break;
          case 'hash':
            value = await client.hgetall(key);
            break;
          case 'zset':
            value = await client.zrange(key, 0, -1, 'WITHSCORES');
            break;
          default:
            continue;
        }
        
        backup[key] = {
          type,
          value,
          ttl: ttl > 0 ? ttl : null,
        };
      }

      await fs.writeFile(filepath, JSON.stringify(backup, null, 2));
    } catch (error) {
      logger.error('Manual Redis backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup uploads directory
   */
  private async backupUploads(backupDir: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filename = 'uploads.tar';
    const filepath = path.join(backupDir, filename);

    try {
      // Check if uploads directory exists
      await fs.access(uploadsDir);
      
      // Create tar archive
      return new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-cf', filepath, '-C', path.dirname(uploadsDir), path.basename(uploadsDir)]);
        
        tar.on('close', (code) => {
          if (code === 0) {
            resolve(filepath);
          } else {
            reject(new Error(`tar exited with code ${code}`));
          }
        });
        
        tar.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      // If uploads directory doesn't exist, create empty file
      await fs.writeFile(filepath, '');
      return filepath;
    }
  }

  /**
   * Backup logs
   */
  private async backupLogs(backupDir: string): Promise<string> {
    const logsDir = path.join(process.cwd(), 'logs');
    const filename = 'logs.tar';
    const filepath = path.join(backupDir, filename);

    try {
      // Check if logs directory exists
      await fs.access(logsDir);
      
      // Create tar archive
      return new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-cf', filepath, '-C', path.dirname(logsDir), path.basename(logsDir)]);
        
        tar.on('close', (code) => {
          if (code === 0) {
            resolve(filepath);
          } else {
            reject(new Error(`tar exited with code ${code}`));
          }
        });
        
        tar.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      // If logs directory doesn't exist, create empty file
      await fs.writeFile(filepath, '');
      return filepath;
    }
  }

  /**
   * Calculate backup size
   */
  private async calculateBackupSize(backupDir: string): Promise<number> {
    let totalSize = 0;
    
    const files = await fs.readdir(backupDir);
    for (const file of files) {
      const filepath = path.join(backupDir, file);
      const stats = await fs.stat(filepath);
      totalSize += stats.size;
    }
    
    return totalSize;
  }

  /**
   * Generate checksum for backup
   */
  private async generateChecksum(backupDir: string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    
    const files = await fs.readdir(backupDir);
    files.sort(); // Ensure consistent order
    
    for (const file of files) {
      const filepath = path.join(backupDir, file);
      const content = await fs.readFile(filepath);
      hash.update(content);
    }
    
    return hash.digest('hex');
  }

  /**
   * Compress backup
   */
  private async compressBackup(backupDir: string): Promise<void> {
    const files = await fs.readdir(backupDir);
    
    for (const file of files) {
      const filepath = path.join(backupDir, file);
      const compressedPath = `${filepath}.gz`;
      
      await pipeline(
        createReadStream(filepath),
        createGzip(),
        createWriteStream(compressedPath)
      );
      
      // Remove original file
      await fs.unlink(filepath);
    }
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this.config.storage.local.path, 'backup_history.json');
    await fs.writeFile(metadataPath, JSON.stringify(this.backupHistory, null, 2));
  }

  /**
   * Load backup history
   */
  private async loadBackupHistory(): Promise<void> {
    try {
      const metadataPath = path.join(this.config.storage.local.path, 'backup_history.json');
      const content = await fs.readFile(metadataPath, 'utf-8');
      this.backupHistory = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty history
      this.backupHistory = [];
    }
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const now = new Date();
    const toDelete: string[] = [];
    
    for (const backup of this.backupHistory) {
      const backupAge = now.getTime() - backup.timestamp.getTime();
      const daysOld = Math.floor(backupAge / (1000 * 60 * 60 * 24));
      
      let shouldDelete = false;
      
      // Apply retention policy
      if (daysOld > this.config.retention.daily) {
        shouldDelete = true;
      }
      
      if (shouldDelete) {
        toDelete.push(backup.id);
        
        // Delete backup files
        const backupDir = path.join(this.config.storage.local.path, backup.id);
        try {
          await fs.rm(backupDir, { recursive: true, force: true });
          logger.info('Deleted old backup', { backupId: backup.id, age: daysOld });
        } catch (error) {
          logger.error('Failed to delete old backup', { backupId: backup.id, error });
        }
      }
    }
    
    // Remove from history
    this.backupHistory = this.backupHistory.filter(backup => !toDelete.includes(backup.id));
    
    if (toDelete.length > 0) {
      await this.saveBackupMetadata(this.backupHistory[0]); // Save updated history
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === options.backupId);
    if (!backup) {
      throw new Error(`Backup ${options.backupId} not found`);
    }

    if (backup.status !== 'completed') {
      throw new Error(`Backup ${options.backupId} is not completed`);
    }

    logger.info('Starting restore', { backupId: options.backupId, components: options.components });

    try {
      const backupDir = path.join(this.config.storage.local.path, backup.id);

      // Restore database
      if (options.components.database && backup.files.database) {
        await this.restoreDatabase(backup.files.database);
      }

      // Restore Redis
      if (options.components.redis && backup.files.redis) {
        await this.restoreRedis(backup.files.redis);
      }

      // Restore uploads
      if (options.components.uploads && backup.files.uploads) {
        await this.restoreUploads(backup.files.uploads);
      }

      // Restore logs
      if (options.components.logs && backup.files.logs) {
        await this.restoreLogs(backup.files.logs);
      }

      logger.info('Restore completed successfully', { backupId: options.backupId });
    } catch (error) {
      logger.error('Restore failed', { backupId: options.backupId, error });
      throw error;
    }
  }

  /**
   * Restore database
   */
  private async restoreDatabase(backupFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const psql = spawn('psql', [
        '--host', process.env.DATABASE_HOST || 'localhost',
        '--port', process.env.DATABASE_PORT || '5432',
        '--username', process.env.DATABASE_USER || 'postgres',
        '--dbname', process.env.DATABASE_NAME || 'aigentable',
        '--file', backupFile,
      ], {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DATABASE_PASSWORD || '',
        },
      });

      psql.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`psql exited with code ${code}`));
        }
      });

      psql.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Restore Redis
   */
  private async restoreRedis(backupFile: string): Promise<void> {
    try {
      const content = await fs.readFile(backupFile, 'utf-8');
      const backup = JSON.parse(content);
      const client = redis.getClient();

      // Clear existing data
      await client.flushall();

      // Restore data
      for (const [key, data] of Object.entries(backup)) {
        const { type, value, ttl } = data as any;

        switch (type) {
          case 'string':
            await client.set(key, value);
            break;
          case 'list':
            await client.lpush(key, ...value);
            break;
          case 'set':
            await client.sadd(key, ...value);
            break;
          case 'hash':
            await client.hset(key, value);
            break;
          case 'zset':
            const pairs = [];
            for (let i = 0; i < value.length; i += 2) {
              pairs.push(value[i + 1], value[i]); // score, member
            }
            await client.zadd(key, ...pairs);
            break;
        }

        // Set TTL if it exists
        if (ttl) {
          await client.expire(key, ttl);
        }
      }
    } catch (error) {
      logger.error('Redis restore failed:', error);
      throw error;
    }
  }

  /**
   * Restore uploads
   */
  private async restoreUploads(backupFile: string): Promise<void> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xf', backupFile, '-C', process.cwd()]);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar exited with code ${code}`));
        }
      });
      
      tar.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Restore logs
   */
  private async restoreLogs(backupFile: string): Promise<void> {
    const logsDir = path.join(process.cwd(), 'logs');
    
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xf', backupFile, '-C', process.cwd()]);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar exited with code ${code}`));
        }
      });
      
      tar.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Export data
   */
  public async exportData(format: 'json' | 'csv' | 'sql' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(this.config.storage.local.path, 'exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    const exportPath = path.join(exportDir, `export_${timestamp}.${format}`);
    
    try {
      switch (format) {
        case 'json':
          await this.exportToJson(exportPath);
          break;
        case 'csv':
          await this.exportToCsv(exportPath);
          break;
        case 'sql':
          await this.exportToSql(exportPath);
          break;
      }
      
      logger.info('Data export completed', { format, exportPath });
      return exportPath;
    } catch (error) {
      logger.error('Data export failed', { format, error });
      throw error;
    }
  }

  /**
   * Export to JSON
   */
  private async exportToJson(exportPath: string): Promise<void> {
    const client = database.getClient();
    
    const data = {
      tenants: await client.tenant.findMany(),
      users: await client.user.findMany(),
      agents: await client.agent.findMany(),
      conversations: await client.conversation.findMany(),
      messages: await client.message.findMany(),
      documents: await client.document.findMany(),
      channels: await client.channel.findMany(),
    };
    
    await fs.writeFile(exportPath, JSON.stringify(data, null, 2));
  }

  /**
   * Export to CSV
   */
  private async exportToCsv(exportPath: string): Promise<void> {
    // This is a simplified CSV export
    // In production, you'd use a proper CSV library
    const client = database.getClient();
    
    const conversations = await client.conversation.findMany({
      include: {
        messages: true,
      },
    });
    
    const csvLines = [
      'ConversationId,CustomerName,CustomerEmail,AgentId,Status,CreatedAt,MessageCount',
      ...conversations.map(conv => 
        `${conv.id},"${conv.customerName || ''}","${conv.customerEmail || ''}",${conv.agentId || ''},${conv.status},${conv.createdAt.toISOString()},${conv.messages.length}`
      ),
    ];
    
    await fs.writeFile(exportPath, csvLines.join('\n'));
  }

  /**
   * Export to SQL
   */
  private async exportToSql(exportPath: string): Promise<void> {
    await this.backupDatabase(path.dirname(exportPath));
    const dbBackupPath = path.join(path.dirname(exportPath), 'database.sql');
    await fs.rename(dbBackupPath, exportPath);
  }

  /**
   * Get backup history
   */
  public getBackupHistory(): BackupMetadata[] {
    return [...this.backupHistory];
  }

  /**
   * Get backup by ID
   */
  public getBackup(backupId: string): BackupMetadata | undefined {
    return this.backupHistory.find(backup => backup.id === backupId);
  }

  /**
   * Verify backup integrity
   */
  public async verifyBackup(backupId: string): Promise<boolean> {
    const backup = this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    try {
      const backupDir = path.join(this.config.storage.local.path, backupId);
      const currentChecksum = await this.generateChecksum(backupDir);
      
      return currentChecksum === backup.checksum;
    } catch (error) {
      logger.error('Backup verification failed', { backupId, error });
      return false;
    }
  }

  /**
   * Get storage usage
   */
  public async getStorageUsage(): Promise<{
    totalSize: number;
    backupCount: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    let totalSize = 0;
    let oldestBackup: Date | null = null;
    let newestBackup: Date | null = null;

    for (const backup of this.backupHistory) {
      totalSize += backup.size;
      
      if (!oldestBackup || backup.timestamp < oldestBackup) {
        oldestBackup = backup.timestamp;
      }
      
      if (!newestBackup || backup.timestamp > newestBackup) {
        newestBackup = backup.timestamp;
      }
    }

    return {
      totalSize,
      backupCount: this.backupHistory.length,
      oldestBackup,
      newestBackup,
    };
  }

  /**
   * Stop scheduled backups
   */
  public stopScheduledBackups(): void {
    if (this.scheduledBackup) {
      clearTimeout(this.scheduledBackup);
      this.scheduledBackup = undefined;
      logger.info('Scheduled backups stopped');
    }
  }
}

export const backupService = BackupService.getInstance();
export default backupService;