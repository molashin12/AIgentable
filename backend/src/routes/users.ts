import express from 'express';
import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, requireTenant, authorize, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, userSchemas, validateId, validatePagination } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../utils/errors';
import logger from '../utils/logger';
import { authService } from '../middleware/auth';
import { config } from '../config/config';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Email transporter setup
const emailTransporter = nodemailer.createTransport({
  host: 'localhost',
  port: 587,
  secure: false,
  auth: {
    user: 'test@example.com',
    pass: 'password',
  },
});

// Get all users (admin only)
router.get('/', 
  requireTenant,
  authorize(UserRole.BUSINESS_OWNER),
  validatePagination,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { role, status, search } = req.query;
    const tenantId = req.user!.tenantId;

    const skip = (Number(page) - 1) * Number(limit);
    
    // Build where clause
    const where: Record<string, any> = { tenantId };
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy as string]: sortOrder },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
  
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

// Get user by ID
router.get('/:id', 
  requireTenant,
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Users can view their own profile, admins can view any user in their tenant
    if (id !== currentUserId && currentUserRole !== UserRole.BUSINESS_OWNER) {
      throw new AuthorizationError('You can only view your own profile');
    }

    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

// Create new user (admin only)
router.post('/', 
  requireTenant,
  authorize('BUSINESS_OWNER'),
  validateBody(userSchemas.inviteUser),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { firstName, lastName, email, role, sendInvitation } = req.body;
    const tenantId = req.user!.tenantId;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await authService.hashPassword(tempPassword);

    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role || UserRole.TEAM_MEMBER,
        status: 'ACTIVE',
        tenantId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Send invitation email if requested
    if (sendInvitation) {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        await emailTransporter.sendMail({
          from: config.email.fromAddress,
          to: email,
          subject: `Invitation to join ${tenant?.name || 'AIgentable'}`,
          html: `
            <h2>You've been invited to join ${tenant?.name || 'AIgentable'}</h2>
            <p>Hello ${firstName} ${lastName},</p>
            <p>You have been invited to join ${tenant?.name || 'AIgentable'} as a ${role}.</p>
            <p><strong>Your login credentials:</strong></p>
            <p>Email: ${email}</p>
            <p>Temporary Password: ${tempPassword}</p>
            <p>Please log in and change your password immediately.</p>
            <p><a href="${config.frontendUrl}/login">Login to AIgentable</a></p>
            <p>Best regards,<br>The AIgentable Team</p>
          `,
        });

        logger.business('User invitation sent', {
          userId: user.id,
          email,
          role,
          tenantId,
          invitedBy: req.user!.id,
        });
      } catch (error) {
        logger.error('Failed to send invitation email:', {
          userId: user.id,
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.business('User created', {
      userId: user.id,
      email,
      role,
      tenantId,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { 
        user,
        ...(sendInvitation && { tempPassword }),
      },
    });
  })
);

// Update user
router.put('/:id', 
  requireTenant,
  validateId,
  validateBody(userSchemas.updateProfile),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;
    const updateData = req.body;

    // Users can update their own profile, admins can update any user in their tenant
    if (id !== currentUserId && currentUserRole !== UserRole.BUSINESS_OWNER) {
      throw new AuthorizationError('You can only update your own profile');
    }

    // Check if user exists and belongs to tenant
    const existingUser = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!existingUser) {
      throw new NotFoundError('User');
    }

    // Non-admin users cannot change role or status
    if (currentUserRole !== UserRole.BUSINESS_OWNER) {
      delete updateData.role;
      delete updateData.status;
    }

    // Check if email is being changed and if it's already taken
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: updateData.email },
      });
      if (emailExists) {
        throw new ConflictError('Email already exists');
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.business('User updated', {
      userId: id,
      changes: Object.keys(updateData),
      tenantId,
      updatedBy: currentUserId,
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  })
);

