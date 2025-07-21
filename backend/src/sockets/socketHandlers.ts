import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { prisma } from '../config/database';
import logger from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  userRole?: string;
}

export const initializeSocketHandlers = (io: SocketIOServer): void => {
  // Authentication middleware for socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      
      // Verify user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('Invalid or inactive user'));
      }

      socket.userId = user.id;
      socket.tenantId = user.tenantId || undefined;
      socket.userRole = user.role;
      
      logger.info('Socket authenticated', {
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
      });
      
      next();
    } catch (error) {
      logger.error('Socket authentication failed', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(new Error('Authentication failed'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: socket.userId,
      tenantId: socket.tenantId,
    });

    // Join tenant-specific room
    if (socket.tenantId) {
      socket.join(`tenant:${socket.tenantId}`);
    }

    // Join user-specific room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Handle conversation events
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug('User joined conversation', {
        userId: socket.userId,
        conversationId,
        socketId: socket.id,
      });
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug('User left conversation', {
        userId: socket.userId,
        conversationId,
        socketId: socket.id,
      });
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    // Handle agent status updates
    socket.on('agent_status_update', (data: { agentId: string; status: string }) => {
      if (socket.userRole === 'ADMIN' || socket.userRole === 'MANAGER') {
        socket.to(`tenant:${socket.tenantId}`).emit('agent_status_changed', {
          agentId: data.agentId,
          status: data.status,
          updatedBy: socket.userId,
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        tenantId: socket.tenantId,
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      });
    });
  });

  logger.info('Socket handlers initialized');
};

// Helper functions to emit events from other parts of the application
export const emitToUser = (io: SocketIOServer, userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToTenant = (io: SocketIOServer, tenantId: string, event: string, data: any): void => {
  io.to(`tenant:${tenantId}`).emit(event, data);
};

export const emitToConversation = (io: SocketIOServer, conversationId: string, event: string, data: any): void => {
  io.to(`conversation:${conversationId}`).emit(event, data);
};

// Broadcast new message to conversation participants
export const broadcastMessage = (io: SocketIOServer, conversationId: string, message: any): void => {
  io.to(`conversation:${conversationId}`).emit('new_message', message);
};

// Broadcast agent response to conversation
export const broadcastAgentResponse = (io: SocketIOServer, conversationId: string, response: any): void => {
  io.to(`conversation:${conversationId}`).emit('agent_response', response);
};

// Broadcast system notification
export const broadcastSystemNotification = (io: SocketIOServer, tenantId: string, notification: any): void => {
  io.to(`tenant:${tenantId}`).emit('system_notification', notification);
};