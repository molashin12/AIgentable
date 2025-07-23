import React, { useState, useEffect } from 'react'
import { EyeIcon, ChatBubbleLeftRightIcon, UserIcon, CpuChipIcon, ClockIcon, SignalIcon } from '@heroicons/react/24/outline'
import { useSocket } from '../contexts/SocketContext'
import { useConversations, Conversation, Message } from '../hooks/useConversations'
import { toast } from 'sonner'

interface ConversationActivity {
  conversationId: string
  conversation?: Conversation
  lastMessage?: Message
  lastActivity: string
  isActive: boolean
  participantCount: number
  unreadCount: number
}

interface LiveConversationMonitorProps {
  className?: string
  onConversationSelect?: (conversationId: string) => void
  maxConversations?: number
}

export const LiveConversationMonitor: React.FC<LiveConversationMonitorProps> = ({
  className = '',
  onConversationSelect,
  maxConversations = 10
}) => {
  const { socket, isConnected } = useSocket()
  const { conversations, fetchConversations } = useConversations()
  const [activeConversations, setActiveConversations] = useState<ConversationActivity[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations({ status: 'ACTIVE', limit: maxConversations })
  }, [fetchConversations, maxConversations])

  // Initialize active conversations from fetched data
  useEffect(() => {
    const activities: ConversationActivity[] = conversations.map(conv => ({
      conversationId: conv.id,
      conversation: conv,
      lastActivity: conv.updatedAt || conv.createdAt,
      isActive: conv.status === 'ACTIVE',
      participantCount: 1, // Default, will be updated by socket events
      unreadCount: 0
    }))
    
    setActiveConversations(activities)
  }, [conversations])

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleNewMessage = (data: { conversationId: string; message: Message }) => {
      setActiveConversations(prev => {
        const updated = prev.map(activity => {
          if (activity.conversationId === data.conversationId) {
            return {
              ...activity,
              lastMessage: data.message,
              lastActivity: data.message.timestamp,
              unreadCount: activity.conversationId === selectedConversation ? 0 : activity.unreadCount + 1
            }
          }
          return activity
        })
        
        // Sort by last activity
        return updated.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      })
    }

    const handleConversationUpdate = (data: { conversationId: string; update: any }) => {
      setActiveConversations(prev => 
        prev.map(activity => {
          if (activity.conversationId === data.conversationId) {
            return {
              ...activity,
              conversation: { ...activity.conversation, ...data.update } as Conversation,
              lastActivity: new Date().toISOString(),
              isActive: data.update.status === 'ACTIVE'
            }
          }
          return activity
        })
      )
    }

    const handleUserJoined = (data: { conversationId: string; userId: string }) => {
      setActiveConversations(prev => 
        prev.map(activity => {
          if (activity.conversationId === data.conversationId) {
            return {
              ...activity,
              participantCount: activity.participantCount + 1,
              lastActivity: new Date().toISOString()
            }
          }
          return activity
        })
      )
    }

    const handleUserLeft = (data: { conversationId: string; userId: string }) => {
      setActiveConversations(prev => 
        prev.map(activity => {
          if (activity.conversationId === data.conversationId) {
            return {
              ...activity,
              participantCount: Math.max(0, activity.participantCount - 1),
              lastActivity: new Date().toISOString()
            }
          }
          return activity
        })
      )
    }

    const handleConversationClosed = (data: { conversationId: string }) => {
      setActiveConversations(prev => 
        prev.map(activity => {
          if (activity.conversationId === data.conversationId) {
            return {
              ...activity,
              isActive: false,
              lastActivity: new Date().toISOString()
            }
          }
          return activity
        })
      )
    }

    // Subscribe to events
    socket.on('new_message', handleNewMessage)
    socket.on('conversation_update', handleConversationUpdate)
    socket.on('user_joined_conversation', handleUserJoined)
    socket.on('user_left_conversation', handleUserLeft)
    socket.on('conversation_closed', handleConversationClosed)

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('conversation_update', handleConversationUpdate)
      socket.off('user_joined_conversation', handleUserJoined)
      socket.off('user_left_conversation', handleUserLeft)
      socket.off('conversation_closed', handleConversationClosed)
    }
  }, [socket, isConnected, selectedConversation])

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversation(conversationId)
    
    // Clear unread count
    setActiveConversations(prev => 
      prev.map(activity => 
        activity.conversationId === conversationId 
          ? { ...activity, unreadCount: 0 }
          : activity
      )
    )
    
    onConversationSelect?.(conversationId)
  }

  const formatLastActivity = (timestamp: string) => {
    const now = new Date()
    const activity = new Date(timestamp)
    const diffMs = now.getTime() - activity.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getMessagePreview = (message?: Message) => {
    if (!message) return 'No messages yet'
    
    const preview = message.content.length > 50 
      ? `${message.content.substring(0, 50)}...` 
      : message.content
    
    return message.role === 'user' ? `User: ${preview}` : `AI: ${preview}`
  }

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <EyeIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Conversations
          </h3>
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
            isConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            <SignalIcon className="h-3 w-3" />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {activeConversations.filter(c => c.isActive).length} active
        </div>
      </div>

      {/* Conversations List */}
      <div className="max-h-96 overflow-y-auto">
        {activeConversations.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No active conversations
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {activeConversations.map((activity) => (
              <div
                key={activity.conversationId}
                onClick={() => handleConversationClick(activity.conversationId)}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  selectedConversation === activity.conversationId
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {activity.conversation?.title || `Conversation ${activity.conversationId.slice(-6)}`}
                      </h4>
                      
                      <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs ${
                        activity.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          activity.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span>{activity.isActive ? 'Active' : 'Closed'}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-2">
                      {getMessagePreview(activity.lastMessage)}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-3 w-3" />
                        <span>{activity.participantCount}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-3 w-3" />
                        <span>{formatLastActivity(activity.lastActivity)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {activity.unreadCount > 0 && (
                    <div className="flex items-center justify-center w-5 h-5 bg-blue-500 text-white text-xs rounded-full ml-2">
                      {activity.unreadCount > 9 ? '9+' : activity.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}