// Delete user (admin only)
router.delete('/:id', 
  requireTenant,
  authorize(UserRole.BUSINESS_OWNER),
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const currentUserId = req.user!.id;

    // Cannot delete yourself
    if (id === currentUserId) {
      throw new ValidationError('You cannot delete your own account');
    }

    // Check if user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if user is the last admin
    if (user.role === UserRole.BUSINESS_OWNER) {
      const adminCount = await prisma.user.count({
        where: {
          tenantId,
          role: UserRole.BUSINESS_OWNER,
          status: 'ACTIVE',
        },
      });

      if (adminCount <= 1) {
        throw new ValidationError('Cannot delete the last admin user');
      }
    }

    // Soft delete by updating status
    await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        email: `deleted_${Date.now()}_${user.email}`, // Prevent email conflicts
        updatedAt: new Date(),
      },
    });

    logger.business('User deleted', {
      userId: id,
      email: user.email,
      role: user.role,
      tenantId,
      deletedBy: currentUserId,
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

// Change password
router.post('/:id/change-password', 
  requireTenant,
  validateId,
  validateBody(userSchemas.changePassword),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const tenantId = req.user!.tenantId;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Users can change their own password, admins can change any user's password
    if (id !== currentUserId && currentUserRole !== UserRole.BUSINESS_OWNER) {
      throw new AuthorizationError('You can only change your own password');
    }

    // Get user
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Verify current password (only for non-admin users changing their own password)
    if (id === currentUserId) {
      const isValidPassword = await authService.comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }
    }

    // Hash new password
    const hashedPassword = await authService.hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    logger.security('Password changed', {
      userId: id,
      tenantId,
      changedBy: currentUserId,
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

// Resend invitation (admin only)
router.post('/:id/resend-invitation', 
  requireTenant,
  authorize(UserRole.BUSINESS_OWNER),
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Get user
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate new temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await authService.hashPassword(tempPassword);

    // Update user with new password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    // Send invitation email
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      await emailTransporter.sendMail({
        from: config.email.fromAddress,
        to: user.email,
        subject: `Invitation to join ${tenant?.name || 'AIgentable'} (Resent)`,
        html: `
          <h2>Your invitation to ${tenant?.name || 'AIgentable'} has been resent</h2>
          <p>Hello ${user.firstName} ${user.lastName},</p>
          <p>Your invitation to join ${tenant?.name || 'AIgentable'} as a ${user.role} has been resent.</p>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Temporary Password: ${tempPassword}</p>
          <p>Please log in and change your password immediately.</p>
          <p><a href="${config.frontendUrl}/login">Login to AIgentable</a></p>
          <p>Best regards,<br>The AIgentable Team</p>
        `,
      });

      logger.business('User invitation resent', {
        userId: id,
        email: user.email,
        tenantId,
        resentBy: req.user!.id,
      });

      res.json({
        success: true,
        message: 'Invitation resent successfully',
        data: { tempPassword },
      });
    } catch (error) {
      logger.error('Failed to resend invitation email:', {
        userId: id,
        email: user.email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ApiError(500, 'Failed to send invitation email');
    }
  })
);

// Update user status (admin only)
router.patch('/:id/status', 
  requireTenant,
  authorize(UserRole.BUSINESS_OWNER),
  validateId,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user!.tenantId;
    const currentUserId = req.user!.id;

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      throw new ValidationError('Invalid status');
    }

    // Cannot change your own status
    if (id === currentUserId) {
      throw new ValidationError('You cannot change your own status');
    }

    // Get user
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if user is the last admin
    if (user.role === UserRole.BUSINESS_OWNER && status !== 'ACTIVE') {
      const adminCount = await prisma.user.count({
        where: {
          tenantId,
          role: UserRole.BUSINESS_OWNER,
          status: 'ACTIVE',
        },
      });

      if (adminCount <= 1) {
        throw new ValidationError('Cannot deactivate the last admin user');
      }
    }

    // Update status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
      select: {
          id: true,
          firstName: true,
        lastName: true,
          email: true,
          role: true,
          status: true,
        },
    });

    logger.business('User status changed', {
      userId: id,
      oldStatus: user.status,
      newStatus: status,
      tenantId,
      changedBy: currentUserId,
    });

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: { user: updatedUser },
    });
  })
);

// Get user activity log (admin only)
router.get('/:id/activity', 
  requireTenant,
  authorize(UserRole.BUSINESS_OWNER),
  validateId,
  validatePagination,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { page, limit } = req.query;
    const tenantId = req.user!.tenantId;

    // Check if user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // This would typically come from an audit log table
    // For now, we'll return basic information
    const activity = {
      userId: id,
      lastLogin: user.lastLogin,
      accountCreated: user.createdAt,
      lastUpdated: user.updatedAt,
    };

    res.json({
      success: true,
      data: { activity },
    });
  })
);

// Get current user profile
router.get('/me/profile', 
  requireTenant,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const tenantId = req.user!.tenantId;

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

// Update current user profile
router.put('/me/profile', 
  requireTenant,
  validateBody(userSchemas.updateProfile),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const tenantId = req.user!.tenantId;
    const { firstName, lastName, email } = req.body;

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });
      if (existingUser) {
        throw new ConflictError('Email already exists');
      }
    }

    // Update user profile
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.business('User profile updated', {
      userId,
      changes: Object.keys(req.body),
      tenantId,
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  })
);

export default router;