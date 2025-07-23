import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/config';
import logger from '../utils/logger';

export type AIProvider = 'openai' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: AIProvider;
}

export interface ChatCompletionResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: AIProvider;
}

export interface EmbeddingResponse {
  embedding: number[];
  tokensUsed: number;
  model: string;
  provider: AIProvider;
}

class AIProviderService {
  private openai: OpenAI;
  private gemini: GoogleGenerativeAI;
  private defaultProvider: AIProvider;

  constructor() {
    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Initialize Gemini
    this.gemini = new GoogleGenerativeAI(config.geminiApiKey);
    
    // Set default provider from config
    this.defaultProvider = (config.defaultAIProvider as AIProvider) || 'openai';
  }

  /**
   * Generate chat completion using specified or default AI provider
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const provider = options.provider || this.defaultProvider;
    
    try {
      switch (provider) {
        case 'openai':
          return await this.generateOpenAICompletion(messages, options);
        case 'gemini':
          return await this.generateGeminiCompletion(messages, options);
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`AI completion failed with ${provider}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider,
        messageCount: messages.length,
      });
      throw error;
    }
  }

  /**
   * Generate embeddings using specified or default AI provider
   */
  async generateEmbedding(
    text: string,
    options: { provider?: AIProvider; model?: string } = {}
  ): Promise<EmbeddingResponse> {
    const provider = options.provider || this.defaultProvider;
    
    try {
      switch (provider) {
        case 'openai':
          return await this.generateOpenAIEmbedding(text, options.model);
        case 'gemini':
          return await this.generateGeminiEmbedding(text, options.model);
        default:
          throw new Error(`Unsupported AI provider for embeddings: ${provider}`);
      }
    } catch (error) {
      logger.error(`Embedding generation failed with ${provider}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider,
        textLength: text.length,
      });
      throw error;
    }
  }

  /**
   * Generate batch embeddings
   */
  async generateBatchEmbeddings(
    texts: string[],
    options: { provider?: AIProvider; model?: string } = {}
  ): Promise<EmbeddingResponse[]> {
    const provider = options.provider || this.defaultProvider;
    
    try {
      switch (provider) {
        case 'openai':
          return await this.generateOpenAIBatchEmbeddings(texts, options.model);
        case 'gemini':
          // Gemini doesn't support batch embeddings, fallback to OpenAI for consistency
          logger.warn('Gemini batch embeddings not available, falling back to OpenAI');
          return await this.generateOpenAIBatchEmbeddings(texts, config.openaiEmbeddingModel);
        default:
          throw new Error(`Unsupported AI provider for batch embeddings: ${provider}`);
      }
    } catch (error) {
      logger.error(`Batch embedding generation failed with ${provider}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider,
        batchSize: texts.length,
      });
      throw error;
    }
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: AIProvider): string[] {
    switch (provider) {
      case 'openai':
        return [
          'gpt-4',
          'gpt-4-turbo',
          'gpt-4-turbo-preview',
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
        ];
      case 'gemini':
        return [
          'gemini-pro',
          'gemini-pro-vision',
          'gemini-1.5-pro',
          'gemini-1.5-flash',
        ];
      default:
        return [];
    }
  }

  /**
   * Get available embedding models for a provider
   */
  getAvailableEmbeddingModels(provider: AIProvider): string[] {
    switch (provider) {
      case 'openai':
        return [
          'text-embedding-ada-002',
          'text-embedding-3-small',
          'text-embedding-3-large',
        ];
      case 'gemini':
        // Note: Gemini embeddings fallback to OpenAI in current implementation
        return [
          'text-embedding-ada-002', // Fallback model
        ];
      default:
        return [];
    }
  }

  /**
   * Test provider connectivity
   */
  async testProvider(provider: AIProvider): Promise<{ success: boolean; error?: string; capabilities?: any }> {
    try {
      const testMessage: ChatMessage[] = [
        { role: 'user', content: 'Hello, this is a test message.' }
      ];
      
      await this.generateChatCompletion(testMessage, { 
        provider,
        maxTokens: 10,
        temperature: 0
      });
      
      const capabilities = this.getProviderCapabilities(provider);
      
      return { 
        success: true,
        capabilities
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private methods for OpenAI
  private async generateOpenAICompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const model = options.model || config.openaiModel || 'gpt-3.5-turbo';
    
    const completion = await this.openai.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 500,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      tokensUsed: completion.usage?.total_tokens || 0,
      model,
      provider: 'openai',
    };
  }

  private async generateOpenAIEmbedding(
    text: string,
    model?: string
  ): Promise<EmbeddingResponse> {
    const embeddingModel = model || config.openaiEmbeddingModel || 'text-embedding-ada-002';
    
    const response = await this.openai.embeddings.create({
      model: embeddingModel,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage?.total_tokens || 0,
      model: embeddingModel,
      provider: 'openai',
    };
  }

  private async generateOpenAIBatchEmbeddings(
    texts: string[],
    model?: string
  ): Promise<EmbeddingResponse[]> {
    const embeddingModel = model || config.openaiEmbeddingModel || 'text-embedding-ada-002';
    
    const response = await this.openai.embeddings.create({
      model: embeddingModel,
      input: texts,
    });

    return response.data.map((item, index) => ({
      embedding: item.embedding,
      tokensUsed: Math.floor((response.usage?.total_tokens || 0) / texts.length),
      model: embeddingModel,
      provider: 'openai',
    }));
  }

  // Private methods for Gemini
  private async generateGeminiCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    const model = options.model || config.geminiModel || 'gemini-pro';
    const genAI = this.gemini.getGenerativeModel({ model });

    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    let prompt = '';
    if (systemMessage) {
      prompt += `System: ${systemMessage.content}\n\n`;
    }
    
    // Add conversation history
    conversationMessages.forEach(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      prompt += `${role}: ${msg.content}\n`;
    });
    
    prompt += 'Assistant:';

    const result = await genAI.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    return {
      content,
      tokensUsed: 0, // v0.1.3 doesn't provide token usage
      model,
      provider: 'gemini',
    };
  }

  private async generateGeminiEmbedding(
    text: string,
    model?: string
  ): Promise<EmbeddingResponse> {
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    // For now, fallback to OpenAI for embeddings when Gemini is requested
    // This ensures compatibility while maintaining the provider abstraction
    logger.warn('Gemini embeddings not available in v0.1.3, falling back to OpenAI');
    return await this.generateOpenAIEmbedding(text, config.openaiEmbeddingModel);
  }

  /**
   * Get current default provider
   */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider;
  }

  /**
   * Get embedding provider (always returns 'openai' for consistency)
   */
  getEmbeddingProvider(): AIProvider {
    // Always use OpenAI for embeddings to ensure consistency
    return 'openai';
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: AIProvider): void {
    this.defaultProvider = provider;
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(provider: AIProvider): {
    chatCompletion: boolean;
    embeddings: boolean;
    batchEmbeddings: boolean;
    streaming: boolean;
  } {
    switch (provider) {
      case 'openai':
        return {
          chatCompletion: true,
          embeddings: true,
          batchEmbeddings: true,
          streaming: true,
        };
      case 'gemini':
        return {
          chatCompletion: true,
          embeddings: false, // Fallback to OpenAI
          batchEmbeddings: false, // Fallback to OpenAI
          streaming: false,
        };
      default:
        return {
          chatCompletion: false,
          embeddings: false,
          batchEmbeddings: false,
          streaming: false,
        };
    }
  }
}

// Export singleton instance
export const aiProvider = new AIProviderService();
export default aiProvider;