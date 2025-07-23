import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'

export interface DashboardMetrics {
  totalAgents: number
  activeConversations: number
  totalMessages: number
  totalConversations: number
  avgResponseTime: number
  userSatisfaction: number
  avgSatisfaction: number
  satisfactionChange: number
  resolutionRate: number
  resolutionRateChange: number
  conversationGrowth: number
  responseTimeChange: number
  topPerformingAgents: Array<{
    id: string
    name: string
    messageCount: number
    avgRating: number
  }>
  conversationTrends: Array<{
    date: string
    count: number
  }>
  messageTrends: Array<{
    date: string
    count: number
  }>
}

export interface ConversationMetrics {
  totalConversations: number
  avgDuration: number
  resolutionRate: number
  satisfactionScore: number
  trends: Array<{
    date: string
    conversations: number
    resolved: number
    escalated: number
  }>
  responseTimeByHour: Array<{
    hour: string
    avgTime: number
  }>
  channelDistribution: Array<{
    name: string
    value: number
    color: string
  }>
  satisfactionTrend: Array<{
    date: string
    score: number
  }>
  trendsData: Array<{
    date: string
    conversations: number
    avgDuration: number
    satisfactionScore: number
  }>
}

export interface AgentMetrics {
  agentId: string
  name: string
  totalConversations: number
  avgResponseTime: number
  satisfactionScore: number
  resolutionRate: number
  performance: Array<{
    id: string
    name: string
    conversations: number
    avgResponseTime: number
    satisfactionScore: number
    resolutionRate: number
  }>
  trendsData: Array<{
    date: string
    conversations: number
    avgResponseTime: number
    satisfactionScore: number
  }>
}

export const useAnalytics = () => {
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null)
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics | null>(null)
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardMetrics = async (timeRange?: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getDashboardMetrics({ timeRange })
      setDashboardMetrics(response)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch dashboard metrics'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchConversationMetrics = async (params?: any) => {
    try {
      const response = await apiClient.getConversationMetrics(params)
      const metrics = response as ConversationMetrics
      setConversationMetrics(metrics)
      return metrics
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch conversation metrics'
      toast.error(errorMessage)
      throw err
    }
  }

  const fetchAgentMetrics = async (agentId: string, params?: any) => {
    try {
      const response = await apiClient.getAgentMetrics(agentId, params)
      const metrics = response as AgentMetrics
      setAgentMetrics(metrics)
      return metrics
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch agent metrics'
      toast.error(errorMessage)
      throw err
    }
  }

  const exportMetrics = async (type: 'dashboard' | 'conversations' | 'agents', params?: any) => {
    try {
      let response
      switch (type) {
        case 'dashboard':
          response = await apiClient.getDashboardMetrics({ ...params, export: true })
          break
        case 'conversations':
          response = await apiClient.getConversationMetrics({ ...params, export: true })
          break
        case 'agents':
          response = await apiClient.getAgentMetrics(params.agentId, { ...params, export: true })
          break
        default:
          throw new Error('Invalid export type')
      }
      
      // Create and download CSV file
      const blob = new Blob([response.csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type}-metrics-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Metrics exported successfully')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to export metrics'
      toast.error(errorMessage)
      throw err
    }
  }

  const exportToCsv = async (type: 'dashboard' | 'conversations' | 'agents', params?: any) => {
    return exportMetrics(type, params)
  }

  const refreshMetrics = () => {
    fetchDashboardMetrics()
  }

  useEffect(() => {
    fetchDashboardMetrics()
  }, [])

  return {
    dashboardMetrics,
    conversationMetrics,
    agentMetrics,
    loading,
    error,
    fetchDashboardMetrics,
    fetchConversationMetrics,
    fetchAgentMetrics,
    exportMetrics,
    exportToCsv,
    refreshMetrics
  }
}