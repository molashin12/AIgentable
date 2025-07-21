import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';
import logger from './logger';

// Custom validation messages
const customMessages = {
  'string.base': '{#label} must be a string',
  'string.empty': '{#label} cannot be empty',
  'string.min': '{#label} must be at least {#limit} characters long',
  'string.max': '{#label} must not exceed {#limit} characters',
  'string.email': '{#label} must be a valid email address',
  'string.pattern.base': '{#label} format is invalid',
  'number.base': '{#label} must be a number',
  'number.min': '{#label} must be at least {#limit}',
  'number.max': '{#label} must not exceed {#limit}',
  'number.integer': '{#label} must be an integer',
  'boolean.base': '{#label} must be a boolean',
  'array.base': '{#label} must be an array',
  'array.min': '{#label} must contain at least {#limit} items',
  'array.max': '{#label} must not contain more than {#limit} items',
  'object.base': '{#label} must be an object',
  'any.required': '{#label} is required',
  'any.only': '{#label} must be one of {#valids}',
};

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().uuid().required().label('ID'),
  email: Joi.string().email().required().label('Email'),
  password: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    .label('Password')
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    }),
  name: Joi.string().min(1).max(255).required().label('Name'),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(50).required()
    .label('Slug')
    .messages({
      'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
    }),
  url: Joi.string().uri().label('URL'),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).label('Phone')
    .messages({
      'string.pattern.base': 'Phone number must be in international format',
    }),
  pagination: {
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(100).default(20).label('Limit'),
    sortBy: Joi.string().label('Sort By'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').label('Sort Order'),
  },
  search: Joi.string().min(1).max(255).label('Search Query'),
  dateRange: {
    startDate: Joi.date().iso().label('Start Date'),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).label('End Date'),
  },
};

// User validation schemas
export const userSchemas = {
  register: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    name: commonSchemas.name,
    tenantName: Joi.string().min(1).max(255).required().label('Organization Name'),
  }).messages(customMessages),

  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required().label('Password'),
  }).messages(customMessages),

  forgotPassword: Joi.object({
    email: commonSchemas.email,
  }).messages(customMessages),

  resetPassword: Joi.object({
    token: Joi.string().required().label('Reset Token'),
    password: commonSchemas.password,
  }).messages(customMessages),

  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(255).optional().label('First Name'),
    lastName: Joi.string().min(1).max(255).optional().label('Last Name'),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
  }).min(1).messages(customMessages),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().label('Current Password'),
    newPassword: commonSchemas.password,
  }).messages(customMessages),

  inviteUser: Joi.object({
    email: commonSchemas.email,
    role: Joi.string().valid('ADMIN', 'MANAGER', 'AGENT', 'VIEWER').required().label('Role'),
    firstName: Joi.string().min(1).max(255).optional().label('First Name'),
    lastName: Joi.string().min(1).max(255).optional().label('Last Name'),
  }).messages(customMessages),
};

// Agent validation schemas
export const agentSchemas = {
  create: Joi.object({
    name: commonSchemas.name,
    description: Joi.string().max(1000).label('Description'),
    type: Joi.string().valid('CUSTOMER_SERVICE', 'SALES', 'SUPPORT', 'MARKETING', 'HR', 'FINANCE', 'CUSTOM').required().label('Type'),
    model: Joi.string().valid('gpt-4', 'gpt-3.5-turbo', 'claude-3', 'claude-2').default('gpt-4').label('Model'),
    temperature: Joi.number().min(0).max(2).default(0.7).label('Temperature'),
    maxTokens: Joi.number().integer().min(1).max(4000).default(1000).label('Max Tokens'),
    systemPrompt: Joi.string().max(5000).label('System Prompt'),
    isActive: Joi.boolean().default(true).label('Is Active'),
    settings: Joi.object({
      enableMemory: Joi.boolean().default(true),
      enableWebSearch: Joi.boolean().default(false),
      enableFileUpload: Joi.boolean().default(true),
      responseStyle: Joi.string().valid('professional', 'friendly', 'casual', 'formal').default('professional'),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ar').default('en'),
    }).label('Settings'),
  }).messages(customMessages),

  update: Joi.object({
    name: commonSchemas.name.optional(),
    description: Joi.string().max(1000).optional().label('Description'),
    model: Joi.string().valid('gpt-4', 'gpt-3.5-turbo', 'claude-3', 'claude-2').optional().label('Model'),
    temperature: Joi.number().min(0).max(2).optional().label('Temperature'),
    maxTokens: Joi.number().integer().min(1).max(4000).optional().label('Max Tokens'),
    systemPrompt: Joi.string().max(5000).optional().label('System Prompt'),
    isActive: Joi.boolean().optional().label('Is Active'),
    settings: Joi.object({
      enableMemory: Joi.boolean(),
      enableWebSearch: Joi.boolean(),
      enableFileUpload: Joi.boolean(),
      responseStyle: Joi.string().valid('professional', 'friendly', 'casual', 'formal'),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ar'),
    }).optional().label('Settings'),
  }).min(1).messages(customMessages),

  chat: Joi.object({
    message: Joi.string().min(1).max(5000).required().label('Message'),
    conversationId: Joi.string().uuid().optional().label('Conversation ID'),
    context: Joi.object().optional().label('Context'),
  }).messages(customMessages),
};

// Document validation schemas
export const documentSchemas = {
  upload: Joi.object({
    agentId: commonSchemas.id.optional(),
    category: Joi.string().valid('KNOWLEDGE_BASE', 'FAQ', 'POLICY', 'MANUAL', 'OTHER').default('KNOWLEDGE_BASE').label('Category'),
    tags: Joi.array().items(Joi.string().max(50)).max(10).label('Tags'),
    isPublic: Joi.boolean().default(false).label('Is Public'),
  }).messages(customMessages),

  update: Joi.object({
    name: Joi.string().min(1).max(255).optional().label('Name'),
    category: Joi.string().valid('KNOWLEDGE_BASE', 'FAQ', 'POLICY', 'MANUAL', 'OTHER').optional().label('Category'),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional().label('Tags'),
    isPublic: Joi.boolean().optional().label('Is Public'),
  }).min(1).messages(customMessages),

  search: Joi.object({
    query: commonSchemas.search,
    agentId: commonSchemas.id.optional(),
    category: Joi.string().valid('KNOWLEDGE_BASE', 'FAQ', 'POLICY', 'MANUAL', 'OTHER').optional().label('Category'),
    tags: Joi.array().items(Joi.string()).optional().label('Tags'),
    limit: Joi.number().integer().min(1).max(50).default(10).label('Limit'),
  }).messages(customMessages),
};

// Channel validation schemas
export const channelSchemas = {
  create: Joi.object({
    name: commonSchemas.name,
    type: Joi.string().valid('WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'WEBCHAT', 'EMAIL', 'SMS').required().label('Type'),
    agentId: commonSchemas.id,
    config: Joi.object().required().label('Configuration'),
    isActive: Joi.boolean().default(true).label('Is Active'),
  }).messages(customMessages),

  update: Joi.object({
    name: commonSchemas.name.optional(),
    agentId: commonSchemas.id.optional(),
    config: Joi.object().optional().label('Configuration'),
    isActive: Joi.boolean().optional().label('Is Active'),
  }).min(1).messages(customMessages),

  webhook: Joi.object({
    type: Joi.string().required().label('Type'),
    data: Joi.object().required().label('Data'),
    signature: Joi.string().optional().label('Signature'),
  }).messages(customMessages),
};

// Conversation validation schemas
export const conversationSchemas = {
  create: Joi.object({
    channelId: commonSchemas.id,
    customerInfo: Joi.object({
      name: Joi.string().max(255).label('Customer Name'),
      email: commonSchemas.email.optional(),
      phone: commonSchemas.phone.optional(),
      metadata: Joi.object().label('Metadata'),
    }).label('Customer Info'),
  }).messages(customMessages),

  update: Joi.object({
    agentId: commonSchemas.id.optional(),
    status: Joi.string().valid('ACTIVE', 'RESOLVED', 'CLOSED').optional().label('Status'),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional().label('Priority'),
    tags: Joi.array().items(Joi.string()).optional().label('Tags'),
  }).min(1).messages(customMessages),

  sendMessage: Joi.object({
    content: Joi.string().min(1).max(5000).required().label('Content'),
    type: Joi.string().valid('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO').default('TEXT').label('Type'),
    metadata: Joi.object().optional().label('Metadata'),
  }).messages(customMessages),

  updateStatus: Joi.object({
    status: Joi.string().valid('ACTIVE', 'RESOLVED', 'CLOSED').required().label('Status'),
    resolution: Joi.string().max(1000).optional().label('Resolution'),
  }).messages(customMessages),
};

// Analytics validation schemas
export const analyticsSchemas = {
  query: Joi.object({
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
    interval: Joi.string().valid('hour', 'day', 'week', 'month').default('day').label('Interval'),
  }).messages(customMessages),

  conversations: Joi.object({
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
    interval: Joi.string().valid('hour', 'day', 'week', 'month').default('day').label('Interval'),
    channelId: commonSchemas.id.optional(),
    agentId: commonSchemas.id.optional(),
  }).messages(customMessages),

  messages: Joi.object({
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
    interval: Joi.string().valid('hour', 'day', 'week', 'month').default('day').label('Interval'),
    channelId: commonSchemas.id.optional(),
    agentId: commonSchemas.id.optional(),
  }).messages(customMessages),

  agents: Joi.object({
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
    agentId: commonSchemas.id.optional(),
  }).messages(customMessages),

  channels: Joi.object({
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
    channelId: commonSchemas.id.optional(),
  }).messages(customMessages),

  customers: Joi.object({
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
  }).messages(customMessages),

  export: Joi.object({
    type: Joi.string().valid('conversations', 'messages', 'agents', 'channels', 'customers').required().label('Type'),
    period: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y').default('7d').label('Period'),
    startDate: commonSchemas.dateRange.startDate.optional(),
    endDate: commonSchemas.dateRange.endDate.optional(),
    format: Joi.string().valid('json', 'csv', 'xlsx').default('json').label('Format'),
  }).messages(customMessages),
};

// Tenant validation schemas
export const tenantSchemas = {
  update: Joi.object({
    name: commonSchemas.name.optional(),
    settings: Joi.object({
      theme: Joi.string().valid('light', 'dark').optional(),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ar').optional(),
      timezone: Joi.string().optional(),
      branding: Joi.object({
        logo: commonSchemas.url.optional(),
        primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
        secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
      }).optional(),
    }).optional().label('Settings'),
  }).min(1).messages(customMessages),

  subscription: Joi.object({
    plan: Joi.string().valid('STARTER', 'PROFESSIONAL', 'ENTERPRISE').required().label('Plan'),
    billingCycle: Joi.string().valid('MONTHLY', 'YEARLY').default('MONTHLY').label('Billing Cycle'),
  }).messages(customMessages),
};

// API Key validation schemas
export const apiKeySchemas = {
  create: Joi.object({
    name: commonSchemas.name,
    description: Joi.string().max(500).optional().label('Description'),
    permissions: Joi.array().items(Joi.string()).min(1).required().label('Permissions'),
    expiresAt: Joi.date().iso().greater('now').optional().label('Expires At'),
  }).messages(customMessages),

  update: Joi.object({
    name: commonSchemas.name.optional(),
    description: Joi.string().max(500).optional().label('Description'),
    permissions: Joi.array().items(Joi.string()).min(1).optional().label('Permissions'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').optional().label('Status'),
  }).min(1).messages(customMessages),
};

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.warn('Validation failed', {
        source,
        errors: details,
        url: req.url,
        method: req.method,
        ip: req.ip,
      });

      throw new ValidationError('Validation failed', details);
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

// Validate body
export const validateBody = (schema: Joi.ObjectSchema) => validate(schema, 'body');

// Validate query parameters
export const validateQuery = (schema: Joi.ObjectSchema) => validate(schema, 'query');

// Validate URL parameters
export const validateParams = (schema: Joi.ObjectSchema) => validate(schema, 'params');

// Common parameter validation
export const validateId = validateParams(Joi.object({
  id: commonSchemas.id,
}));

// Pagination validation
export const validatePagination = validateQuery(Joi.object(commonSchemas.pagination));

// Search validation
export const validateSearch = validateQuery(Joi.object({
  q: commonSchemas.search.optional(),
  ...commonSchemas.pagination,
}));

// Date range validation
export const validateDateRange = validateQuery(Joi.object({
  ...commonSchemas.dateRange,
  ...commonSchemas.pagination,
}));

// File upload validation
export const validateFileUpload = (allowedTypes: string[], maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      throw new ValidationError('No file uploaded');
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    for (const file of files) {
      if (!file) continue;
      
      // Check file size
      if (file.size > maxSize) {
        throw new ValidationError(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      }

      // Check file type
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedTypes.includes(fileExtension)) {
        throw new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    next();
  };
};

// Custom validation helpers
export const customValidators = {
  // Validate UUID
  isUUID: (value: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  // Validate email
  isEmail: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  // Validate phone number
  isPhone: (value: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(value);
  },

  // Validate URL
  isURL: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  // Validate slug
  isSlug: (value: string): boolean => {
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(value);
  },

  // Validate hex color
  isHexColor: (value: string): boolean => {
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    return hexColorRegex.test(value);
  },
};

export default {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateId,
  validatePagination,
  validateSearch,
  validateDateRange,
  validateFileUpload,
  customValidators,
  commonSchemas,
  userSchemas,
  agentSchemas,
  documentSchemas,
  channelSchemas,
  conversationSchemas,
  analyticsSchemas,
  tenantSchemas,
  apiKeySchemas,
};