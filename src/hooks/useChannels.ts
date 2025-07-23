import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'

export interface Channel {
  id: string
  name: string
  type: 'WEB_CHAT' | 'WHATSAPP' | 'TELEGRAM' | 'SLACK' | 'DISCORD' | 'EMAIL' | 'SMS'
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR'
  agentId: string
  config: {
    webhookUrl?: string
    apiKey?: string
    botToken?: string
    phoneNumber?: string
    [key: string]: any
  }
  statistics: {
    totalConversations: number
    activeConversations: number
    avgResponseTime: number
    satisfactionScore: number
  }
  createdAt: string
  updatedAt: string
}

export const useChannels = () => {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChannels = async (params?: any) => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getChannels(params)
      setChannels(response.channels || [])
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch channels'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createChannel = async (channelData: Partial<Channel>) => {
    try {
      const newChannel = await apiClient.createChannel(channelData)
      setChannels(prev => [...prev, newChannel])
      toast.success('Channel created successfully')
      return newChannel
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create channel'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const updateChannel = async (id: string, channelData: Partial<Channel>) => {
    try {
      const updatedChannel = await apiClient.updateChannel(id, channelData)
      setChannels(prev => prev.map(channel => 
        channel.id === id ? updatedChannel : channel
      ))
      toast.success('Channel updated successfully')
      return updatedChannel
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update channel'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const deleteChannel = async (id: string) => {
    try {
      await apiClient.deleteChannel(id)
      setChannels(prev => prev.filter(channel => channel.id !== id))
      toast.success('Channel deleted successfully')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to delete channel'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const testChannel = async (id: string, message: string) => {
    try {
      const response = await apiClient.testChannel(id, message)
      toast.success('Test message sent successfully')
      return response
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to test channel'
      toast.error(errorMessage)
      throw err
    }
  }

  const getChannelStatistics = async (id: string, timeRange?: string) => {
    try {
      const response = await apiClient.getChannelStatistics(id, { timeRange })
      return response.statistics
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch channel statistics'
      toast.error(errorMessage)
      throw err
    }
  }

  const getSupportedChannelTypes = async () => {
    try {
      const response = await apiClient.getSupportedChannelTypes()
      return response.types
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch supported channel types'
      toast.error(errorMessage)
      throw err
    }
  }

  const configureWebhook = async (id: string, webhookConfig: any) => {
    try {
      const response = await apiClient.configureChannelWebhook(id, webhookConfig)
      setChannels(prev => prev.map(channel => 
        channel.id === id ? { ...channel, config: { ...channel.config, ...webhookConfig } } : channel
      ))
      toast.success('Webhook configured successfully')
      return response
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to configure webhook'
      toast.error(errorMessage)
      throw err
    }
  }

  useEffect(() => {
    fetchChannels()
  }, [])

  return {
    channels,
    loading,
    error,
    fetchChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    testChannel,
    getChannelStatistics,
    getSupportedChannelTypes,
    configureWebhook
  }
}