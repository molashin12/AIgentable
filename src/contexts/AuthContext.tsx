import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId?: string
  status?: string
  lastLogin?: Date
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (userData: { email: string; password: string; name: string; tenantName: string }) => Promise<boolean>
  logout: () => void
  refreshToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')
        
        if (token && userData) {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
          
          // Verify token is still valid
          try {
            await refreshToken()
          } catch (error) {
            // Token is invalid, clear auth state
            apiClient.clearAuth()
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        apiClient.clearAuth()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      const response = await apiClient.login(email, password)
      
      if (response.user && response.token) {
        localStorage.setItem('user', JSON.stringify(response.user))
        setUser(response.user)
        
        toast.success('Login successful!')
        return true
      } else {
        toast.error('Login failed')
        return false
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || ''
        if (errorMessage.toLowerCase().includes('user not found') || errorMessage.toLowerCase().includes('invalid credentials')) {
          toast.error('Invalid email or password. Please check your credentials and try again.')
        } else {
          toast.error('Invalid credentials. Please try again.')
        }
      } else if (error.response?.status === 404) {
        toast.error('User not found. Please check your email or register for a new account.')
      } else if (error.response?.status === 403) {
        toast.error('Account access denied. Please contact support if you believe this is an error.')
      } else if (error.response?.status === 429) {
        toast.error('Too many login attempts. Please wait a few minutes before trying again.')
      } else if (error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR') {
        toast.error('Connection timeout. Please check your internet connection and try again.')
      } else if (error.response?.status >= 500) {
        toast.error('Server error. Please try again later or contact support if the problem persists.')
      } else {
        toast.error(error.response?.data?.message || 'Login failed. Please try again.')
      }
      
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (userData: { email: string; password: string; name: string; tenantName: string }): Promise<boolean> => {
    try {
      setIsLoading(true)
      const response = await apiClient.register(userData)
      
      if (response.user && response.token) {
        localStorage.setItem('user', JSON.stringify(response.user))
        setUser(response.user)
        
        toast.success('Registration successful!')
        return true
      } else {
        toast.error('Registration failed')
        return false
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      
      // Handle specific registration error cases
      if (error.response?.status === 409) {
        const errorMessage = error.response?.data?.message || ''
        if (errorMessage.toLowerCase().includes('organization name')) {
          toast.error('This organization name is already taken. Please choose a different name.')
        } else {
          toast.error('An account with this email already exists. Please try logging in instead.')
        }
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || ''
        if (errorMessage.toLowerCase().includes('password')) {
          toast.error('Password does not meet requirements. Please use a stronger password.')
        } else if (errorMessage.toLowerCase().includes('email')) {
          toast.error('Please enter a valid email address.')
        } else {
          toast.error(errorMessage || 'Invalid registration data. Please check your information.')
        }
      } else if (error.response?.status === 429) {
        toast.error('Too many registration attempts. Please wait a few minutes before trying again.')
      } else if (error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR') {
        toast.error('Connection timeout. Please check your internet connection and try again.')
      } else if (error.response?.status >= 500) {
        toast.error('Server error. Please try again later or contact support if the problem persists.')
      } else {
        toast.error(error.response?.data?.message || 'Registration failed. Please try again.')
      }
      
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await apiClient.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      toast.success('Logged out successfully')
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await apiClient.getProfile()
      
      // Backend returns data in response.data.user format
      if (response.data?.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user))
        setUser(response.data.user)
        return true
      } else {
        throw new Error('Profile fetch failed')
      }
    } catch (error: any) {
      console.error('Profile fetch error:', error)
      
      // Only show error message if it's not a 401 (handled by interceptor)
      if (error.response?.status !== 401) {
        if (error.response?.status >= 500) {
          toast.error('Unable to verify session. Please try logging in again.')
        }
      }
      
      apiClient.clearAuth()
      setUser(null)
      return false
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext