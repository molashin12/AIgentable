import { config } from './config';
import logger from '../utils/logger';

// RAG System Configuration
export interface RAGConfig {
  // Search Strategy Configuration
  search: {
    defaultStrategy: 'semantic' | 'keyword' | 'hybrid';
    hybridWeights: {
      semantic: number;
      keyword: number;
    };
    similarityThresholds: {
      semantic: number;
      keyword: number;
      hybrid: number;
    };
    maxResults: {
      semantic: number;
      keyword: number;
      hybrid: number;
    };
    enableReranking: boolean;
    rerankingBoosts: {
      pdfFiles: number;
      firstChunks: number;
      recentDocuments: number;
      optimalLength: number;
    };
  };
  
  // Embedding Configuration
  embeddings: {
    defaultProvider: 'openai' | 'gemini';
    fallbackProvider: 'openai' | 'gemini';
    models: {
      openai: string;
      gemini: string; // Fallback model when Gemini embeddings not available
    };
    batchSize: number;
    retryAttempts: number;
  };
  
  // Context Window Management
  context: {
    maxDocuments: number;
    maxTokensPerDocument: number;
    totalMaxTokens: number;
    includeSourceInfo: boolean;
    includeSimilarityScores: boolean;
  };
  
  // Collection Management
  collections: {
    autoCleanup: boolean;
    cleanupThresholdDays: number;
    maxDocumentsPerAgent: number;
    enableTenantIsolation: boolean;
  };
  
  // Performance Settings
  performance: {
    cacheResults: boolean;
    cacheTTL: number; // in seconds
    enableMetrics: boolean;
    logSearchQueries: boolean;
  };
}

// Default RAG Configuration
export const defaultRAGConfig: RAGConfig = {
  search: {
    defaultStrategy: 'hybrid',
    hybridWeights: {
      semantic: 0.7,
      keyword: 0.3,
    },
    similarityThresholds: {
      semantic: 0.7,
      keyword: 0.5,
      hybrid: 0.6,
    },
    maxResults: {
      semantic: 5,
      keyword: 10,
      hybrid: 5,
    },
    enableReranking: true,
    rerankingBoosts: {
      pdfFiles: 1.1,
      firstChunks: 1.05,
      recentDocuments: 1.02,
      optimalLength: 1.03,
    },
  },
  
  embeddings: {
    defaultProvider: 'openai',
    fallbackProvider: 'openai',
    models: {
      openai: 'text-embedding-ada-002',
      gemini: 'text-embedding-ada-002', // Fallback to OpenAI
    },
    batchSize: 100,
    retryAttempts: 3,
  },
  
  context: {
    maxDocuments: 3,
    maxTokensPerDocument: 1000,
    totalMaxTokens: 3000,
    includeSourceInfo: true,
    includeSimilarityScores: true,
  },
  
  collections: {
    autoCleanup: true,
    cleanupThresholdDays: 90,
    maxDocumentsPerAgent: 10000,
    enableTenantIsolation: true,
  },
  
  performance: {
    cacheResults: false, // Disabled by default for real-time accuracy
    cacheTTL: 300, // 5 minutes
    enableMetrics: true,
    logSearchQueries: true,
  },
};

