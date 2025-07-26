import { Server as SocketIOServer } from 'socket.io';
import { ConversationChain, RetrievalQAChain, LLMChain } from 'langchain/chains';
import { ConversationTokenBufferMemory, ConversationSummaryMemory } from 'langchain/memory';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { CallbackManager } from '@langchain/core/callbacks/manager';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { Document } from '@langchain/core/documents';
import { langchainProvider } from './langchainProvider';
import { langchainRAG } from './langchainRAG';
import { prisma } from '../config/database';
import { ConversationStatus } from '@prisma/client';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Interfaces for backward compatibility
export interface ProcessMessageOptions {
  conversationId: string;
  agentId: string;
  message: string;
  userId?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  useRAG?: boolean;
  streamResponse?: boolean;
}

export interface MessageContext {
  conversationId: string;
  agentId: string;
  userId?: string;
  customerId?: string;
  recentMessages: any[];
  agentPersonality?: string;
  customerInfo?: any;
  relevantDocuments?: Document[];
  metadata?: Record<string, any>;
}

export interface ProcessedMessage {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, any>;
  processingTime?: number;
  tokensUsed?: number;
}

// Memory type enum
export enum MemoryType {
  BUFFER = 'buffer',
  SUMMARY = 'summary'
}

// Chain type enum
export enum ChainType {
  CONVERSATION = 'conversation',
  RETRIEVAL_QA = 'retrieval_qa',
  CUSTOM_WORKFLOW = 'custom_workflow'
}

// Streaming callback handler for Socket.io integration
class SocketStreamingHandler extends BaseCallbackHandler {
  name = 'socket_streaming_handler';
  
  constructor(
    private io: SocketIOServer,
    private conversationId: string,
    private userId?: string
  ) {
    super();
  }

  override async handleLLMNewToken(token: string): Promise<void> {
    this.io.to(this.conversationId).emit('message_chunk', {
      conversationId: this.conversationId,
      chunk: token,
      userId: this.userId,
      timestamp: new Date()
    });
  }

  override async handleLLMEnd(): Promise<void> {
    this.io.to(this.conversationId).emit('message_complete', {
      conversationId: this.conversationId,
      userId: this.userId,
      timestamp: new Date()
    });
  }

  override async handleLLMError(err: Error): Promise<void> {
    this.io.to(this.conversationId).emit('message_error', {
      conversationId: this.conversationId,
      error: err.message,
      userId: this.userId,
      timestamp: new Date()
    });
  }
}

export class LangChainMessageProcessorService {
  private static instance: LangChainMessageProcessorService;
  private io: SocketIOServer;
  private conversationMemories: Map<string, ConversationTokenBufferMemory | ConversationSummaryMemory> = new Map();
  private conversationChains: Map<string, ConversationChain | RetrievalQAChain | LLMChain> = new Map();
  private readonly MAX_CONTEXT_MESSAGES = 20;
  private readonly MAX_MEMORY_SIZE = 2000; // tokens

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  public static getInstance(io?: SocketIOServer): LangChainMessageProcessorService {
    if (!LangChainMessageProcessorService.instance) {
      if (!io) {
        throw new Error('SocketIO instance required for first initialization');
      }
      LangChainMessageProcessorService.instance = new LangChainMessageProcessorService(io);
    }
    return LangChainMessageProcessorService.instance;
  }

