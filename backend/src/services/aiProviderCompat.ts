import { langchainProvider } from './langchainProvider';
import {
  AIProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResponse,
  EmbeddingResponse
} from './langchainProvider';
import logger from '../utils/logger';

/**
 * Compatibility wrapper for the existing aiProvider.ts interface
 * This ensures backward compatibility while using LangChain underneath
 */
class AIProviderCompatService {
  /**
   * Generate chat completion using specified or default AI provider
   * Maintains exact same interface as original aiProvider.ts
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    return await langchainProvider.generateChatCompletion(messages, options);
  }

  /**
   * Generate embedding using specified or default AI provider
   * Maintains exact same interface as original aiProvider.ts
   */
  async generateEmbedding(
    text: string,
    options: { provider?: AIProvider; model?: string } = {}
  ): Promise<EmbeddingResponse> {
    return await langchainProvider.generateEmbedding(text, options);
  }

  /**
   * Generate batch embeddings
   * Maintains exact same interface as original aiProvider.ts
   */
  async generateBatchEmbeddings(
    texts: string[],
    options: { provider?: AIProvider; model?: string } = {}
  ): Promise<EmbeddingResponse[]> {
    return await langchainProvider.generateBatchEmbeddings(texts, options);
  }

  /**
   * Get available models for a provider
   * Maintains exact same interface as original aiProvider.ts
   */
  getAvailableModels(provider: AIProvider): string[] {
    return langchainProvider.getAvailableModels(provider);
  }

  /**
   * Get available embedding models for a provider
   * Maintains exact same interface as original aiProvider.ts
   */
  getAvailableEmbeddingModels(provider: AIProvider): string[] {
    return langchainProvider.getAvailableEmbeddingModels(provider);
  }

  /**
   * Test provider connectivity and capabilities
   * Maintains exact same interface as original aiProvider.ts
   */
  async testProvider(provider: AIProvider): Promise<{ success: boolean; error?: string; capabilities?: any }> {
    return await langchainProvider.testProvider(provider);
  }

  /**
   * Get default provider
   * Maintains exact same interface as original aiProvider.ts
   */
  getDefaultProvider(): AIProvider {
    return langchainProvider.getDefaultProvider();
  }

  /**
   * Set default provider
   * Maintains exact same interface as original aiProvider.ts
   */
  setDefaultProvider(provider: AIProvider): void {
    langchainProvider.setDefaultProvider(provider);
  }

  /**
   * Get embedding provider (always OpenAI for consistency)
   * Maintains exact same interface as original aiProvider.ts
   */
  getEmbeddingProvider(): AIProvider {
    return langchainProvider.getEmbeddingProvider();
  }

  /**
   * Get provider capabilities
   * Maintains exact same interface as original aiProvider.ts
   */
  getProviderCapabilities(provider: AIProvider): {
    chatCompletion: boolean;
    embeddings: boolean;
    batchEmbeddings: boolean;
    streaming: boolean;
  } {
    return langchainProvider.getProviderCapabilities(provider);
  }
}

// Export singleton instance with same name as original
export const aiProvider = new AIProviderCompatService();
export default aiProvider;

// Re-export types for compatibility
export {
  AIProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResponse,
  EmbeddingResponse
};