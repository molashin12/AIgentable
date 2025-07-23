import { useState } from 'react'
import {
  PlusIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  PlayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'
import { useAgents, Agent } from '../hooks/useAgents'

// Agent interface is now imported from useAgents hook

const personalityTraits = [
  'Professional', 'Friendly', 'Helpful', 'Empathetic', 'Technical',
  'Persuasive', 'Patient', 'Enthusiastic', 'Formal', 'Casual'
]

const roles = [
  'Sales', 'Customer Service', 'Lead Generation', 'Technical Support',
  'Marketing', 'HR Assistant', 'Appointment Booking'
]

export default function AgentBuilder() {
  const { t } = useLanguage()
  const { agents, loading, error, createAgent, updateAgent, deleteAgent, testAgent } = useAgents()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [isTestingAgent, setIsTestingAgent] = useState(false)

  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    personality: '',
    instructions: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    category: '',
  })

  const handleCreateAgent = async () => {
    if (!newAgent.name || !newAgent.description) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await createAgent({
        ...newAgent,
        isActive: true
      })
      setNewAgent({
        name: '',
        description: '',
        personality: '',
        instructions: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        category: '',
      })
      setShowCreateForm(false)
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleTestAgent = async () => {
    if (!testMessage.trim() || !selectedAgent) {
      toast.error('Please enter a test message')
      return
    }

    setIsTestingAgent(true)
    try {
      const response = await testAgent(selectedAgent.id, testMessage)
      setTestResponse(response.response || 'No response received')
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsTestingAgent(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('agentBuilder.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('agentBuilder.description')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          {t('agentBuilder.createAgent')}
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 mb-8">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <CpuChipIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{agent.category || 'General'}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    agent.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : agent.status === 'TRAINING'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {agent.status}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{agent.description}</p>
              
              <div className="mb-4">
                <div className="flex flex-wrap gap-1">
                  {agent.personality && (
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      {agent.personality}
                    </span>
                  )}
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                    {agent.model}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <div>
                  <span className="font-medium">Temperature:</span> {agent.temperature}
                </div>
                <div>
                  <span className="font-medium">Max Tokens:</span> {agent.maxTokens}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedAgent(agent)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Cog6ToothIcon className="-ml-1 mr-2 h-4 w-4" />
                  {t('agentBuilder.configure')}
                </button>
                <button
                  onClick={() => setSelectedAgent(agent)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <ChatBubbleLeftIcon className="-ml-1 mr-2 h-4 w-4" />
                  {t('agentBuilder.test')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Agent Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('agentBuilder.createNewAgent')}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Agent Name *</label>
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Sales Assistant"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={newAgent.category}
                    onChange={(e) => setNewAgent({...newAgent, category: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select a category</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
                  <textarea
                    value={newAgent.description}
                    onChange={(e) => setNewAgent({...newAgent, description: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="Describe what this agent will do..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personality</label>
                  <input
                    type="text"
                    value={newAgent.personality}
                    onChange={(e) => setNewAgent({...newAgent, personality: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Professional, helpful, and empathetic"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instructions</label>
                  <textarea
                    value={newAgent.instructions}
                    onChange={(e) => setNewAgent({...newAgent, instructions: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="Specific instructions for how the agent should behave..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Model</label>
                  <select
                    value={newAgent.model}
                    onChange={(e) => setNewAgent({...newAgent, model: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Temperature: {newAgent.temperature}</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={newAgent.temperature}
                      onChange={(e) => setNewAgent({...newAgent, temperature: parseFloat(e.target.value)})}
                      className="mt-1 block w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>Conservative</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Tokens</label>
                    <input
                      type="number"
                      min="100"
                      max="4000"
                      value={newAgent.maxTokens}
                      onChange={(e) => setNewAgent({...newAgent, maxTokens: parseInt(e.target.value)})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAgent}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Agent Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Test Agent: {selectedAgent.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Message</label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="Enter a message to test how the agent responds..."
                  />
                </div>
                
                <button
                  onClick={handleTestAgent}
                  disabled={isTestingAgent}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isTestingAgent ? (
                    <>
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="-ml-1 mr-2 h-4 w-4" />
                      Test Agent
                    </>
                  )}
                </button>
                
                {testResponse && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Agent Response:</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{testResponse}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedAgent(null)
                    setTestMessage('')
                    setTestResponse('')
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}