import { useState, useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { Message } from './useConversations'
import { toast } from 'sonner'

interface UseRealTimeMessagesProps {
  conversationId: string
  onNewMessage?: (message: Message) => void
  onAgentResponse?: (response: any) => void
}

export const useRealTimeMessages = ({
  conversationId,
  onNewMessage,
  onAgentResponse
}: UseRealTimeMessagesProps) => {
  const { socket, isConnected, joinConversation, leaveConversation, sendMessage } = useSocket()
  const [messages, setMessages] = useState<Message[]>([])
  const [isAgentTyping, setIsAgentTyping] = useState(false)

  // Join conversation on mount
  useEffect(() => {
    if (isConnected && conversationId) {
      joinConversation(conversationId)
      
      return () => {
        leaveConversation(conversationId)
      }
    }
  }, [isConnected, conversationId, joinConversation, leaveConversation])

  // Handle new messages
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (message: Message) => {
      if (message.role === 'assistant') {
        setIsAgentTyping(false)
      }
      
      setMessages(prev => {
        // Avoid duplicates
        if (prev.find(m => m.id === message.id)) {
          return prev
        }
        return [...prev, message]
      })
      
      onNewMessage?.(message)
    }

    const handleAgentResponse = (response: any) => {
      setIsAgentTyping(false)
      handleNewMessage(response.message)
      onAgentResponse?.(response)
    }

    const handleAgentTypingStart = () => {
      setIsAgentTyping(true)
    }

    const handleAgentTypingStop = () => {
      setIsAgentTyping(false)
    }

    socket.on('new_message', handleNewMessage)
    socket.on('agent_response', handleAgentResponse)
    socket.on('agent_typing_start', handleAgentTypingStart)
    socket.on('agent_typing_stop', handleAgentTypingStop)

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('agent_response', handleAgentResponse)
      socket.off('agent_typing_start', handleAgentTypingStart)
      socket.off('agent_typing_stop', handleAgentTypingStop)
    }
  }, [socket, onNewMessage, onAgentResponse])

  const sendRealtimeMessage = useCallback((content: string, metadata?: any) => {
    if (!isConnected) {
      toast.error('Not connected to real-time services')
      return
    }

    const message = {
      id: `temp-${Date.now()}`,
      content,
      role: 'user' as const,
      timestamp: new Date().toISOString(),
      metadata
    }

    // Optimistically add message
    setMessages(prev => [...prev, message])
    
    // Send via socket
    sendMessage(conversationId, message)
  }, [isConnected, conversationId, sendMessage])

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      // Avoid duplicates
      if (prev.find(m => m.id === message.id)) {
        return prev
      }
      return [...prev, message]
    })
  }, [])

  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ))
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    isAgentTyping,
    isConnected,
    sendRealtimeMessage,
    addMessage,
    updateMessage,
    clearMessages
  }
}

export default useRealTimeMessages