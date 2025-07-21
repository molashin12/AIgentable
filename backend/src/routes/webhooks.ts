import express from 'express';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { validateBody } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';
import { chromadb } from '../config/chromadb';
import OpenAI from 'openai';
import axios from 'axios';

const router = express.Router();
const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Middleware to verify webhook signatures
const verifyWebhookSignature = (secret: string) => {
  return (req: Request, res: Response, next: Function) => {
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
    const body = JSON.stringify(req.body);
    
    if (!signature) {
      throw new AuthenticationError('Missing webhook signature');
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    const providedSignature = Array.isArray(signature) ? signature[0] : signature;
    const cleanSignature = providedSignature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(cleanSignature))) {
      throw new AuthenticationError('Invalid webhook signature');
    }
    
    next();
  };
};

// Helper function to process incoming message
const processIncomingMessage = async (
  channelId: string,
  customerIdentifier: string,
  customerName: string,
  messageContent: string,
  messageType: string = 'TEXT',
  metadata: Record<string, any> = {}
) => {
  try {
    // Get channel information
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        channelAgents: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        channelId,
        OR: [
          { customerEmail: customerIdentifier },
          { customerPhone: customerIdentifier },
        ],
        status: { not: 'RESOLVED' },
      },
      include: {
        agent: true,
      },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          channelId,
          agentId: channel.channelAgents[0]?.agentId || '',
          customerName,
          customerEmail: customerIdentifier.includes('@') ? customerIdentifier : null,
          customerPhone: !customerIdentifier.includes('@') ? customerIdentifier : null,
          metadata: metadata,
          status: 'ACTIVE',
          priority: 'NORMAL',
          tenantId: channel.tenantId,
        },
        include: {
          agent: true,
        },
      });

      logger.business('New conversation created from webhook', {
        conversationId: conversation?.id || '',
        channelId,
        customerIdentifier,
        tenantId: channel.tenantId,
      });
    }

    // Create customer message
    const customerMessage = await prisma.message.create({
      data: {
        conversationId: conversation?.id || '',
        content: messageContent,
        sender: 'CUSTOMER',
        type: messageType as any,
        metadata,
      },
    });

    // Update conversation timestamp
    if (conversation?.id) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    }

    logger.webhook('Customer message received', {
      messageId: customerMessage.id,
      conversationId: conversation?.id || '',
      channelType: channel.type,
      messageType,
      tenantId: channel.tenantId,
    });

    // Generate AI response if agent is active and auto-response is enabled
    if (conversation?.agent && conversation.agent.isActive && (conversation.agent as any)?.autoResponse) {
      try {
        // Get conversation context
        const recentMessages = await prisma.message.findMany({
          where: { conversationId: conversation?.id || '' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        // Get relevant documents from knowledge base
        let contextDocuments: string[] = [];
        if ((conversation?.agent as any)?.knowledgeBase) {
          try {
            const searchResults = await chromadb.searchDocuments(
              channel.tenantId,
              messageContent,
              3,
              { agentId: channel.channelAgents[0]?.agentId || '' }
            );
            contextDocuments = searchResults.map(result => result.document);
          } catch (error) {
            logger.warn('Failed to search knowledge base for webhook response:', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Build context for AI
        const systemPrompt = (conversation?.agent as any)?.systemPrompt || 'You are a helpful customer service assistant.';
        const conversationHistory = recentMessages
          .reverse()
          .map(msg => `${msg.sender}: ${msg.content}`)
          .join('\n');
        
        const knowledgeContext = contextDocuments.length > 0
          ? `\n\nRelevant information:\n${(contextDocuments as string[]).join('\n\n')}`
          : '';

        // Generate AI response
        const agent = channel.channelAgents[0]?.agent;
        const aiCompletion = await openai.chat.completions.create({
          model: agent?.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}${knowledgeContext}`,
            },
            {
              role: 'user',
              content: `Conversation history:\n${conversationHistory}\n\nPlease respond to the customer's latest message.`,
            },
          ],
          max_tokens: agent?.maxTokens || 500,
          temperature: agent?.temperature || 0.7,
        });

        const aiContent = aiCompletion.choices[0]?.message?.content;
        if (aiContent) {
          // Create AI response message
          const aiMessage = await prisma.message.create({
            data: {
              conversationId: conversation?.id || '',
              content: aiContent,
              sender: 'AGENT',
              type: 'TEXT',
              metadata: {
                aiGenerated: true,
                model: agent?.model || 'gpt-3.5-turbo',
                tokensUsed: aiCompletion.usage?.total_tokens || 0,
                webhook: true,
              },
            },
          });

          // Send response back to channel
          await sendMessageToChannel(channel, customerIdentifier, aiContent);

          logger.ai('AI response sent via webhook', {
            messageId: aiMessage.id,
            conversationId: conversation?.id,
            channelType: channel.type,
            model: agent?.model,
            tokensUsed: aiCompletion.usage?.total_tokens,
            tenantId: channel.tenantId,
          });
        }
      } catch (error) {
        logger.error('Failed to generate AI response for webhook:', {
          conversationId: conversation?.id || '',
          channelType: channel.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { conversation, message: customerMessage };
  } catch (error) {
    logger.error('Failed to process incoming webhook message:', {
      channelId,
      customerIdentifier,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

// Helper function to send message to channel
const sendMessageToChannel = async (channel: any, recipient: string, message: string) => {
  try {
    switch (channel.type) {
      case 'WHATSAPP':
        await axios.post(
          `https://graph.facebook.com/v18.0/${channel.config.phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: recipient,
            text: { body: message },
          },
          {
            headers: {
              Authorization: `Bearer ${channel.config.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        break;

      case 'FACEBOOK':
        await axios.post(
          `https://graph.facebook.com/v18.0/me/messages`,
          {
            recipient: { id: recipient },
            message: { text: message },
          },
          {
            params: {
              access_token: channel.config.accessToken,
            },
          }
        );
        break;

      case 'TELEGRAM':
        await axios.post(
          `https://api.telegram.org/bot${channel.config.botToken}/sendMessage`,
          {
            chat_id: recipient,
            text: message,
          }
        );
        break;

      default:
        logger.warn('Unsupported channel type for outbound message:', {
          channelType: channel.type,
          channelId: channel.id,
        });
    }
  } catch (error) {
    logger.error('Failed to send message to channel:', {
      channelType: channel.type,
      channelId: channel.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

// WhatsApp webhook
router.get('/whatsapp/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;

  // Get channel to verify token
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'WHATSAPP') {
    throw new NotFoundError('WhatsApp channel not found');
  }

  if (mode === 'subscribe' && verifyToken === (channel.config as any)?.verifyToken) {
    logger.webhook('WhatsApp webhook verified', {
      channelId,
      tenantId: channel.tenantId,
    });
    res.status(200).send(challenge);
  } else {
    throw new AuthenticationError('Invalid verify token');
  }
}));

router.post('/whatsapp/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { entry } = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'WHATSAPP') {
    throw new NotFoundError('WhatsApp channel not found');
  }

  // Verify webhook signature
  // Note: In production, you should verify the signature
  // verifyWebhookSignature(channel.config.webhookSecret)(req, res, () => {});

  for (const entryItem of entry) {
    for (const change of entryItem.changes) {
      if (change.field === 'messages') {
        for (const message of change.value.messages || []) {
          if (message.type === 'text') {
            const customerPhone = message.from;
            const customerName = change.value.contacts?.[0]?.profile?.name || 'Unknown';
            const messageContent = message.text.body;

            await processIncomingMessage(
              channelId,
              customerPhone,
              customerName,
              messageContent,
              'TEXT',
              {
                whatsappMessageId: message.id,
                timestamp: message.timestamp,
              }
            );
          }
        }
      }
    }
  }

  res.status(200).json({ success: true });
}));

// Facebook Messenger webhook
router.get('/facebook/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;

  // Get channel to verify token
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'FACEBOOK') {
    throw new NotFoundError('Facebook channel not found');
  }

  if (mode === 'subscribe' && verifyToken === (channel.config as any)?.verifyToken) {
    logger.webhook('Facebook webhook verified', {
      channelId,
      tenantId: channel.tenantId,
    });
    res.status(200).send(challenge);
  } else {
    throw new AuthenticationError('Invalid verify token');
  }
}));

router.post('/facebook/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { entry } = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'FACEBOOK') {
    throw new NotFoundError('Facebook channel not found');
  }

  for (const entryItem of entry) {
    for (const messaging of entryItem.messaging || []) {
      if (messaging.message && !messaging.message.is_echo) {
        const senderId = messaging.sender.id;
        const messageContent = messaging.message.text;

        if (messageContent) {
          // Get sender info from Facebook API
          let customerName = 'Unknown';
          try {
            const userInfo = await axios.get(
              `https://graph.facebook.com/v18.0/${senderId}`,
              {
                params: {
                  fields: 'first_name,last_name',
                  access_token: (channel.config as any)?.accessToken,
                },
              }
            );
            customerName = `${userInfo.data.first_name} ${userInfo.data.last_name}`.trim();
          } catch (error) {
            logger.warn('Failed to get Facebook user info:', {
              senderId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          await processIncomingMessage(
            channelId,
            senderId,
            customerName,
            messageContent,
            'TEXT',
            {
              facebookMessageId: messaging.message.mid,
              timestamp: messaging.timestamp,
            }
          );
        }
      }
    }
  }

  res.status(200).json({ success: true });
}));

// Instagram webhook
router.get('/instagram/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;

  // Get channel to verify token
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'INSTAGRAM') {
    throw new NotFoundError('Instagram channel not found');
  }

  if (mode === 'subscribe' && verifyToken === (channel.config as any)?.verifyToken) {
    logger.webhook('Instagram webhook verified', {
      channelId,
      tenantId: channel.tenantId,
    });
    res.status(200).send(challenge);
  } else {
    throw new AuthenticationError('Invalid verify token');
  }
}));

router.post('/instagram/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { entry } = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'INSTAGRAM') {
    throw new NotFoundError('Instagram channel not found');
  }

  for (const entryItem of entry) {
    for (const messaging of entryItem.messaging || []) {
      if (messaging.message && !messaging.message.is_echo) {
        const senderId = messaging.sender.id;
        const messageContent = messaging.message.text;

        if (messageContent) {
          await processIncomingMessage(
            channelId,
            senderId,
            'Instagram User',
            messageContent,
            'TEXT',
            {
              instagramMessageId: messaging.message.mid,
              timestamp: messaging.timestamp,
            }
          );
        }
      }
    }
  }

  res.status(200).json({ success: true });
}));

