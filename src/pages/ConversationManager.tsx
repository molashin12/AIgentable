import { useState, useEffect } from 'react'
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon,
  CpuChipIcon,
  HandRaisedIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { useConversations } from '../hooks/useConversations'
import { ConversationFilters, ConversationStats } from '../types/conversation'
import { Conversation, Message } from '../hooks/useConversations'



const getChannelIcon = (channel: string) => {
  const icons = {
    whatsapp: '📱',
    website: '🌐',
    facebook: '💬',
    telegram: '✈️',
  }
  return icons[channel as keyof typeof icons] || '💬'
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'resolved':
      return 'bg-blue-100 text-blue-800'
    case 'escalated':
      return 'bg-red-100 text-red-800'
    case 'waiting':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function ConversationManager() {
  const {
    conversations,
    loading,
    error,
    fetchConversations,
    getConversation,
    sendMessage,
    updateConversationStatus,
    searchConversations
  } = useConversations()
  
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  
  useEffect(() => {
    fetchConversations()
  }, [])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    try {
      await sendMessage(selectedConversation.id, newMessage)
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleEscalate = async (conversationId: string) => {
    try {
      await updateConversationStatus(conversationId, 'PENDING')
    } catch (error) {
      console.error('Failed to escalate conversation:', error)
    }
  }

  const handleResolve = async (conversationId: string) => {
    try {
      await updateConversationStatus(conversationId, 'CLOSED')
      // Refresh the conversation if it's currently selected
      if (selectedConversation?.id === conversationId) {
        const conversationData = await getConversation(conversationId)
        setSelectedConversation(conversationData.conversation)
        setMessages(conversationData.messages)
      }
    } catch (error) {
      console.error('Failed to resolve conversation:', error)
    }
  }
  
  const handleSelectConversation = async (conversation: any) => {
    try {
      const conversationData = await getConversation(conversation.id)
      setSelectedConversation(conversationData.conversation)
      setMessages(conversationData.messages)
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const filteredConversations = conversations?.filter(conv => {
    const matchesSearch = searchTerm === '' || 
      conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lastMessage?.content?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || conv.status.toLowerCase() === statusFilter
    const matchesChannel = channelFilter === 'all' || conv.channelId === channelFilter
    
    return matchesSearch && matchesStatus && matchesChannel
  }) || []

  const activeConversations = conversations?.filter(c => c.status === 'ACTIVE').length || 0
  const escalatedConversations = conversations?.filter(c => c.status === 'PENDING').length || 0
  const resolvedConversations = conversations?.filter(c => c.status === 'CLOSED').length || 0
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading conversations...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            <h3 className="text-lg font-medium">Error loading conversations</h3>
            <p className="mt-2">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Conversation Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor live conversations, manage agent handovers, and track customer interactions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Conversations</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{activeConversations}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <HandRaisedIcon className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Escalated</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{escalatedConversations}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Resolved Today</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{resolvedConversations}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="flex h-96">
          {/* Conversations List */}
          <div className="w-1/3 border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex space-x-2 mb-4">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-500 border border-gray-300 rounded-md">
                  <FunnelIcon className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex space-x-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
                
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Channels</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Website</option>
                  <option value="facebook">Facebook</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-y-auto h-80">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <UserIcon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {conversation.title || 'Unknown Customer'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <span className="mr-1">{getChannelIcon('website')}</span>
                          Channel {conversation.channelId}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(conversation.status)}`}>
                        {conversation.status}
                      </span>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor('normal')}`}>
                        Normal
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500">
                      <CpuChipIcon className="h-3 w-3 mr-1" />
                      {conversation.agentId || 'AI Agent'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {conversation.lastMessage?.timestamp ? format(new Date(conversation.lastMessage.timestamp), 'HH:mm') : ''}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-2 truncate">
                    {conversation.lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <UserIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {selectedConversation.title || 'Unknown Customer'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <span className="mr-1">{getChannelIcon('website')}</span>
                          Channel {selectedConversation.channelId} • {selectedConversation.messageCount} messages
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {selectedConversation.status !== 'PENDING' && (
                        <button
                          onClick={() => handleEscalate(selectedConversation.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                        >
                          <HandRaisedIcon className="-ml-1 mr-1 h-3 w-3" />
                          Escalate
                        </button>
                      )}
                      {selectedConversation.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleResolve(selectedConversation.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircleIcon className="-ml-1 mr-1 h-3 w-3" />
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs opacity-75">
                            {format(new Date(message.timestamp), 'HH:mm')}
                          </span>
                          {message.role !== 'user' && (
                            <span className="text-xs opacity-75 ml-2">
                              🤖
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No conversation selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Select a conversation from the list to start monitoring.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}