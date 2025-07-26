export type EmbeddingProvider = 'openai' | 'gemini';

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: EmbeddingProvider;
  dimensions: number;
  usage?: {
    totalTokens: number;
  };
}

export interface EmbeddingOptions {
  provider?: EmbeddingProvider;
  batchSize?: number;
  timeout?: number;
}

export interface TextSimilarityResult {
  similarity: number;
  text1: string;
  text2: string;
  provider: EmbeddingProvider;
}

export interface SimilarText {
  text: string;
  similarity: number;
  index: number;
}

export interface EmbeddingModelInfo {
  model: string;
  dimensions: number;
  maxTokens: number;
}

export interface EmbeddingProvidersResponse {
  providers: EmbeddingProvider[];
  models: Record<EmbeddingProvider, EmbeddingModelInfo>;
}

export interface EmbeddingRequest {
  text: string;
  provider?: EmbeddingProvider;
}

export interface BatchEmbeddingRequest {
  texts: string[];
  provider?: EmbeddingProvider;
  batchSize?: number;
}

export interface SimilarityRequest {
  text1: string;
  text2: string;
  provider?: EmbeddingProvider;
}

export interface SimilarTextsRequest {
  queryText: string;
  candidateTexts: string[];
  topK?: number;
  provider?: EmbeddingProvider;
}

export interface EmbeddingApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Utility types for embedding operations
export interface EmbeddingAnalysis {
  textLength: number;
  estimatedTokens: number;
  isWithinLimits: boolean;
  recommendedProvider: EmbeddingProvider;
  chunks?: string[];
}

export interface EmbeddingComparison {
  provider1: EmbeddingProvider;
  provider2: EmbeddingProvider;
  similarity: number;
  dimensions1: number;
  dimensions2: number;
  processingTime1: number;
  processingTime2: number;
}

export interface EmbeddingBenchmark {
  provider: EmbeddingProvider;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  totalRequests: number;
}

// Document processing with embeddings
export interface DocumentEmbedding {
  documentId: string;
  chunks: Array<{
    text: string;
    embedding: number[];
    metadata: Record<string, any>;
  }>;
  provider: EmbeddingProvider;
  model: string;
  createdAt: string;
}

export interface EmbeddingSearchResult {
  documentId: string;
  chunkIndex: number;
  text: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface SemanticSearchRequest {
  query: string;
  provider?: EmbeddingProvider;
  topK?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface SemanticSearchResponse {
  results: EmbeddingSearchResult[];
  totalResults: number;
  processingTime: number;
  provider: EmbeddingProvider;
}

// Training and fine-tuning related types
export interface EmbeddingTrainingData {
  texts: string[];
  labels?: string[];
  metadata?: Record<string, any>[];
}

export interface EmbeddingCluster {
  id: string;
  centroid: number[];
  texts: string[];
  similarity: number;
  size: number;
}

export interface EmbeddingClustering {
  clusters: EmbeddingCluster[];
  totalClusters: number;
  averageSimilarity: number;
  provider: EmbeddingProvider;
}

// Error types
export interface EmbeddingError {
  code: string;
  message: string;
  provider?: EmbeddingProvider;
  details?: Record<string, any>;
}

export class EmbeddingValidationError extends Error {
  constructor(
    message: string,
    public provider?: EmbeddingProvider,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'EmbeddingValidationError';
  }
}

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    public provider: EmbeddingProvider,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
  }
}