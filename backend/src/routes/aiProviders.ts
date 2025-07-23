import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  ValidationError,
  NotFoundError,
} from '../utils/errors';
import logger from '../utils/logger';
import { aiProvider, AIProvider } from '../services/aiProvider';
import { config } from '../config/config';
import Joi from 'joi';

const router = express.Router();

// Apply authentication and tenant requirement to all routes
router.use(authenticate);
router.use(requireTenant);

// Validation schemas
const testProviderSchema = Joi.object({
  provider: Joi.string().valid('openai', 'gemini').required(),
  model: Joi.string().optional(),
});

const setDefaultProviderSchema = Joi.object({
  provider: Joi.string().valid('openai', 'gemini').required(),
});

// Get available AI providers and their status
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  try {
    // Test connectivity for both providers
    const [openaiStatus, geminiStatus] = await Promise.allSettled([
      aiProvider.testProvider('openai'),
      aiProvider.testProvider('gemini'),
    ]);

    const providers = {
      openai: {
        available: openaiStatus.status === 'fulfilled' && openaiStatus.value.success,
        error: openaiStatus.status === 'fulfilled' ? openaiStatus.value.error : 'Connection failed',
        models: aiProvider.getAvailableModels('openai'),
        embeddingModels: aiProvider.getAvailableEmbeddingModels('openai'),
        configured: !!config.openaiApiKey,
      },
      gemini: {
        available: geminiStatus.status === 'fulfilled' && geminiStatus.value.success,
        error: geminiStatus.status === 'fulfilled' ? geminiStatus.value.error : 'Connection failed',
        models: aiProvider.getAvailableModels('gemini'),
        embeddingModels: aiProvider.getAvailableEmbeddingModels('gemini'),
        configured: !!config.geminiApiKey,
      },
    };

    const currentProvider = aiProvider.getDefaultProvider();

    logger.system('AI provider status checked', {
      tenantId,
      userId,
      currentProvider,
      openaiAvailable: providers.openai.available,
      geminiAvailable: providers.gemini.available,
    });

    res.json({
      success: true,
      data: {
        currentProvider,
        providers,
        configuration: {
          defaultProvider: config.defaultAIProvider,
          openaiConfigured: providers.openai.configured,
          geminiConfigured: providers.gemini.configured,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to check AI provider status:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId,
    });
    throw new ApiError(500, 'Failed to check provider status');
  }
}));

// Test specific AI provider connectivity
router.post('/test', validateBody(testProviderSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { provider, model } = req.body;
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  try {
    const testResult = await aiProvider.testProvider(provider as AIProvider);
    
    // If test is successful and model is provided, test with specific model
    let modelTestResult = null;
    if (testResult.success && model) {
      try {
        const testCompletion = await aiProvider.generateChatCompletion(
          [{ role: 'user', content: 'Hello, this is a test.' }],
          { provider: provider as AIProvider, model, maxTokens: 10, temperature: 0 }
        );
        modelTestResult = {
          success: true,
          model: testCompletion.model,
          tokensUsed: testCompletion.tokensUsed,
        };
      } catch (error) {
        modelTestResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Model test failed',
        };
      }
    }

    logger.system('AI provider tested', {
      provider,
      model,
      success: testResult.success,
      tenantId,
      userId,
    });

    res.json({
      success: true,
      data: {
        provider,
        connectivity: testResult,
        modelTest: modelTestResult,
        availableModels: aiProvider.getAvailableModels(provider as AIProvider),
        availableEmbeddingModels: aiProvider.getAvailableEmbeddingModels(provider as AIProvider),
      },
    });
  } catch (error) {
    logger.error('AI provider test failed:', {
      provider,
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId,
    });
    throw new ApiError(500, `Failed to test ${provider} provider`);
  }
}));

// Set default AI provider (runtime change)
router.post('/set-default', validateBody(setDefaultProviderSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { provider } = req.body;
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  try {
    // Test the provider before setting it as default
    const testResult = await aiProvider.testProvider(provider as AIProvider);
    
    if (!testResult.success) {
      throw new ValidationError(`Cannot set ${provider} as default: ${testResult.error}`);
    }

    // Set the new default provider
    const previousProvider = aiProvider.getDefaultProvider();
    aiProvider.setDefaultProvider(provider as AIProvider);

    logger.business('Default AI provider changed', {
      previousProvider,
      newProvider: provider,
      tenantId,
      userId,
    });

    res.json({
      success: true,
      message: `Default AI provider set to ${provider}`,
      data: {
        previousProvider,
        currentProvider: provider,
        testResult,
      },
    });
  } catch (error) {
    logger.error('Failed to set default AI provider:', {
      provider,
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      userId,
    });
    
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ApiError(500, `Failed to set ${provider} as default provider`);
  }
}));

// Get AI provider usage statistics
router.get('/usage', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { period = '7d' } = req.query;

  try {
    // Calculate date range
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get usage statistics from message metadata
    const [openaiMessages, geminiMessages] = await Promise.all([
      // OpenAI usage
      prisma.message.findMany({
        where: {
          conversation: { tenantId },
          sender: 'AGENT',
          createdAt: { gte: startDate },
          metadata: {
            path: ['provider'],
            equals: 'openai',
          },
        },
        select: {
          metadata: true,
        },
      }),
      // Gemini usage
      prisma.message.findMany({
        where: {
          conversation: { tenantId },
          sender: 'AGENT',
          createdAt: { gte: startDate },
          metadata: {
            path: ['provider'],
            equals: 'gemini',
          },
        },
        select: {
          metadata: true,
        },
      }),
    ]);

    // Calculate token usage
    const openaiTokens = openaiMessages.reduce((sum, msg) => {
      const tokens = (msg.metadata as any)?.tokensUsed || 0;
      return sum + (typeof tokens === 'number' ? tokens : 0);
    }, 0);

    const geminiTokens = geminiMessages.reduce((sum, msg) => {
      const tokens = (msg.metadata as any)?.tokensUsed || 0;
      return sum + (typeof tokens === 'number' ? tokens : 0);
    }, 0);

    res.json({
      success: true,
      data: {
        period,
        usage: {
          openai: {
            messages: openaiMessages.length,
            tokens: openaiTokens,
          },
          gemini: {
            messages: geminiMessages.length,
            tokens: geminiTokens,
          },
        },
        total: {
          messages: openaiMessages.length + geminiMessages.length,
          tokens: openaiTokens + geminiTokens,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get AI provider usage:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      period,
    });
    throw new ApiError(500, 'Failed to retrieve usage statistics');
  }
}));

export default router;