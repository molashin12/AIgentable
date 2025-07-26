import { useState, useEffect } from 'react'
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface APIKey {
  id: string
  name: string
  key: string
  prefix: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  permissions: string[]
  rateLimit: {
    requests: number
    period: 'minute' | 'hour' | 'day'
  }
  restrictions: {
    ipWhitelist: string[]
    domains: string[]
    environments: string[]
  }
  usage: {
    totalRequests: number
    lastUsed: string | null
    requestsToday: number
    requestsThisMonth: number
  }
  createdAt: string
  expiresAt: string | null
  lastRotated: string | null
}

interface APIKeyStats {
  total: number
  active: number
  revoked: number
  expired: number
  totalRequests: number
  requestsToday: number
}

const mockAPIKeys: APIKey[] = [
  {
    id: 'key_1',
    name: 'Production API',
    key: 'ak_live_1234567890abcdef1234567890abcdef12345678',
    prefix: 'ak_live_',
    status: 'ACTIVE',
    permissions: ['agents:read', 'agents:write', 'conversations:read', 'conversations:write', 'analytics:read'],
    rateLimit: {
      requests: 1000,
      period: 'hour'
    },
    restrictions: {
      ipWhitelist: ['192.168.1.100', '10.0.0.50'],
      domains: ['api.mycompany.com', 'app.mycompany.com'],
      environments: ['production']
    },
    usage: {
      totalRequests: 45230,
      lastUsed: '2024-01-20T14:30:00Z',
      requestsToday: 1250,
      requestsThisMonth: 28500
    },
    createdAt: '2024-01-01T10:00:00Z',
    expiresAt: '2024-12-31T23:59:59Z',
    lastRotated: '2024-01-15T09:00:00Z'
  },
  {
    id: 'key_2',
    name: 'Development API',
    key: 'ak_test_abcdef1234567890abcdef1234567890abcdef12',
    prefix: 'ak_test_',
    status: 'ACTIVE',
    permissions: ['agents:read', 'conversations:read', 'analytics:read'],
    rateLimit: {
      requests: 100,
      period: 'hour'
    },
    restrictions: {
      ipWhitelist: [],
      domains: ['localhost:3000', 'dev.mycompany.com'],
      environments: ['development', 'staging']
    },
    usage: {
      totalRequests: 2340,
      lastUsed: '2024-01-20T16:45:00Z',
      requestsToday: 45,
      requestsThisMonth: 890
    },
    createdAt: '2024-01-10T14:00:00Z',
    expiresAt: null,
    lastRotated: null
  },
  {
    id: 'key_3',
    name: 'Analytics Dashboard',
    key: 'ak_live_fedcba0987654321fedcba0987654321fedcba09',
    prefix: 'ak_live_',
    status: 'REVOKED',
    permissions: ['analytics:read'],
    rateLimit: {
      requests: 500,
      period: 'hour'
    },
    restrictions: {
      ipWhitelist: ['203.0.113.10'],
      domains: ['dashboard.mycompany.com'],
      environments: ['production']
    },
    usage: {
      totalRequests: 12500,
      lastUsed: '2024-01-18T10:20:00Z',
      requestsToday: 0,
      requestsThisMonth: 5200
    },
    createdAt: '2023-12-01T09:00:00Z',
    expiresAt: null,
    lastRotated: null
  }
]

const mockStats: APIKeyStats = {
  total: 3,
  active: 2,
  revoked: 1,
  expired: 0,
  totalRequests: 60070,
  requestsToday: 1295
}

const availablePermissions = [
  { id: 'agents:read', label: 'Read Agents', description: 'View agent configurations and details' },
  { id: 'agents:write', label: 'Write Agents', description: 'Create, update, and delete agents' },
  { id: 'conversations:read', label: 'Read Conversations', description: 'View conversation history and messages' },
  { id: 'conversations:write', label: 'Write Conversations', description: 'Send messages and update conversations' },
  { id: 'analytics:read', label: 'Read Analytics', description: 'Access analytics and reporting data' },
  { id: 'documents:read', label: 'Read Documents', description: 'View uploaded documents and training data' },
  { id: 'documents:write', label: 'Write Documents', description: 'Upload and manage documents' },
  { id: 'webhooks:read', label: 'Read Webhooks', description: 'View webhook configurations' },
  { id: 'webhooks:write', label: 'Write Webhooks', description: 'Create and manage webhooks' },
  { id: 'admin:read', label: 'Admin Read', description: 'View administrative data' },
  { id: 'admin:write', label: 'Admin Write', description: 'Perform administrative actions' }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'REVOKED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'EXPIRED':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const generateAPIKey = (environment: 'production' | 'development') => {
  const prefix = environment === 'production' ? 'ak_live_' : 'ak_test_'
  const randomPart = Array.from({ length: 32 }, () => 
    Math.random().toString(36).charAt(2)
  ).join('')
  return prefix + randomPart
}

