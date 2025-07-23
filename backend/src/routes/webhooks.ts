import express from 'express';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { webhookHandler } from '../services/webhookHandler';
import logger from '../utils/logger';
import { validateQuery } from '../utils/validation';
import { z } from 'zod';

const router = express.Router();

// Middleware to parse raw body for webhook signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

// Validation schemas
const whatsappWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.string(),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z.array(z.object({
          profile: z.object({
            name: z.string(),
          }),
          wa_id: z.string(),
        })).optional(),
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          text: z.object({
            body: z.string(),
          }).optional(),
          type: z.string(),
        })).optional(),
        statuses: z.array(z.object({
          id: z.string(),
          status: z.string(),
          timestamp: z.string(),
          recipient_id: z.string(),
        })).optional(),
      }),
      field: z.string(),
    })),
  })),
});

const facebookWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    time: z.number(),
    messaging: z.array(z.object({
      sender: z.object({
        id: z.string(),
      }),
      recipient: z.object({
        id: z.string(),
      }),
      timestamp: z.number(),
      message: z.object({
        mid: z.string(),
        text: z.string().optional(),
        attachments: z.array(z.object({
          type: z.string(),
          payload: z.object({
            url: z.string().optional(),
          }),
        })).optional(),
      }).optional(),
      delivery: z.object({
        mids: z.array(z.string()),
        watermark: z.number(),
      }).optional(),
      read: z.object({
        watermark: z.number(),
      }).optional(),
    })),
  })),
});

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha1' | 'sha256' = 'sha256'
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace(`${algorithm}=`, '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * @route GET /api/webhooks/whatsapp
 * @desc WhatsApp webhook verification
 * @access Public
 */
router.get('/whatsapp', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify the webhook
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('WhatsApp webhook verification failed', {
        mode,
        token: token ? '[REDACTED]' : 'missing',
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('WhatsApp webhook verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).send('Internal Server Error');
  }
});

/**
 * @route POST /api/webhooks/whatsapp
 * @desc Handle WhatsApp webhook events
 * @access Public
 */
router.post('/whatsapp', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = req.body.toString();

    // Verify webhook signature
    if (process.env.WHATSAPP_WEBHOOK_SECRET) {
      if (!signature || !verifyWebhookSignature(payload, signature, process.env.WHATSAPP_WEBHOOK_SECRET, 'sha256')) {
        logger.warn('WhatsApp webhook signature verification failed', {
          hasSignature: !!signature,
          hasSecret: !!process.env.WHATSAPP_WEBHOOK_SECRET,
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Parse the webhook payload
    const webhookData = JSON.parse(payload);
    
    // Validate the webhook data structure
    const validation = whatsappWebhookSchema.safeParse(webhookData);
    if (!validation.success) {
      logger.warn('Invalid WhatsApp webhook payload', {
        errors: validation.error.errors,
      });
      return res.status(400).json({
        error: 'Invalid webhook payload',
        details: validation.error.errors,
      });
    }

    const validatedData = validation.data;

    logger.info('WhatsApp webhook received', {
      object: validatedData.object,
      entryCount: validatedData.entry.length,
    });

    // Process each entry
    for (const entry of validatedData.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          const { value } = change;
          
          // Process incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              try {
                logger.info('WhatsApp message received', {
                  messageId: message.id,
                  from: message.from,
                  timestamp: new Date(parseInt(message.timestamp) * 1000),
                  text: message.text?.body || '',
                  type: message.type,
                  phoneNumberId: value.metadata.phone_number_id,
                  displayPhoneNumber: value.metadata.display_phone_number,
                });
              } catch (error) {
                logger.error('Failed to process WhatsApp message', {
                  messageId: message.id,
                  from: message.from,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }
          }

          // Process message statuses
          if (value.statuses) {
            for (const status of value.statuses) {
              try {
                logger.info('WhatsApp status received', {
                  messageId: status.id,
                  status: status.status,
                  timestamp: new Date(parseInt(status.timestamp) * 1000),
                  recipientId: status.recipient_id,
                });
              } catch (error) {
                logger.error('Failed to process WhatsApp status', {
                  messageId: status.id,
                  status: status.status,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('WhatsApp webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/webhooks/facebook
 * @desc Facebook Messenger webhook verification
 * @access Public
 */
router.get('/facebook', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify the webhook
    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      logger.info('Facebook webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('Facebook webhook verification failed', {
        mode,
        token: token ? '[REDACTED]' : 'missing',
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Facebook webhook verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).send('Internal Server Error');
  }
});

/**
 * @route POST /api/webhooks/facebook
 * @desc Handle Facebook Messenger webhook events
 * @access Public
 */
router.post('/facebook', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = req.body.toString();

    // Verify webhook signature
    if (process.env.FACEBOOK_WEBHOOK_SECRET) {
      if (!signature || !verifyWebhookSignature(payload, signature, process.env.FACEBOOK_WEBHOOK_SECRET, 'sha256')) {
        logger.warn('Facebook webhook signature verification failed', {
          hasSignature: !!signature,
          hasSecret: !!process.env.FACEBOOK_WEBHOOK_SECRET,
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Parse the webhook payload
    const webhookData = JSON.parse(payload);
    
    // Validate the webhook data structure
    const validation = facebookWebhookSchema.safeParse(webhookData);
    if (!validation.success) {
      logger.warn('Invalid Facebook webhook payload', {
        errors: validation.error.errors,
      });
      return res.status(400).json({
        error: 'Invalid webhook payload',
        details: validation.error.errors,
      });
    }

    const validatedData = validation.data;

    logger.info('Facebook webhook received', {
      object: validatedData.object,
      entryCount: validatedData.entry.length,
    });

    // Process each entry
    for (const entry of validatedData.entry) {
      for (const messaging of entry.messaging) {
        try {
          // Process incoming messages
          if (messaging.message) {
            // Use the public Facebook webhook processor
            await webhookHandler.processFacebookWebhook(req, res);
            return; // Exit early since response is handled
          }

          // Process delivery confirmations
          if (messaging.delivery) {
            logger.info('Facebook delivery receipt received', {
              senderId: messaging.sender.id,
              recipientId: messaging.recipient.id,
              messageIds: messaging.delivery.mids,
            });
          }

          // Process read receipts
          if (messaging.read) {
            logger.info('Facebook read receipt received', {
              senderId: messaging.sender.id,
              recipientId: messaging.recipient.id,
              watermark: messaging.read.watermark,
            });
          }
        } catch (error) {
          logger.error('Failed to process Facebook messaging event', {
            senderId: messaging.sender.id,
            recipientId: messaging.recipient.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Facebook webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/instagram
 * @desc Handle Instagram webhook events
 * @access Public
 */
router.post('/instagram', rawBodyParser, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = req.body.toString();

    // Verify webhook signature (Instagram uses same format as Facebook)
    if (process.env.INSTAGRAM_WEBHOOK_SECRET) {
      if (!signature || !verifyWebhookSignature(payload, signature, process.env.INSTAGRAM_WEBHOOK_SECRET, 'sha256')) {
        logger.warn('Instagram webhook signature verification failed');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const webhookData = JSON.parse(payload);
    
    logger.info('Instagram webhook received', {
      object: webhookData.object,
      entryCount: webhookData.entry?.length || 0,
    });

    // Process Instagram messages (similar to Facebook format)
    if (webhookData.entry) {
      for (const entry of webhookData.entry) {
        if (entry.messaging) {
          for (const messaging of entry.messaging) {
            try {
              if (messaging.message) {
                // Use the public Instagram webhook processor
                await webhookHandler.processInstagramWebhook(req, res);
                return; // Exit early since response is handled
              }
            } catch (error) {
              logger.error('Failed to process Instagram message', {
                senderId: messaging.sender?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Instagram webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/telegram
 * @desc Handle Telegram webhook events
 * @access Public
 */
router.post('/telegram', express.json(), async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    
    logger.info('Telegram webhook received', {
      updateId: webhookData.update_id,
      hasMessage: !!webhookData.message,
    });

    // Process Telegram messages
    if (webhookData.message) {
      const message = webhookData.message;
      
      try {
        // Use the public Telegram webhook processor
        await webhookHandler.processTelegramWebhook(req, res);
        return; // Exit early since response is handled
      } catch (error) {
        logger.error('Failed to process Telegram message', {
          messageId: message.message_id,
          chatId: message.chat.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Telegram webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/generic
 * @desc Handle generic webhook events for custom integrations
 * @access Public
 */
router.post('/generic', express.json(), async (req: Request, res: Response) => {
  try {
    const { platform, data, signature } = req.body;
    
    if (!platform || !data) {
      return res.status(400).json({
        error: 'Missing required fields: platform and data',
      });
    }

    // Verify signature if provided
    if (signature && process.env.GENERIC_WEBHOOK_SECRET) {
      const payload = JSON.stringify(data);
      if (!verifyWebhookSignature(payload, signature, process.env.GENERIC_WEBHOOK_SECRET)) {
        logger.warn('Generic webhook signature verification failed', { platform });
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    logger.info('Generic webhook received', {
      platform,
      dataKeys: Object.keys(data),
    });

    // Process generic webhook
    try {
      // Log generic webhook for now - implement specific processing as needed
      logger.info('Generic webhook processed', {
        platform,
        dataSize: JSON.stringify(data).length,
      });
    } catch (error) {
      logger.error('Failed to process generic webhook', {
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Generic webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/webhooks/health
 * @desc Check webhook service health
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date(),
      services: {
        webhookHandler: 'operational',
        messageProcessor: 'operational',
      },
      supportedPlatforms: [
        'whatsapp',
        'facebook',
        'instagram',
        'telegram',
        'generic',
      ],
    });
  } catch (error) {
    logger.error('Webhook health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;