import { prisma } from '../config/database';
import { chromadb } from '../config/chromadb';
import { aiProvider, ChatMessage, ChatCompletionOptions } from './aiProvider';
import logger from '../utils/logger';
import { getIO } from '../server';
import { broadcastConversationUpdate, broadcastNotification } from '../sockets/socketHandlers';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessMessageOptions {
  conversationId: string;
  agentId: string;
  tenantId: string;
  message: string;
  sender: 'CUSTOMER' | 'AGENT';
  channelId?: string;
  metadata?: Record<string, any>;
}

export interface MessageContext {
  conversationHistory: ChatMessage[];
  agentPersonality: string;
  relevantDocuments: string[];
  customerInfo?: {
    name?: string;
    email?: string;
    preferences?: Record<string, any>;
  };
}

export interface ProcessedMessage {
  messageId: string;
  content: string;
  sender: 'CUSTOMER' | 'AGENT';
  timestamp: Date;
  metadata?: Record<string, any>;
  tokensUsed?: number;
  processingTime?: number;
}

class MessageProcessorService {
  private static instance: MessageProcessorService;
  private conversationMemory: Map<string, ChatMessage[]> = new Map();
  private readonly MAX_CONTEXT_MESSAGES = 20;
  private readonly MAX_CONTEXT_TOKENS = 4000;

  private constructor() {}

  public static getInstance(): MessageProcessorService {
    if (!MessageProcessorService.instance) {
      MessageProcessorService.instance = new MessageProcessorService();
    }
    return MessageProcessorService.instance;
  }

