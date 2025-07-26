import { useState } from 'react'
import {
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  BoltIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'
  secret: string
  headers: Record<string, string>
  retryPolicy: {
    maxRetries: number
    backoffMultiplier: number
    initialDelay: number
  }
  timeout: number
  description: string
  stats: {
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    lastDelivery: string | null
    averageResponseTime: number
  }
  createdAt: string
  updatedAt: string
}

interface WebhookEvent {
  id: string
  name: string
  description: string
  category: string
  payload: Record<string, any>
}

interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRYING'
  responseCode: number | null
  responseTime: number | null
  attempts: number
  nextRetry: string | null
  payload: Record<string, any>
  response: string | null
  error: string | null
  timestamp: string
}

const mockWebhooks: Webhook[] = [
  {
    id: 'webhook_1',
    name: 'Customer Support Integration',
    url: 'https://api.mycompany.com/webhooks/aigentable',
    events: ['conversation.started', 'conversation.ended', 'agent.escalated'],
    status: 'ACTIVE',
    secret: 'whsec_1234567890abcdef1234567890abcdef12345678',
    headers: {
      'Authorization': 'Bearer token123',
      'X-Custom-Header': 'custom-value'
    },
    retryPolicy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    timeout: 30000,
    description: 'Sends conversation events to our customer support system',
    stats: {
      totalDeliveries: 1250,
      successfulDeliveries: 1198,
      failedDeliveries: 52,
      lastDelivery: '2024-01-20T16:30:00Z',
      averageResponseTime: 245
    },
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-20T16:30:00Z'
  },
  {
    id: 'webhook_2',
    name: 'Analytics Dashboard',
    url: 'https://analytics.mycompany.com/webhooks/events',
    events: ['agent.trained', 'document.processed', 'analytics.generated'],
    status: 'ACTIVE',
    secret: 'whsec_abcdef1234567890abcdef1234567890abcdef12',
    headers: {
      'X-API-Key': 'analytics-key-456'
    },
    retryPolicy: {
      maxRetries: 5,
      backoffMultiplier: 1.5,
      initialDelay: 500
    },
    timeout: 15000,
    description: 'Sends analytics and training events to our dashboard',
    stats: {
      totalDeliveries: 890,
      successfulDeliveries: 885,
      failedDeliveries: 5,
      lastDelivery: '2024-01-20T15:45:00Z',
      averageResponseTime: 120
    },
    createdAt: '2024-01-05T14:00:00Z',
    updatedAt: '2024-01-20T15:45:00Z'
  },
  {
    id: 'webhook_3',
    name: 'Slack Notifications',
    url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
    events: ['agent.error', 'system.alert'],
    status: 'ERROR',
    secret: 'whsec_fedcba0987654321fedcba0987654321fedcba09',
    headers: {},
    retryPolicy: {
      maxRetries: 2,
      backoffMultiplier: 2,
      initialDelay: 2000
    },
    timeout: 10000,
    description: 'Sends error alerts and system notifications to Slack',
    stats: {
      totalDeliveries: 45,
      successfulDeliveries: 32,
      failedDeliveries: 13,
      lastDelivery: '2024-01-19T09:15:00Z',
      averageResponseTime: 890
    },
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-19T09:15:00Z'
  }
]

