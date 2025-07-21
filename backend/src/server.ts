import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

// Import configurations and middleware
import { config } from './config/config';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { authenticate } from './middleware/auth';
import logger from './utils/logger';
import { database } from './config/database';
import { connectRedis } from './config/redis';
import { initializeChroma } from './config/chroma';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import tenantRoutes from './routes/tenants';
import agentRoutes from './routes/agents';
import documentRoutes from './routes/documents';
import channelRoutes from './routes/channels';
import conversationRoutes from './routes/conversations';
import analyticsRoutes from './routes/analytics';
import webhookRoutes from './routes/webhooks';
import apiRoutes from './routes/api';
import apiKeyRoutes from './routes/apiKeys';

// Import socket handlers
import { initializeSocketHandlers } from './sockets/socketHandlers';

// Load environment variables
dotenv.config();

class AIgentableServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSockets();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMaxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    if (config.nodeEnv !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => logger.info(message.trim())
        }
      }));
    }

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: process.env.npm_package_version || '1.0.0'
      });
    });
  }

  private initializeRoutes(): void {
    const apiPrefix = `/api/${config.apiVersion}`;

    // Public routes (no authentication required)
    this.app.use(`${apiPrefix}/auth`, authRoutes);
    this.app.use(`${apiPrefix}/webhooks`, webhookRoutes);

    // Protected routes (authentication required)
    this.app.use(`${apiPrefix}/users`, authenticate, userRoutes);
    this.app.use(`${apiPrefix}/tenants`, authenticate, tenantRoutes);
    this.app.use(`${apiPrefix}/agents`, authenticate, agentRoutes);
    this.app.use(`${apiPrefix}/documents`, authenticate, documentRoutes);
    this.app.use(`${apiPrefix}/channels`, authenticate, channelRoutes);
    this.app.use(`${apiPrefix}/conversations`, authenticate, conversationRoutes);
    this.app.use(`${apiPrefix}/analytics`, authenticate, analyticsRoutes);
    this.app.use(`${apiPrefix}/api-keys`, authenticate, apiKeyRoutes);

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        message: 'AIgentable API Documentation',
        version: config.apiVersion,
        endpoints: {
          auth: `${apiPrefix}/auth`,
          users: `${apiPrefix}/users`,
          tenants: `${apiPrefix}/tenants`,
          agents: `${apiPrefix}/agents`,
          documents: `${apiPrefix}/documents`,
          channels: `${apiPrefix}/channels`,
          conversations: `${apiPrefix}/conversations`,
          analytics: `${apiPrefix}/analytics`,
          webhooks: `${apiPrefix}/webhooks`
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFound);

    // Global error handler
    this.app.use(errorHandler);
  }

  private initializeSockets(): void {
    initializeSocketHandlers(this.io);
  }

  private async initializeServices(): Promise<void> {
    try {
      // Connect to database
  await database.connect();
  logger.info('Database connected successfully');

  // Connect to Redis
  await connectRedis();
  logger.info('Redis connected successfully');

      // Initialize ChromaDB
      await initializeChroma();
      logger.info('ChromaDB initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize services:', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // Initialize all services
      await this.initializeServices();

      // Start the server
      this.server.listen(this.port, () => {
        logger.info('AIgentable Server starting...', {
          port: this.port,
          environment: process.env.NODE_ENV,
        });
        logger.info(`🚀 AIgentable Server running on port ${this.port}`);
        logger.info(`📚 API Documentation: http://localhost:${this.port}/api/docs`);
        logger.info(`🏥 Health Check: http://localhost:${this.port}/health`);
        logger.info(`🌍 Environment: ${config.nodeEnv}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Received shutdown signal, closing server gracefully...');
    
    this.server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }
}

// Start the server
const server = new AIgentableServer();
server.start().catch((error) => {
  logger.error('Failed to start AIgentable server:', error);
  process.exit(1);
});

export default server;