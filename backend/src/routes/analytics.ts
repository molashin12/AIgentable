import express from 'express';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateQuery, analyticsSchemas, validateDateRange } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';

const router = express.Router();

// Apply authentication and tenant requirement to all routes
router.use(authenticate);
router.use(requireTenant);

// Helper function to get date range
const getDateRange = (period: string, startDate?: string, endDate?: string) => {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  return { start, end };
};

// Helper function to generate time series data
const generateTimeSeries = (start: Date, end: Date, interval: string) => {
  const series = [];
  const current = new Date(start);
  
  let incrementMs: number;
  switch (interval) {
    case 'hour':
      incrementMs = 60 * 60 * 1000;
      break;
    case 'day':
      incrementMs = 24 * 60 * 60 * 1000;
      break;
    case 'week':
      incrementMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      incrementMs = 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      incrementMs = 24 * 60 * 60 * 1000;
  }

  while (current <= end) {
    series.push(new Date(current));
    current.setTime(current.getTime() + incrementMs);
  }

  return series;
};

// Dashboard overview analytics
router.get('/dashboard', validateQuery(analyticsSchemas.query), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', startDate, endDate } = req.query;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  const [conversationStats, messageStats, agentStats, channelStats, customerStats] = await Promise.all([
    // Conversation statistics
    prisma.conversation.aggregate({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
      _count: true,
    }),
    
    // Message statistics
    prisma.message.aggregate({
      where: {
        conversation: { tenantId },
        createdAt: { gte: start, lte: end },
      },
      _count: true,
    }),
    
    // Agent performance
    prisma.agent.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: {
            conversations: {
              where: {
                createdAt: { gte: start, lte: end },
              },
            },
          },
        },
      },
    }),
    
    // Channel performance
    prisma.channel.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: {
            conversations: {
              where: {
                createdAt: { gte: start, lte: end },
              },
            },
          },
        },
      },
    }),
    
    // Unique customers
    prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        customerEmail: true,
        customerPhone: true,
      },
      distinct: ['customerEmail', 'customerPhone'],
    }),
  ]);

  // Calculate response times
  const resolvedConversations = await prisma.conversation.findMany({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      status: 'RESOLVED',
    },
    select: {
      createdAt: true,
      endedAt: true,
    },
  });

  const avgResponseTime = resolvedConversations.length > 0
    ? resolvedConversations.reduce((sum: number, conv: any) => {
        const responseTime = conv.endedAt ? conv.endedAt.getTime() - conv.createdAt.getTime() : 0;
        return sum + responseTime;
      }, 0) / resolvedConversations.length
    : 0;

  // Get conversation status breakdown
  const statusBreakdown = await prisma.conversation.groupBy({
    by: ['status'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
  });

  // Get priority breakdown
  const priorityBreakdown = await prisma.conversation.groupBy({
    by: ['priority'],
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
    },
    _count: true,
  });

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      overview: {
        totalConversations: conversationStats._count,
        totalMessages: messageStats._count,
        uniqueCustomers: customerStats.length,
        avgResponseTimeMs: Math.round(avgResponseTime),
        avgResponseTimeHours: Math.round(avgResponseTime / (1000 * 60 * 60) * 100) / 100,
      },
      conversationsByStatus: statusBreakdown.map((stat: any) => ({
        status: stat.status,
        count: stat._count,
        percentage: Math.round((stat._count / conversationStats._count) * 100),
      })),
      conversationsByPriority: priorityBreakdown.map((stat: any) => ({
        priority: stat.priority,
        count: stat._count,
        percentage: Math.round((stat._count / conversationStats._count) * 100),
      })),
      agentPerformance: agentStats.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        conversations: agent._count.conversations,
        isActive: agent.isActive,
      })),
      channelPerformance: channelStats.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        conversations: channel._count.conversations,
        isActive: channel.isActive,
      })),
    },
  });
}));

