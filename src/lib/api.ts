import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { toast } from 'sonner'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const API_TIMEOUT = 10000

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      window.location.href = '/login'
      toast.error('Session expired. Please login again.')
    } else if (error.response?.status === 403) {
      toast.error('Access denied. You do not have permission to perform this action.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.')
    } else {
      const message = error.response?.data?.message || 'An unexpected error occurred'
      toast.error(message)
    }
    return Promise.reject(error)
  }
)

// API Response Types
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

// Generic API methods
export const api = {
  // GET request
  get: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const response = await apiClient.get(url, config)
    return response.data
  },

  // POST request
  post: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const response = await apiClient.post(url, data, config)
    return response.data
  },

  // PUT request
  put: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const response = await apiClient.put(url, data, config)
    return response.data
  },

  // PATCH request
  patch: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const response = await apiClient.patch(url, data, config)
    return response.data
  },

  // DELETE request
  delete: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const response = await apiClient.delete(url, config)
    return response.data
  },
}

// Authentication API
export const authApi = {
  login: async (email: string, password: string) => {
    return api.post('/auth/login', { email, password })
  },

  register: async (userData: { email: string; password: string; name: string; tenantName: string }) => {
    return api.post('/auth/register', userData)
  },

  logout: async () => {
    return api.post('/auth/logout')
  },

  refreshToken: async () => {
    return api.post('/auth/refresh')
  },

  forgotPassword: async (email: string) => {
    return api.post('/auth/forgot-password', { email })
  },

  resetPassword: async (token: string, password: string) => {
    return api.post('/auth/reset-password', { token, password })
  },
}

// Agents API
export const agentsApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }) => {
    return api.get<PaginatedResponse<any>>('/agents', { params })
  },

  getById: async (id: string) => {
    return api.get(`/agents/${id}`)
  },

  create: async (agentData: any) => {
    return api.post('/agents', agentData)
  },

  update: async (id: string, agentData: any) => {
    return api.put(`/agents/${id}`, agentData)
  },

  delete: async (id: string) => {
    return api.delete(`/agents/${id}`)
  },

  train: async (id: string, documents: any[]) => {
    return api.post(`/agents/${id}/train`, { documents })
  },

  test: async (id: string, message: string) => {
    return api.post(`/agents/${id}/test`, { message })
  },
}

// Channels API
export const channelsApi = {
  getAll: async (params?: { page?: number; limit?: number; type?: string }) => {
    return api.get<PaginatedResponse<any>>('/channels', { params })
  },

  getById: async (id: string) => {
    return api.get(`/channels/${id}`)
  },

  create: async (channelData: any) => {
    return api.post('/channels', channelData)
  },

  update: async (id: string, channelData: any) => {
    return api.put(`/channels/${id}`, channelData)
  },

  delete: async (id: string) => {
    return api.delete(`/channels/${id}`)
  },

  connect: async (id: string, config: any) => {
    return api.post(`/channels/${id}/connect`, config)
  },

  disconnect: async (id: string) => {
    return api.post(`/channels/${id}/disconnect`)
  },
}

// Conversations API
export const conversationsApi = {
  getAll: async (params?: { page?: number; limit?: number; channelId?: string; status?: string }) => {
    return api.get<PaginatedResponse<any>>('/conversations', { params })
  },

  getById: async (id: string) => {
    return api.get(`/conversations/${id}`)
  },

  create: async (conversationData: any) => {
    return api.post('/conversations', conversationData)
  },

  update: async (id: string, conversationData: any) => {
    return api.put(`/conversations/${id}`, conversationData)
  },

  delete: async (id: string) => {
    return api.delete(`/conversations/${id}`)
  },

  getMessages: async (id: string, params?: { page?: number; limit?: number }) => {
    return api.get(`/conversations/${id}/messages`, { params })
  },

  sendMessage: async (id: string, messageData: any) => {
    return api.post(`/conversations/${id}/messages`, messageData)
  },
}

// Documents API
export const documentsApi = {
  getAll: async (params?: { page?: number; limit?: number; type?: string }) => {
    return api.get<PaginatedResponse<any>>('/documents', { params })
  },

  getById: async (id: string) => {
    return api.get(`/documents/${id}`)
  },

  upload: async (file: File, metadata?: any) => {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }
    return api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  delete: async (id: string) => {
    return api.delete(`/documents/${id}`)
  },

  process: async (id: string) => {
    return api.post(`/documents/${id}/process`)
  },
}

// Analytics API
export const analyticsApi = {
  getDashboard: async (params?: { startDate?: string; endDate?: string }) => {
    return api.get('/analytics/dashboard', { params })
  },

  getConversationMetrics: async (params?: { startDate?: string; endDate?: string; channelId?: string }) => {
    return api.get('/analytics/conversations', { params })
  },

  getAgentMetrics: async (params?: { startDate?: string; endDate?: string; agentId?: string }) => {
    return api.get('/analytics/agents', { params })
  },
}

export default apiClient