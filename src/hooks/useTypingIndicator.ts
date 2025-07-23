import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from '../contexts/SocketContext'

interface TypingUser {
  userId: string
  userName: string
  timestamp: number
}

interface UseTypingIndicatorProps {
  conversationId: string
  currentUserId?: string
  typingTimeout?: number // milliseconds
}

export const useTypingIndicator = ({
  conversationId,
  currentUserId,
  typingTimeout = 3000
}: UseTypingIndicatorProps) => {
  const { socket, isConnected, startTyping, stopTyping } = useSocket()
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [isCurrentUserTyping, setIsCurrentUserTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingTime = useRef<number>(0)

  // Clean up typing users periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers(prev => 
        prev.filter(user => now - user.timestamp < typingTimeout)
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [typingTimeout])

  // Handle typing events from socket
  useEffect(() => {
    if (!socket) return

    const handleTypingStart = (data: { userId: string; userName: string; conversationId: string }) => {
      if (data.conversationId !== conversationId || data.userId === currentUserId) {
        return
      }

      setTypingUsers(prev => {
        const existing = prev.find(user => user.userId === data.userId)
        if (existing) {
          return prev.map(user => 
            user.userId === data.userId 
              ? { ...user, timestamp: Date.now() }
              : user
          )
        }
        return [...prev, {
          userId: data.userId,
          userName: data.userName,
          timestamp: Date.now()
        }]
      })
    }

    const handleTypingStop = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId !== conversationId) {
        return
      }

      setTypingUsers(prev => prev.filter(user => user.userId !== data.userId))
    }

    socket.on('user_typing_start', handleTypingStart)
    socket.on('user_typing_stop', handleTypingStop)

    return () => {
      socket.off('user_typing_start', handleTypingStart)
      socket.off('user_typing_stop', handleTypingStop)
    }
  }, [socket, conversationId, currentUserId])

  const handleStartTyping = useCallback(() => {
    if (!isConnected || !conversationId) return

    const now = Date.now()
    
    // Only send typing start if we haven't sent one recently
    if (now - lastTypingTime.current > 1000) {
      startTyping(conversationId)
      lastTypingTime.current = now
    }

    setIsCurrentUserTyping(true)

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping()
    }, typingTimeout)
  }, [isConnected, conversationId, startTyping, typingTimeout])

  const handleStopTyping = useCallback(() => {
    if (!isConnected || !conversationId) return

    stopTyping(conversationId)
    setIsCurrentUserTyping(false)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }, [isConnected, conversationId, stopTyping])

  // Auto-stop typing when component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (isCurrentUserTyping && isConnected) {
        stopTyping(conversationId)
      }
    }
  }, [isCurrentUserTyping, isConnected, conversationId, stopTyping])

  const getTypingText = useCallback(() => {
    if (typingUsers.length === 0) return ''
    
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} is typing...`
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
    } else {
      return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`
    }
  }, [typingUsers])

  return {
    typingUsers,
    isCurrentUserTyping,
    isAnyoneTyping: typingUsers.length > 0,
    typingText: getTypingText(),
    startTyping: handleStartTyping,
    stopTyping: handleStopTyping
  }
}

export default useTypingIndicator