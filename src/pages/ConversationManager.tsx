import { useState } from 'react'
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

interface Conversation {
  id: string
  customerName: string
  customerAvatar?: string
  channel: 'whatsapp' | 'website' | 'facebook' | 'telegram'
  agent: string
  status: 'active' | 'resolved' | 'escalated' | 'waiting'
  lastMessage: string
  lastMessageTime: string
  messageCount: number
  isHuman: boolean
  priority: 'low' | 'medium' | 'high'
}

interface Message {
  id: string
  sender: 'customer' | 'agent' | 'human'
  content: string
  timestamp: string
  type: 'text' | 'image' | 'file'
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    customerName: 'Sarah Johnson',
    channel: 'whatsapp',
    agent: 'Sales Assistant',
    status: 'active',
    lastMessage: 'Can you tell me more about your premium plan?',
    lastMessageTime: '2024-01-15T10:30:00Z',
    messageCount: 8,
    isHuman: false,
    priority: 'medium',
  },
  {
    id: '2',
    customerName: 'Mike Chen',
    channel: 'website',
    agent: 'Support Bot',
    status: 'escalated',
    lastMessage: 'I need to speak with a human agent',
    lastMessageTime: '2024-01-15T10:25:00Z',
    messageCount: 12,
    isHuman: true,
    priority: 'high',
  },
  {
    id: '3',
    customerName: 'Emma Davis',
    channel: 'facebook',
    agent: 'Lead Qualifier',
    status: 'resolved',
    lastMessage: 'Thank you for your help!',
    lastMessageTime: '2024-01-15T09:45:00Z',
    messageCount: 6,
    isHuman: false,
    priority: 'low',
  },
]

const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'customer',
    content: 'Hi, I\'m interested in your AI agent platform',
    timestamp: '2024-01-15T10:20:00Z',
    type: 'text',
  },
  {
    id: '2',
    sender: 'agent',
    content: 'Hello! I\'d be happy to help you learn about our AI agent platform. What specific features are you most interested in?',
    timestamp: '2024-01-15T10:20:30Z',
    type: 'text',
  },
  {
    id: '3',
    sender: 'customer',
    content: 'I want to know about pricing and integration options',
    timestamp: '2024-01-15T10:22:00Z',
    type: 'text',
  },
  {
    id: '4',
    sender: 'agent',
    content: 'Great! We offer flexible pricing plans starting from $29/month. Our platform integrates with WhatsApp, Facebook Messenger, Telegram, and website widgets. Would you like me to show you our pricing details?',
    timestamp: '2024-01-15T10:22:45Z',
    type: 'text',
  },
  {
    id: '5',
    sender: 'customer',
    content: 'Can you tell me more about your premium plan?',
    timestamp: '2024-01-15T10:30:00Z',
    type: 'text',
  },
]

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
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(conversations[0])
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return

    const message: Message = {
      id: Date.now().toString(),
      sender: 'human',
      content: newMessage,
      timestamp: new Date().toISOString(),
      type: 'text',
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')

    // Update conversation
    setConversations(prev => prev.map(conv => 
      conv.id === selectedConversation.id
        ? {
            ...conv,
            lastMessage: newMessage,
            lastMessageTime: new Date().toISOString(),
            messageCount: conv.messageCount + 1,
            isHuman: true,
          }
        : conv
    ))
  }

  const handleEscalate = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId
        ? { ...conv, status: 'escalated' as const, isHuman: true }
        : conv
    ))
  }

  const handleResolve = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId
        ? { ...conv, status: 'resolved' as const }
        : conv
    ))
  }

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter
    const matchesChannel = channelFilter === 'all' || conv.channel === channelFilter
    
    return matchesSearch && matchesStatus && matchesChannel
  })

  const activeConversations = conversations.filter(c => c.status === 'active').length
  const escalatedConversations = conversations.filter(c => c.status === 'escalated').length
  const resolvedToday = conversations.filter(c => c.status === 'resolved').length

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
                  <dd className="text-2xl font-semibold text-gray-900">{resolvedToday}</dd>
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
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="waiting">Waiting</option>
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
                  onClick={() => setSelectedConversation(conversation)}
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
                        <div className="text-sm font-medium text-gray-900">{conversation.customerName}</div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <span className="mr-1">{getChannelIcon(conversation.channel)}</span>
                          {conversation.channel}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(conversation.status)}`}>
                        {conversation.status}
                      </span>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(conversation.priority)}`}>
                        {conversation.priority}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500">
                      {conversation.isHuman ? (
                        <UserIcon className="h-3 w-3 mr-1" />
                      ) : (
                        <CpuChipIcon className="h-3 w-3 mr-1" />
                      )}
                      {conversation.agent}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(conversation.lastMessageTime), 'HH:mm')}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-2 truncate">{conversation.lastMessage}</p>
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
                        <div className="text-sm font-medium text-gray-900">{selectedConversation.customerName}</div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <span className="mr-1">{getChannelIcon(selectedConversation.channel)}</span>
                          {selectedConversation.channel} • {selectedConversation.messageCount} messages
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {selectedConversation.status !== 'escalated' && (
                        <button
                          onClick={() => handleEscalate(selectedConversation.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                        >
                          <HandRaisedIcon className="-ml-1 mr-1 h-3 w-3" />
                          Escalate
                        </button>
                      )}
                      {selectedConversation.status !== 'resolved' && (
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
                        message.sender === 'customer' ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender === 'customer'
                            ? 'bg-gray-100 text-gray-900'
                            : message.sender === 'agent'
                            ? 'bg-blue-500 text-white'
                            : 'bg-green-500 text-white'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs opacity-75">
                            {format(new Date(message.timestamp), 'HH:mm')}
                          </span>
                          {message.sender !== 'customer' && (
                            <span className="text-xs opacity-75 ml-2">
                              {message.sender === 'agent' ? '🤖' : '👤'}
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