// Telegram webhook
router.post('/telegram/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const update = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'TELEGRAM') {
    throw new NotFoundError('Telegram channel not found');
  }

  if (update.message && update.message.text) {
    const chatId = update.message.chat.id.toString();
    const customerName = update.message.from.first_name + (update.message.from.last_name ? ` ${update.message.from.last_name}` : '');
    const messageContent = update.message.text;

    await processIncomingMessage(
      channelId,
      chatId,
      customerName,
      messageContent,
      'TEXT',
      {
        telegramMessageId: update.message.message_id,
        telegramUserId: update.message.from.id,
        timestamp: update.message.date,
      }
    );
  }

  res.status(200).json({ success: true });
}));

// Email webhook (for services like SendGrid, Mailgun)
router.post('/email/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const emailData = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'API') {
    throw new NotFoundError('Email channel not found');
  }

  // Parse email data (format depends on email service)
  const customerEmail = emailData.from || emailData.sender;
  const customerName = emailData.fromName || emailData.senderName || 'Email User';
  const messageContent = emailData.text || emailData.body || emailData.content;
  const subject = emailData.subject;

  if (customerEmail && messageContent) {
    await processIncomingMessage(
      channelId,
      customerEmail,
      customerName,
      `Subject: ${subject}\n\n${messageContent}`,
      'EMAIL',
      {
        subject,
        emailMessageId: emailData.messageId,
        timestamp: emailData.timestamp || new Date().toISOString(),
      }
    );
  }

  res.status(200).json({ success: true });
}));

