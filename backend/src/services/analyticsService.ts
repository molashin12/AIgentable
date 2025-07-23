import { prisma } from '../config/database';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import { getIO } from '../server';
import { broadcastDashboardUpdate } from '../sockets/socketHandlers';

export interface ConversationAnalytics {
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  customerSatisfactionScore: number;
  messageVolume: {
    total: number;
    userMessages: number;
    agentMessages: number;
  };
  topChannels: Array<{
    channelId: string;
    channelName: string;
    messageCount: number;
    conversationCount: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    messageCount: number;
    conversationCount: number;
  }>;
}

export interface AgentAnalytics {
  agentId: string;
  agentName: string;
  totalConversations: number;
  activeConversations: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  messageCount: number;
  customerSatisfactionScore: number;
  tokensUsed: number;
  costEstimate: number;
  performance: {
    responseTimeScore: number;
    resolutionScore: number;
    satisfactionScore: number;
    overallScore: number;
  };
  trends: {
    conversationsTrend: number; // percentage change
    responseTimeTrend: number;
    satisfactionTrend: number;
  };
}

export interface DashboardMetrics {
  overview: {
    totalConversations: number;
    activeConversations: number;
    totalAgents: number;
    activeAgents: number;
    totalChannels: number;
    activeChannels: number;
    totalMessages: number;
    averageResponseTime: number;
  };
  realTime: {
    conversationsToday: number;
    messagesToday: number;
    activeNow: number;
    responseTimeToday: number;
  };
  trends: {
    conversationsTrend: number;
    messagesTrend: number;
    responseTimeTrend: number;
    satisfactionTrend: number;
  };
  topPerformers: {
    agents: Array<{
      id: string;
      name: string;
      score: number;
      conversations: number;
    }>;
    channels: Array<{
      id: string;
      name: string;
      type: string;
      messageCount: number;
    }>;
  };
}

