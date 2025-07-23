import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { toast } from 'sonner'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const API_TIMEOUT = 10000

class APIClient {
  private client: AxiosInstance
  private token: string | null = null
  private tenantId: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
    this.initializeAuth()
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuth()
          window.location.href = '/login'
          toast.error('Session expired. Please login again.')
        } else if (error.response?.status === 403) {
          toast.error('Access denied. You do not have permission to perform this action.')
        } else if (error.response?.status >= 500) {
          toast.error('Server error. Please try again later.')
        } else if (error.code === 'ECONNABORTED') {
          toast.error('Request timeout. Please check your connection.')
        }
        return Promise.reject(error)
      }
    )
  }

  private initializeAuth() {
    const token = localStorage.getItem('token')
    const tenantId = localStorage.getItem('tenantId')
    if (token && tenantId) {
      this.token = token
      this.tenantId = tenantId
    }
  }

  setAuth(token: string, tenantId: string) {
    this.token = token
    this.tenantId = tenantId
    localStorage.setItem('token', token)
    localStorage.setItem('tenantId', tenantId)
  }

  clearAuth() {
    this.token = null
    this.tenantId = null
    localStorage.removeItem('token')
    localStorage.removeItem('tenantId')
    localStorage.removeItem('user')
  }

  // Auth methods
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password })
    const { user, token } = response.data
    this.setAuth(token, user.tenantId)
    return response.data
  }

  async register(userData: any) {
    const response = await this.client.post('/auth/register', userData)
    const { user, token } = response.data
    this.setAuth(token, user.tenantId)
    return response.data
  }

  async logout() {
    await this.client.post('/auth/logout')
    this.clearAuth()
  }

  async getProfile() {
    const response = await this.client.get('/auth/me')
    return response.data
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email })
    return response.data
  }

  async resetPassword(token: string, password: string) {
    const response = await this.client.post('/auth/reset-password', { token, password })
    return response.data
  }

  // Agent methods
  async getAgents(params?: any) {
    const response = await this.client.get('/agents', { params })
    return response.data
  }

  async createAgent(agentData: any) {
    const response = await this.client.post('/agents', agentData)
    return response.data
  }

  async updateAgent(id: string, agentData: any) {
    const response = await this.client.put(`/agents/${id}`, agentData)
    return response.data
  }

  async deleteAgent(id: string) {
    await this.client.delete(`/agents/${id}`)
  }

  async testAgent(id: string, message: string) {
    const response = await this.client.post(`/agents/${id}/test`, { message })
    return response.data
  }

  async trainAgent(id: string, documents: any[]) {
    const response = await this.client.post(`/agents/${id}/train`, { documents })
    return response.data
  }

  // Conversation methods
  async getConversations(params?: any) {
    const response = await this.client.get('/conversations', { params })
    return response.data
  }

  async getConversation(id: string) {
    const response = await this.client.get(`/conversations/${id}`)
    return response.data
  }

  async sendMessage(conversationId: string, message: any) {
    const response = await this.client.post(`/conversations/${conversationId}/messages`, message)
    return response.data
  }

  async updateConversationStatus(id: string, status: string) {
    const response = await this.client.put(`/conversations/${id}/status`, { status })
    return response.data
  }

  // Document methods
  async uploadDocuments(files: FileList, agentId: string) {
    const formData = new FormData()
    Array.from(files).forEach(file => {
      formData.append('files', file)
    })
    formData.append('agentId', agentId)

    const response = await this.client.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async getDocuments(params?: any) {
    const response = await this.client.get('/documents', { params })
    return response.data
  }

  async deleteDocument(id: string) {
    await this.client.delete(`/documents/${id}`)
  }

  async processDocument(id: string) {
    const response = await this.client.post(`/documents/${id}/process`)
    return response.data
  }

  async uploadDocument(formData: FormData, config?: any) {
    const response = await this.client.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...config
    })
    return response.data
  }

  // Channel methods
  async getChannels(params?: any) {
    const response = await this.client.get('/channels', { params })
    return response.data
  }

  async createChannel(channelData: any) {
    const response = await this.client.post('/channels', channelData)
    return response.data
  }

  async updateChannel(id: string, channelData: any) {
    const response = await this.client.put(`/channels/${id}`, channelData)
    return response.data
  }

  async deleteChannel(id: string) {
    await this.client.delete(`/channels/${id}`)
  }

  async testChannel(id: string, message?: string) {
    const response = await this.client.post(`/channels/${id}/test`, { message })
    return response.data
  }

  async getChannelStatistics(id: string, params?: any) {
    const response = await this.client.get(`/channels/${id}/statistics`, { params })
    return response.data
  }

  async getSupportedChannelTypes() {
    const response = await this.client.get('/channels/types')
    return response.data
  }

  async configureChannelWebhook(id: string, webhookConfig: any) {
    const response = await this.client.put(`/channels/${id}/webhook`, webhookConfig)
    return response.data
  }

  // Analytics methods
  async getAnalyticsOverview() {
    const response = await this.client.get('/analytics/overview')
    return response.data
  }

  async getDashboardMetrics(params?: any) {
    const response = await this.client.get('/analytics/dashboard', { params })
    return response.data
  }

  async getConversationMetrics(params?: any) {
    const response = await this.client.get('/analytics/conversations', { params })
    return response.data
  }

  async getConversationAnalytics(params?: any) {
    const response = await this.client.get('/analytics/conversations', { params })
    return response.data
  }

  async getAgentAnalytics(params?: any) {
    const response = await this.client.get('/analytics/agents', { params })
    return response.data
  }

  async getChannelAnalytics(params?: any) {
    const response = await this.client.get('/analytics/channels', { params })
    return response.data
  }

  async getAgentMetrics(agentId: string, params?: any) {
    const response = await this.client.get(`/analytics/agents/${agentId}`, { params })
    return response.data
  }

  // Search methods
  async searchConversations(query: string, params?: any) {
    const response = await this.client.get('/search/conversations', { params: { query, ...params } })
    return response.data
  }

  async searchDocuments(query: string, params?: any) {
    const response = await this.client.get('/search/documents', { params: { query, ...params } })
    return response.data
  }

  async searchAgents(query: string, params?: any) {
    const response = await this.client.get('/search/agents', { params: { query, ...params } })
    return response.data
  }

  // User management
  async getUsers(params?: any) {
    const response = await this.client.get('/users', { params })
    return response.data
  }

  async createUser(userData: any) {
    const response = await this.client.post('/users', userData)
    return response.data
  }

  async updateUser(id: string, userData: any) {
    const response = await this.client.put(`/users/${id}`, userData)
    return response.data
  }

  async deleteUser(id: string) {
    await this.client.delete(`/users/${id}`)
  }

  // API Keys
  async getApiKeys() {
    const response = await this.client.get('/api-keys')
    return response.data
  }

  async createApiKey(keyData: any) {
    const response = await this.client.post('/api-keys', keyData)
    return response.data
  }

  async deleteApiKey(id: string) {
    await this.client.delete(`/api-keys/${id}`)
  }

  // AI Providers
  async getAiProviders() {
    const response = await this.client.get('/ai-providers')
    return response.data
  }

  async createAiProvider(providerData: any) {
    const response = await this.client.post('/ai-providers', providerData)
    return response.data
  }

  async updateAiProvider(id: string, providerData: any) {
    const response = await this.client.put(`/ai-providers/${id}`, providerData)
    return response.data
  }
}

export const apiClient = new APIClient()

// Legacy API interfaces for backward compatibility
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Export the main API client
export default apiClient