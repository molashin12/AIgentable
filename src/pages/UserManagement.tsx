import { useState } from 'react'
import {
  UserIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  KeyIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'PLATFORM_ADMIN' | 'BUSINESS_OWNER' | 'TEAM_MEMBER' | 'END_CUSTOMER'
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  tenantId: string
  createdAt: string
  lastLoginAt?: string
  permissions: string[]
}

interface Permission {
  id: string
  name: string
  description: string
  category: string
}

const mockUsers: User[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    role: 'BUSINESS_OWNER',
    status: 'ACTIVE',
    tenantId: 'tenant-1',
    createdAt: '2024-01-15T10:00:00Z',
    lastLoginAt: '2024-01-20T14:30:00Z',
    permissions: ['users.read', 'users.write', 'agents.read', 'agents.write']
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@company.com',
    role: 'TEAM_MEMBER',
    status: 'ACTIVE',
    tenantId: 'tenant-1',
    createdAt: '2024-01-16T09:00:00Z',
    lastLoginAt: '2024-01-19T16:45:00Z',
    permissions: ['agents.read', 'conversations.read']
  },
  {
    id: '3',
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob.wilson@company.com',
    role: 'END_CUSTOMER',
    status: 'PENDING',
    tenantId: 'tenant-1',
    createdAt: '2024-01-18T11:00:00Z',
    permissions: ['analytics.read']
  }
]

const mockPermissions: Permission[] = [
  { id: 'users.read', name: 'View Users', description: 'Can view user list and details', category: 'User Management' },
  { id: 'users.write', name: 'Manage Users', description: 'Can create, edit, and delete users', category: 'User Management' },
  { id: 'agents.read', name: 'View Agents', description: 'Can view AI agents', category: 'Agent Management' },
  { id: 'agents.write', name: 'Manage Agents', description: 'Can create, edit, and delete agents', category: 'Agent Management' },
  { id: 'conversations.read', name: 'View Conversations', description: 'Can view conversations', category: 'Conversations' },
  { id: 'conversations.write', name: 'Manage Conversations', description: 'Can manage conversations', category: 'Conversations' },
  { id: 'analytics.read', name: 'View Analytics', description: 'Can view analytics and reports', category: 'Analytics' },
  { id: 'billing.read', name: 'View Billing', description: 'Can view billing information', category: 'Billing' },
  { id: 'billing.write', name: 'Manage Billing', description: 'Can manage billing and subscriptions', category: 'Billing' }
]

const getRoleColor = (role: string) => {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'BUSINESS_OWNER':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'TEAM_MEMBER':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'END_CUSTOMER':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'INACTIVE':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return <CheckCircleIcon className="h-4 w-4" />
    case 'INACTIVE':
      return <XCircleIcon className="h-4 w-4" />
    case 'PENDING':
      return <ClockIcon className="h-4 w-4" />
    default:
      return <ClockIcon className="h-4 w-4" />
  }
}

export default function UserManagement() {
  const { } = useLanguage()
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [permissions] = useState<Permission[]>(mockPermissions)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'TEAM_MEMBER' as 'PLATFORM_ADMIN' | 'BUSINESS_OWNER' | 'TEAM_MEMBER' | 'END_CUSTOMER',
    permissions: [] as string[]
  })

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter
    const matchesStatus = statusFilter === 'ALL' || user.status === statusFilter
    
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleCreateUser = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) {
      toast.error('Please fill in all required fields')
      return
    }

    const user: User = {
      id: Date.now().toString(),
      ...newUser,
      status: 'PENDING',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      permissions: newUser.permissions
    }

    setUsers(prev => [...prev, user])
    setNewUser({ firstName: '', lastName: '', email: '', role: 'TEAM_MEMBER', permissions: [] })
    setShowCreateModal(false)
    toast.success('User created successfully')
  }

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId))
    toast.success('User deleted successfully')
  }

  const handleUpdateUserStatus = (userId: string, status: User['status']) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u))
    toast.success(`User status updated to ${status.toLowerCase()}`)
  }

  const handleUpdateUserPermissions = (userId: string, permissions: string[]) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions } : u))
    toast.success('User permissions updated')
  }

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = []
    }
    acc[permission.category].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.status === 'ACTIVE').length
  const pendingUsers = users.filter(u => u.status === 'PENDING').length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage users, roles, and permissions for your organization
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Users</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{totalUsers}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Users</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{activeUsers}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Pending Users</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{pendingUsers}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="ALL">All Roles</option>
                <option value="PLATFORM_ADMIN">Platform Admin</option>
                <option value="BUSINESS_OWNER">Business Owner</option>
                <option value="TEAM_MEMBER">Team Member</option>
                <option value="END_CUSTOMER">End Customer</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredUsers.map((user) => (
            <li key={user.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.firstName} {user.lastName}
                      </div>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {getStatusIcon(user.status)}
                        <span className="ml-1">{user.status}</span>
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                      {user.lastLoginAt && (
                        <span className="ml-2">
                          Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowPermissionsModal(true)
                    }}
                    className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <KeyIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                      handleUpdateUserStatus(user.id, newStatus)
                    }}
                    className={`inline-flex items-center p-2 border rounded-md shadow-sm text-sm font-medium ${
                      user.status === 'ACTIVE'
                        ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30'
                        : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30'
                    }`}
                  >
                    {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="inline-flex items-center p-2 border border-red-300 dark:border-red-600 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New User</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label>
                    <input
                      type="text"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label>
                    <input
                      type="text"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as 'PLATFORM_ADMIN' | 'BUSINESS_OWNER' | 'TEAM_MEMBER' | 'END_CUSTOMER'})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  >
                    <option value="TEAM_MEMBER">Team Member</option>
                    <option value="BUSINESS_OWNER">Business Owner</option>
                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                    <option value="END_CUSTOMER">End Customer</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                      <div key={category}>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">{category}</h4>
                        <div className="mt-1 space-y-1">
                          {perms.map((permission) => (
                            <label key={permission.id} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={newUser.permissions.includes(permission.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewUser(prev => ({
                                      ...prev,
                                      permissions: [...prev.permissions, permission.id]
                                    }))
                                  } else {
                                    setNewUser(prev => ({
                                      ...prev,
                                      permissions: prev.permissions.filter(p => p !== permission.id)
                                    }))
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{permission.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  onClick={handleCreateUser}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Manage Permissions - {selectedUser.firstName} {selectedUser.lastName}
              </h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{category}</h4>
                    <div className="mt-2 space-y-2">
                      {perms.map((permission) => (
                        <label key={permission.id} className="flex items-start">
                          <input
                            type="checkbox"
                            checked={selectedUser.permissions.includes(permission.id)}
                            onChange={(e) => {
                              const newPermissions = e.target.checked
                                ? [...selectedUser.permissions, permission.id]
                                : selectedUser.permissions.filter(p => p !== permission.id)
                              
                              setSelectedUser(prev => prev ? { ...prev, permissions: newPermissions } : null)
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                          />
                          <div className="ml-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{permission.name}</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{permission.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleUpdateUserPermissions(selectedUser.id, selectedUser.permissions)
                    setShowPermissionsModal(false)
                    setSelectedUser(null)
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}