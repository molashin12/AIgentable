import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  // Server
  port: number;
  nodeEnv: string;
  apiVersion: string;
  
  // Database
  databaseUrl: string;
  databaseHost: string;
  databasePort: number;
  databaseName: string;
  databaseUser: string;
  databasePassword: string;
  
  // Redis
  redisUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  
  // ChromaDB
  chromaHost: string;
  chromaPort: number;
  chromaCollectionName: string;
  
  // AI Provider
  defaultAIProvider: string;
  
  // OpenAI
  openaiApiKey: string;
  openaiModel: string;
  openaiEmbeddingModel: string;
  
  // Gemini
  geminiApiKey: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  
  // WhatsApp
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  whatsappWebhookVerifyToken: string;
  whatsappWebhookSecret: string;
  
  // Facebook
  facebookAppId: string;
  facebookAppSecret: string;
  facebookPageAccessToken: string;
  
  // Instagram
  instagramAccessToken: string;
  instagramBusinessAccountId: string;
  instagramAppSecret: string;
  
  // Telegram
  telegramBotToken: string;
  
  // File Upload
  maxFileSize: number;
  uploadPath: string;
  allowedFileTypes: string[];
  
  // Email
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  email: {
    fromAddress: string;
  };
  
  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  
  // CORS
  corsOrigin: string | string[];
  
  // Frontend
  frontendUrl: string;
  
  // Webhooks
  webhookBaseUrl: string;
  
  // Logging
  logLevel: string;
  logFile: string;
  
  // Session
  sessionSecret: string;
  sessionMaxAge: number;
  
  // GCP
  gcpProjectId: string;
  gcpKeyFile: string;
  
  // Monitoring
  sentryDsn?: string;
  
  // Feature Flags
  enableAnalytics: boolean;
  enableRealTimeChat: boolean;
  enableFileUpload: boolean;
  enableMultiLanguage: boolean;
}

const getEnvVar = (name: string, defaultValue?: string): string => {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

const getEnvNumber = (name: string, defaultValue?: number): number => {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value ? parseInt(value, 10) : defaultValue!;
};

const getEnvBoolean = (name: string, defaultValue: boolean = false): boolean => {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getEnvArray = (name: string, defaultValue: string[] = []): string[] => {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim());
};

export const config: Config = {
  // Server Configuration
  port: getEnvNumber('PORT', 3001),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  apiVersion: getEnvVar('API_VERSION', 'v1'),
  
  // Database Configuration
  databaseUrl: getEnvVar('DATABASE_URL'),
  databaseHost: getEnvVar('DATABASE_HOST', 'localhost'),
  databasePort: getEnvNumber('DATABASE_PORT', 5432),
  databaseName: getEnvVar('DATABASE_NAME', 'aigentable'),
  databaseUser: getEnvVar('DATABASE_USER', 'postgres'),
  databasePassword: getEnvVar('DATABASE_PASSWORD'),
  
  // Redis Configuration
  redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
  redisHost: getEnvVar('REDIS_HOST', 'localhost'),
  redisPort: getEnvNumber('REDIS_PORT', 6379),
  redisPassword: process.env.REDIS_PASSWORD,
  
  // JWT Configuration
  jwtSecret: getEnvVar('JWT_SECRET'),
  jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '7d'),
  jwtRefreshSecret: getEnvVar('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: getEnvVar('JWT_REFRESH_EXPIRES_IN', '30d'),
  
  // ChromaDB Configuration
  chromaHost: getEnvVar('CHROMA_HOST', 'localhost'),
  chromaPort: getEnvNumber('CHROMA_PORT', 8000),
  chromaCollectionName: getEnvVar('CHROMA_COLLECTION_NAME', 'aigentable_vectors'),
  
  // AI Provider Configuration
  defaultAIProvider: getEnvVar('DEFAULT_AI_PROVIDER', 'openai'),
  
  // OpenAI Configuration
  openaiApiKey: getEnvVar('OPENAI_API_KEY'),
  openaiModel: getEnvVar('OPENAI_MODEL', 'gpt-4'),
  openaiEmbeddingModel: getEnvVar('OPENAI_EMBEDDING_MODEL', 'text-embedding-ada-002'),
  
  // Gemini Configuration
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: getEnvVar('GEMINI_MODEL', 'gemini-pro'),
  geminiEmbeddingModel: getEnvVar('GEMINI_EMBEDDING_MODEL', 'embedding-001'),
  
  // WhatsApp Configuration
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  whatsappWebhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET || '',
  
  // Facebook Configuration
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  facebookPageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
  
  // Instagram Configuration
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET || '',
  
  // Telegram Configuration
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // File Upload Configuration
  maxFileSize: getEnvNumber('MAX_FILE_SIZE', 10485760), // 10MB
  uploadPath: getEnvVar('UPLOAD_PATH', './uploads'),
  allowedFileTypes: getEnvArray('ALLOWED_FILE_TYPES', ['pdf', 'doc', 'docx', 'txt', 'csv', 'json']),
  
  // Email Configuration
  smtpHost: getEnvVar('SMTP_HOST', 'smtp.gmail.com'),
  smtpPort: getEnvNumber('SMTP_PORT', 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtp: {
    host: getEnvVar('SMTP_HOST', 'smtp.gmail.com'),
    port: getEnvNumber('SMTP_PORT', 587),
    secure: getEnvBoolean('SMTP_SECURE', false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: getEnvVar('EMAIL_FROM_ADDRESS', 'noreply@aigentable.com'),
  },
  email: {
    fromAddress: getEnvVar('EMAIL_FROM_ADDRESS', 'noreply@aigentable.com'),
  },
  
  // Rate Limiting
  rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  rateLimitMaxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  
  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN?.includes(',') 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
  
  // Frontend Configuration
  frontendUrl: getEnvVar('FRONTEND_URL', 'http://localhost:5173'),
  
  // Webhook Configuration
  webhookBaseUrl: getEnvVar('WEBHOOK_BASE_URL', 'https://api.aigentable.com'),
  
  // Logging Configuration
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  logFile: getEnvVar('LOG_FILE', 'logs/app.log'),
  
  // Session Configuration
  sessionSecret: getEnvVar('SESSION_SECRET'),
  sessionMaxAge: getEnvNumber('SESSION_MAX_AGE', 86400000), // 24 hours
  
  // Google Cloud Platform
  gcpProjectId: process.env.GCP_PROJECT_ID || '',
  gcpKeyFile: process.env.GCP_KEY_FILE || '',
  
  // Monitoring
  sentryDsn: process.env.SENTRY_DSN,
  
  // Feature Flags
  enableAnalytics: getEnvBoolean('ENABLE_ANALYTICS', true),
  enableRealTimeChat: getEnvBoolean('ENABLE_REAL_TIME_CHAT', true),
  enableFileUpload: getEnvBoolean('ENABLE_FILE_UPLOAD', true),
  enableMultiLanguage: getEnvBoolean('ENABLE_MULTI_LANGUAGE', true),
};

// Validate critical configuration
if (config.nodeEnv === 'production') {
  const requiredVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'SESSION_SECRET'
  ];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Environment variable ${varName} is required in production`);
    }
  }
}

export default config;