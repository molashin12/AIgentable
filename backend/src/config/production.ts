import { PrismaClientOptions } from '@prisma/client/runtime/library';

// Production database configuration
export const productionDatabaseConfig: PrismaClientOptions = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
  errorFormat: 'minimal',
};

// Redis configuration for production
export const productionRedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  connectTimeout: 10000,
  commandTimeout: 5000,
  // Connection pool settings
  maxMemoryPolicy: 'allkeys-lru',
  // Cluster configuration (if using Redis Cluster)
  enableOfflineQueue: false,
};

// Server configuration for production
export const productionServerConfig = {
  // Express settings
  trustProxy: true,
  jsonLimit: '10mb',
  urlEncodedLimit: '10mb',
  
  // Security settings
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        scriptSrc: ["'self'", 'https:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        fontSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  
  // CORS settings
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
    ],
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Store in Redis for distributed rate limiting
    store: 'redis',
  },
  
  // Compression
  compression: {
    level: 6,
    threshold: 1024,
    filter: (req: any, res: any) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return true;
    },
  },
};

// Monitoring configuration
export const productionMonitoringConfig = {
  // Metrics collection interval (milliseconds)
  metricsInterval: 60000, // 1 minute
  
  // Alert thresholds
  alerts: {
    cpuUsage: 80, // percentage
    memoryUsage: 85, // percentage
    diskUsage: 90, // percentage
    responseTime: 2000, // milliseconds
    errorRate: 5, // percentage
    dbConnectionPool: 90, // percentage
  },
  
  // Health check configuration
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retries: 3,
  },
  
  // Log retention
  logRetention: {
    error: '30d',
    warn: '14d',
    info: '7d',
    debug: '1d',
  },
};

// Backup configuration
export const productionBackupConfig = {
  // Backup schedule (cron format)
  schedule: {
    full: '0 2 * * 0', // Weekly full backup on Sunday at 2 AM
    incremental: '0 2 * * 1-6', // Daily incremental backup at 2 AM
  },
  
  // Retention policy
  retention: {
    daily: 7,
    weekly: 4,
    monthly: 12,
    yearly: 3,
  },
  
  // Storage configuration
  storage: {
    local: {
      enabled: true,
      path: process.env.BACKUP_PATH || './backups',
      maxSize: '10GB',
    },
    s3: {
      enabled: process.env.AWS_S3_BACKUP_ENABLED === 'true',
      bucket: process.env.AWS_S3_BACKUP_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  
  // Compression and encryption
  compression: true,
  encryption: {
    enabled: process.env.BACKUP_ENCRYPTION_ENABLED === 'true',
    algorithm: 'aes-256-gcm',
    key: process.env.BACKUP_ENCRYPTION_KEY,
  },
};

// Cache configuration
export const productionCacheConfig = {
  // Default TTL values (seconds)
  defaultTTL: {
    short: 300, // 5 minutes
    medium: 1800, // 30 minutes
    long: 3600, // 1 hour
    extended: 86400, // 24 hours
  },
  
  // Cache prefixes for different data types
  prefixes: {
    user: 'user:',
    agent: 'agent:',
    conversation: 'conv:',
    document: 'doc:',
    analytics: 'analytics:',
    system: 'system:',
  },
  
  // Cache warming configuration
  warming: {
    enabled: true,
    interval: 3600000, // 1 hour
    batchSize: 100,
  },
  
  // Memory management
  maxMemory: process.env.REDIS_MAX_MEMORY || '2gb',
  evictionPolicy: 'allkeys-lru',
};

// Performance optimization settings
export const productionPerformanceConfig = {
  // Database query optimization
  database: {
    slowQueryThreshold: 1000, // milliseconds
    connectionTimeout: 10000, // milliseconds
    queryTimeout: 30000, // milliseconds
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },
  
  // API optimization
  api: {
    requestTimeout: 30000, // milliseconds
    maxRequestSize: '10mb',
    enableGzip: true,
    enableEtag: true,
  },
  
  // File upload limits
  upload: {
    maxFileSize: '50mb',
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json',
      'text/html',
      'text/markdown',
    ],
    maxFiles: 10,
  },
};

// Security configuration
export const productionSecurityConfig = {
  // JWT settings
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    algorithm: 'HS256',
  },
  
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  
  // Session settings
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
  },
  
  // API key settings
  apiKey: {
    defaultRateLimit: 1000,
    maxRateLimit: 10000,
    keyLength: 32,
  },
};

// Export all configurations
export const productionConfig = {
  database: productionDatabaseConfig,
  redis: productionRedisConfig,
  server: productionServerConfig,
  monitoring: productionMonitoringConfig,
  backup: productionBackupConfig,
  cache: productionCacheConfig,
  performance: productionPerformanceConfig,
  security: productionSecurityConfig,
};