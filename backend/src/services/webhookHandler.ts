import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { messageProcessor, ProcessMessageOptions } from './messageProcessor';
import logger from '../utils/logger';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookPayload {
  platform: 'whatsapp' | 'facebook' | 'instagram' | 'telegram';
  messageId: string;
  senderId: string;
  recipientId: string;
  message: {
    text?: string;
    type: 'text' | 'image' | 'audio' | 'video' | 'document';
    attachments?: Array<{
      type: string;
      url: string;
    }>;
  };
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  payload?: WebhookPayload;
}

export interface ProcessedWebhookMessage {
  messageId: string;
  conversationId: string;
  response?: {
    content: string;
    messageId: string;
  };
  error?: string;
}

class WebhookHandlerService {
  private static instance: WebhookHandlerService;

  private constructor() {}

  public static getInstance(): WebhookHandlerService {
    if (!WebhookHandlerService.instance) {
      WebhookHandlerService.instance = new WebhookHandlerService();
    }
    return WebhookHandlerService.instance;
  }

  /**
   * Generic webhook validation
   */
  public validateWebhook(
    payload: any,
    signature: string,
    secret: string,
    platform: string
  ): WebhookValidationResult {
    try {
      // Verify signature
      const isSignatureValid = this.verifySignature(payload, signature, secret, platform);
      if (!isSignatureValid) {
        return {
          isValid: false,
          error: 'Invalid webhook signature',
        };
      }

      // Parse platform-specific payload
      const parsedPayload = this.parseWebhookPayload(payload, platform);
      if (!parsedPayload) {
        return {
          isValid: false,
          error: 'Invalid webhook payload format',
        };
      }

      return {
        isValid: true,
        payload: parsedPayload,
      };
    } catch (error) {
      logger.error('Webhook validation failed', {
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        isValid: false,
        error: 'Webhook validation error',
      };
    }
  }

  /**
   * Process WhatsApp webhook
   */
  public async processWhatsAppWebhook(
    req: Request,
    res: Response
  ): Promise<ProcessedWebhookMessage[]> {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = req.body;

      // Validate webhook
      const validation = this.validateWebhook(
        payload,
        signature,
        config.whatsappWebhookSecret,
        'whatsapp'
      );

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const results: ProcessedWebhookMessage[] = [];

      // Process WhatsApp messages
      if (payload.entry) {
        for (const entry of payload.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value && change.value.messages) {
                for (const message of change.value.messages) {
                  const result = await this.processWhatsAppMessage(message, change.value);
                  results.push(result);
                }
              }
            }
          }
        }
      }

      logger.business('WhatsApp webhook processed', {
        messagesProcessed: results.length,
        payload: JSON.stringify(payload).substring(0, 500),
      });

      return results;
    } catch (error) {
      logger.error('WhatsApp webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process Facebook Messenger webhook
   */
  public async processFacebookWebhook(
    req: Request,
    res: Response
  ): Promise<ProcessedWebhookMessage[]> {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = req.body;

      // Validate webhook
      const validation = this.validateWebhook(
        payload,
        signature,
        config.facebookAppSecret,
        'facebook'
      );

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const results: ProcessedWebhookMessage[] = [];

      // Process Facebook messages
      if (payload.entry) {
        for (const entry of payload.entry) {
          if (entry.messaging) {
            for (const messagingEvent of entry.messaging) {
              if (messagingEvent.message) {
                const result = await this.processFacebookMessage(messagingEvent);
                results.push(result);
              }
            }
          }
        }
      }

      logger.business('Facebook webhook processed', {
        messagesProcessed: results.length,
        payload: JSON.stringify(payload).substring(0, 500),
      });

      return results;
    } catch (error) {
      logger.error('Facebook webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process Instagram webhook
   */
  public async processInstagramWebhook(
    req: Request,
    res: Response
  ): Promise<ProcessedWebhookMessage[]> {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = req.body;

      // Validate webhook
      const validation = this.validateWebhook(
        payload,
        signature,
        config.instagramAppSecret,
        'instagram'
      );

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const results: ProcessedWebhookMessage[] = [];

      // Process Instagram messages (similar to Facebook)
      if (payload.entry) {
        for (const entry of payload.entry) {
          if (entry.messaging) {
            for (const messagingEvent of entry.messaging) {
              if (messagingEvent.message) {
                const result = await this.processInstagramMessage(messagingEvent);
                results.push(result);
              }
            }
          }
        }
      }

      logger.business('Instagram webhook processed', {
        messagesProcessed: results.length,
        payload: JSON.stringify(payload).substring(0, 500),
      });

      return results;
    } catch (error) {
      logger.error('Instagram webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process Telegram webhook
   */
  public async processTelegramWebhook(
    req: Request,
    res: Response
  ): Promise<ProcessedWebhookMessage[]> {
    try {
      const payload = req.body;

      // Telegram uses different validation (bot token in URL)
      if (!payload.message) {
        return [];
      }

      const result = await this.processTelegramMessage(payload.message);
      
      logger.business('Telegram webhook processed', {
        messagesProcessed: 1,
        payload: JSON.stringify(payload).substring(0, 500),
      });

      return [result];
    } catch (error) {
      logger.error('Telegram webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(
    payload: any,
    signature: string,
    secret: string,
    platform: string
  ): boolean {
    try {
      const payloadString = JSON.stringify(payload);
      let expectedSignature: string;

      switch (platform) {
        case 'whatsapp':
        case 'facebook':
        case 'instagram':
          expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
          break;
        case 'telegram':
          // Telegram doesn't use signature validation in the same way
          return true;
        default:
          return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Signature verification failed', {
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Parse webhook payload based on platform
   */
  private parseWebhookPayload(payload: any, platform: string): WebhookPayload | null {
    try {
      switch (platform) {
        case 'whatsapp':
          return this.parseWhatsAppPayload(payload);
        case 'facebook':
          return this.parseFacebookPayload(payload);
        case 'instagram':
          return this.parseInstagramPayload(payload);
        case 'telegram':
          return this.parseTelegramPayload(payload);
        default:
          return null;
      }
    } catch (error) {
      logger.error('Payload parsing failed', {
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Parse WhatsApp payload
   */
  private parseWhatsAppPayload(payload: any): WebhookPayload | null {
    // WhatsApp webhook structure parsing
    if (!payload.entry || !payload.entry[0]?.changes) {
      return null;
    }

    const change = payload.entry[0].changes[0];
    if (!change.value?.messages?.[0]) {
      return null;
    }

    const message = change.value.messages[0];
    return {
      platform: 'whatsapp',
      messageId: message.id,
      senderId: message.from,
      recipientId: change.value.metadata?.phone_number_id || '',
      message: {
        text: message.text?.body || '',
        type: message.type || 'text',
      },
      timestamp: parseInt(message.timestamp) * 1000,
    };
  }

  /**
   * Parse Facebook payload
   */
  private parseFacebookPayload(payload: any): WebhookPayload | null {
    if (!payload.entry || !payload.entry[0]?.messaging?.[0]) {
      return null;
    }

    const messaging = payload.entry[0].messaging[0];
    if (!messaging.message) {
      return null;
    }

    return {
      platform: 'facebook',
      messageId: messaging.message.mid,
      senderId: messaging.sender.id,
      recipientId: messaging.recipient.id,
      message: {
        text: messaging.message.text || '',
        type: 'text',
      },
      timestamp: messaging.timestamp,
    };
  }

  /**
   * Parse Instagram payload
   */
  private parseInstagramPayload(payload: any): WebhookPayload | null {
    // Instagram uses similar structure to Facebook
    return this.parseFacebookPayload(payload);
  }

  /**
   * Parse Telegram payload
   */
  private parseTelegramPayload(payload: any): WebhookPayload | null {
    if (!payload.message) {
      return null;
    }

    const message = payload.message;
    return {
      platform: 'telegram',
      messageId: message.message_id.toString(),
      senderId: message.from.id.toString(),
      recipientId: message.chat.id.toString(),
      message: {
        text: message.text || '',
        type: 'text',
      },
      timestamp: message.date * 1000,
    };
  }

  /**
   * Process WhatsApp message
   */
  private async processWhatsAppMessage(
    message: any,
    value: any
  ): Promise<ProcessedWebhookMessage> {
    try {
      // Find or create conversation
      const conversation = await this.findOrCreateConversation(
        message.from,
        'WHATSAPP',
        value.metadata?.phone_number_id
      );

      // Process message
      const processOptions: ProcessMessageOptions = {
        conversationId: conversation.id,
        agentId: conversation.agentId!,
        tenantId: conversation.tenantId,
        message: message.text?.body || '',
        sender: 'CUSTOMER',
        channelId: conversation.channelId,
        metadata: {
          platform: 'whatsapp',
          externalMessageId: message.id,
          senderId: message.from,
        },
      };

      const result = await messageProcessor.processMessage(processOptions);

      // Send response back to WhatsApp
      await this.sendWhatsAppMessage(
        message.from,
        result.content,
        value.metadata?.phone_number_id
      );

      return {
        messageId: result.messageId,
        conversationId: conversation.id,
        response: {
          content: result.content,
          messageId: result.messageId,
        },
      };
    } catch (error) {
      logger.error('WhatsApp message processing failed', {
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        messageId: message.id,
        conversationId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process Facebook message
   */
  private async processFacebookMessage(
    messagingEvent: any
  ): Promise<ProcessedWebhookMessage> {
    try {
      // Find or create conversation
      const conversation = await this.findOrCreateConversation(
        messagingEvent.sender.id,
        'FACEBOOK',
        messagingEvent.recipient.id
      );

      // Process message
      const processOptions: ProcessMessageOptions = {
        conversationId: conversation.id,
        agentId: conversation.agentId!,
        tenantId: conversation.tenantId,
        message: messagingEvent.message.text || '',
        sender: 'CUSTOMER',
        channelId: conversation.channelId,
        metadata: {
          platform: 'facebook',
          externalMessageId: messagingEvent.message.mid,
          senderId: messagingEvent.sender.id,
        },
      };

      const result = await messageProcessor.processMessage(processOptions);

      // Send response back to Facebook
      await this.sendFacebookMessage(
        messagingEvent.sender.id,
        result.content
      );

      return {
        messageId: result.messageId,
        conversationId: conversation.id,
        response: {
          content: result.content,
          messageId: result.messageId,
        },
      };
    } catch (error) {
      logger.error('Facebook message processing failed', {
        messageId: messagingEvent.message?.mid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        messageId: messagingEvent.message?.mid || '',
        conversationId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process Instagram message
   */
  private async processInstagramMessage(
    messagingEvent: any
  ): Promise<ProcessedWebhookMessage> {
    // Instagram processing is similar to Facebook
    return this.processFacebookMessage(messagingEvent);
  }

  /**
   * Process Telegram message
   */
  private async processTelegramMessage(
    message: any
  ): Promise<ProcessedWebhookMessage> {
    try {
      // Find or create conversation
      const conversation = await this.findOrCreateConversation(
        message.from.id.toString(),
        'TELEGRAM',
        message.chat.id.toString()
      );

      // Process message
      const processOptions: ProcessMessageOptions = {
        conversationId: conversation.id,
        agentId: conversation.agentId!,
        tenantId: conversation.tenantId,
        message: message.text || '',
        sender: 'CUSTOMER',
        channelId: conversation.channelId,
        metadata: {
          platform: 'telegram',
          externalMessageId: message.message_id.toString(),
          senderId: message.from.id.toString(),
        },
      };

      const result = await messageProcessor.processMessage(processOptions);

      // Send response back to Telegram
      await this.sendTelegramMessage(
        message.chat.id,
        result.content
      );

      return {
        messageId: result.messageId,
        conversationId: conversation.id,
        response: {
          content: result.content,
          messageId: result.messageId,
        },
      };
    } catch (error) {
      logger.error('Telegram message processing failed', {
        messageId: message.message_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        messageId: message.message_id?.toString() || '',
        conversationId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Find or create conversation
   */
  private async findOrCreateConversation(
    externalUserId: string,
    platform: string,
    channelIdentifier: string
  ) {
    // Find existing conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        externalId: externalUserId,
        channel: {
          type: platform as any,
        },
        status: { in: ['ACTIVE'] },
      },
      include: {
        channel: true,
        agent: true,
      },
    });

    if (!conversation) {
      // Find channel for this platform
      const channel = await prisma.channel.findFirst({
        where: {
          type: platform as any,
          isActive: true,
        },

      });

      if (!channel) {
        throw new Error(`No active channel found for platform: ${platform}`);
      }

      // Find an active agent for this tenant
      const agent = await prisma.agent.findFirst({
        where: {
          tenantId: channel.tenantId,
          isActive: true,
        },
      });

      if (!agent) {
        throw new Error(`No active agent found for tenant: ${channel.tenantId}`);
      }

      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          id: uuidv4(),
          channelId: channel.id,
          agentId: agent.id,
          tenantId: channel.tenantId,
          externalId: externalUserId,
          status: 'ACTIVE',
          priority: 'NORMAL',
          metadata: {
            platform,
            channelIdentifier,
          },
        },
        include: {
          channel: true,
          agent: true,
        },
      });
    }

    return conversation;
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsAppMessage(
    to: string,
    message: string,
    phoneNumberId: string
  ): Promise<void> {
    try {
      // Implementation would use WhatsApp Business API
      logger.info('WhatsApp message sent', { to, phoneNumberId });
    } catch (error) {
      logger.error('Failed to send WhatsApp message', {
        to,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send Facebook message
   */
  private async sendFacebookMessage(
    recipientId: string,
    message: string
  ): Promise<void> {
    try {
      // Implementation would use Facebook Messenger API
      logger.info('Facebook message sent', { recipientId });
    } catch (error) {
      logger.error('Failed to send Facebook message', {
        recipientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send Telegram message
   */
  private async sendTelegramMessage(
    chatId: number,
    message: string
  ): Promise<void> {
    try {
      // Implementation would use Telegram Bot API
      logger.info('Telegram message sent', { chatId });
    } catch (error) {
      logger.error('Failed to send Telegram message', {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
export const webhookHandler = WebhookHandlerService.getInstance();
export default webhookHandler;