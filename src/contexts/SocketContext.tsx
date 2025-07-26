import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { toast } from 'sonner'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void
  sendMessage: (conversationId: string, message: any) => void
  startTyping: (conversationId: string) => void
  stopTyping: (conversationId: string) => void
  onNewMessage: (callback: (message: any) => void) => void
  onAgentResponse: (callback: (response: any) => void) => void
  onTypingStart: (callback: (data: any) => void) => void
  onTypingStop: (callback: (data: any) => void) => void
  onConversationUpdate: (callback: (data: any) => void) => void
  onNotification: (callback: (notification: any) => void) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token')
      if (!token) return

      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
        auth: {
          token,
          tenantId: user.tenantId
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      })

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id)
        setIsConnected(true)
        reconnectAttempts.current = 0
        toast.success('Connected to real-time services')
      })

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
        setIsConnected(false)
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          newSocket.connect()
        }
      })

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        reconnectAttempts.current++
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          toast.error('Failed to connect to real-time services')
        }
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts')
        toast.success('Reconnected to real-time services')
      })

      newSocket.on('reconnect_failed', () => {
        console.error('Socket reconnection failed')
        toast.error('Unable to reconnect to real-time services')
      })

      // Authentication error handler
      newSocket.on('auth_error', (error) => {
        console.error('Socket authentication error:', error)
        toast.error('Authentication failed for real-time services')
        newSocket.disconnect()
      })

      socketRef.current = newSocket

      return () => {
        newSocket.close()
        socketRef.current = null
        setIsConnected(false)
      }
    } else {
      // Disconnect socket if user is not authenticated
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
        setIsConnected(false)
      }
    }
  }, [isAuthenticated, user])

  const joinConversation = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join_conversation', { conversationId })
      console.log('Joined conversation:', conversationId)
    }
  }

  const leaveConversation = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave_conversation', { conversationId })
      console.log('Left conversation:', conversationId)
    }
  }

  const sendMessage = (conversationId: string, message: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send_message', {
        conversationId,
        message: {
          ...message,
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  const startTyping = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing_start', { conversationId })
    }
  }

  const stopTyping = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing_stop', { conversationId })
    }
  }

  const onNewMessage = (callback: (message: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('new_message', callback)
      return () => socketRef.current?.off('new_message', callback)
    }
  }

  const onAgentResponse = (callback: (response: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('agent_response', callback)
      return () => socketRef.current?.off('agent_response', callback)
    }
  }

  const onTypingStart = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('user_typing_start', callback)
      return () => socketRef.current?.off('user_typing_start', callback)
    }
  }

  const onTypingStop = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('user_typing_stop', callback)
      return () => socketRef.current?.off('user_typing_stop', callback)
    }
  }

  const onConversationUpdate = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('conversation_update', callback)
      return () => socketRef.current?.off('conversation_update', callback)
    }
  }

  const onNotification = (callback: (notification: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('notification', (notification) => {
        callback(notification)
        // Show toast notification
        switch (notification.type) {
          case 'info':
            toast.info(notification.message)
            break
          case 'success':
            toast.success(notification.message)
            break
          case 'warning':
            toast.warning(notification.message)
            break
          case 'error':
            toast.error(notification.message)
            break
          default:
            toast(notification.message)
        }
      })
      return () => socketRef.current?.off('notification', callback)
    }
  }

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    onNewMessage,
    onAgentResponse,
    onTypingStart,
    onTypingStop,
    onConversationUpdate,
    onNotification
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export default SocketContext