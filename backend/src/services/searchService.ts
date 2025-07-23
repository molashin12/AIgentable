import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface SearchQuery {
  query?: string;
  filters?: SearchFilters;
  sort?: SortOptions;
  pagination?: PaginationOptions;
}

export interface SearchFilters {
  // Date filters
  dateFrom?: Date;
  dateTo?: Date;
  
  // Status filters
  status?: string[];
  priority?: string[];
  
  // User filters
  agentIds?: string[];
  customerIds?: string[];
  
  // Channel filters
  channels?: string[];
  
  // Conversation filters
  hasUnreadMessages?: boolean;
  isAssigned?: boolean;
  tags?: string[];
  
  // Message filters
  messageTypes?: string[];
  hasAttachments?: boolean;
  
  // Sentiment filters
  sentiment?: string[];
  
  // Custom field filters
  customFields?: Record<string, any>;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  searchTime: number;
  facets?: SearchFacets;
}

export interface SearchFacets {
  status?: Array<{ value: string; count: number }>;
  channels?: Array<{ value: string; count: number }>;
  agents?: Array<{ value: string; count: number; label: string }>;
  tags?: Array<{ value: string; count: number }>;
  dateRanges?: Array<{ value: string; count: number; label: string }>;
}

export interface ConversationSearchResult {
  id: string;
  title?: string;
  status: string;
  priority: string;
  channel: string;
  customerId: string;
  customerName?: string;
  agentId?: string;
  agentName?: string;
  tags: string[];
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  snippet?: string;
  relevanceScore?: number;
}

export interface MessageSearchResult {
  id: string;
  conversationId: string;
  content: string;
  type: string;
  senderId: string;
  senderName?: string;
  senderType: string;
  timestamp: Date;
  hasAttachments: boolean;
  snippet?: string;
  relevanceScore?: number;
}

export interface SearchAnalytics {
  totalSearches: number;
  searchesToday: number;
  searchesThisWeek: number;
  averageResultsPerSearch: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgResults: number;
  }>;
  popularFilters: Array<{
    filter: string;
    count: number;
  }>;
  searchPerformance: Array<{
    date: string;
    searches: number;
    avgResponseTime: number;
  }>;
}