const maskAPIKey = (key: string) => {
  const prefix = key.split('_').slice(0, 2).join('_') + '_'
  const suffix = key.slice(-8)
  return prefix + '•'.repeat(16) + suffix
}

export default function APIKeyManagement() {
  const { t } = useLanguage()
  const [apiKeys, setApiKeys] = useState<APIKey[]>(mockAPIKeys)
  const [stats] = useState<APIKeyStats>(mockStats)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [newKey, setNewKey] = useState({
    name: '',
    environment: 'development' as 'production' | 'development',
    permissions: [] as string[],
    rateLimit: {
      requests: 100,
      period: 'hour' as 'minute' | 'hour' | 'day'
    },
    restrictions: {
      ipWhitelist: [] as string[],
      domains: [] as string[],
      environments: ['development'] as string[]
    },
    expiresAt: ''
  })

  const filteredKeys = apiKeys.filter(key => {
    if (filterStatus !== 'all' && key.status !== filterStatus) return false
    if (searchTerm && !key.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !key.key.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const handleCreateKey = () => {
    if (!newKey.name || newKey.permissions.length === 0) {
      toast.error('Please provide a name and at least one permission')
      return
    }

    const apiKey: APIKey = {
      id: `key_${Date.now()}`,
      name: newKey.name,
      key: generateAPIKey(newKey.environment),
      prefix: newKey.environment === 'production' ? 'ak_live_' : 'ak_test_',
      status: 'ACTIVE',
      permissions: [...newKey.permissions],
      rateLimit: { ...newKey.rateLimit },
      restrictions: {
        ipWhitelist: newKey.restrictions.ipWhitelist.filter(ip => ip.trim()),
        domains: newKey.restrictions.domains.filter(domain => domain.trim()),
        environments: [...newKey.restrictions.environments]
      },
      usage: {
        totalRequests: 0,
        lastUsed: null,
        requestsToday: 0,
        requestsThisMonth: 0
      },
      createdAt: new Date().toISOString(),
      expiresAt: newKey.expiresAt || null,
      lastRotated: null
    }

    setApiKeys(prev => [...prev, apiKey])
    setNewKey({
      name: '',
      environment: 'development',
      permissions: [],
      rateLimit: { requests: 100, period: 'hour' },
      restrictions: { ipWhitelist: [], domains: [], environments: ['development'] },
      expiresAt: ''
    })
    setShowCreateModal(false)
    toast.success('API key created successfully')
  }

  const handleRevokeKey = (keyId: string) => {
    setApiKeys(prev => prev.map(key => 
      key.id === keyId ? { ...key, status: 'REVOKED' as const } : key
    ))
    toast.success('API key revoked')
  }

  const handleRotateKey = (keyId: string) => {
    const key = apiKeys.find(k => k.id === keyId)
    if (!key) return

    const newKeyValue = generateAPIKey(key.prefix.includes('live') ? 'production' : 'development')
    setApiKeys(prev => prev.map(k => 
      k.id === keyId ? { 
        ...k, 
        key: newKeyValue,
        lastRotated: new Date().toISOString()
      } : k
    ))
    toast.success('API key rotated successfully')
  }

  const handleDeleteKey = (keyId: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== keyId))
    toast.success('API key deleted')
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleViewDetails = (key: APIKey) => {
    setSelectedKey(key)
    setShowDetailsModal(true)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Key Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Generate, manage, and monitor API keys for secure access to your platform
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <KeyIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Keys</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.active}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Revoked</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.revoked}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Expired</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.expired}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Requests Today</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.requestsToday.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Requests</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.totalRequests.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <div>
                <input
                  type="text"
                  placeholder="Search API keys..."
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
                  <option value="REVOKED">Revoked</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Create API Key
            </button>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredKeys.map((apiKey) => (
            <li key={apiKey.id}>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <KeyIcon className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{apiKey.name}</h3>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(apiKey.status)}`}>
                          {apiKey.status}
                        </span>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          apiKey.prefix.includes('live') 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        }`}>
                          {apiKey.prefix.includes('live') ? 'Production' : 'Development'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : maskAPIKey(apiKey.key)}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {visibleKeys.has(apiKey.id) ? (
                            <EyeSlashIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="ml-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {apiKey.permissions.length} permissions • {apiKey.rateLimit.requests}/{apiKey.rateLimit.period} rate limit
                        {apiKey.usage.lastUsed && (
                          <span className="ml-2">
                            • Last used {new Date(apiKey.usage.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-right text-sm">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {apiKey.usage.requestsToday.toLocaleString()} today
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {apiKey.usage.totalRequests.toLocaleString()} total
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleViewDetails(apiKey)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      
                      {apiKey.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => handleRotateKey(apiKey.id)}
                            className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                            title="Rotate Key"
                          >
                            <Cog6ToothIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleRevokeKey(apiKey.id)}
                            className="p-2 text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300"
                            title="Revoke"
                          >
                            <ExclamationTriangleIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDeleteKey(apiKey.id)}
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

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New API Key</h3>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Key Name *</label>
                    <input
                      type="text"
                      value={newKey.name}
                      onChange={(e) => setNewKey({...newKey, name: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="Production API Key"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Environment *</label>
                    <select
                      value={newKey.environment}
                      onChange={(e) => setNewKey({...newKey, environment: e.target.value as any})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="development">Development</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </div>
                
                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permissions *</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {availablePermissions.map((permission) => (
                      <div key={permission.id} className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={newKey.permissions.includes(permission.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKey({...newKey, permissions: [...newKey.permissions, permission.id]})
                              } else {
                                setNewKey({...newKey, permissions: newKey.permissions.filter(p => p !== permission.id)})
                              }
                            }}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label className="font-medium text-gray-700 dark:text-gray-300">{permission.label}</label>
                          <p className="text-gray-500 dark:text-gray-400">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Rate Limiting */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Rate Limiting</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Requests</label>
                      <input
                        type="number"
                        value={newKey.rateLimit.requests}
                        onChange={(e) => setNewKey({
                          ...newKey,
                          rateLimit: { ...newKey.rateLimit, requests: parseInt(e.target.value) || 0 }
                        })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Period</label>
                      <select
                        value={newKey.rateLimit.period}
                        onChange={(e) => setNewKey({
                          ...newKey,
                          rateLimit: { ...newKey.rateLimit, period: e.target.value as any }
                        })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      >
                        <option value="minute">Per Minute</option>
                        <option value="hour">Per Hour</option>
                        <option value="day">Per Day</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Restrictions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Access Restrictions</label>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">IP Whitelist (comma-separated)</label>
                      <input
                        type="text"
                        value={newKey.restrictions.ipWhitelist.join(', ')}
                        onChange={(e) => setNewKey({
                          ...newKey,
                          restrictions: {
                            ...newKey.restrictions,
                            ipWhitelist: e.target.value.split(',').map(ip => ip.trim()).filter(Boolean)
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        placeholder="192.168.1.100, 10.0.0.50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Allowed Domains (comma-separated)</label>
                      <input
                        type="text"
                        value={newKey.restrictions.domains.join(', ')}
                        onChange={(e) => setNewKey({
                          ...newKey,
                          restrictions: {
                            ...newKey.restrictions,
                            domains: e.target.value.split(',').map(domain => domain.trim()).filter(Boolean)
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        placeholder="api.mycompany.com, app.mycompany.com"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiration Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={newKey.expiresAt}
                    onChange={(e) => setNewKey({...newKey, expiresAt: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Details Modal */}
      {showDetailsModal && selectedKey && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{selectedKey.name} Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Status:</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedKey.status)}`}>
                        {selectedKey.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Environment:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {selectedKey.prefix.includes('live') ? 'Production' : 'Development'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{new Date(selectedKey.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Expires:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {selectedKey.expiresAt ? new Date(selectedKey.expiresAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Permissions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Permissions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedKey.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Usage Stats */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Usage Statistics</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Total Requests:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedKey.usage.totalRequests.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Requests Today:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedKey.usage.requestsToday.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Requests This Month:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedKey.usage.requestsThisMonth.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Last Used:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {selectedKey.usage.lastUsed ? new Date(selectedKey.usage.lastUsed).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Rate Limiting */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Rate Limiting</h4>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Limit:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {selectedKey.rateLimit.requests} requests per {selectedKey.rateLimit.period}
                    </span>
                  </div>
                </div>
                
                {/* Restrictions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Access Restrictions</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">IP Whitelist:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {selectedKey.restrictions.ipWhitelist.length > 0 ? selectedKey.restrictions.ipWhitelist.join(', ') : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Allowed Domains:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {selectedKey.restrictions.domains.length > 0 ? selectedKey.restrictions.domains.join(', ') : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Environments:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {selectedKey.restrictions.environments.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}