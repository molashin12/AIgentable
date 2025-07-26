import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config/config';
import logger from '../utils/logger';
import { AIProvider } from './langchainProvider';

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: AIProvider;
  dimensions: number;
  usage?: {
    totalTokens: number;
  };
}

export interface EmbeddingOptions {
  provider?: AIProvider;
  batchSize?: number;
  timeout?: number;
}

export interface TextSimilarityResult {
  similarity: number;
  text1: string;
  text2: string;
  provider: AIProvider;
}

class EmbeddingService {
  private openaiEmbeddings: OpenAIEmbeddings;
  private geminiEmbeddings: GoogleGenerativeAIEmbeddings;
  private defaultProvider: AIProvider;

  constructor() {
    this.openaiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiEmbeddingModel || 'text-embedding-ada-002',
    });

    this.geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.geminiApiKey,
      modelName: 'gemini-embedding-001',
    });

    this.defaultProvider = 'gemini'; // Default to Gemini for better performance
  }

  /**
   * Get embeddings instance for the specified provider
   */
  private getEmbeddingsInstance(provider: AIProvider): OpenAIEmbeddings | GoogleGenerativeAIEmbeddings {
    switch (provider) {
      case 'openai':
        return this.openaiEmbeddings;
      case 'gemini':
        return this.geminiEmbeddings;
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  /**
   * Generate embeddings for a single text
   */
  async embedText(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    const provider = options.provider || this.defaultProvider;
    const startTime = Date.now();

    try {
      const embeddingsInstance = this.getEmbeddingsInstance(provider);
      const embeddings = await embeddingsInstance.embedQuery(text);
      
      const result: EmbeddingResult = {
        embeddings: [embeddings],
        model: provider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-ada-002',
        provider,
        dimensions: embeddings.length,
      };

      const processingTime = Date.now() - startTime;
      logger.info(`Generated embedding for text using ${provider} in ${processingTime}ms`);
      
      return result;
    } catch (error) {
      logger.error(`Error generating embedding with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedTexts(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    const provider = options.provider || this.defaultProvider;
    const batchSize = options.batchSize || 100;
    const startTime = Date.now();

    try {
      const embeddingsInstance = this.getEmbeddingsInstance(provider);
      const allEmbeddings: number[][] = [];
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await embeddingsInstance.embedDocuments(batch);
        allEmbeddings.push(...batchEmbeddings);
        
        // Add small delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const result: EmbeddingResult = {
        embeddings: allEmbeddings,
        model: provider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-ada-002',
        provider,
        dimensions: allEmbeddings[0]?.length || 0,
        usage: {
          totalTokens: texts.reduce((sum, text) => sum + text.length, 0)
        }
      };

      const processingTime = Date.now() - startTime;
      logger.info(`Generated ${allEmbeddings.length} embeddings using ${provider} in ${processingTime}ms`);
      
      return result;
    } catch (error) {
      logger.error(`Error generating embeddings with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two texts
   */
  async calculateSimilarity(
    text1: string,
    text2: string,
    options: EmbeddingOptions = {}
  ): Promise<TextSimilarityResult> {
    const provider = options.provider || this.defaultProvider;
    
    try {
      const [embedding1, embedding2] = await Promise.all([
        this.embedText(text1, { provider }),
        this.embedText(text2, { provider })
      ]);

      const similarity = this.cosineSimilarity(
        embedding1.embeddings[0],
        embedding2.embeddings[0]
      );

      return {
        similarity,
        text1,
        text2,
        provider
      };
    } catch (error) {
      logger.error(`Error calculating similarity with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Find most similar texts from a collection
   */
  async findSimilarTexts(
    queryText: string,
    candidateTexts: string[],
    topK: number = 5,
    options: EmbeddingOptions = {}
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    const provider = options.provider || this.defaultProvider;
    
    try {
      const [queryEmbedding, candidateEmbeddings] = await Promise.all([
        this.embedText(queryText, { provider }),
        this.embedTexts(candidateTexts, { provider })
      ]);

      const similarities = candidateEmbeddings.embeddings.map((embedding, index) => ({
        text: candidateTexts[index],
        similarity: this.cosineSimilarity(queryEmbedding.embeddings[0], embedding),
        index
      }));

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      logger.error(`Error finding similar texts with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Get available embedding providers
   */
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    
    if (config.openaiApiKey) {
      providers.push('openai');
    }
    
    if (config.geminiApiKey) {
      providers.push('gemini');
    }
    
    return providers;
  }

  /**
   * Get embedding model info for a provider
   */
  getModelInfo(provider: AIProvider): { model: string; dimensions: number; maxTokens: number } {
    switch (provider) {
      case 'openai':
        return {
          model: 'text-embedding-ada-002',
          dimensions: 1536,
          maxTokens: 8191
        };
      case 'gemini':
        return {
          model: 'gemini-embedding-001',
          dimensions: 768,
          maxTokens: 2048
        };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Validate text length for embedding
   */
  validateTextLength(text: string, provider: AIProvider): boolean {
    const modelInfo = this.getModelInfo(provider);
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedTokens = text.length / 4;
    return estimatedTokens <= modelInfo.maxTokens;
  }

  /**
   * Chunk text if it's too long for embedding
   */
  chunkTextForEmbedding(text: string, provider: AIProvider, overlap: number = 100): string[] {
    const modelInfo = this.getModelInfo(provider);
    const maxChars = modelInfo.maxTokens * 4; // Rough estimation
    
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      start = end - overlap;
    }
    
    return chunks;
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;