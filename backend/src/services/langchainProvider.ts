import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
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

class LangChainProviderService {
  private openaiChat: ChatOpenAI;
  private geminiChat: ChatGoogleGenerativeAI;
  private openaiEmbeddings: OpenAIEmbeddings;
  private geminiEmbeddings: GoogleGenerativeAIEmbeddings;
  private defaultProvider: AIProvider;
  private outputParser: StringOutputParser;

  constructor() {
    // Initialize output parser
    this.outputParser = new StringOutputParser();

    // Initialize OpenAI models
    this.openaiChat = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiModel || 'gpt-3.5-turbo',
      temperature: 0.7,
    });

    this.openaiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiEmbeddingModel || 'text-embedding-ada-002',
    });

    // Initialize Gemini models
    this.geminiChat = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: 'gemini-pro',
      temperature: 0.7,
    });

    this.geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.geminiApiKey,
      modelName: 'embedding-001',
    });

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
      const langchainMessages = this.convertToLangChainMessages(messages);
      
      if (provider === 'openai') {
        return await this.generateOpenAICompletion(langchainMessages, options);
      } else if (provider === 'gemini') {
        return await this.generateGeminiCompletion(langchainMessages, options);
      } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Error generating chat completion with ${provider}:`, error);
      
      // Retry with fallback provider if primary fails
      if (provider !== 'openai') {
        logger.info(`Retrying with OpenAI fallback...`);
        const langchainMessages = this.convertToLangChainMessages(messages);
        return await this.generateOpenAICompletion(langchainMessages, { ...options, provider: 'openai' });
      }
      
      throw error;
    }
  }

  /**
   * Generate embedding using specified or default AI provider
   */
  async generateEmbedding(
    text: string,
    options: { provider?: AIProvider; model?: string } = {}
  ): Promise<EmbeddingResponse> {
    const provider = options.provider || this.getEmbeddingProvider();
    
    try {
      if (provider === 'openai') {
        return await this.generateOpenAIEmbedding(text, options.model);
      } else if (provider === 'gemini') {
        return await this.generateGeminiEmbedding(text, options.model);
      } else {
        throw new Error(`Unsupported embedding provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Error generating embedding with ${provider}:`, error);
      
      // Fallback to OpenAI for embeddings
      if (provider !== 'openai') {
        logger.info(`Falling back to OpenAI for embeddings...`);
        return await this.generateOpenAIEmbedding(text, options.model);
      }
      
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
    const provider = options.provider || this.getEmbeddingProvider();
    
    try {
      if (provider === 'openai') {
        return await this.generateOpenAIBatchEmbeddings(texts, options.model);
      } else {
        // For non-OpenAI providers, process individually
        const embeddings = await Promise.all(
          texts.map(text => this.generateEmbedding(text, options))
        );
        return embeddings;
      }
    } catch (error) {
      logger.error(`Error generating batch embeddings with ${provider}:`, error);
      
      // Fallback to OpenAI
      if (provider !== 'openai') {
        logger.info(`Falling back to OpenAI for batch embeddings...`);
        return await this.generateOpenAIBatchEmbeddings(texts, options.model);
      }
      
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
        return [
          'embedding-001',
        ];
      default:
        return [];
    }
  }

  /**
   * Test provider connectivity and capabilities
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

  /**
   * Get default provider
   */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider;
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: AIProvider): void {
    this.defaultProvider = provider;
  }

  /**
   * Get embedding provider (always OpenAI for consistency)
   */
  getEmbeddingProvider(): AIProvider {
    return 'openai';
  }

  /**
   * Get chat model instance for LangChain chains
   */
  async getChatModel(provider?: AIProvider): Promise<ChatOpenAI | ChatGoogleGenerativeAI> {
    const selectedProvider = provider || this.defaultProvider;
    
    if (selectedProvider === 'openai') {
      return this.openaiChat;
    } else if (selectedProvider === 'gemini') {
      return this.geminiChat;
    } else {
      throw new Error(`Unsupported chat model provider: ${selectedProvider}`);
    }
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
          embeddings: true,
          batchEmbeddings: false,
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

  // Private helper methods

  private convertToLangChainMessages(messages: ChatMessage[]): BaseMessage[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage(msg.content);
        default:
          throw new Error(`Unknown message role: ${msg.role}`);
      }
    });
  }

  private async generateOpenAICompletion(
    messages: BaseMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const model = options.model || config.openaiModel || 'gpt-3.5-turbo';
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens;

    // Create new instance with updated configuration
    this.openaiChat = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: model,
      temperature,
      maxTokens,
    });

    const chain = RunnableSequence.from([
      this.openaiChat,
      this.outputParser,
    ]);

    const response = await chain.invoke(messages);

    return {
      content: response,
      tokensUsed: 0, // LangChain doesn't provide token usage by default
      model,
      provider: 'openai'
    };
  }

  private async generateGeminiCompletion(
    messages: BaseMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const model = options.model || 'gemini-pro';
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens;

    // Create new instance with updated configuration
    this.geminiChat = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: model,
      temperature,
      maxOutputTokens: maxTokens,
    });

    const chain = RunnableSequence.from([
      this.geminiChat,
      this.outputParser,
    ]);

    const response = await chain.invoke(messages);

    return {
      content: response,
      tokensUsed: 0, // LangChain doesn't provide token usage by default
      model,
      provider: 'gemini'
    };
  }

  private async generateOpenAIEmbedding(
    text: string,
    model?: string
  ): Promise<EmbeddingResponse> {
    const embeddingModel = model || config.openaiEmbeddingModel || 'text-embedding-ada-002';
    
    // Create new instance with updated model
    this.openaiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: embeddingModel,
    });

    const embedding = await this.openaiEmbeddings.embedQuery(text);

    return {
      embedding,
      tokensUsed: 0, // LangChain doesn't provide token usage by default
      model: embeddingModel,
      provider: 'openai'
    };
  }

  private async generateGeminiEmbedding(
    text: string,
    model?: string
  ): Promise<EmbeddingResponse> {
    const embeddingModel = model || 'embedding-001';
    
    // Create new instance with updated model
    this.geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.geminiApiKey,
      modelName: embeddingModel,
    });

    const embedding = await this.geminiEmbeddings.embedQuery(text);

    return {
      embedding,
      tokensUsed: 0, // LangChain doesn't provide token usage by default
      model: embeddingModel,
      provider: 'gemini'
    };
  }

  private async generateOpenAIBatchEmbeddings(
    texts: string[],
    model?: string
  ): Promise<EmbeddingResponse[]> {
    const embeddingModel = model || config.openaiEmbeddingModel || 'text-embedding-ada-002';
    
    // Create new instance with updated model
    this.openaiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: embeddingModel,
    });

    const embeddings = await this.openaiEmbeddings.embedDocuments(texts);

    return embeddings.map(embedding => ({
      embedding,
      tokensUsed: 0, // LangChain doesn't provide token usage by default
      model: embeddingModel,
      provider: 'openai' as AIProvider
    }));
  }
}

// Export singleton instance
export const langchainProvider = new LangChainProviderService();
export default langchainProvider;