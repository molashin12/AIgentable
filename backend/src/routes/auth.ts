import express from 'express';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { authService, authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, userSchemas } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '../utils/errors';
import logger from '../utils/logger';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Register new user and tenant
router.post('/register', validateBody(userSchemas.register), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, tenantName } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Check if tenant name is available (using name instead of slug since slug doesn't exist)
  const existingTenant = await prisma.tenant.findFirst({
    where: { name: tenantName },
  });

  if (existingTenant) {
    throw new ConflictError('Organization name is already taken');
  }

  // Hash password
  logger.info('Starting password hashing', { email });
  const hashedPassword = await authService.hashPassword(password);
  logger.info('Password hashing completed', { email });

  // Create tenant and user in a transaction
  logger.info('Starting database transaction', { email, tenantName });
  const result = await prisma.$transaction(async (tx: any) => {
    // Create tenant
    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        plan: 'STARTER',
        status: 'ACTIVE',
        settings: {
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
        },
      },
    });

    // Create user
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
        role: UserRole.BUSINESS_OWNER,
        status: 'ACTIVE',
        tenantId: tenant.id,
      },
    });

    return { tenant, user };
  });
  logger.info('Database transaction completed', { email, userId: result.user.id, tenantId: result.tenant.id });

  // Generate tokens
  logger.info('Generating tokens', { userId: result.user.id });
  const tokens = authService.generateTokens({
    userId: result.user.id,
    tenantId: result.tenant.id,
    email: result.user.email,
    role: result.user.role,
  });
  logger.info('Token generation completed', { userId: result.user.id });

  // Store refresh token with timeout handling
  logger.info('Storing refresh token for user', { userId: result.user.id });
  try {
    await Promise.race([
      authService.storeRefreshToken(result.user.id, tokens.refreshToken),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Refresh token storage timeout')), 10000)
      )
    ]);
    logger.info('Refresh token stored successfully', { userId: result.user.id });
  } catch (error) {
    logger.error('Failed to store refresh token', { userId: result.user.id, error });
    // Continue without failing the registration
  }

  logger.business('User registered', {
    userId: result.user.id,
    email: result.user.email,
    tenantId: result.tenant.id,
    tenantName: result.tenant.name,
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        // slug: result.tenant.slug, // Field doesn't exist in schema
        plan: result.tenant.plan,
      },
      tokens,
    },
  });
}));

// Login user
router.post('/login', validateBody(userSchemas.login), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user with tenant
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new AuthenticationError('Account is not active');
  }

  if (user.tenant?.status !== 'ACTIVE') {
    throw new AuthenticationError('Organization account is not active');
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(password, user.password);
  if (!isPasswordValid) {
    logger.security('Failed login attempt', {
      email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const tokens = authService.generateTokens({
    userId: user.id,
    tenantId: user.tenantId as string,
    email: user.email,
    role: user.role,
  });

  // Store refresh token
  await authService.storeRefreshToken(user.id, tokens.refreshToken);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  logger.business('User logged in', {
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLogin: user.lastLogin,
      },
      tenant: user.tenant,
      tokens,
    },
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  const payload = authService.verifyToken(refreshToken, true);

  // Validate refresh token in Redis
  const isValidRefreshToken = await authService.validateRefreshToken(payload.userId, refreshToken);
  if (!isValidRefreshToken) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
        },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE' || user.tenant?.status !== 'ACTIVE') {
    throw new AuthenticationError('User or tenant is not active');
  }

  // Generate new tokens
  const tokens = authService.generateTokens({
    userId: user.id,
    tenantId: user.tenantId as string,
    email: user.email,
    role: user.role,
  });

  // Store new refresh token
  await authService.storeRefreshToken(user.id, tokens.refreshToken);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLogin: user.lastLogin,
      },
      tenant: user.tenant,
      tokens,
    },
  });
}));

// Logout
router.post('/logout', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);

  if (token) {
    // Blacklist the access token
    await authService.blacklistToken(token);
  }

  if (req.user?.id) {
    // Revoke refresh token
    await authService.revokeRefreshToken(req.user.id);
  }

  logger.business('User logged out', {
    userId: req.user?.id,
    email: req.user?.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Logout successful',
  });
}));

// Forgot password
router.post('/forgot-password', validateBody(userSchemas.forgotPassword), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent',
    });
    return;
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

  // Store reset token in Redis only (no database fields for reset tokens)

  // Store in Redis for additional security
  await redis.set(`reset_token:${resetToken}`, user.id, 3600); // 1 hour

  // TODO: Send email with reset link
  // await emailService.sendPasswordResetEmail(user.email, resetToken);

  logger.business('Password reset requested', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent',
  });
}));

// Reset password
router.post('/reset-password', validateBody(userSchemas.resetPassword), asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  // Verify token in Redis
  const userId = await redis.get(`reset_token:${token}`);
  if (!userId) {
    throw new AuthenticationError('Invalid or expired reset token');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AuthenticationError('Invalid or expired reset token');
  }

  // Hash new password
  const hashedPassword = await authService.hashPassword(password);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
  });

  // Remove reset token from Redis
  await redis.del(`reset_token:${token}`);

  // Revoke all existing refresh tokens
  await authService.revokeRefreshToken(user.id);

  logger.business('Password reset completed', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Password reset successful',
  });
}));

// Change password
router.post('/change-password', authenticate, validateBody(userSchemas.changePassword), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify current password
  const isCurrentPasswordValid = await authService.comparePassword(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await authService.hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Revoke all existing refresh tokens
  await authService.revokeRefreshToken(userId);

  logger.business('Password changed', {
    userId,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

// Get current user profile
router.get('/me', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
          settings: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
        // preferences: user.preferences, // Field doesn't exist in schema
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tenant: user.tenant,
    },
  });
}));

// Update user profile
router.put('/me', authenticate, validateBody(userSchemas.updateProfile), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const updateData = req.body;

  // If email is being updated, check if it's already taken
  if (updateData.email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: updateData.email,
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new ConflictError('Email is already taken');
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  logger.business('User profile updated', {
    userId,
    email: updatedUser.email,
    changes: Object.keys(updateData),
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        // preferences: updatedUser.preferences, // Field doesn't exist in schema
        updatedAt: updatedUser.updatedAt,
      },
    },
  });
}));

// Verify token (for frontend to check if token is still valid)
router.get('/verify', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
        tenantId: req.user!.tenantId,
      },
    },
  });
}));

export default router;