export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private cachePrefix = 'analytics:';
  private cacheTTL = 300; // 5 minutes

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Get conversation analytics for a tenant
   */
  public async getConversationAnalytics(
    tenantId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<ConversationAnalytics> {
    try {
      const cacheKey = `${this.cachePrefix}conversations:${tenantId}:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`;
      
      // Try to get from cache
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate analytics
      const analytics = await this.calculateConversationAnalytics(tenantId, timeRange);
      
      // Cache the result
      await this.setCache(cacheKey, analytics, this.cacheTTL);
      
      return analytics;
    } catch (error) {
      logger.error('Failed to get conversation analytics', {
        tenantId,
        timeRange,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get agent analytics for a tenant
   */
  public async getAgentAnalytics(
    tenantId: string,
    agentId?: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<AgentAnalytics[]> {
    try {
      const defaultTimeRange: AnalyticsTimeRange = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        period: 'day',
      };
      
      const range = timeRange || defaultTimeRange;
      const cacheKey = `${this.cachePrefix}agents:${tenantId}:${agentId || 'all'}:${range.startDate.getTime()}:${range.endDate.getTime()}`;
      
      // Try to get from cache
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate analytics
      const analytics = await this.calculateAgentAnalytics(tenantId, agentId, range);
      
      // Cache the result
      await this.setCache(cacheKey, analytics, this.cacheTTL);
      
      return analytics;
    } catch (error) {
      logger.error('Failed to get agent analytics', {
        tenantId,
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get dashboard metrics for a tenant
   */
  public async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    try {
      const cacheKey = `${this.cachePrefix}dashboard:${tenantId}`;
      
      // Try to get from cache
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate metrics
      const metrics = await this.calculateDashboardMetrics(tenantId);
      
      // Cache the result with shorter TTL for real-time data
      await this.setCache(cacheKey, metrics, 60); // 1 minute
      
      return metrics;
    } catch (error) {
      logger.error('Failed to get dashboard metrics', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update real-time metrics
   */
  public async updateRealTimeMetrics(
    tenantId: string,
    event: 'conversation_created' | 'message_sent' | 'conversation_completed' | 'agent_response'
  ): Promise<void> {
    try {
      // Invalidate cache
      await this.invalidateCache(`${this.cachePrefix}dashboard:${tenantId}`);
      
      // Get updated metrics
      const metrics = await this.getDashboardMetrics(tenantId);
      
      // Broadcast to connected clients
      const io = getIO();
      await broadcastDashboardUpdate(io, tenantId);
      
      logger.debug('Real-time metrics updated', {
        tenantId,
        event,
      });
    } catch (error) {
      logger.error('Failed to update real-time metrics', {
        tenantId,
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate conversation analytics
   */
  private async calculateConversationAnalytics(
    tenantId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<ConversationAnalytics> {
    const { startDate, endDate } = timeRange;

    // Get conversation counts
    const [totalConversations, activeConversations, completedConversations] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.conversation.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.conversation.count({
        where: {
          tenantId,
          status: 'RESOLVED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Get message statistics
    const messageStats = await prisma.message.groupBy({
      by: ['sender'],
      where: {
        conversation: { tenantId },
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    const messageVolume = {
      total: messageStats.reduce((sum, stat) => sum + stat._count.id, 0),
      userMessages: messageStats.find(s => s.sender === 'CUSTOMER')?._count.id || 0,
      agentMessages: messageStats.find(s => s.sender === 'AGENT')?._count.id || 0,
    };

    // Get top channels
    const topChannels = await prisma.channel.findMany({
      where: { tenantId },
      include: {
        conversations: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          include: {
            _count: {
              select: { messages: true },
            },
          },
        },
      },
    });

    const channelStats = topChannels.map(channel => ({
      channelId: channel.id,
      channelName: channel.name,
      messageCount: channel.conversations.reduce(
        (sum, conv) => sum + (conv._count?.messages || 0),
        0
      ),
      conversationCount: channel.conversations.length,
    })).sort((a, b) => b.messageCount - a.messageCount);

    // Get hourly distribution
    const hourlyDistribution = await this.getHourlyDistribution(tenantId, timeRange);

    // Calculate average response time (placeholder - would need more complex query)
    const averageResponseTime = await this.calculateAverageResponseTime(tenantId, timeRange);
    
    // Calculate average resolution time
    const averageResolutionTime = await this.calculateAverageResolutionTime(tenantId, timeRange);

    return {
      totalConversations,
      activeConversations,
      completedConversations,
      averageResponseTime,
      averageResolutionTime,
      customerSatisfactionScore: 4.2, // Placeholder - would come from feedback system
      messageVolume,
      topChannels: channelStats,
      hourlyDistribution,
    };
  }

  /**
   * Calculate agent analytics
   */
  private async calculateAgentAnalytics(
    tenantId: string,
    agentId?: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<AgentAnalytics[]> {
    const { startDate, endDate } = timeRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const whereClause: any = {
      tenantId,
      ...(agentId && { id: agentId }),
    };

    const agents = await prisma.agent.findMany({
      where: whereClause,
      include: {
        conversations: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          include: {
            messages: {
              where: {
                createdAt: { gte: startDate, lte: endDate },
              },
            },
          },
        },
      },
    });

    const analytics: AgentAnalytics[] = [];

    for (const agent of agents) {
      const totalConversations = agent.conversations.length;
      const activeConversations = agent.conversations.filter(
        conv => conv.status === 'ACTIVE'
      ).length;
      
      const messageCount = agent.conversations.reduce(
        (sum, conv) => sum + conv.messages.length,
        0
      );

      // Calculate token usage from message metadata
      const tokensUsed = agent.conversations.reduce((sum, conv) => {
        return sum + conv.messages.reduce((msgSum, msg) => {
          const tokens = (msg.metadata as any)?.tokensUsed || 0;
          return msgSum + tokens;
        }, 0);
      }, 0);

      // Estimate cost (placeholder calculation)
      const costEstimate = tokensUsed * 0.002; // $0.002 per 1K tokens

      // Calculate performance scores (placeholder logic)
      const responseTimeScore = Math.random() * 100; // Would be calculated from actual data
      const resolutionScore = Math.random() * 100;
      const satisfactionScore = Math.random() * 100;
      const overallScore = (responseTimeScore + resolutionScore + satisfactionScore) / 3;

      analytics.push({
        agentId: agent.id,
        agentName: agent.name,
        totalConversations,
        activeConversations,
        averageResponseTime: await this.calculateAgentResponseTime(agent.id, timeRange),
        averageResolutionTime: await this.calculateAgentResolutionTime(agent.id, timeRange),
        messageCount,
        customerSatisfactionScore: 4.2, // Placeholder
        tokensUsed,
        costEstimate,
        performance: {
          responseTimeScore,
          resolutionScore,
          satisfactionScore,
          overallScore,
        },
        trends: {
          conversationsTrend: Math.random() * 20 - 10, // Placeholder
          responseTimeTrend: Math.random() * 20 - 10,
          satisfactionTrend: Math.random() * 20 - 10,
        },
      });
    }

    return analytics;
  }

  /**
   * Calculate dashboard metrics
   */
  private async calculateDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // Overview metrics
    const [totalConversations, activeConversations, totalAgents, activeAgents, totalChannels, activeChannels] = await Promise.all([
      prisma.conversation.count({ where: { tenantId } }),
      prisma.conversation.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.agent.count({ where: { tenantId } }),
      prisma.agent.count({ where: { tenantId, isActive: true } }),
      prisma.channel.count({ where: { tenantId } }),
      prisma.channel.count({ where: { tenantId, isActive: true } }),
    ]);

    const totalMessages = await prisma.message.count({
      where: { conversation: { tenantId } },
    });

    // Real-time metrics
    const [conversationsToday, messagesToday] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: todayStart },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { tenantId },
          createdAt: { gte: todayStart },
        },
      }),
    ]);

    // Yesterday's metrics for trends
    const [conversationsYesterday, messagesYesterday] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { tenantId },
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
    ]);

    // Calculate trends
    const conversationsTrend = conversationsYesterday > 0 
      ? ((conversationsToday - conversationsYesterday) / conversationsYesterday) * 100 
      : 0;
    const messagesTrend = messagesYesterday > 0 
      ? ((messagesToday - messagesYesterday) / messagesYesterday) * 100 
      : 0;

    // Top performers
    const topAgents = await this.getTopPerformingAgents(tenantId);
    const topChannels = await this.getTopPerformingChannels(tenantId);

    return {
      overview: {
        totalConversations,
        activeConversations,
        totalAgents,
        activeAgents,
        totalChannels,
        activeChannels,
        totalMessages,
        averageResponseTime: 120, // Placeholder
      },
      realTime: {
        conversationsToday,
        messagesToday,
        activeNow: activeConversations,
        responseTimeToday: 95, // Placeholder
      },
      trends: {
        conversationsTrend,
        messagesTrend,
        responseTimeTrend: Math.random() * 20 - 10, // Placeholder
        satisfactionTrend: Math.random() * 10, // Placeholder
      },
      topPerformers: {
        agents: topAgents,
        channels: topChannels,
      },
    };
  }

  /**
   * Get hourly distribution
   */
  private async getHourlyDistribution(
    tenantId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<Array<{ hour: number; messageCount: number; conversationCount: number }>> {
    // This would require a more complex query to group by hour
    // For now, returning placeholder data
    const distribution = [];
    for (let hour = 0; hour < 24; hour++) {
      distribution.push({
        hour,
        messageCount: Math.floor(Math.random() * 100),
        conversationCount: Math.floor(Math.random() * 20),
      });
    }
    return distribution;
  }

  /**
   * Calculate average response time
   */
  private async calculateAverageResponseTime(
    tenantId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<number> {
    // Placeholder implementation
    // Would calculate time between user message and agent response
    return 120; // seconds
  }

  /**
   * Calculate average resolution time
   */
  private async calculateAverageResolutionTime(
    tenantId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<number> {
    // Placeholder implementation
    // Would calculate time from conversation start to completion
    return 1800; // seconds (30 minutes)
  }

  /**
   * Calculate agent response time
   */
  private async calculateAgentResponseTime(
    agentId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<number> {
    // Placeholder implementation
    return Math.floor(Math.random() * 300) + 60; // 60-360 seconds
  }

  /**
   * Calculate agent resolution time
   */
  private async calculateAgentResolutionTime(
    agentId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<number> {
    // Placeholder implementation
    return Math.floor(Math.random() * 3600) + 600; // 10-70 minutes
  }

  /**
   * Get top performing agents
   */
  private async getTopPerformingAgents(tenantId: string) {
    const agents = await prisma.agent.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
      take: 5,
      orderBy: {
        conversations: {
          _count: 'desc',
        },
      },
    });

    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      score: Math.floor(Math.random() * 100), // Placeholder score
      conversations: agent._count.conversations,
    }));
  }

  /**
   * Get top performing channels
   */
  private async getTopPerformingChannels(tenantId: string) {
    const channels = await prisma.channel.findMany({
      where: { tenantId, isActive: true },
      include: {
        conversations: {
          include: {
            _count: {
              select: { messages: true },
            },
          },
        },
      },
      take: 5,
    });

    return channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      messageCount: channel.conversations.reduce(
        (sum, conv) => sum + (conv._count?.messages || 0),
        0
      ),
    })).sort((a, b) => b.messageCount - a.messageCount);
  }

  /**
   * Cache helpers
   */
  private async getFromCache(key: string): Promise<any> {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Cache get failed', { key, error });
      return null;
    }
  }

  private async setCache(key: string, data: any, ttl: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(data));
      await redis.expire(key, ttl);
    } catch (error) {
      logger.warn('Cache set failed', { key, error });
    }
  }

  private async invalidateCache(pattern: string): Promise<void> {
    try {
      await redis.invalidatePattern(pattern + '*');
    } catch (error) {
      logger.warn('Cache invalidation failed', { pattern, error });
    }
  }

  /**
   * Generate analytics report
   */
  public async generateAnalyticsReport(
    tenantId: string,
    timeRange: AnalyticsTimeRange,
    includeAgents: boolean = true
  ): Promise<{
    conversations: ConversationAnalytics;
    agents?: AgentAnalytics[];
    dashboard: DashboardMetrics;
    generatedAt: Date;
  }> {
    try {
      const [conversations, agents, dashboard] = await Promise.all([
        this.getConversationAnalytics(tenantId, timeRange),
        includeAgents ? this.getAgentAnalytics(tenantId, undefined, timeRange) : Promise.resolve(undefined),
        this.getDashboardMetrics(tenantId),
      ]);

      return {
        conversations,
        agents,
        dashboard,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate analytics report', {
        tenantId,
        timeRange,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();
export default analyticsService;