// Conversation analytics
router.get('/conversations', validateQuery(analyticsSchemas.conversations), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', startDate, endDate, interval = 'day', channelId, agentId } = req.query;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  // Build where clause
  const where: any = {
    tenantId,
    createdAt: { gte: start, lte: end },
  };
  if (channelId) where.channelId = channelId;
  if (agentId) where.agentId = agentId;

  const [totalStats, statusStats, priorityStats, timeSeries] = await Promise.all([
    // Total statistics
    prisma.conversation.aggregate({
      where,
      _count: true,
    }),
    
    // Status breakdown
    prisma.conversation.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    
    // Priority breakdown
    prisma.conversation.groupBy({
      by: ['priority'],
      where,
      _count: true,
    }),
    
    // Time series data
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${interval}, "createdAt") as date,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active
      FROM "Conversation"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        ${channelId ? `AND "channelId" = ${channelId}` : ''}
        ${agentId ? `AND "agentId" = ${agentId}` : ''}
      GROUP BY DATE_TRUNC(${interval}, "createdAt")
      ORDER BY date
    `,
  ]);

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      total: totalStats._count,
      byStatus: statusStats.map((stat: any) => ({
        status: stat.status,
        count: stat._count,
        percentage: Math.round((stat._count / totalStats._count) * 100),
      })),
      byPriority: priorityStats.map((stat: any) => ({
        priority: stat.priority,
        count: stat._count,
        percentage: Math.round((stat._count / totalStats._count) * 100),
      })),
      timeSeries: timeSeries,
    },
  });
}));

// Message analytics
router.get('/messages', validateQuery(analyticsSchemas.messages), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', startDate, endDate, interval = 'day', channelId, agentId } = req.query;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  // Build where clause
  const where: any = {
    conversation: { tenantId },
    createdAt: { gte: start, lte: end },
  };
  if (channelId) where.conversation.channelId = channelId;
  if (agentId) where.conversation.agentId = agentId;

  const [totalStats, senderStats, typeStats, timeSeries] = await Promise.all([
    // Total statistics
    prisma.message.aggregate({
      where,
      _count: true,
    }),
    
    // Sender breakdown
    prisma.message.groupBy({
      by: ['sender'],
      where,
      _count: true,
    }),
    
    // Message type breakdown
    prisma.message.groupBy({
      by: ['type'],
      where,
      _count: true,
    }),
    
    // Time series data
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${interval}, m."createdAt") as date,
        COUNT(*) as count,
        COUNT(CASE WHEN m.sender = 'CUSTOMER' THEN 1 END) as customer_messages,
        COUNT(CASE WHEN m.sender = 'AGENT' THEN 1 END) as agent_messages,
        COUNT(CASE WHEN m.sender = 'SYSTEM' THEN 1 END) as system_messages
      FROM "Message" m
      JOIN "Conversation" c ON m."conversationId" = c.id
      WHERE c."tenantId" = ${tenantId}
        AND m."createdAt" >= ${start}
        AND m."createdAt" <= ${end}
        ${channelId ? `AND c."channelId" = ${channelId}` : ''}
        ${agentId ? `AND c."agentId" = ${agentId}` : ''}
      GROUP BY DATE_TRUNC(${interval}, m."createdAt")
      ORDER BY date
    `,
  ]);

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      total: totalStats._count,
      bySender: senderStats.map((stat: any) => ({
        sender: stat.sender,
        count: stat._count,
        percentage: Math.round((stat._count / totalStats._count) * 100),
      })),
      byType: typeStats.map((stat: any) => ({
        type: stat.type,
        count: stat._count,
        percentage: Math.round((stat._count / totalStats._count) * 100),
      })),
      timeSeries: timeSeries,
    },
  });
}));

