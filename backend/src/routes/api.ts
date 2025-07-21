import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import tenantRoutes from './tenants';
import agentRoutes from './agents';
import conversationRoutes from './conversations';
import documentRoutes from './documents';
import channelRoutes from './channels';
import webhookRoutes from './webhooks';
import analyticsRoutes from './analytics';
import apiKeyRoutes from './apiKeys';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tenants', tenantRoutes);
router.use('/agents', agentRoutes);
router.use('/conversations', conversationRoutes);
router.use('/documents', documentRoutes);
router.use('/channels', channelRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/api-keys', apiKeyRoutes);

export default router;