  /**
   * Main message processing method with LangChain integration
   */
  public async processMessage(options: ProcessMessageOptions): Promise<ProcessedMessage> {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing message for conversation ${options.conversationId}`);

      // Store user message
      const userMessage = await this.storeUserMessage(options);
      
      // Build message context
      const context = await this.buildMessageContext(options);
      
      // Get or create appropriate memory and chain
      const memory = await this.getOrCreateMemory(options.conversationId, context);
      const chain = await this.getOrCreateChain(options, memory, context);
      
      // Generate AI response using LangChain
      const aiResponse = await this.generateAIResponseWithChain(
        chain,
        options.message,
        context,
        options.streamResponse
      );
      
      // Store AI response
      const aiMessage = await this.storeAIResponse({
        conversationId: options.conversationId,
        content: aiResponse,
        metadata: {
          ...options.metadata,
          chainType: this.getChainType(chain),
          memoryType: this.getMemoryType(memory),
          processingTime: Date.now() - startTime
        }
      });
      
      // Update conversation status
      await this.updateConversationStatus(options.conversationId, ConversationStatus.ACTIVE);
      
      // Emit real-time events
      this.emitMessageEvents(aiMessage, options);
      
      return aiMessage;
      
    } catch (error) {
      logger.error('Error processing message:', error);
      
      // Emit error event
      this.io.to(options.conversationId).emit('message_error', {
        conversationId: options.conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Get or create appropriate memory based on conversation context
   */
  private async getOrCreateMemory(
    conversationId: string,
    context: MessageContext
  ): Promise<ConversationTokenBufferMemory | ConversationSummaryMemory> {
    const memoryKey = conversationId;
    
    if (this.conversationMemories.has(memoryKey)) {
      return this.conversationMemories.get(memoryKey)!;
    }

    // Determine memory type based on conversation length and context
    const memoryType = await this.determineMemoryType(conversationId, context);
    let memory: ConversationTokenBufferMemory | ConversationSummaryMemory;

    switch (memoryType) {
      case MemoryType.SUMMARY:
        memory = new ConversationSummaryMemory({
          llm: await langchainProvider.getChatModel(),
          returnMessages: true,
          memoryKey: 'chat_history'
        });
        break;
        
      default: // BUFFER
        memory = new ConversationTokenBufferMemory({
          llm: await langchainProvider.getChatModel(),
          maxTokenLimit: this.MAX_MEMORY_SIZE,
          returnMessages: true,
          memoryKey: 'chat_history'
        });
    }

    // Load existing conversation history into memory
    await this.loadConversationHistoryIntoMemory(conversationId, memory);
    
    this.conversationMemories.set(memoryKey, memory);
    return memory;
  }

  /**
   * Get or create appropriate chain based on options and context
   */
  private async getOrCreateChain(
    options: ProcessMessageOptions,
    memory: ConversationTokenBufferMemory | ConversationSummaryMemory,
    context: MessageContext
  ): Promise<ConversationChain | RetrievalQAChain | LLMChain> {
    const chainKey = `${options.conversationId}_${options.agentId}`;
    
    if (this.conversationChains.has(chainKey)) {
      return this.conversationChains.get(chainKey)!;
    }

    const llm = await langchainProvider.getChatModel();
    let chain: ConversationChain | RetrievalQAChain | LLMChain;

    if (options.useRAG && context.relevantDocuments && context.relevantDocuments.length > 0) {
      // Create RetrievalQA chain for RAG-enhanced responses
      const retriever = await langchainRAG.getRetriever();
      
      chain = RetrievalQAChain.fromLLM(llm, retriever, {
        returnSourceDocuments: true
      });
      
    } else if (await this.requiresCustomWorkflow(options, context)) {
      // Create custom chain for business-specific workflows
      chain = await this.createCustomWorkflowChain(llm, memory, context);
      
    } else {
      // Create standard conversation chain
      const prompt = ChatPromptTemplate.fromMessages([
        new SystemMessage(await this.buildSystemPrompt(context)),
        new MessagesPlaceholder('chat_history'),
        ['human', '{input}']
      ]);
      
      chain = new ConversationChain({
        llm,
        memory,
        prompt
      });
    }

    this.conversationChains.set(chainKey, chain);
    return chain;
  }

  /**
   * Generate AI response using LangChain chain with streaming support
   */
  private async generateAIResponseWithChain(
    chain: ConversationChain | RetrievalQAChain | LLMChain,
    input: string,
    context: MessageContext,
    streamResponse: boolean = false
  ): Promise<string> {
    try {
      const callbacks = streamResponse ? [
        new SocketStreamingHandler(this.io, context.conversationId, context.userId)
      ] : [];

      const callbackManager = new CallbackManager();
      callbacks.forEach(callback => callbackManager.addHandler(callback));

      let response: any;
      
      if (chain instanceof RetrievalQAChain) {
        response = await chain.call(
          { query: input },
          { callbacks: callbackManager.handlers }
        );
        return response.text || response.result;
        
      } else if (chain instanceof ConversationChain) {
        response = await chain.call(
          { input },
          { callbacks: callbackManager.handlers }
        );
        return response.response;
        
      } else {
        // Custom LLMChain
        response = await chain.call(
          { input, ...context },
          { callbacks: callbackManager.handlers }
        );
        return response.text;
      }
      
    } catch (error) {
      logger.error('Error generating AI response with chain:', error);
      
      // Fallback to direct LangChain provider
      return await this.fallbackToDirectProvider(input, context);
    }
  }

  /**
   * Create custom workflow chain for business-specific processes
   */
  private async createCustomWorkflowChain(
    llm: any,
    memory: ConversationTokenBufferMemory | ConversationSummaryMemory,
    context: MessageContext
  ): Promise<LLMChain> {
    // Define custom workflow prompt template
    const workflowPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(`You are a specialized AI assistant for ${context.agentPersonality || 'customer service'}.
      
Customer Information: ${JSON.stringify(context.customerInfo || {})}
      
Workflow Guidelines:
      1. Analyze customer intent and context
      2. Apply business rules and policies
      3. Provide personalized responses
      4. Escalate when necessary
      
Relevant Knowledge: ${context.relevantDocuments?.map(doc => doc.pageContent).join('\n') || 'None'}`),
      new MessagesPlaceholder('chat_history'),
      ['human', 'Customer Message: {input}\n\nPlease process this according to our workflow guidelines.']
    ]);

    return new LLMChain({
      llm,
      prompt: workflowPrompt,
      memory
    });
  }

  /**
   * Determine appropriate memory type based on conversation characteristics
   */
  private async determineMemoryType(
    conversationId: string,
    context: MessageContext
  ): Promise<MemoryType> {
    const messageCount = context.recentMessages?.length || 0;
    
    // Use summary memory for long conversations
    if (messageCount > this.MAX_CONTEXT_MESSAGES) {
      return MemoryType.SUMMARY;
    }
    
    // Default to buffer memory for short conversations
    return MemoryType.BUFFER;
  }

  /**
   * Load existing conversation history into LangChain memory
   */
  private async loadConversationHistoryIntoMemory(
    conversationId: string,
    memory: ConversationTokenBufferMemory | ConversationSummaryMemory
  ): Promise<void> {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: this.MAX_CONTEXT_MESSAGES,
      });
      
      for (const msg of messages) {
        if (msg.sender === 'CUSTOMER') {
          await memory.chatHistory.addMessage(new HumanMessage(msg.content));
        } else if (msg.sender === 'AGENT') {
          await memory.chatHistory.addMessage(new AIMessage(msg.content));
        }
      }
      
    } catch (error) {
      logger.error('Error loading conversation history into memory:', error);
    }
  }

  /**
   * Check if custom workflow is required
   */
  private async requiresCustomWorkflow(
    options: ProcessMessageOptions,
    context: MessageContext
  ): Promise<boolean> {
    // Business logic to determine if custom workflow is needed
    const hasComplexIntent = options.message.toLowerCase().includes('refund') ||
                           options.message.toLowerCase().includes('complaint') ||
                           options.message.toLowerCase().includes('escalate');
    
    const hasCustomerContext = !!context.customerId;
    
    return hasComplexIntent && hasCustomerContext;
  }

  /**
   * Fallback to direct provider when chain fails
   */
  private async fallbackToDirectProvider(
    input: string,
    context: MessageContext
  ): Promise<string> {
    logger.warn('Falling back to direct provider for message generation');
    
    const messages = [
      { role: 'system', content: await this.buildSystemPrompt(context) },
      ...context.recentMessages.slice(-5), // Last 5 messages for context
      { role: 'user', content: input }
    ];
    
    const response = await langchainProvider.generateChatCompletion(messages);
    return response.content;
  }

  // Utility methods for chain and memory type identification
  private getChainType(chain: ConversationChain | RetrievalQAChain | LLMChain): ChainType {
    if (chain instanceof RetrievalQAChain) return ChainType.RETRIEVAL_QA;
    if (chain instanceof ConversationChain) return ChainType.CONVERSATION;
    return ChainType.CUSTOM_WORKFLOW;
  }

  private getMemoryType(memory: ConversationTokenBufferMemory | ConversationSummaryMemory): MemoryType {
    if (memory instanceof ConversationSummaryMemory) return MemoryType.SUMMARY;
    return MemoryType.BUFFER;
  }

  // Backward compatibility methods (delegating to existing implementations)
  private async storeUserMessage(options: ProcessMessageOptions): Promise<ProcessedMessage> {
    // Store user message using Prisma
    const message = await prisma.message.create({
      data: {
        id: uuidv4(),
        conversationId: options.conversationId,
        content: options.message,
        sender: 'CUSTOMER',
        metadata: options.metadata || {},
        createdAt: new Date(),
      },
    });
    
    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      role: 'user',
      timestamp: message.createdAt,
      metadata: message.metadata as Record<string, any> | undefined
    };
  }

  private async buildMessageContext(options: ProcessMessageOptions): Promise<MessageContext> {
    // Get recent messages using Prisma
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: options.conversationId },
      orderBy: { createdAt: 'desc' },
      take: this.MAX_CONTEXT_MESSAGES,
    });
    
    // Get agent configuration using Prisma
    const agent = await prisma.agent.findUnique({
      where: { id: options.agentId },
      include: {
        documents: {
          select: { id: true, name: true },
        },
      },
    });
    
    // Get customer info from conversation
    let customerInfo = null;
    if (options.customerId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: options.conversationId },
        select: {
          customerName: true,
          customerEmail: true,
          metadata: true,
        },
      });
      
      customerInfo = {
        name: conversation?.customerName || undefined,
        email: conversation?.customerEmail || undefined,
        preferences: conversation?.metadata as Record<string, any> || {},
      };
    }
    
    let relevantDocuments: Document[] = [];
    if (options.useRAG) {
      try {
        relevantDocuments = await langchainRAG.searchSimilar(
          options.message,
          { k: 5, threshold: 0.7 }
        );
      } catch (error) {
        logger.error('Error retrieving relevant documents:', error);
      }
    }
    
    return {
      conversationId: options.conversationId,
      agentId: options.agentId,
      userId: options.userId,
      customerId: options.customerId,
      recentMessages,
      agentPersonality: (typeof agent?.personality === 'string' ? agent.personality : JSON.stringify(agent?.personality)) || 'a helpful AI assistant',
      customerInfo,
      relevantDocuments,
      metadata: options.metadata
    };
  }

  private async buildSystemPrompt(context: MessageContext): Promise<string> {
    let systemPrompt = `You are ${context.agentPersonality || 'a helpful AI assistant'}.`;
    
    if (context.customerInfo) {
      systemPrompt += `\n\nCustomer Information:\n${JSON.stringify(context.customerInfo, null, 2)}`;
    }
    
    if (context.relevantDocuments && context.relevantDocuments.length > 0) {
      systemPrompt += `\n\nRelevant Knowledge Base:\n${context.relevantDocuments.map(doc => doc.pageContent).join('\n\n')}`;
    }
    
    systemPrompt += `\n\nPlease provide helpful, accurate, and contextually appropriate responses.`;
    
    return systemPrompt;
  }

  private async storeAIResponse(data: {
    conversationId: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<ProcessedMessage> {
    // Store AI response using Prisma
    const message = await prisma.message.create({
      data: {
        id: uuidv4(),
        conversationId: data.conversationId,
        content: data.content,
        sender: 'AGENT',
        metadata: data.metadata || {},
        createdAt: new Date(),
      },
    });
    
    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      role: 'assistant',
      timestamp: message.createdAt,
      metadata: message.metadata as Record<string, any> | undefined
    };
  }

  private async updateConversationStatus(conversationId: string, status: ConversationStatus): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { 
        status,
        updatedAt: new Date()
      },
    });
  }

  private emitMessageEvents(message: ProcessedMessage, options: ProcessMessageOptions): void {
    this.io.to(options.conversationId).emit('new_message', {
      message,
      conversationId: options.conversationId,
      timestamp: new Date()
    });
    
    if (options.userId) {
      this.io.to(`user_${options.userId}`).emit('notification', {
        type: 'new_message',
        conversationId: options.conversationId,
        message: message.content.substring(0, 100) + '...',
        timestamp: new Date()
      });
    }
  }

  /**
   * Clear memory for a specific conversation
   */
  public async clearConversationMemory(conversationId: string): Promise<void> {
    const memoryKey = conversationId;
    const chainKey = `${conversationId}_*`; // Pattern for all chains with this conversation
    
    // Clear memory
    if (this.conversationMemories.has(memoryKey)) {
      const memory = this.conversationMemories.get(memoryKey)!;
      await memory.clear();
      this.conversationMemories.delete(memoryKey);
    }
    
    // Clear associated chains
    for (const [key, chain] of this.conversationChains.entries()) {
      if (key.startsWith(conversationId)) {
        this.conversationChains.delete(key);
      }
    }
    
    logger.info(`Cleared memory and chains for conversation ${conversationId}`);
  }

  /**
   * Get memory statistics for monitoring
   */
  public getMemoryStats(): {
    activeMemories: number;
    activeChains: number;
    memoryTypes: Record<string, number>;
    chainTypes: Record<string, number>;
  } {
    const memoryTypes: Record<string, number> = {};
    const chainTypes: Record<string, number> = {};
    
    for (const memory of this.conversationMemories.values()) {
      const type = this.getMemoryType(memory);
      memoryTypes[type] = (memoryTypes[type] || 0) + 1;
    }
    
    for (const chain of this.conversationChains.values()) {
      const type = this.getChainType(chain);
      chainTypes[type] = (chainTypes[type] || 0) + 1;
    }
    
    return {
      activeMemories: this.conversationMemories.size,
      activeChains: this.conversationChains.size,
      memoryTypes,
      chainTypes
    };
  }

  /**
   * Process multiple messages in batch (for testing or bulk operations)
   */
  public async processBatchMessages(messageOptions: ProcessMessageOptions[]): Promise<ProcessedMessage[]> {
    const results: ProcessedMessage[] = [];
    
    for (const options of messageOptions) {
      try {
        const result = await this.processMessage(options);
        results.push(result);
      } catch (error) {
        logger.error(`Error processing batch message for conversation ${options.conversationId}:`, error);
        // Continue with other messages
      }
    }
    
    return results;
  }
}

// Export singleton instance factory
export const langchainMessageProcessor = {
  getInstance: (io?: SocketIOServer) => LangChainMessageProcessorService.getInstance(io)
};