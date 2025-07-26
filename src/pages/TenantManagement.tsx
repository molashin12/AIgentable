import { useState, useEffect } from 'react'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  CreditCardIcon,
  KeyIcon,
  GlobeAltIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface Tenant {
  id: string
  name: string
  domain: string
  subdomain: string
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CANCELLED'
  plan: 'STARTER' | 'PRO' | 'ENTERPRISE'
  createdAt: string
  lastActivity: string
  owner: {
    id: string
    name: string
    email: string
  }
  settings: {
    customBranding: boolean
    ssoEnabled: boolean
    apiAccess: boolean
    webhooksEnabled: boolean
    maxUsers: number
    maxAgents: number
    storageLimit: number // in GB
  }
  usage: {
    users: number
    agents: number
    conversations: number
    storage: number // in GB
    apiCalls: number
  }
  billing: {
    amount: number
    currency: string
    interval: 'month' | 'year'
    nextBilling: string
    paymentStatus: 'PAID' | 'PENDING' | 'FAILED'
  }
}

interface TenantStats {
  total: number
  active: number
  suspended: number
  pending: number
  cancelled: number
  revenue: {
    monthly: number
    yearly: number
  }
}

const mockTenants: Tenant[] = [
  {
    id: 'tenant_1',
    name: 'Acme Corporation',
    domain: 'acme.com',
    subdomain: 'acme',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    createdAt: '2024-01-15T10:00:00Z',
    lastActivity: '2024-01-20T14:30:00Z',
    owner: {
      id: 'user_1',
      name: 'John Smith',
      email: 'john@acme.com'
    },
    settings: {
      customBranding: true,
      ssoEnabled: true,
      apiAccess: true,
      webhooksEnabled: true,
      maxUsers: 100,
      maxAgents: 50,
      storageLimit: 100
    },
    usage: {
      users: 45,
      agents: 12,
      conversations: 15420,
      storage: 23.5,
      apiCalls: 125000
    },
    billing: {
      amount: 299,
      currency: 'USD',
      interval: 'month',
      nextBilling: '2024-02-15T10:00:00Z',
      paymentStatus: 'PAID'
    }
  },
  {
    id: 'tenant_2',
    name: 'TechStart Inc',
    domain: 'techstart.io',
    subdomain: 'techstart',
    status: 'ACTIVE',
    plan: 'PRO',
    createdAt: '2024-01-10T09:00:00Z',
    lastActivity: '2024-01-20T16:45:00Z',
    owner: {
      id: 'user_2',
      name: 'Sarah Johnson',
      email: 'sarah@techstart.io'
    },
    settings: {
      customBranding: true,
      ssoEnabled: false,
      apiAccess: true,
      webhooksEnabled: true,
      maxUsers: 25,
      maxAgents: 10,
      storageLimit: 50
    },
    usage: {
      users: 18,
      agents: 7,
      conversations: 8950,
      storage: 12.3,
      apiCalls: 45000
    },
    billing: {
      amount: 99,
      currency: 'USD',
      interval: 'month',
      nextBilling: '2024-02-10T09:00:00Z',
      paymentStatus: 'PAID'
    }
  },
  {
    id: 'tenant_3',
    name: 'Small Business Co',
    domain: 'smallbiz.com',
    subdomain: 'smallbiz',
    status: 'SUSPENDED',
    plan: 'STARTER',
    createdAt: '2024-01-05T11:00:00Z',
    lastActivity: '2024-01-18T10:20:00Z',
    owner: {
      id: 'user_3',
      name: 'Mike Wilson',
      email: 'mike@smallbiz.com'
    },
    settings: {
      customBranding: false,
      ssoEnabled: false,
      apiAccess: false,
      webhooksEnabled: false,
      maxUsers: 5,
      maxAgents: 3,
      storageLimit: 10
    },
    usage: {
      users: 3,
      agents: 2,
      conversations: 1250,
      storage: 2.1,
      apiCalls: 5000
    },
    billing: {
      amount: 29,
      currency: 'USD',
      interval: 'month',
      nextBilling: '2024-02-05T11:00:00Z',
      paymentStatus: 'FAILED'
    }
  }
]

