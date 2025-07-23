export interface Channel {
  id: string
  name: string
  type: 'WHATSAPP' | 'FACEBOOK' | 'TELEGRAM' | 'WEBSITE' | 'EMAIL' | 'SMS'
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR'
  isActive: boolean
  icon: string
  description: string
  conversations: number
  lastActivity: string
  createdAt: string
  updatedAt: string
  config: {
    phoneNumber?: string
    apiKey?: string
    pageId?: string
    botToken?: string
    webhookUrl?: string
  }
}

export interface ChannelStats {
  totalChannels: number
  connectedChannels: number
  totalConversations: number
  activeAgents: number
}

export interface WidgetConfig {
  theme: 'light' | 'dark'
  position: string
  primaryColor: string
  greetingMessage: string
}