class SearchService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly SEARCH_ANALYTICS_TTL = 86400; // 24 hours

  /**
   * Search conversations with full-text search and filtering
   */
  async searchConversations(
    tenantId: string,
    searchQuery: SearchQuery
  ): Promise<SearchResult<ConversationSearchResult>> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        filters = {},
        sort = { field: 'updatedAt', direction: 'desc' },
        pagination = { page: 1, limit: 20 }
      } = searchQuery;
      
      // Build where clause
      const where: any = {
        tenantId,
        ...this.buildConversationFilters(filters),
      };
      
      // Add full-text search if query provided
      if (query && query.trim()) {
        where.OR = [
          {
            messages: {
              some: {
                content: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            customer: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
              ],
            },
          },
          {
            tags: {
              hasSome: [query],
            },
          },
        ];
      }
      
      // Calculate pagination
      const skip = (pagination.page - 1) * pagination.limit;
      
      // Execute search with count
      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          include: {
            agent: {
              select: {
                id: true,
                name: true,
              },
            },
            messages: {
              select: {
                id: true,
                content: true,
                sentAt: true,
              },
              orderBy: {
                sentAt: 'desc',
              },
              take: 1,
            },
            _count: {
              select: {
                messages: true,
              },
            },
          },
          orderBy: this.buildSortClause(sort),
          skip,
          take: pagination.limit,
        }),
        prisma.conversation.count({ where }),
      ]);
      
      // Transform results
      const items: ConversationSearchResult[] = conversations.map(conv => ({
        id: conv.id,
        title: conv.customerName || 'Untitled Conversation', // Use customerName as title
        status: conv.status,
        priority: conv.priority,
        channel: conv.channelId, // Use channelId instead of channel
        customerId: conv.customerEmail || '', // Use customerEmail as customerId
        customerName: conv.customerName || undefined, // Handle null value
        agentId: conv.agentId || undefined, // Handle null value
        agentName: conv.agent?.name,
        tags: conv.tags,
        messageCount: conv._count.messages,
        lastMessageAt: conv.messages[0]?.sentAt || conv.createdAt, // Use sentAt instead of timestamp
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        snippet: this.generateSnippet(conv.messages[0]?.content, query),
        relevanceScore: this.calculateRelevanceScore(conv, query),
      }));
      
      const searchTime = Date.now() - startTime;
      
      // Track search analytics
      this.trackSearchAnalytics(tenantId, 'conversations', query, filters, total, searchTime);
      
      return {
        items,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrev: pagination.page > 1,
        searchTime,
        facets: await this.getConversationFacets(tenantId, filters),
      };
    } catch (error) {
      logger.error('Failed to search conversations', { error, tenantId, searchQuery });
      throw new Error('Failed to search conversations');
    }
  }

  /**
   * Search messages with full-text search and filtering
   */
  async searchMessages(
    tenantId: string,
    searchQuery: SearchQuery
  ): Promise<SearchResult<MessageSearchResult>> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        filters = {},
        sort = { field: 'timestamp', direction: 'desc' },
        pagination = { page: 1, limit: 20 }
      } = searchQuery;
      
      // Build where clause
      const where: any = {
        conversation: {
          tenantId,
        },
        ...this.buildMessageFilters(filters),
      };
      
      // Add full-text search if query provided
      if (query && query.trim()) {
        where.content = {
          contains: query,
          mode: 'insensitive',
        };
      }
      
      // Calculate pagination
      const skip = (pagination.page - 1) * pagination.limit;
      
      // Execute search with count
      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where,
          include: {

            conversation: {
              select: {
                id: true,
                customerName: true,
              },
            },

          },
          orderBy: this.buildSortClause(sort),
          skip,
          take: pagination.limit,
        }),
        prisma.message.count({ where }),
      ]);
      
      // Transform results
      const items: MessageSearchResult[] = messages.map(msg => ({
        id: msg.id,
        conversationId: msg.conversationId,
        content: msg.content,
        type: msg.type,
        senderId: '', // Message model doesn't have senderId field
        senderName: msg.sender,
        senderType: msg.sender,
        timestamp: msg.sentAt,
        hasAttachments: false, // Message model doesn't have attachments relation
        snippet: this.generateSnippet(msg.content, query),
        relevanceScore: this.calculateMessageRelevanceScore(msg, query),
      }));
      
      const searchTime = Date.now() - startTime;
      
      // Track search analytics
      this.trackSearchAnalytics(tenantId, 'messages', query, filters, total, searchTime);
      
      return {
        items,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrev: pagination.page > 1,
        searchTime,
      };
    } catch (error) {
      logger.error('Failed to search messages', { error, tenantId, searchQuery });
      throw new Error('Failed to search messages');
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(tenantId: string, days: number = 30): Promise<SearchAnalytics> {
    try {
      const cacheKey = `search_analytics:${tenantId}:${days}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      // Get search statistics from Redis
      const searchKeys = await redis.keys(`search:${tenantId}:*`);
      const searchData = await Promise.all(
        searchKeys.map(async key => {
          const data = await redis.hgetall(key);
          return {
            key,
            tenantId: data.tenantId || '',
            type: data.type || '',
            query: data.query || '',
            filters: data.filters || '{}',
            timestamp: parseInt(data.timestamp || '0'),
            results: parseInt(data.results || '0'),
            responseTime: parseInt(data.responseTime || '0'),
          };
        })
      );
      
      // Filter by date range
      const filteredData = searchData.filter(item => 
        item.timestamp >= startDate.getTime() && item.timestamp <= endDate.getTime()
      );
      
      const totalSearches = filteredData.length;
      const today = new Date().toISOString().split('T')[0];
      const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const searchesToday = filteredData.filter(item => 
        new Date(item.timestamp).toISOString().split('T')[0] === today
      ).length;
      
      const searchesThisWeek = filteredData.filter(item => 
        item.timestamp >= thisWeek.getTime()
      ).length;
      
      const averageResultsPerSearch = totalSearches > 0 
        ? filteredData.reduce((sum, item) => sum + item.results, 0) / totalSearches
        : 0;
      
      // Top queries
      const queryCount: Record<string, { count: number; totalResults: number }> = {};
      filteredData.forEach(item => {
        if (item.query) {
          if (!queryCount[item.query]) {
            queryCount[item.query] = { count: 0, totalResults: 0 };
          }
          queryCount[item.query].count++;
          queryCount[item.query].totalResults += item.results;
        }
      });
      
      const topQueries = Object.entries(queryCount)
        .map(([query, data]) => ({
          query,
          count: data.count,
          avgResults: Math.round(data.totalResults / data.count),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Popular filters
      const filterCount: Record<string, number> = {};
      filteredData.forEach(item => {
        if (item.filters) {
          try {
            const filters = JSON.parse(item.filters);
            Object.keys(filters).forEach(filter => {
              filterCount[filter] = (filterCount[filter] || 0) + 1;
            });
          } catch (error) {
            // Ignore invalid JSON
          }
        }
      });
      
      const popularFilters = Object.entries(filterCount)
        .map(([filter, count]) => ({ filter, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Search performance by day
      const dailyPerformance: Record<string, { searches: number; totalResponseTime: number }> = {};
      filteredData.forEach(item => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        if (!dailyPerformance[date]) {
          dailyPerformance[date] = { searches: 0, totalResponseTime: 0 };
        }
        dailyPerformance[date].searches++;
        dailyPerformance[date].totalResponseTime += item.responseTime;
      });
      
      const searchPerformance = Object.entries(dailyPerformance)
        .map(([date, data]) => ({
          date,
          searches: data.searches,
          avgResponseTime: Math.round(data.totalResponseTime / data.searches),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      const analytics: SearchAnalytics = {
        totalSearches,
        searchesToday,
        searchesThisWeek,
        averageResultsPerSearch: Math.round(averageResultsPerSearch),
        topQueries,
        popularFilters,
        searchPerformance,
      };
      
      // Cache results
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      logger.error('Failed to get search analytics', { error, tenantId });
      throw new Error('Failed to get search analytics');
    }
  }

  /**
   * Build conversation filters
   */
  private buildConversationFilters(filters: SearchFilters): any {
    const where: any = {};
    
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }
    
    if (filters.status?.length) {
      where.status = { in: filters.status };
    }
    
    if (filters.priority?.length) {
      where.priority = { in: filters.priority };
    }
    
    if (filters.agentIds?.length) {
      where.agentId = { in: filters.agentIds };
    }
    
    if (filters.customerIds?.length) {
      where.customerId = { in: filters.customerIds };
    }
    
    if (filters.channels?.length) {
      where.channelId = { in: filters.channels };
    }
    
    if (filters.isAssigned !== undefined) {
      where.agentId = filters.isAssigned ? { not: null } : null;
    }
    
    if (filters.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }
    
    return where;
  }

  /**
   * Build message filters
   */
  private buildMessageFilters(filters: SearchFilters): any {
    const where: any = {};
    
    if (filters.dateFrom || filters.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) where.timestamp.gte = filters.dateFrom;
      if (filters.dateTo) where.timestamp.lte = filters.dateTo;
    }
    
    if (filters.messageTypes?.length) {
      where.type = { in: filters.messageTypes };
    }
    
    if (filters.hasAttachments !== undefined) {
      where.attachments = filters.hasAttachments 
        ? { some: {} }
        : { none: {} };
    }
    
    return where;
  }

  /**
   * Build sort clause
   */
  private buildSortClause(sort: SortOptions): any {
    return {
      [sort.field]: sort.direction,
    };
  }

  /**
   * Generate search snippet
   */
  private generateSnippet(content: string, query?: string): string {
    if (!content) return '';
    
    const maxLength = 150;
    
    if (!query) {
      return content.length > maxLength 
        ? content.substring(0, maxLength) + '...'
        : content;
    }
    
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(queryLower);
    
    if (index === -1) {
      return content.length > maxLength 
        ? content.substring(0, maxLength) + '...'
        : content;
    }
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, start + maxLength);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Calculate relevance score for conversations
   */
  private calculateRelevanceScore(conversation: any, query?: string): number {
    if (!query) return 1;
    
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Check customer name
    if (conversation.customer?.name?.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    
    // Check tags
    if (conversation.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))) {
      score += 5;
    }
    
    // Check recent messages
    if (conversation.messages?.some((msg: any) => 
      msg.content?.toLowerCase().includes(queryLower)
    )) {
      score += 3;
    }
    
    return score;
  }

  /**
   * Calculate relevance score for messages
   */
  private calculateMessageRelevanceScore(message: any, query?: string): number {
    if (!query) return 1;
    
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = message.content?.toLowerCase() || '';
    
    // Exact match
    if (contentLower === queryLower) {
      score += 20;
    }
    // Contains query
    else if (contentLower.includes(queryLower)) {
      score += 10;
    }
    
    return score;
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(
    tenantId: string,
    query: string,
    type: string = 'all'
  ): Promise<string[]> {
    try {
      const suggestions: Set<string> = new Set();
      const queryLower = query.toLowerCase();
      
      if (type === 'all' || type === 'conversations') {
        // Get customer names from conversations
        const conversations = await prisma.conversation.findMany({
          where: {
            tenantId,
            OR: [
              { customerName: { contains: query, mode: 'insensitive' } },
              { customerEmail: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: { customerName: true, customerEmail: true },
          take: 5,
        });
        
        conversations.forEach(conv => {
          if (conv.customerName?.toLowerCase().includes(queryLower)) {
            suggestions.add(conv.customerName);
          }
          if (conv.customerEmail?.toLowerCase().includes(queryLower)) {
            suggestions.add(conv.customerEmail);
          }
        });
        
        // Get tags
        const taggedConversations = await prisma.conversation.findMany({
          where: {
            tenantId,
            tags: { hasSome: [query] },
          },
          select: { tags: true },
          take: 10,
        });
        
        taggedConversations.forEach(conv => {
          conv.tags.forEach((tag: string) => {
            if (tag.toLowerCase().includes(queryLower)) {
              suggestions.add(tag);
            }
          });
        });
      }
      
      if (type === 'all' || type === 'messages') {
        // Get common phrases from messages
        const messages = await prisma.message.findMany({
          where: {
            conversation: { tenantId },
            content: { contains: query, mode: 'insensitive' },
          },
          select: { content: true },
          take: 10,
        });
        
        messages.forEach(msg => {
          const words = msg.content.split(' ');
          for (let i = 0; i < words.length - 1; i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            if (phrase.toLowerCase().includes(queryLower) && phrase.length > query.length) {
              suggestions.add(phrase);
            }
          }
        });
      }
      
      return Array.from(suggestions).slice(0, 10);
    } catch (error) {
      logger.error('Failed to get search suggestions', { error, tenantId, query });
      return [];
    }
  }

  /**
   * Save a search query
   */
  async saveSearch(params: {
    tenantId: string;
    userId: string;
    name: string;
    description?: string;
    searchQuery: any;
    type: string;
    isPublic: boolean;
  }): Promise<any> {
    try {
      const savedSearch = await prisma.savedSearch.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          name: params.name,
          description: params.description,
          searchQuery: JSON.stringify(params.searchQuery),
          type: params.type,
          isPublic: params.isPublic,
        },
      });
      
      return {
        ...savedSearch,
        searchQuery: JSON.parse(savedSearch.searchQuery),
      };
    } catch (error) {
      logger.error('Failed to save search', { error, params });
      throw new Error('Failed to save search');
    }
  }

  /**
   * Get saved search queries
   */
  async getSavedSearches(params: {
    tenantId: string;
    userId: string;
    type?: string;
    includePublic: boolean;
  }): Promise<any[]> {
    try {
      const where: any = {
        tenantId: params.tenantId,
        OR: [
          { userId: params.userId },
        ],
      };
      
      if (params.includePublic) {
        where.OR.push({ isPublic: true });
      }
      
      if (params.type) {
        where.type = params.type;
      }
      
      const savedSearches = await prisma.savedSearch.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      return savedSearches.map(search => ({
        ...search,
        searchQuery: JSON.parse(search.searchQuery),
      }));
    } catch (error) {
      logger.error('Failed to get saved searches', { error, params });
      throw new Error('Failed to get saved searches');
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(params: {
    id: string;
    tenantId: string;
    userId: string;
  }): Promise<void> {
    try {
      const savedSearch = await prisma.savedSearch.findFirst({
        where: {
          id: params.id,
          tenantId: params.tenantId,
          userId: params.userId,
        },
      });
      
      if (!savedSearch) {
        throw new Error('Saved search not found');
      }
      
      await prisma.savedSearch.delete({
        where: { id: params.id },
      });
    } catch (error) {
      logger.error('Failed to delete saved search', { error, params });
      throw new Error('Failed to delete saved search');
    }
  }

  /**
   * Get search facets for filtering
   */
  async getSearchFacets(tenantId: string, type: string): Promise<any> {
    try {
      const facets: any = {};
      
      if (type === 'conversations') {
        // Get status facets
        const statusCounts = await prisma.conversation.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { status: true },
        });
        
        facets.status = statusCounts.map(item => ({
          value: item.status,
          count: item._count.status,
        }));
        
        // Get channel facets
        const channelCounts = await prisma.conversation.groupBy({
          by: ['channelId'],
          where: { tenantId },
          _count: true,
        });
        
        facets.channels = channelCounts.map(item => ({
          value: item.channelId,
          count: item._count,
        }));
        
        // Get agent facets
        const agentCounts = await prisma.conversation.groupBy({
          by: ['agentId'],
          where: { 
            tenantId,
            agentId: { not: null },
          },
          _count: { agentId: true },
          _max: { agentId: true },
        });
        
        const agentIds = agentCounts.map(item => item.agentId).filter((id): id is string => id !== null);
        const agents = await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, firstName: true, lastName: true },
        });
        
        facets.agents = agentCounts.map(item => {
          const agent = agents.find(a => a.id === item.agentId);
          const agentName = agent ? `${agent.firstName} ${agent.lastName}`.trim() : 'Unknown Agent';
          return {
            value: item.agentId,
            count: item._count.agentId,
            label: agentName,
          };
        });
      }
      
      return facets;
    } catch (error) {
      logger.error('Failed to get search facets', { error, tenantId, type });
      throw new Error('Failed to get search facets');
    }
  }

  /**
   * Get conversation facets
   */
  private async getConversationFacets(
    tenantId: string,
    filters: SearchFilters
  ): Promise<SearchFacets> {
    try {
      const baseWhere = {
        tenantId,
        ...this.buildConversationFilters(filters),
      };
      
      const [statusCounts, channelCounts, agentCounts] = await Promise.all([
        prisma.conversation.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: { status: true },
        }),
        prisma.conversation.groupBy({
          by: ['channelId'],
          where: baseWhere,
          _count: true,
        }),
        prisma.conversation.groupBy({
          by: ['agentId'],
          where: {
            ...baseWhere,
            agentId: { not: null },
          },
          _count: { agentId: true },
        }),
      ]);
      
      return {
        status: statusCounts.map(item => ({
          value: item.status,
          count: item._count.status,
        })),
        channels: channelCounts.map(item => ({
          value: item.channelId,
          count: item._count,
        })),
        agents: agentCounts.map(item => ({
          value: item.agentId!,
          count: item._count.agentId,
          label: 'Agent', // Would need to fetch agent names
        })),
      };
    } catch (error) {
      logger.error('Failed to get conversation facets', { error, tenantId });
      return {};
    }
  }

  /**
   * Track search analytics
   */
  private async trackSearchAnalytics(
    tenantId: string,
    type: string,
    query?: string,
    filters?: SearchFilters,
    results?: number,
    responseTime?: number
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const searchKey = `search:${tenantId}:${timestamp}:${Math.random()}`;
      
      await redis.hmset(searchKey, {
        tenantId,
        type,
        query: query || '',
        filters: JSON.stringify(filters || {}),
        results: results || 0,
        responseTime: responseTime || 0,
        timestamp,
      });
      
      // Set expiration for search analytics data
      await redis.expire(searchKey, this.SEARCH_ANALYTICS_TTL);
    } catch (error) {
      logger.error('Failed to track search analytics', { error, tenantId, type });
      // Don't throw error as this is not critical
    }
  }
}

export default new SearchService();
export { SearchService };