// Environment-based configuration overrides
function getRAGConfigFromEnv(): Partial<RAGConfig> {
  const envConfig: Partial<RAGConfig> = {};
  
  // Search configuration
  if (process.env.RAG_DEFAULT_STRATEGY) {
    envConfig.search = {
      ...defaultRAGConfig.search,
      defaultStrategy: process.env.RAG_DEFAULT_STRATEGY as 'semantic' | 'keyword' | 'hybrid',
    };
  }
  
  if (process.env.RAG_SEMANTIC_WEIGHT && process.env.RAG_KEYWORD_WEIGHT) {
    const semanticWeight = parseFloat(process.env.RAG_SEMANTIC_WEIGHT);
    const keywordWeight = parseFloat(process.env.RAG_KEYWORD_WEIGHT);
    
    if (Math.abs(semanticWeight + keywordWeight - 1.0) < 0.01) {
      envConfig.search = {
        ...envConfig.search || defaultRAGConfig.search,
        hybridWeights: {
          semantic: semanticWeight,
          keyword: keywordWeight,
        },
      };
    } else {
      logger.warn('RAG hybrid weights do not sum to 1.0, using defaults');
    }
  }
  
  // Embedding configuration
  if (process.env.RAG_EMBEDDING_PROVIDER) {
    envConfig.embeddings = {
      ...defaultRAGConfig.embeddings,
      defaultProvider: process.env.RAG_EMBEDDING_PROVIDER as 'openai' | 'gemini',
    };
  }
  
  // Context configuration
  if (process.env.RAG_MAX_DOCUMENTS) {
    envConfig.context = {
      ...defaultRAGConfig.context,
      maxDocuments: parseInt(process.env.RAG_MAX_DOCUMENTS),
    };
  }
  
  if (process.env.RAG_MAX_TOKENS_PER_DOC) {
    envConfig.context = {
      ...envConfig.context || defaultRAGConfig.context,
      maxTokensPerDocument: parseInt(process.env.RAG_MAX_TOKENS_PER_DOC),
    };
  }
  
  // Performance configuration
  if (process.env.RAG_ENABLE_CACHE) {
    envConfig.performance = {
      ...defaultRAGConfig.performance,
      cacheResults: process.env.RAG_ENABLE_CACHE === 'true',
    };
  }
  
  if (process.env.RAG_CACHE_TTL) {
    envConfig.performance = {
      ...envConfig.performance || defaultRAGConfig.performance,
      cacheTTL: parseInt(process.env.RAG_CACHE_TTL),
    };
  }
  
  return envConfig;
}

// Merge default config with environment overrides
export const ragConfig: RAGConfig = {
  ...defaultRAGConfig,
  ...getRAGConfigFromEnv(),
};

// Configuration validation
export function validateRAGConfig(config: RAGConfig): boolean {
  try {
    // Validate hybrid weights sum to 1
    const weightSum = config.search.hybridWeights.semantic + config.search.hybridWeights.keyword;
    if (Math.abs(weightSum - 1.0) > 0.01) {
      logger.error('RAG Config validation failed: hybrid weights must sum to 1.0');
      return false;
    }
    
    // Validate similarity thresholds are between 0 and 1
    const thresholds = Object.values(config.search.similarityThresholds);
    if (thresholds.some(t => t < 0 || t > 1)) {
      logger.error('RAG Config validation failed: similarity thresholds must be between 0 and 1');
      return false;
    }
    
    // Validate max results are positive
    const maxResults = Object.values(config.search.maxResults);
    if (maxResults.some(r => r <= 0)) {
      logger.error('RAG Config validation failed: max results must be positive');
      return false;
    }
    
    // Validate context limits
    if (config.context.maxDocuments <= 0 || config.context.maxTokensPerDocument <= 0) {
      logger.error('RAG Config validation failed: context limits must be positive');
      return false;
    }
    
    logger.info('RAG configuration validated successfully', {
      strategy: config.search.defaultStrategy,
      embeddingProvider: config.embeddings.defaultProvider,
      maxDocuments: config.context.maxDocuments,
    });
    
    return true;
  } catch (error) {
    logger.error('RAG Config validation error:', error);
    return false;
  }
}

// Initialize and validate configuration
if (!validateRAGConfig(ragConfig)) {
  logger.warn('Using default RAG configuration due to validation errors');
}

// Export utility functions
export function getSearchStrategy(override?: string): 'semantic' | 'keyword' | 'hybrid' {
  if (override && ['semantic', 'keyword', 'hybrid'].includes(override)) {
    return override as 'semantic' | 'keyword' | 'hybrid';
  }
  return ragConfig.search.defaultStrategy;
}

export function getHybridWeights(semanticWeight?: number, keywordWeight?: number) {
  if (semanticWeight !== undefined && keywordWeight !== undefined) {
    const sum = semanticWeight + keywordWeight;
    if (Math.abs(sum - 1.0) < 0.01) {
      return { semantic: semanticWeight, keyword: keywordWeight };
    }
  }
  return ragConfig.search.hybridWeights;
}

export function getSimilarityThreshold(strategy: 'semantic' | 'keyword' | 'hybrid', override?: number): number {
  if (override !== undefined && override >= 0 && override <= 1) {
    return override;
  }
  return ragConfig.search.similarityThresholds[strategy];
}

export function getMaxResults(strategy: 'semantic' | 'keyword' | 'hybrid', override?: number): number {
  if (override !== undefined && override > 0) {
    return override;
  }
  return ragConfig.search.maxResults[strategy];
}

// Export configuration for external use
export { ragConfig as default };