// Agent performance analytics
router.get('/agents', validateQuery(analyticsSchemas.agents), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', startDate, endDate, agentId } = req.query;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  // Build where clause
  const where: any = {
    tenantId,
    createdAt: { gte: start, lte: end },
  };
  if (agentId) where.agentId = agentId;

  const agents = await prisma.agent.findMany({
    where: {
      tenantId,
      ...(agentId && { id: agentId as string }),
    },
    include: {
      _count: {
        select: {
          conversations: {
            where: {
              createdAt: { gte: start, lte: end },
            },
          },
        },
      },
    },
  });

  const agentPerformance = await Promise.all(
    agents.map(async (agent: any) => {
      const [conversationStats, messageStats, responseTimeStats] = await Promise.all([
        // Conversation statistics
        prisma.conversation.aggregate({
          where: {
            agentId: agent.id,
            createdAt: { gte: start, lte: end },
          },
          _count: true,
        }),
        
        // Message statistics
        prisma.message.aggregate({
          where: {
            conversation: {
              agentId: agent.id,
            },
            sender: 'AGENT',
            createdAt: { gte: start, lte: end },
          },
          _count: true,
        }),
        
        // Response time calculation
        prisma.conversation.findMany({
          where: {
            agentId: agent.id,
            createdAt: { gte: start, lte: end },
            status: 'RESOLVED',
          },
          select: {
            createdAt: true,
            endedAt: true,
          },
        }),
      ]);

      const avgResponseTime = responseTimeStats.length > 0
        ? responseTimeStats.reduce((sum: number, conv: any) => {
            const responseTime = conv.endedAt ? conv.endedAt.getTime() - conv.createdAt.getTime() : 0;
            return sum + responseTime;
          }, 0) / responseTimeStats.length
        : 0;

      // Get conversation status breakdown for this agent
      const statusBreakdown = await prisma.conversation.groupBy({
        by: ['status'],
        where: {
          agentId: agent.id,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      });

      return {
        id: agent.id,
        name: agent.name,
        isActive: agent.isActive,
        conversations: conversationStats._count,
        messages: messageStats._count,
        avgResponseTimeMs: Math.round(avgResponseTime),
        avgResponseTimeHours: Math.round(avgResponseTime / (1000 * 60 * 60) * 100) / 100,
        statusBreakdown: statusBreakdown.map((stat: any) => ({
          status: stat.status,
          count: stat._count,
        })),
      };
    })
  );

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      agents: agentPerformance,
    },
  });
}));

// Channel performance analytics
router.get('/channels', validateQuery(analyticsSchemas.channels), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', startDate, endDate, channelId } = req.query;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  const channels = await prisma.channel.findMany({
    where: {
      tenantId,
      ...(channelId && { id: channelId as string }),
    },
    include: {
      _count: {
        select: {
          conversations: {
            where: {
              createdAt: { gte: start, lte: end },
            },
          },
        },
      },
    },
  });

  const channelPerformance = await Promise.all(
    channels.map(async (channel: any) => {
      const [conversationStats, messageStats, customerStats] = await Promise.all([
        // Conversation statistics
        prisma.conversation.aggregate({
          where: {
            channelId: channel.id,
            createdAt: { gte: start, lte: end },
          },
          _count: true,
        }),
        
        // Message statistics
        prisma.message.aggregate({
          where: {
            conversation: {
              channelId: channel.id,
            },
            createdAt: { gte: start, lte: end },
          },
          _count: true,
        }),
        
        // Unique customers
        prisma.conversation.findMany({
          where: {
            channelId: channel.id,
            createdAt: { gte: start, lte: end },
          },
          select: {
            customerEmail: true,
            customerPhone: true,
          },
          distinct: ['customerEmail', 'customerPhone'],
        }),
      ]);

      // Get conversation status breakdown for this channel
      const statusBreakdown = await prisma.conversation.groupBy({
        by: ['status'],
        where: {
          channelId: channel.id,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      });

      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        isActive: channel.isActive,
        conversations: conversationStats._count,
        messages: messageStats._count,
        uniqueCustomers: customerStats.length,
        statusBreakdown: statusBreakdown.map((stat: any) => ({
          status: stat.status,
          count: stat._count,
        })),
      };
    })
  );

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      channels: channelPerformance,
    },
  });
}));

