export interface Conversation {
  id: string
  userId: string
  agentId: string
  channelId: string
  status: 'active' | 'resolved' | 'escalated' | 'waiting'
  priority: 'low' | 'medium' | 'high'
  metadata: {
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    tags?: string[]
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
  lastMessageAt?: string
  messageCount: number
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderType: 'user' | 'agent' | 'system'
  content: string
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video'
  metadata: {
    fileName?: string
    fileSize?: number
    mimeType?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

export interface ConversationWithDetails extends Conversation {
  agent?: {
    id: string
    name: string
    category: string
  }
  channel?: {
    id: string
    name: string
    type: string
  }
  lastMessage?: Message
  messages?: Message[]
}

export interface ConversationFilters {
  status?: string
  agentId?: string
  channelId?: string
  priority?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface ConversationStats {
  total: number
  active: number
  resolved: number
  escalated: number
  waiting: number
  avgResponseTime: number
  avgResolutionTime: number
}