  /**
   * Process incoming message and generate AI response
   */
  public async processMessage(options: ProcessMessageOptions): Promise<ProcessedMessage> {
    const startTime = Date.now();
    
    try {
      // Store user message
      const userMessage = await this.storeMessage({
        conversationId: options.conversationId,
        content: options.message,
        sender: 'CUSTOMER',
        metadata: options.metadata,
      });

      // Update conversation memory
      await this.updateConversationMemory(options.conversationId, {
        role: 'user',
        content: options.message,
      });

      // Get agent and conversation context
      const context = await this.buildMessageContext(options);
      
      // Generate AI response
      const aiResponse = await this.generateAIResponse(context, options);
      
      // Store AI response
      const agentMessage = await this.storeMessage({
        conversationId: options.conversationId,
        content: aiResponse.content,
        sender: 'AGENT',
        metadata: {
          tokensUsed: aiResponse.tokensUsed,
          model: aiResponse.model,
          provider: aiResponse.provider,
        },
      });

      // Update conversation memory with AI response
      await this.updateConversationMemory(options.conversationId, {
        role: 'assistant',
        content: aiResponse.content,
      });

      // Update conversation status and timestamp
      await this.updateConversationStatus(options.conversationId);

      // Emit real-time events
      await this.emitRealTimeEvents(options.tenantId, options.conversationId, agentMessage);

      const processingTime = Date.now() - startTime;
      
      logger.business('Message processed successfully', {
        conversationId: options.conversationId,
        agentId: options.agentId,
        tenantId: options.tenantId,
        tokensUsed: aiResponse.tokensUsed,
        processingTime,
      });

      return {
        messageId: agentMessage.id,
        content: aiResponse.content,
        sender: 'AGENT',
        timestamp: agentMessage.createdAt,
        metadata: agentMessage.metadata as Record<string, any> | undefined,
        tokensUsed: aiResponse.tokensUsed,
        processingTime,
      };
    } catch (error) {
      logger.error('Message processing failed', {
        conversationId: options.conversationId,
        agentId: options.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Build message context for AI response generation
   */
  private async buildMessageContext(options: ProcessMessageOptions): Promise<MessageContext> {
    try {
      // Get agent configuration
      const agent = await prisma.agent.findUnique({
        where: { id: options.agentId },
        include: {
          documents: {
            select: { id: true, name: true },
          },
        },
      });

      if (!agent) {
        throw new Error(`Agent not found: ${options.agentId}`);
      }

      // Get conversation history
      const conversationHistory = this.getConversationMemory(options.conversationId);

      // Get relevant documents using RAG
      const relevantDocuments = await this.getRelevantDocuments(
        options.tenantId,
        options.message,
        agent.documents.map(d => d.id)
      );

      // Get customer information
      const conversation = await prisma.conversation.findUnique({
        where: { id: options.conversationId },
        select: {
          customerName: true,
          customerEmail: true,
          metadata: true,
        },
      });

      return {
        conversationHistory,
        agentPersonality: this.buildAgentPersonality(agent),
        relevantDocuments,
        customerInfo: {
          name: conversation?.customerName || undefined,
          email: conversation?.customerEmail || undefined,
          preferences: conversation?.metadata as Record<string, any> || {},
        },
      };
    } catch (error) {
      logger.error('Failed to build message context', {
        conversationId: options.conversationId,
        agentId: options.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate AI response for conversation (public method)
   */
  public async generateAIResponseForConversation(options: {
    conversationId: string;
    agentId: string;
    prompt: string;
    includeContext?: boolean;
    tenantId: string;
  }): Promise<{ content: string; tokensUsed: number; model: string; provider: string }> {
    try {
      // Build context for the AI response
      const context = await this.buildMessageContext({
        conversationId: options.conversationId,
        agentId: options.agentId,
        tenantId: options.tenantId,
        message: options.prompt,
        sender: 'CUSTOMER',
      });

      // Generate AI response
      return await this.generateAIResponse(context, {
        conversationId: options.conversationId,
        agentId: options.agentId,
        tenantId: options.tenantId,
        message: options.prompt,
        sender: 'CUSTOMER',
      });
    } catch (error) {
      logger.error('Failed to generate AI response for conversation', {
        conversationId: options.conversationId,
        agentId: options.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate AI response using context
   */
  private async generateAIResponse(
    context: MessageContext,
    options: ProcessMessageOptions
  ): Promise<{ content: string; tokensUsed: number; model: string; provider: string }> {
    try {
      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(context);
      
      // Prepare messages for AI
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...context.conversationHistory.slice(-this.MAX_CONTEXT_MESSAGES),
      ];

      // Get agent configuration for AI parameters
      const agent = await prisma.agent.findUnique({
        where: { id: options.agentId },
        select: {
          model: true,
          temperature: true,
          maxTokens: true,
        },
      });

      const aiOptions: ChatCompletionOptions = {
        model: agent?.model || undefined,
        temperature: agent?.temperature || 0.7,
        maxTokens: agent?.maxTokens || 500,
      };

      // Generate response
      const response = await aiProvider.generateChatCompletion(messages, aiOptions);
      
      return {
        content: response.content,
        tokensUsed: response.tokensUsed,
        model: response.model,
        provider: response.provider,
      };
    } catch (error) {
      logger.error('AI response generation failed', {
        conversationId: options.conversationId,
        agentId: options.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: MessageContext): string {
    let prompt = context.agentPersonality;

    // Add customer context
    if (context.customerInfo?.name) {
      prompt += `\n\nCustomer Information:\n- Name: ${context.customerInfo.name}`;
    }
    if (context.customerInfo?.email) {
      prompt += `\n- Email: ${context.customerInfo.email}`;
    }

    // Add relevant documents
    if (context.relevantDocuments.length > 0) {
      prompt += `\n\nRelevant Knowledge Base Information:\n${context.relevantDocuments.join('\n\n')}`;
    }

    // Add conversation guidelines
    prompt += `\n\nGuidelines:\n- Be helpful, professional, and empathetic\n- Use the provided knowledge base information when relevant\n- If you don't know something, admit it and offer to help find the information\n- Keep responses concise but comprehensive\n- Maintain the conversation context`;

    return prompt;
  }

  /**
   * Build agent personality string
   */
  private buildAgentPersonality(agent: any): string {
    let personality = agent.prompt || 'You are a helpful AI assistant.';
    
    if (agent.personality) {
      const traits = agent.personality.traits || [];
      const tone = agent.personality.tone || 'professional';
      const style = agent.personality.style || 'conversational';
      
      personality += `\n\nPersonality Traits: ${traits.join(', ')}`;
      personality += `\nTone: ${tone}`;
      personality += `\nStyle: ${style}`;
    }
    
    if (agent.role) {
      personality += `\nRole: ${agent.role}`;
    }
    
    return personality;
  }

  /**
   * Get relevant documents using RAG
   */
  private async getRelevantDocuments(
    tenantId: string,
    query: string,
    documentIds: string[]
  ): Promise<string[]> {
    try {
      if (documentIds.length === 0) {
        return [];
      }

      // Search for relevant documents
      const searchResults = await chromadb.searchDocuments(
        tenantId,
        query,
        5, // Get top 5 relevant chunks
        {
          documentId: { $in: documentIds },
        }
      );

      return searchResults.map(result => result.document);
    } catch (error) {
      logger.warn('Failed to retrieve relevant documents', {
        tenantId,
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Store message in database
   */
  private async storeMessage(data: {
    conversationId: string;
    content: string;
    sender: 'CUSTOMER' | 'AGENT';
    metadata?: Record<string, any>;
  }) {
    return await prisma.message.create({
      data: {
        id: uuidv4(),
        conversationId: data.conversationId,
        content: data.content,
        sender: data.sender,
        metadata: data.metadata || {},
        createdAt: new Date(),
      },
    });
  }

  /**
   * Update conversation memory
   */
  private async updateConversationMemory(
    conversationId: string,
    message: ChatMessage
  ): Promise<void> {
    const memory = this.conversationMemory.get(conversationId) || [];
    memory.push(message);
    
    // Keep only recent messages to manage memory
    if (memory.length > this.MAX_CONTEXT_MESSAGES) {
      memory.splice(0, memory.length - this.MAX_CONTEXT_MESSAGES);
    }
    
    this.conversationMemory.set(conversationId, memory);
  }

  /**
   * Get conversation memory
   */
  private getConversationMemory(conversationId: string): ChatMessage[] {
    return this.conversationMemory.get(conversationId) || [];
  }

  /**
   * Load conversation memory from database
   */
  public async loadConversationMemory(conversationId: string): Promise<void> {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: this.MAX_CONTEXT_MESSAGES,
      });

      const memory: ChatMessage[] = messages.map(msg => ({
        role: msg.sender === 'CUSTOMER' ? 'user' : 'assistant',
        content: msg.content,
      }));

      this.conversationMemory.set(conversationId, memory);
    } catch (error) {
      logger.error('Failed to load conversation memory', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear conversation memory
   */
  public clearConversationMemory(conversationId: string): void {
    this.conversationMemory.delete(conversationId);
  }

  /**
   * Update conversation status
   */
  private async updateConversationStatus(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Emit real-time events
   */
  private async emitRealTimeEvents(
    tenantId: string,
    conversationId: string,
    message: any
  ): Promise<void> {
    try {
      const io = getIO();
      
      // Broadcast new message
      await broadcastConversationUpdate(io, tenantId, {
        type: 'NEW_MESSAGE',
        conversationId,
        message: {
          id: message.id,
          content: message.content,
          sender: message.sender,
          createdAt: message.createdAt,
        },
      });

      // Send notification
      const notification = {
        id: uuidv4(),
        type: 'NEW_MESSAGE' as const,
        title: 'New Message',
        message: `New message in conversation`,
        data: { conversationId, messageId: message.id },
        createdAt: new Date(),
        read: false,
      };
      
      broadcastNotification(io, tenantId, notification);
    } catch (error) {
      logger.error('Failed to emit real-time events', {
        tenantId,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Process batch messages (for webhook processing)
   */
  public async processBatchMessages(
    messages: ProcessMessageOptions[]
  ): Promise<ProcessedMessage[]> {
    const results: ProcessedMessage[] = [];
    
    for (const messageOptions of messages) {
      try {
        const result = await this.processMessage(messageOptions);
        results.push(result);
      } catch (error) {
        logger.error('Batch message processing failed', {
          conversationId: messageOptions.conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue processing other messages
      }
    }
    
    return results;
  }

  /**
   * Get processing statistics
   */
  public getProcessingStats(): {
    activeConversations: number;
    memoryUsage: number;
  } {
    return {
      activeConversations: this.conversationMemory.size,
      memoryUsage: JSON.stringify(Array.from(this.conversationMemory.values())).length,
    };
  }
}

// Export singleton instance
export const messageProcessor = MessageProcessorService.getInstance();
export default messageProcessor;