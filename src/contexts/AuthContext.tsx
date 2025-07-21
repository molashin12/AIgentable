import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../lib/api'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  status: string
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
        const token = localStorage.getItem('authToken')
        const userData = localStorage.getItem('user')
        
        if (token && userData) {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
          
          // Verify token is still valid
          try {
            await refreshToken()
          } catch (error) {
            // Token is invalid, clear auth state
            localStorage.removeItem('authToken')
            localStorage.removeItem('user')
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
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
      const response = await authApi.login(email, password)
      
      if (response.success && response.data) {
        const { token, user: userData } = response.data
        
        localStorage.setItem('authToken', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
        
        toast.success('Login successful!')
        return true
      } else {
        toast.error(response.message || 'Login failed')
        return false
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error(error.response?.data?.message || 'Login failed')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (userData: { email: string; password: string; name: string; tenantName: string }): Promise<boolean> => {
    try {
      setIsLoading(true)
      const response = await authApi.register(userData)
      
      if (response.success && response.data) {
        const { token, user: newUser } = response.data
        
        localStorage.setItem('authToken', token)
        localStorage.setItem('user', JSON.stringify(newUser))
        setUser(newUser)
        
        toast.success('Registration successful!')
        return true
      } else {
        toast.error(response.message || 'Registration failed')
        return false
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      toast.error(error.response?.data?.message || 'Registration failed')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      setUser(null)
      toast.success('Logged out successfully')
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await authApi.refreshToken()
      
      if (response.success && response.data) {
        const { token, user: userData } = response.data
        
        localStorage.setItem('authToken', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
        
        return true
      } else {
        throw new Error('Token refresh failed')
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
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