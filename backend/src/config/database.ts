import { PrismaClient } from '@prisma/client';
import { config } from './config';
import logger from '../utils/logger';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.databaseUrl,
        },
      },
      log: config.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });

    // Prisma client is ready to use
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      logger.info('Successfully connected to PostgreSQL database');
      
      // Test the connection
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection test successful');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Disconnected from PostgreSQL database');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  public getClient(): PrismaClient {
    if (!this.isConnected) {
      logger.warn('Database client requested but not connected');
    }
    return this.prisma;
  }

  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  public async healthCheck(): Promise<{ status: string; timestamp: Date; latency?: number }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        latency,
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }

  // Transaction helper
  public async transaction<T>(fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  // Bulk operations helper
  public async createMany(model: string, data: any[]): Promise<{ count: number }> {
    try {
      // @ts-ignore - Dynamic model access
      return await (this.prisma as any)[model].createMany({
        data,
        skipDuplicates: true,
      });
    } catch (error) {
      logger.error(`Bulk create failed for model ${model}:`, error);
      throw error;
    }
  }

  // Migration helper
  public async runMigrations(): Promise<void> {
    try {
      // This would typically be handled by Prisma CLI in production
      // but we can add custom migration logic here if needed
      logger.info('Checking database migrations...');
      
      // You can add custom migration checks here
      // For now, we'll just log that migrations should be run via CLI
      logger.info('Run "npx prisma migrate deploy" to apply migrations');
    } catch (error) {
      logger.error('Migration check failed:', error);
      throw error;
    }
  }

  // Seed helper
  public async seedDatabase(): Promise<void> {
    try {
      logger.info('Seeding database...');
      
      // Check if we already have data
      const userCount = await this.prisma.user.count();
      if (userCount > 0) {
        logger.info('Database already seeded, skipping...');
        return;
      }

      // Create default tenant
      const defaultTenant = await this.prisma.tenant.create({
        data: {
          name: 'Default Organization',
          plan: 'FREE',
          status: 'ACTIVE',
          settings: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
          },
        },
      });

      // Create default admin user
      const adminUser = await this.prisma.user.create({
        data: {
          email: 'admin@aigentable.com',
          password: 'temp_password_123',
          firstName: 'System',
          lastName: 'Administrator',
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
          tenantId: defaultTenant.id,
        },
      });

      logger.info('Database seeded successfully');
      logger.info(`Default tenant created: ${defaultTenant.id}`);
      logger.info(`Admin user created: ${adminUser.id}`);
    } catch (error) {
      logger.error('Database seeding failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const database = DatabaseConnection.getInstance();
export const prisma = database.getClient();
export default database;

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await database.disconnect();
});

process.on('SIGINT', async () => {
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await database.disconnect();
  process.exit(0);
});