// SMS webhook (for services like Twilio)
router.post('/sms/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const smsData = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'API') {
    throw new NotFoundError('SMS channel not found');
  }

  // Parse SMS data (Twilio format)
  const customerPhone = smsData.From;
  const messageContent = smsData.Body;
  const customerName = 'SMS User';

  if (customerPhone && messageContent) {
    await processIncomingMessage(
      channelId,
      customerPhone,
      customerName,
      messageContent,
      'SMS',
      {
        smsMessageSid: smsData.MessageSid,
        twilioAccountSid: smsData.AccountSid,
        timestamp: new Date().toISOString(),
      }
    );
  }

  res.status(200).json({ success: true });
}));

// Webchat webhook (for custom web chat widget)
router.post('/webchat/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { customerIdentifier, customerName, message, sessionId } = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.type !== 'WEBSITE') {
    throw new NotFoundError('Webchat channel not found');
  }

  if (customerIdentifier && message) {
    await processIncomingMessage(
      channelId,
      customerIdentifier,
      customerName || 'Web Visitor',
      message,
      'TEXT',
      {
        sessionId,
        timestamp: new Date().toISOString(),
        source: 'webchat',
      }
    );
  }

  res.status(200).json({ success: true });
}));

// Generic webhook for testing
router.post('/test/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { customerIdentifier, customerName, message, messageType } = req.body;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  if (customerIdentifier && message) {
    const result = await processIncomingMessage(
      channelId,
      customerIdentifier,
      customerName || 'Test User',
      message,
      messageType || 'TEXT',
      {
        source: 'test',
        timestamp: new Date().toISOString(),
      }
    );

    res.status(200).json({
      success: true,
      data: {
        conversationId: result.conversation?.id,
        messageId: result.message.id,
      },
    });
  } else {
    throw new ValidationError('customerIdentifier and message are required');
  }
}));

// Webhook status endpoint
router.get('/status/:channelId', asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;

  // Get channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      _count: {
        select: {
          conversations: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          },
        },
      },
    },
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  res.json({
    success: true,
    data: {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      isActive: channel.isActive,
      webhookUrl: (channel.config as any)?.webhookUrl,
      conversationsLast24h: channel._count.conversations,
      lastTested: (channel.config as any)?.lastTested,
    },
  });
}));

export default router;