// Customer analytics
router.get('/customers', validateQuery(analyticsSchemas.customers), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { period = '7d', startDate, endDate } = req.query;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  const [newCustomers, returningCustomers, topCustomers, customerActivity] = await Promise.all([
    // New customers (first conversation in period)
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT COALESCE("customerEmail", "customerPhone")) as count
      FROM "Conversation" c1
      WHERE c1."tenantId" = ${tenantId}
        AND c1."createdAt" >= ${start}
        AND c1."createdAt" <= ${end}
        AND NOT EXISTS (
          SELECT 1 FROM "Conversation" c2
          WHERE c2."tenantId" = ${tenantId}
            AND COALESCE(c2."customerEmail", c2."customerPhone") = COALESCE(c1."customerEmail", c1."customerPhone")
            AND c2."createdAt" < ${start}
        )
    `,
    
    // Returning customers
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT COALESCE("customerEmail", "customerPhone")) as count
      FROM "Conversation" c1
      WHERE c1."tenantId" = ${tenantId}
        AND c1."createdAt" >= ${start}
        AND c1."createdAt" <= ${end}
        AND EXISTS (
          SELECT 1 FROM "Conversation" c2
          WHERE c2."tenantId" = ${tenantId}
            AND COALESCE(c2."customerEmail", c2."customerPhone") = COALESCE(c1."customerEmail", c1."customerPhone")
            AND c2."createdAt" < ${start}
        )
    `,
    
    // Top customers by conversation count
    prisma.$queryRaw`
      SELECT 
        COALESCE("customerEmail", "customerPhone") as customer,
        "customerName",
        COUNT(*) as conversation_count,
        MAX("createdAt") as last_conversation
      FROM "Conversation"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND COALESCE("customerEmail", "customerPhone") IS NOT NULL
      GROUP BY COALESCE("customerEmail", "customerPhone"), "customerName"
      ORDER BY conversation_count DESC
      LIMIT 10
    `,
    
    // Customer activity by channel
    prisma.$queryRaw`
      SELECT 
        ch.name as channel_name,
        ch.type as channel_type,
        COUNT(DISTINCT COALESCE(c."customerEmail", c."customerPhone")) as unique_customers
      FROM "Conversation" c
      JOIN "Channel" ch ON c."channelId" = ch.id
      WHERE c."tenantId" = ${tenantId}
        AND c."createdAt" >= ${start}
        AND c."createdAt" <= ${end}
      GROUP BY ch.id, ch.name, ch.type
      ORDER BY unique_customers DESC
    `,
  ]);

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      newCustomers: (newCustomers as any)[0]?.count || 0,
      returningCustomers: (returningCustomers as any)[0]?.count || 0,
      topCustomers: topCustomers,
      customersByChannel: customerActivity,
    },
  });
}));

// Export analytics data
router.post('/export', validateQuery(analyticsSchemas.export), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { type, period = '7d', startDate, endDate, format = 'json' } = req.body;
  const tenantId = req.user!.tenantId;
  const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

  let data: any = {};

  switch (type) {
    case 'conversations':
      data = await prisma.conversation.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
        },
        include: {
          channel: {
            select: { name: true, type: true },
          },
          agent: {
            select: { name: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      });
      break;

    case 'messages':
      data = await prisma.message.findMany({
        where: {
          conversation: { tenantId },
          createdAt: { gte: start, lte: end },
        },
        include: {
          conversation: {
            select: {
              customerName: true,
              customerEmail: true,
              channel: {
                select: { name: true, type: true },
              },
            },
          },
        },
      });
      break;

    case 'agents':
      data = await prisma.agent.findMany({
        where: { tenantId },
        include: {
          _count: {
            select: {
              conversations: {
                where: {
                  createdAt: { gte: start, lte: end },
                },
              },
            },
          },
        },
      });
      break;

    case 'channels':
      data = await prisma.channel.findMany({
        where: { tenantId },
        include: {
          _count: {
            select: {
              conversations: {
                where: {
                  createdAt: { gte: start, lte: end },
                },
              },
            },
          },
        },
      });
      break;

    default:
      throw new ValidationError('Invalid export type');
  }

  logger.business('Analytics data exported', {
    type,
    period,
    format,
    recordCount: Array.isArray(data) ? data.length : 1,
    tenantId,
    userId: req.user!.id,
  });

  if (format === 'csv') {
    // Convert to CSV format
    const csv = convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_${period}.csv"`);
    res.send(csv);
  } else {
    res.json({
      success: true,
      data: {
        type,
        period,
        dateRange: { start, end },
        records: data,
        count: Array.isArray(data) ? data.length : 1,
      },
    });
  }
}));

// Helper function to convert data to CSV
const convertToCSV = (data: Record<string, any>[]): string => {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

// Real-time analytics (for dashboard updates)
router.get('/realtime', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [activeConversations, recentMessages, onlineAgents] = await Promise.all([
    // Active conversations
    prisma.conversation.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    }),
    
    // Messages in last hour
    prisma.message.count({
      where: {
        conversation: { tenantId },
        createdAt: { gte: oneHourAgo },
      },
    }),
    
    // Active agents (simplified - would need session tracking)
    prisma.agent.count({
      where: {
        tenantId,
        isActive: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      timestamp: now,
      activeConversations,
      recentMessages,
      onlineAgents,
    },
  });
}));

export default router;