const availableEvents: WebhookEvent[] = [
  {
    id: 'conversation.started',
    name: 'Conversation Started',
    description: 'Triggered when a new conversation begins',
    category: 'Conversations',
    payload: {
      conversationId: 'string',
      userId: 'string',
      agentId: 'string',
      channel: 'string',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'conversation.ended',
    name: 'Conversation Ended',
    description: 'Triggered when a conversation is completed',
    category: 'Conversations',
    payload: {
      conversationId: 'string',
      userId: 'string',
      agentId: 'string',
      duration: 'number',
      resolution: 'string',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'agent.escalated',
    name: 'Agent Escalated',
    description: 'Triggered when an agent escalates to human support',
    category: 'Agents',
    payload: {
      conversationId: 'string',
      agentId: 'string',
      reason: 'string',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'agent.trained',
    name: 'Agent Trained',
    description: 'Triggered when an agent completes training',
    category: 'Agents',
    payload: {
      agentId: 'string',
      trainingId: 'string',
      documentsProcessed: 'number',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'document.processed',
    name: 'Document Processed',
    description: 'Triggered when a document is successfully processed',
    category: 'Documents',
    payload: {
      documentId: 'string',
      filename: 'string',
      size: 'number',
      processingTime: 'number',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'analytics.generated',
    name: 'Analytics Generated',
    description: 'Triggered when analytics reports are generated',
    category: 'Analytics',
    payload: {
      reportId: 'string',
      type: 'string',
      period: 'string',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'agent.error',
    name: 'Agent Error',
    description: 'Triggered when an agent encounters an error',
    category: 'System',
    payload: {
      agentId: 'string',
      error: 'string',
      severity: 'string',
      timestamp: 'ISO 8601'
    }
  },
  {
    id: 'system.alert',
    name: 'System Alert',
    description: 'Triggered for system-wide alerts and notifications',
    category: 'System',
    payload: {
      alertType: 'string',
      message: 'string',
      severity: 'string',
      timestamp: 'ISO 8601'
    }
  }
]

const mockDeliveries: WebhookDelivery[] = [
  {
    id: 'delivery_1',
    webhookId: 'webhook_1',
    event: 'conversation.started',
    status: 'SUCCESS',
    responseCode: 200,
    responseTime: 245,
    attempts: 1,
    nextRetry: null,
    payload: {
      conversationId: 'conv_123',
      userId: 'user_456',
      agentId: 'agent_789',
      channel: 'web',
      timestamp: '2024-01-20T16:30:00Z'
    },
    response: '{"status": "received", "id": "evt_abc123"}',
    error: null,
    timestamp: '2024-01-20T16:30:00Z'
  },
  {
    id: 'delivery_2',
    webhookId: 'webhook_3',
    event: 'agent.error',
    status: 'FAILED',
    responseCode: 500,
    responseTime: 5000,
    attempts: 3,
    nextRetry: null,
    payload: {
      agentId: 'agent_789',
      error: 'Connection timeout',
      severity: 'high',
      timestamp: '2024-01-19T09:15:00Z'
    },
    response: null,
    error: 'Internal Server Error',
    timestamp: '2024-01-19T09:15:00Z'
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'INACTIVE':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'ERROR':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getDeliveryStatusColor = (status: string) => {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'RETRYING':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const generateSecret = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomPart = Array.from({ length: 32 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  return 'whsec_' + randomPart
}

export default function WebhookConfiguration() {
  const { } = useLanguage()
  const [webhooks, setWebhooks] = useState<Webhook[]>(mockWebhooks)
  const [deliveries] = useState<WebhookDelivery[]>(mockDeliveries)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null)
  const [activeTab, setActiveTab] = useState<'webhooks' | 'events' | 'deliveries'>('webhooks')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    description: '',
    headers: {} as Record<string, string>,
    retryPolicy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    timeout: 30000
  })

  const [newHeader, setNewHeader] = useState({ key: '', value: '' })
  const [testEvent, setTestEvent] = useState({
    event: '',
    payload: '{}'
  })

  const filteredWebhooks = webhooks.filter(webhook => {
    if (filterStatus !== 'all' && webhook.status !== filterStatus) return false
    if (searchTerm && !webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !webhook.url.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const handleCreateWebhook = () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast.error('Please provide name, URL, and at least one event')
      return
    }

    const webhook: Webhook = {
      id: `webhook_${Date.now()}`,
      name: newWebhook.name,
      url: newWebhook.url,
      events: [...newWebhook.events],
      status: 'ACTIVE',
      secret: generateSecret(),
      headers: { ...newWebhook.headers },
      retryPolicy: { ...newWebhook.retryPolicy },
      timeout: newWebhook.timeout,
      description: newWebhook.description,
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        lastDelivery: null,
        averageResponseTime: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setWebhooks(prev => [...prev, webhook])
    setNewWebhook({
      name: '',
      url: '',
      events: [],
      description: '',
      headers: {},
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, initialDelay: 1000 },
      timeout: 30000
    })
    setShowCreateModal(false)
    toast.success('Webhook created successfully')
  }

  const handleUpdateWebhook = () => {
    if (!selectedWebhook) return

    setWebhooks(prev => prev.map(webhook => 
      webhook.id === selectedWebhook.id 
        ? { ...webhook, ...newWebhook, updatedAt: new Date().toISOString() }
        : webhook
    ))
    setShowEditModal(false)
    setSelectedWebhook(null)
    toast.success('Webhook updated successfully')
  }

  const handleDeleteWebhook = (webhookId: string) => {
    setWebhooks(prev => prev.filter(webhook => webhook.id !== webhookId))
    toast.success('Webhook deleted')
  }

  const handleToggleStatus = (webhookId: string) => {
    setWebhooks(prev => prev.map(webhook => 
      webhook.id === webhookId 
        ? { 
            ...webhook, 
            status: webhook.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
            updatedAt: new Date().toISOString()
          }
        : webhook
    ))
    toast.success('Webhook status updated')
  }

  const handleTestWebhook = () => {
    if (!selectedWebhook || !testEvent.event) {
      toast.error('Please select an event to test')
      return
    }

    try {
      JSON.parse(testEvent.payload)
    } catch (error) {
      toast.error('Invalid JSON payload')
      return
    }

    // Simulate webhook test
    toast.success('Test webhook sent successfully')
    setShowTestModal(false)
    setTestEvent({ event: '', payload: '{}' })
  }

  const handleAddHeader = () => {
    if (!newHeader.key || !newHeader.value) {
      toast.error('Please provide both header key and value')
      return
    }

    setNewWebhook(prev => ({
      ...prev,
      headers: {
        ...prev.headers,
        [newHeader.key]: newHeader.value
      }
    }))
    setNewHeader({ key: '', value: '' })
  }

  const handleRemoveHeader = (key: string) => {
    setNewWebhook(prev => {
      const { [key]: removed, ...rest } = prev.headers
      return { ...prev, headers: rest }
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleEditWebhook = (webhook: Webhook) => {
    setSelectedWebhook(webhook)
    setNewWebhook({
      name: webhook.name,
      url: webhook.url,
      events: [...webhook.events],
      description: webhook.description,
      headers: { ...webhook.headers },
      retryPolicy: { ...webhook.retryPolicy },
      timeout: webhook.timeout
    })
    setShowEditModal(true)
  }

  const handleViewDeliveries = (webhook: Webhook) => {
    setSelectedWebhook(webhook)
    setShowDeliveriesModal(true)
  }

  const handleTestWebhookModal = (webhook: Webhook) => {
    setSelectedWebhook(webhook)
    setTestEvent({ event: webhook.events[0] || '', payload: '{}' })
    setShowTestModal(true)
  }

  const webhookDeliveries = deliveries.filter(d => d.webhookId === selectedWebhook?.id)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Webhook Configuration</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Setup and manage webhook endpoints for real-time event notifications
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'webhooks'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <GlobeAltIcon className="w-5 h-5 inline mr-2" />
            Webhooks
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'events'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <BoltIcon className="w-5 h-5 inline mr-2" />
            Available Events
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'deliveries'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <ChartBarIcon className="w-5 h-5 inline mr-2" />
            Delivery Logs
          </button>
        </nav>
      </div>

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <>
          {/* Filters and Actions */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Search webhooks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="all">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ERROR">Error</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Create Webhook
                </button>
              </div>
            </div>
          </div>

          {/* Webhooks List */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredWebhooks.map((webhook) => (
                <li key={webhook.id}>
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <GlobeAltIcon className="h-10 w-10 text-gray-400" />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{webhook.name}</h3>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`}>
                              {webhook.status}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{webhook.url}</code>
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {webhook.events.length} events • {webhook.description}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="text-right text-sm">
                          <div className="text-gray-900 dark:text-white font-medium">
                            {webhook.stats.successfulDeliveries}/{webhook.stats.totalDeliveries} success
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {webhook.stats.averageResponseTime}ms avg
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleViewDeliveries(webhook)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="View Deliveries"
                          >
                            <ChartBarIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleTestWebhookModal(webhook)}
                            className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                            title="Test Webhook"
                          >
                            <PlayIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleEditWebhook(webhook)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(webhook.id)}
                            className={`p-2 ${webhook.status === 'ACTIVE' ? 'text-yellow-400 hover:text-yellow-600' : 'text-green-400 hover:text-green-600'} dark:hover:text-yellow-300`}
                            title={webhook.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          >
                            {webhook.status === 'ACTIVE' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Available Events Tab */}
      {activeTab === 'events' && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Available Webhook Events</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Events that can be configured to trigger webhook deliveries
            </p>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(
              availableEvents.reduce((acc, event) => {
                if (!acc[event.category]) acc[event.category] = []
                acc[event.category].push(event)
                return acc
              }, {} as Record<string, WebhookEvent[]>)
            ).map(([category, events]) => (
              <div key={category} className="p-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">{category}</h4>
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white">{event.name}</h5>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{event.description}</p>
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                              {event.id}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(event.payload, null, 2))}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Copy Payload Schema"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <details className="group">
                          <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                            View Payload Schema
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-x-auto">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Logs Tab */}
      {activeTab === 'deliveries' && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Webhook Deliveries</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Log of recent webhook delivery attempts and their status
            </p>
          </div>
          
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {deliveries.map((delivery) => {
              const webhook = webhooks.find(w => w.id === delivery.webhookId)
              return (
                <li key={delivery.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {delivery.status === 'SUCCESS' ? (
                          <CheckCircleIcon className="h-8 w-8 text-green-400" />
                        ) : delivery.status === 'FAILED' ? (
                          <XCircleIcon className="h-8 w-8 text-red-400" />
                        ) : delivery.status === 'RETRYING' ? (
                          <ArrowPathIcon className="h-8 w-8 text-blue-400" />
                        ) : (
                          <ClockIcon className="h-8 w-8 text-yellow-400" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{webhook?.name || 'Unknown Webhook'}</h4>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeliveryStatusColor(delivery.status)}`}>
                            {delivery.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Event: <span className="font-mono">{delivery.event}</span>
                          {delivery.responseCode && (
                            <span className="ml-2">• HTTP {delivery.responseCode}</span>
                          )}
                          {delivery.responseTime && (
                            <span className="ml-2">• {delivery.responseTime}ms</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {new Date(delivery.timestamp).toLocaleString()}
                          {delivery.attempts > 1 && (
                            <span className="ml-2">• {delivery.attempts} attempts</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {delivery.error && (
                        <div className="text-right text-sm">
                          <div className="text-red-600 dark:text-red-400 font-medium">Error</div>
                          <div className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {delivery.error}
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(delivery.payload, null, 2))}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Copy Payload"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Create/Edit Webhook Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {showCreateModal ? 'Create New Webhook' : 'Edit Webhook'}
              </h3>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Webhook Name *</label>
                    <input
                      type="text"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook({...newWebhook, name: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="Customer Support Integration"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Endpoint URL *</label>
                    <input
                      type="url"
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook({...newWebhook, url: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="https://api.mycompany.com/webhooks/aigentable"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                      value={newWebhook.description}
                      onChange={(e) => setNewWebhook({...newWebhook, description: e.target.value})}
                      rows={3}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="Describe what this webhook is used for..."
                    />
                  </div>
                </div>
                
                {/* Events */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Events to Subscribe *</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-3">
                    {availableEvents.map((event) => (
                      <div key={event.id} className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={newWebhook.events.includes(event.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewWebhook({...newWebhook, events: [...newWebhook.events, event.id]})
                              } else {
                                setNewWebhook({...newWebhook, events: newWebhook.events.filter(e => e !== event.id)})
                              }
                            }}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label className="font-medium text-gray-700 dark:text-gray-300">{event.name}</label>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Headers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom Headers</label>
                  <div className="space-y-2">
                    {Object.entries(newWebhook.headers).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={key}
                          readOnly
                          className="block w-1/3 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                        <input
                          type="text"
                          value={value}
                          readOnly
                          className="block w-2/3 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          onClick={() => handleRemoveHeader(key)}
                          className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newHeader.key}
                        onChange={(e) => setNewHeader({...newHeader, key: e.target.value})}
                        placeholder="Header name"
                        className="block w-1/3 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      />
                      <input
                        type="text"
                        value={newHeader.value}
                        onChange={(e) => setNewHeader({...newHeader, value: e.target.value})}
                        placeholder="Header value"
                        className="block w-2/3 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      />
                      <button
                        onClick={handleAddHeader}
                        className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Timeout (ms)</label>
                    <input
                      type="number"
                      value={newWebhook.timeout}
                      onChange={(e) => setNewWebhook({...newWebhook, timeout: parseInt(e.target.value) || 30000})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Retries</label>
                    <input
                      type="number"
                      value={newWebhook.retryPolicy.maxRetries}
                      onChange={(e) => setNewWebhook({
                        ...newWebhook,
                        retryPolicy: { ...newWebhook.retryPolicy, maxRetries: parseInt(e.target.value) || 0 }
                      })}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    setSelectedWebhook(null)
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={showCreateModal ? handleCreateWebhook : handleUpdateWebhook}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  {showCreateModal ? 'Create Webhook' : 'Update Webhook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Webhook Modal */}
      {showTestModal && selectedWebhook && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Test Webhook: {selectedWebhook.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Type</label>
                  <select
                    value={testEvent.event}
                    onChange={(e) => setTestEvent({...testEvent, event: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select an event</option>
                    {selectedWebhook.events.map((event) => (
                      <option key={event} value={event}>{event}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Payload (JSON)</label>
                  <textarea
                    value={testEvent.payload}
                    onChange={(e) => setTestEvent({...testEvent, payload: e.target.value})}
                    rows={8}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white font-mono"
                    placeholder='{"key": "value"}'
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTestWebhook}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Send Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Modal */}
      {showDeliveriesModal && selectedWebhook && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Deliveries: {selectedWebhook.name}</h3>
                <button
                  onClick={() => setShowDeliveriesModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {webhookDeliveries.length > 0 ? (
                  webhookDeliveries.map((delivery) => (
                    <div key={delivery.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {delivery.status === 'SUCCESS' ? (
                              <CheckCircleIcon className="h-6 w-6 text-green-400" />
                            ) : delivery.status === 'FAILED' ? (
                              <XCircleIcon className="h-6 w-6 text-red-400" />
                            ) : (
                              <ClockIcon className="h-6 w-6 text-yellow-400" />
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{delivery.event}</span>
                              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDeliveryStatusColor(delivery.status)}`}>
                                {delivery.status}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(delivery.timestamp).toLocaleString()}
                              {delivery.responseCode && <span className="ml-2">• HTTP {delivery.responseCode}</span>}
                              {delivery.responseTime && <span className="ml-2">• {delivery.responseTime}ms</span>}
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(delivery, null, 2))}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Copy Details"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {delivery.error && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                          <strong>Error:</strong> {delivery.error}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No deliveries found for this webhook
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}