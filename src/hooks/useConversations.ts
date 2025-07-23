import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  metadata?: any
}

export interface Conversation {
  id: string
  title?: string
  status: 'ACTIVE' | 'CLOSED' | 'PENDING'
  channelId: string
  agentId: string
  userId?: string
  lastMessage?: Message
  messageCount: number
  createdAt: string
  updatedAt: string
  messages?: Message[]
}

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = async (params?: any) => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getConversations(params)
      setConversations(response.conversations || [])
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch conversations'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getConversation = async (id: string) => {
    try {
      const response = await apiClient.getConversation(id)
      return response.conversation
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch conversation'
      toast.error(errorMessage)
      throw err
    }
  }

  const sendMessage = async (conversationId: string, content: string, metadata?: any) => {
    try {
      const messageData = {
        content,
        role: 'user' as const,
        metadata
      }
      const response = await apiClient.sendMessage(conversationId, messageData)
      
      // Update the conversation in the list
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, lastMessage: response.message, messageCount: conv.messageCount + 1 }
          : conv
      ))
      
      return response
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to send message'
      toast.error(errorMessage)
      throw err
    }
  }

  const updateConversationStatus = async (id: string, status: string) => {
    try {
      await apiClient.updateConversationStatus(id, status)
      setConversations(prev => prev.map(conv => 
        conv.id === id ? { ...conv, status: status as any } : conv
      ))
      toast.success('Conversation status updated')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update conversation status'
      toast.error(errorMessage)
      throw err
    }
  }

  const searchConversations = async (query: string, params?: any) => {
    try {
      const response = await apiClient.searchConversations(query, params)
      return response.conversations || []
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to search conversations'
      toast.error(errorMessage)
      throw err
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    getConversation,
    sendMessage,
    updateConversationStatus,
    searchConversations
  }
}