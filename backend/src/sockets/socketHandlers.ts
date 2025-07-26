import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { prisma } from '../config/database';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  userRole?: string;
}

// Real-time metrics cache
interface TenantMetrics {
  activeConversations: number;
  totalMessages: number;
  activeAgents: number;
  responseTime: number;
  lastUpdated: Date;
}

// Notification types
interface Notification {
  id: string;
  type: 'NEW_MESSAGE' | 'AGENT_STATUS_CHANGED' | 'CONVERSATION_ASSIGNED' | 'CONVERSATION_RESOLVED' | 'AGENT_CREATED';
  title: string;
  message: string;
  data: any;
  createdAt: Date;
  read: boolean;
}

// Global event emitter for real-time updates
const realTimeEmitter = new EventEmitter();
const tenantMetricsCache = new Map<string, TenantMetrics>();
const connectedUsers = new Map<string, Set<string>>(); // tenantId -> Set of socketIds

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
      
      // Track connected users per tenant
      if (!connectedUsers.has(socket.tenantId)) {
        connectedUsers.set(socket.tenantId, new Set());
      }
      connectedUsers.get(socket.tenantId)!.add(socket.id);
      
      // Send current dashboard metrics to newly connected user
      sendDashboardMetrics(socket, socket.tenantId);
    }

    // Join user-specific room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      
      // Send unread notifications to user
      sendUnreadNotifications(socket, socket.userId);
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
    socket.on('agent_status_update', async (data: { agentId: string; status: string }) => {
      if (socket.userRole === 'ADMIN' || socket.userRole === 'MANAGER') {
        try {
          // Update agent status in database
          await prisma.agent.update({
            where: { id: data.agentId },
            data: { 
              status: data.status as any, // Type assertion for now
              updatedAt: new Date()
            }
          });

          // Broadcast to all tenant users
          socket.to(`tenant:${socket.tenantId}`).emit('agent_status_changed', {
            agentId: data.agentId,
            status: data.status,
            updatedBy: socket.userId,
            timestamp: new Date()
          });

          // Create notification for status change
          const notification: Notification = {
            id: `agent_${data.agentId}_${Date.now()}`,
            type: 'AGENT_STATUS_CHANGED',
            title: 'Agent Status Updated',
            message: `Agent status changed to ${data.status}`,
            data: { agentId: data.agentId, status: data.status },
            createdAt: new Date(),
            read: false
          };

          // Broadcast notification to tenant
          broadcastNotification(io, socket.tenantId!, notification);

          // Update dashboard metrics
          await updateTenantMetrics(socket.tenantId!);
          
          logger.info('Agent status updated', {
            agentId: data.agentId,
            status: data.status,
            updatedBy: socket.userId,
            tenantId: socket.tenantId
          });
        } catch (error) {
          logger.error('Failed to update agent status', {
            agentId: data.agentId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          socket.emit('error', { message: 'Failed to update agent status' });
        }
      }
    });

    // Handle dashboard metrics request
    socket.on('request_dashboard_metrics', () => {
      if (socket.tenantId) {
        sendDashboardMetrics(socket, socket.tenantId);
      }
    });

    // Handle conversation monitoring
    socket.on('monitor_conversation', (data: { conversationId: string; monitor: boolean }) => {
      if (data.monitor) {
        socket.join(`monitor:${data.conversationId}`);
        logger.debug('User started monitoring conversation', {
          userId: socket.userId,
          conversationId: data.conversationId
        });
      } else {
        socket.leave(`monitor:${data.conversationId}`);
        logger.debug('User stopped monitoring conversation', {
          userId: socket.userId,
          conversationId: data.conversationId
        });
      }
    });

    // Handle notification actions
    socket.on('mark_notification_read', async (data: { notificationId: string }) => {
      try {
        // In a real implementation, you'd update the notification in the database
        socket.emit('notification_marked_read', { notificationId: data.notificationId });
        
        logger.debug('Notification marked as read', {
          userId: socket.userId,
          notificationId: data.notificationId
        });
      } catch (error) {
        logger.error('Failed to mark notification as read', {
          notificationId: data.notificationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle live conversation updates
    socket.on('conversation_update', async (data: { conversationId: string; update: any }) => {
      try {
        // Broadcast update to conversation monitors
        socket.to(`monitor:${data.conversationId}`).emit('conversation_updated', {
          conversationId: data.conversationId,
          update: data.update,
          updatedBy: socket.userId,
          timestamp: new Date()
        });

        // Update tenant metrics if conversation status changed
        if (data.update.status) {
          await updateTenantMetrics(socket.tenantId!);
        }
      } catch (error) {
        logger.error('Failed to process conversation update', {
          conversationId: data.conversationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle document events
    socket.on('join_documents', () => {
      if (socket.tenantId) {
        socket.join(`documents:${socket.tenantId}`);
        logger.debug('User joined documents room', {
          userId: socket.userId,
          tenantId: socket.tenantId,
          socketId: socket.id,
        });
      }
    });

    socket.on('leave_documents', () => {
      if (socket.tenantId) {
        socket.leave(`documents:${socket.tenantId}`);
        logger.debug('User left documents room', {
          userId: socket.userId,
          tenantId: socket.tenantId,
          socketId: socket.id,
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      // Clean up connected users tracking
      if (socket.tenantId && connectedUsers.has(socket.tenantId)) {
        connectedUsers.get(socket.tenantId)!.delete(socket.id);
        if (connectedUsers.get(socket.tenantId)!.size === 0) {
          connectedUsers.delete(socket.tenantId);
        }
      }

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

// Document-related broadcast functions
export const broadcastDocumentUploaded = (io: SocketIOServer, tenantId: string, document: any): void => {
  io.to(`documents:${tenantId}`).emit('document_uploaded', {
    document,
    timestamp: new Date()
  });
  
  logger.info('Document upload broadcasted', {
    tenantId,
    documentId: document.id,
    documentName: document.name
  });
};

export const broadcastDocumentStatusUpdate = (io: SocketIOServer, tenantId: string, documentUpdate: any): void => {
  io.to(`documents:${tenantId}`).emit('document_status_updated', {
    ...documentUpdate,
    timestamp: new Date()
  });
  
  logger.info('Document status update broadcasted', {
    tenantId,
    documentId: documentUpdate.id,
    status: documentUpdate.status
  });
};

export const broadcastDocumentProcessed = (io: SocketIOServer, tenantId: string, document: any): void => {
  io.to(`documents:${tenantId}`).emit('document_processed', {
    document,
    timestamp: new Date()
  });
  
  logger.info('Document processing completion broadcasted', {
    tenantId,
    documentId: document.id,
    chunks: document.metadata?.chunks || 0
  });
};

export const broadcastDocumentDeleted = (io: SocketIOServer, tenantId: string, documentId: string): void => {
  io.to(`documents:${tenantId}`).emit('document_deleted', {
    documentId,
    timestamp: new Date()
  });
  
  logger.info('Document deletion broadcasted', {
    tenantId,
    documentId
  });
};

// Enhanced real-time helper functions

// Send dashboard metrics to a specific socket
const sendDashboardMetrics = async (socket: AuthenticatedSocket, tenantId: string): Promise<void> => {
  try {
    const metrics = await getTenantMetrics(tenantId);
    socket.emit('dashboard_metrics', metrics);
  } catch (error) {
    logger.error('Failed to send dashboard metrics', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get or calculate tenant metrics
const getTenantMetrics = async (tenantId: string): Promise<TenantMetrics> => {
  // Check cache first
  const cached = tenantMetricsCache.get(tenantId);
  if (cached && (Date.now() - cached.lastUpdated.getTime()) < 30000) { // 30 second cache
    return cached;
  }

  try {
    // Calculate real-time metrics
    const [activeConversations, totalMessages, activeAgents, avgResponseTime] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          status: { in: ['ACTIVE'] }
        }
      }),
      prisma.message.count({
        where: {
          conversation: { tenantId },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      prisma.agent.count({
        where: {
          tenantId,
          status: 'ACTIVE'
        }
      }),
      // Mock response time calculation - would need actual response time field
      Promise.resolve({ _avg: null })
    ]);

    const metrics: TenantMetrics = {
      activeConversations,
      totalMessages,
      activeAgents,
      responseTime: 120, // Mock response time in seconds
      lastUpdated: new Date()
    };

    // Cache the metrics
    tenantMetricsCache.set(tenantId, metrics);
    return metrics;
  } catch (error) {
    logger.error('Failed to calculate tenant metrics', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Return default metrics on error
    return {
      activeConversations: 0,
      totalMessages: 0,
      activeAgents: 0,
      responseTime: 0,
      lastUpdated: new Date()
    };
  }
};

// Update tenant metrics and broadcast to connected users
const updateTenantMetrics = async (tenantId: string): Promise<void> => {
  try {
    // Clear cache to force recalculation
    tenantMetricsCache.delete(tenantId);
    
    // Get fresh metrics
    const metrics = await getTenantMetrics(tenantId);
    
    // Broadcast to all connected users in the tenant
    const connectedSockets = connectedUsers.get(tenantId);
    if (connectedSockets && connectedSockets.size > 0) {
      // Get the io instance from the global scope (you might need to adjust this)
      // For now, we'll emit via the realTimeEmitter
      realTimeEmitter.emit('metrics_updated', { tenantId, metrics });
    }
  } catch (error) {
    logger.error('Failed to update tenant metrics', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Send unread notifications to a user
const sendUnreadNotifications = async (socket: AuthenticatedSocket, userId: string): Promise<void> => {
  try {
    // In a real implementation, you'd fetch from a notifications table
    // For now, we'll send mock notifications
    const notifications: Notification[] = [];
    
    socket.emit('unread_notifications', notifications);
  } catch (error) {
    logger.error('Failed to send unread notifications', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Broadcast notification to all tenant users
export const broadcastNotification = (io: SocketIOServer, tenantId: string, notification: Notification): void => {
  io.to(`tenant:${tenantId}`).emit('new_notification', notification);
  
  logger.info('Notification broadcasted', {
    tenantId,
    notificationType: notification.type,
    notificationId: notification.id
  });
};

// Broadcast live conversation update
export const broadcastConversationUpdate = (io: SocketIOServer, conversationId: string, update: any): void => {
  // Emit to conversation participants
  io.to(`conversation:${conversationId}`).emit('conversation_updated', {
    conversationId,
    update,
    timestamp: new Date()
  });
  
  // Emit to conversation monitors
  io.to(`monitor:${conversationId}`).emit('conversation_monitored_update', {
    conversationId,
    update,
    timestamp: new Date()
  });
};

// Broadcast dashboard metrics update to all tenant users
export const broadcastDashboardUpdate = async (io: SocketIOServer, tenantId: string): Promise<void> => {
  try {
    const metrics = await getTenantMetrics(tenantId);
    io.to(`tenant:${tenantId}`).emit('dashboard_metrics', metrics);
    
    logger.debug('Dashboard metrics broadcasted', {
      tenantId,
      metrics
    });
  } catch (error) {
    logger.error('Failed to broadcast dashboard update', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get connected users count for a tenant
export const getConnectedUsersCount = (tenantId: string): number => {
  return connectedUsers.get(tenantId)?.size || 0;
};

// Setup periodic metrics updates
setInterval(async () => {
  for (const tenantId of connectedUsers.keys()) {
    try {
      // Clear cache to get fresh metrics
      tenantMetricsCache.delete(tenantId);
      
      // This would need access to the io instance
      // You might want to pass it as a parameter or store it globally
      realTimeEmitter.emit('periodic_metrics_update', tenantId);
    } catch (error) {
      logger.error('Failed to update periodic metrics', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}, 60000); // Update every minute

// Export the real-time emitter for use in other parts of the application
export { realTimeEmitter };