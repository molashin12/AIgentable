import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'

export interface Agent {
  id: string
  name: string
  description: string
  type: string
  personality: string | { traits: string[]; tone: string; style: string }
  instructions: string
  systemPrompt?: string
  model: string
  temperature: number
  maxTokens: number
  category: string
  isActive: boolean
  status: 'ACTIVE' | 'INACTIVE' | 'TRAINING'
  createdAt: string
  updatedAt: string
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = async (params?: any) => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getAgents(params)
      setAgents(response.agents || [])
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch agents'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createAgent = async (agentData: Partial<Agent>) => {
    try {
      const newAgent = await apiClient.createAgent(agentData)
      setAgents(prev => [...prev, newAgent])
      toast.success('Agent created successfully')
      return newAgent
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create agent'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const updateAgent = async (id: string, agentData: Partial<Agent>) => {
    try {
      const updatedAgent = await apiClient.updateAgent(id, agentData)
      setAgents(prev => prev.map(agent => 
        agent.id === id ? updatedAgent : agent
      ))
      toast.success('Agent updated successfully')
      return updatedAgent
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update agent'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const deleteAgent = async (id: string) => {
    try {
      await apiClient.deleteAgent(id)
      setAgents(prev => prev.filter(agent => agent.id !== id))
      toast.success('Agent deleted successfully')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to delete agent'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const testAgent = async (id: string, message: string) => {
    try {
      const response = await apiClient.testAgent(id, message)
      return response
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to test agent'
      toast.error(errorMessage)
      throw err
    }
  }

  const trainAgent = async (id: string, documents: any[]) => {
    try {
      const response = await apiClient.trainAgent(id, documents)
      // Update agent status to training
      setAgents(prev => prev.map(agent => 
        agent.id === id ? { ...agent, status: 'TRAINING' } : agent
      ))
      toast.success('Agent training started')
      return response
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to start training'
      toast.error(errorMessage)
      throw err
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  return {
    agents,
    loading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    testAgent,
    trainAgent
  }
}