const mockStats: TenantStats = {
  total: 3,
  active: 2,
  suspended: 1,
  pending: 0,
  cancelled: 0,
  revenue: {
    monthly: 427,
    yearly: 5124
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
    case 'PAID':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'SUSPENDED':
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getPlanColor = (plan: string) => {
  switch (plan) {
    case 'STARTER':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'PRO':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'ENTERPRISE':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const formatUsagePercentage = (used: number, limit: number) => {
  if (limit === 0) return 0
  return Math.round((used / limit) * 100)
}

export default function TenantManagement() {
  const { t } = useLanguage()
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants)
  const [stats] = useState<TenantStats>(mockStats)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [showTenantModal, setShowTenantModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'lastActivity' | 'usage'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  const [newTenant, setNewTenant] = useState({
    name: '',
    domain: '',
    subdomain: '',
    plan: 'STARTER' as 'STARTER' | 'PRO' | 'ENTERPRISE',
    ownerName: '',
    ownerEmail: ''
  })

  const filteredTenants = tenants
    .filter(tenant => {
      if (filterStatus !== 'all' && tenant.status !== filterStatus) return false
      if (filterPlan !== 'all' && tenant.plan !== filterPlan) return false
      if (searchTerm && !tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !tenant.domain.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !tenant.owner.email.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'lastActivity':
          aValue = new Date(a.lastActivity).getTime()
          bValue = new Date(b.lastActivity).getTime()
          break
        case 'usage':
          aValue = a.usage.users + a.usage.agents + a.usage.conversations
          bValue = b.usage.users + b.usage.agents + b.usage.conversations
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const handleCreateTenant = () => {
    if (!newTenant.name || !newTenant.domain || !newTenant.subdomain || !newTenant.ownerEmail) {
      toast.error('Please fill in all required fields')
      return
    }

    const tenant: Tenant = {
      id: `tenant_${Date.now()}`,
      name: newTenant.name,
      domain: newTenant.domain,
      subdomain: newTenant.subdomain,
      status: 'PENDING',
      plan: newTenant.plan,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      owner: {
        id: `user_${Date.now()}`,
        name: newTenant.ownerName || newTenant.ownerEmail.split('@')[0],
        email: newTenant.ownerEmail
      },
      settings: {
        customBranding: newTenant.plan !== 'STARTER',
        ssoEnabled: newTenant.plan === 'ENTERPRISE',
        apiAccess: newTenant.plan !== 'STARTER',
        webhooksEnabled: newTenant.plan !== 'STARTER',
        maxUsers: newTenant.plan === 'STARTER' ? 5 : newTenant.plan === 'PRO' ? 25 : 100,
        maxAgents: newTenant.plan === 'STARTER' ? 3 : newTenant.plan === 'PRO' ? 10 : 50,
        storageLimit: newTenant.plan === 'STARTER' ? 10 : newTenant.plan === 'PRO' ? 50 : 100
      },
      usage: {
        users: 1,
        agents: 0,
        conversations: 0,
        storage: 0,
        apiCalls: 0
      },
      billing: {
        amount: newTenant.plan === 'STARTER' ? 29 : newTenant.plan === 'PRO' ? 99 : 299,
        currency: 'USD',
        interval: 'month',
        nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paymentStatus: 'PENDING'
      }
    }

    setTenants(prev => [...prev, tenant])
    setNewTenant({ name: '', domain: '', subdomain: '', plan: 'STARTER', ownerName: '', ownerEmail: '' })
    setShowTenantModal(false)
    toast.success('Tenant created successfully')
  }

  const handleUpdateTenantStatus = (tenantId: string, status: Tenant['status']) => {
    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status } : t))
    toast.success(`Tenant status updated to ${status.toLowerCase()}`)
  }

  const handleDeleteTenant = (tenantId: string) => {
    setTenants(prev => prev.filter(t => t.id !== tenantId))
    toast.success('Tenant deleted successfully')
  }

  const handleViewTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setShowDetailsModal(true)
  }

  const handleImpersonateTenant = (tenant: Tenant) => {
    // In a real app, this would switch the admin to the tenant's context
    toast.success(`Impersonating ${tenant.name}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage multi-tenant organizations and their configurations
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BuildingOfficeIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Tenants</dt>
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
                <XCircleIcon className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Suspended</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.suspended}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CreditCardIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Monthly Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">${stats.revenue.monthly}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Yearly Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">${stats.revenue.yearly}</dd>
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
                  placeholder="Search tenants..."
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
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              
              <div>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Plans</option>
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              
              <div>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-')
                    setSortBy(field as any)
                    setSortOrder(order as any)
                  }}
                  className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="lastActivity-desc">Recently Active</option>
                  <option value="usage-desc">Highest Usage</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={() => setShowTenantModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Create Tenant
            </button>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredTenants.map((tenant) => (
            <li key={tenant.id}>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BuildingOfficeIcon className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{tenant.name}</h3>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tenant.status)}`}>
                          {tenant.status}
                        </span>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanColor(tenant.plan)}`}>
                          {tenant.plan}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <GlobeAltIcon className="h-4 w-4 mr-1" />
                        <span>{tenant.domain}</span>
                        <span className="mx-2">•</span>
                        <span>{tenant.subdomain}.aigentable.com</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Owner: {tenant.owner.name} ({tenant.owner.email})
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-right text-sm">
                      <div className="text-gray-900 dark:text-white font-medium">
                        ${tenant.billing.amount}/{tenant.billing.interval}
                      </div>
                      <div className={`text-xs ${getStatusColor(tenant.billing.paymentStatus)}`}>
                        {tenant.billing.paymentStatus}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleViewTenant(tenant)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => handleImpersonateTenant(tenant)}
                        className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                        title="Impersonate"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </button>
                      
                      {tenant.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleUpdateTenantStatus(tenant.id, 'SUSPENDED')}
                          className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                          title="Suspend"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateTenantStatus(tenant.id, 'ACTIVE')}
                          className="p-2 text-green-400 hover:text-green-600 dark:hover:text-green-300"
                          title="Activate"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteTenant(tenant.id)}
                        className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Usage Stats */}
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {tenant.usage.users}/{tenant.settings.maxUsers}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Users</div>
                    <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${formatUsagePercentage(tenant.usage.users, tenant.settings.maxUsers)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {tenant.usage.agents}/{tenant.settings.maxAgents}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Agents</div>
                    <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${formatUsagePercentage(tenant.usage.agents, tenant.settings.maxAgents)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {tenant.usage.storage.toFixed(1)}/{tenant.settings.storageLimit} GB
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Storage</div>
                    <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${formatUsagePercentage(tenant.usage.storage, tenant.settings.storageLimit)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {tenant.usage.conversations.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Conversations</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Last active: {new Date(tenant.lastActivity).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Create Tenant Modal */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Tenant</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization Name *</label>
                    <input
                      type="text"
                      value={newTenant.name}
                      onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="Acme Corporation"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain *</label>
                    <input
                      type="text"
                      value={newTenant.domain}
                      onChange={(e) => setNewTenant({...newTenant, domain: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="acme.com"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subdomain *</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input
                        type="text"
                        value={newTenant.subdomain}
                        onChange={(e) => setNewTenant({...newTenant, subdomain: e.target.value})}
                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        placeholder="acme"
                      />
                      <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 sm:text-sm">
                        .aigentable.com
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Plan *</label>
                    <select
                      value={newTenant.plan}
                      onChange={(e) => setNewTenant({...newTenant, plan: e.target.value as any})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="STARTER">Starter - $29/month</option>
                      <option value="PRO">Pro - $99/month</option>
                      <option value="ENTERPRISE">Enterprise - $299/month</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner Name</label>
                    <input
                      type="text"
                      value={newTenant.ownerName}
                      onChange={(e) => setNewTenant({...newTenant, ownerName: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="John Smith"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner Email *</label>
                    <input
                      type="email"
                      value={newTenant.ownerEmail}
                      onChange={(e) => setNewTenant({...newTenant, ownerEmail: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="john@acme.com"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTenant}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Tenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Details Modal */}
      {showDetailsModal && selectedTenant && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{selectedTenant.name} Details</h3>
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
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTenant.status)}`}>
                        {selectedTenant.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPlanColor(selectedTenant.plan)}`}>
                        {selectedTenant.plan}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Domain:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedTenant.domain}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Subdomain:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedTenant.subdomain}.aigentable.com</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{new Date(selectedTenant.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Last Activity:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{new Date(selectedTenant.lastActivity).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                {/* Settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Settings & Features</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {Object.entries(selectedTenant.settings).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-gray-500 dark:text-gray-400">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Usage */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Current Usage</h4>
                  <div className="space-y-3">
                    {Object.entries(selectedTenant.usage).map(([key, value]) => {
                      const limit = selectedTenant.settings[`max${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof selectedTenant.settings] as number
                      const percentage = limit ? formatUsagePercentage(value as number, limit) : 0
                      
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {typeof value === 'number' && key === 'storage' ? `${value.toFixed(1)} GB` : value.toLocaleString()}
                              {limit && ` / ${limit}`}
                            </span>
                          </div>
                          {limit && (
                            <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* Billing */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Billing Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        ${selectedTenant.billing.amount}/{selectedTenant.billing.interval}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Payment Status:</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTenant.billing.paymentStatus)}`}>
                        {selectedTenant.billing.paymentStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Next Billing:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {new Date(selectedTenant.billing.nextBilling).toLocaleDateString()}
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