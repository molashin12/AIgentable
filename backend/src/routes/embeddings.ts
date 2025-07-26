import express, { Request, Response } from 'express';
import { z } from 'zod';
import { embeddingService } from '../services/embeddingService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import logger from '../utils/logger';
import { AIProvider } from '../services/langchainProvider';

const router = express.Router();

// Validation schemas
const embeddingRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  provider: z.enum(['openai', 'gemini']).optional(),
});

const batchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(10000)).min(1).max(100),
  provider: z.enum(['openai', 'gemini']).optional(),
});

const similarityRequestSchema = z.object({
  text1: z.string().min(1).max(10000),
  text2: z.string().min(1).max(10000),
  provider: z.enum(['openai', 'gemini']).optional(),
});

const similarTextsRequestSchema = z.object({
  queryText: z.string().min(1).max(10000),
  texts: z.array(z.string().min(1).max(10000)).min(1).max(100),
  threshold: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  provider: z.enum(['openai', 'gemini']).optional(),
});

/**
 * @swagger
 * /api/v1/embeddings/single:
 *   post:
 *     summary: Generate embedding for a single text
 *     tags: [Embeddings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to generate embedding for
 *                 maxLength: 10000
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 description: Embedding provider to use
 *                 default: gemini
 *     responses:
 *       200:
 *         description: Embedding generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     embeddings:
 *                       type: array
 *                       items:
 *                         type: array
 *                         items:
 *                           type: number
 *                     model:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     dimensions:
 *                       type: number
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/single', authenticate, validateBody(embeddingRequestSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, provider } = req.body;
    
    const result = await embeddingService.embedText(text, { provider });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error generating single embedding:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate embedding',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/embeddings/batch:
 *   post:
 *     summary: Generate embeddings for multiple texts
 *     tags: [Embeddings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - texts
 *             properties:
 *               texts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 100
 *                 description: Array of texts to generate embeddings for
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 description: Embedding provider to use
 *                 default: gemini
 *               batchSize:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Batch size for processing
 *                 default: 100
 *     responses:
 *       200:
 *         description: Embeddings generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/batch', authenticate, validateBody(batchEmbeddingRequestSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { texts, provider } = req.body;
    
    const result = await embeddingService.embedTexts(texts, { provider });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error generating batch embeddings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate embeddings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/embeddings/similarity:
 *   post:
 *     summary: Calculate similarity between two texts
 *     tags: [Embeddings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text1
 *               - text2
 *             properties:
 *               text1:
 *                 type: string
 *                 maxLength: 10000
 *               text2:
 *                 type: string
 *                 maxLength: 10000
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 default: gemini
 *     responses:
 *       200:
 *         description: Similarity calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     similarity:
 *                       type: number
 *                       description: Cosine similarity score between 0 and 1
 *                     text1:
 *                       type: string
 *                     text2:
 *                       type: string
 *                     provider:
 *                       type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/similarity', authenticate, validateBody(similarityRequestSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text1, text2, provider } = req.body;
    
    const result = await embeddingService.calculateSimilarity(text1, text2, { provider });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error calculating similarity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate similarity',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/embeddings/similar-texts:
 *   post:
 *     summary: Find most similar texts from a collection
 *     tags: [Embeddings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queryText
 *               - candidateTexts
 *             properties:
 *               queryText:
 *                 type: string
 *                 maxLength: 10000
 *               candidateTexts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 1000
 *               topK:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 5
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 default: gemini
 *     responses:
 *       200:
 *         description: Similar texts found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       similarity:
 *                         type: number
 *                       index:
 *                         type: number
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/similar-texts', authenticate, validateBody(similarTextsRequestSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { queryText, texts, threshold = 0.7, limit = 5, provider } = req.body;
    
    const results = await embeddingService.findSimilarTexts(
      queryText,
      texts,
      limit,
      { provider }
    );
    
    // Filter by threshold if provided
    const filteredResults = threshold > 0 
      ? results.filter(result => result.similarity >= threshold)
      : results;
    
    res.json({
      success: true,
      data: filteredResults
    });
  } catch (error) {
    logger.error('Error finding similar texts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find similar texts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/embeddings/providers:
 *   get:
 *     summary: Get available embedding providers
 *     tags: [Embeddings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available providers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     providers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     models:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           model:
 *                             type: string
 *                           dimensions:
 *                             type: number
 *                           maxTokens:
 *                             type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/providers', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const providers = embeddingService.getAvailableProviders();
    const models: Record<string, any> = {};
    
    providers.forEach(provider => {
      models[provider] = embeddingService.getModelInfo(provider);
    });
    
    res.json({
      success: true,
      data: {
        providers,
        models
      }
    });
  } catch (error) {
    logger.error('Error getting providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get providers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;