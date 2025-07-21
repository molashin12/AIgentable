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

interface Agent {
  id: string
  name: string
  role: string
  status: 'ACTIVE' | 'TRAINING' | 'DRAFT'
  description: string
  personality: string[]
  responseLength: 'Short' | 'Medium' | 'Long'
  creativity: number
  conversations: number
  accuracy: string
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Sales Assistant',
    role: 'Sales',
    status: 'ACTIVE',
    description: 'Helps customers with product inquiries and sales',
    personality: ['Professional', 'Helpful', 'Persuasive'],
    responseLength: 'Medium',
    creativity: 70,
    conversations: 245,
    accuracy: '96%',
  },
  {
    id: '2',
    name: 'Support Bot',
    role: 'Customer Service',
    status: 'ACTIVE',
    description: 'Provides technical support and troubleshooting',
    personality: ['Patient', 'Technical', 'Empathetic'],
    responseLength: 'Long',
    creativity: 50,
    conversations: 189,
    accuracy: '94%',
  },
]

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
  const [agents, setAgents] = useState<Agent[]>(mockAgents)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [isTestingAgent, setIsTestingAgent] = useState(false)

  const [newAgent, setNewAgent] = useState({
    name: '',
    role: '',
    description: '',
    personality: [] as string[],
    responseLength: 'Medium' as 'Short' | 'Medium' | 'Long',
    creativity: 50,
  })

  const handleCreateAgent = () => {
    if (!newAgent.name || !newAgent.role || !newAgent.description) {
      toast.error('Please fill in all required fields')
      return
    }

    const agent: Agent = {
      id: Date.now().toString(),
      ...newAgent,
      status: 'DRAFT',
      conversations: 0,
      accuracy: 'N/A',
    }

    setAgents([...agents, agent])
    setNewAgent({
      name: '',
      role: '',
      description: '',
      personality: [],
      responseLength: 'Medium',
      creativity: 50,
    })
    setShowCreateForm(false)
    toast.success('Agent created successfully!')
  }

  const handleTestAgent = async () => {
    if (!testMessage.trim()) {
      toast.error('Please enter a test message')
      return
    }

    setIsTestingAgent(true)
    // Simulate API call
    setTimeout(() => {
      setTestResponse(`Hello! I'm ${selectedAgent?.name}. I understand you're asking about "${testMessage}". Based on my training, I can help you with that. This is a simulated response showing how I would handle your inquiry with a ${selectedAgent?.personality.join(', ').toLowerCase()} approach.`)
      setIsTestingAgent(false)
    }, 2000)
  }

  const togglePersonality = (trait: string) => {
    setNewAgent(prev => ({
      ...prev,
      personality: prev.personality.includes(trait)
        ? prev.personality.filter(p => p !== trait)
        : [...prev.personality, trait]
    }))
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">{agent.role}</p>
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
                  {agent.personality.map((trait) => (
                    <span
                      key={trait}
                      className="inline-flex px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <div>
                  <span className="font-medium">{t('agentBuilder.conversations')}:</span> {agent.conversations}
                </div>
                <div>
                  <span className="font-medium">{t('agentBuilder.accuracy')}:</span> {agent.accuracy}
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
                  <label className="block text-sm font-medium text-gray-700">Agent Name *</label>
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Sales Assistant"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role *</label>
                  <select
                    value={newAgent.role}
                    onChange={(e) => setNewAgent({...newAgent, role: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description *</label>
                  <textarea
                    value={newAgent.description}
                    onChange={(e) => setNewAgent({...newAgent, description: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Describe what this agent will do..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Personality Traits</label>
                  <div className="flex flex-wrap gap-2">
                    {personalityTraits.map((trait) => (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => togglePersonality(trait)}
                        className={`px-3 py-1 text-sm rounded-full border ${
                          newAgent.personality.includes(trait)
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {trait}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Response Length</label>
                  <select
                    value={newAgent.responseLength}
                    onChange={(e) => setNewAgent({...newAgent, responseLength: e.target.value as 'Short' | 'Medium' | 'Long'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="Short">Short (1-2 sentences)</option>
                    <option value="Medium">Medium (2-4 sentences)</option>
                    <option value="Long">Long (4+ sentences)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Creativity Level: {newAgent.creativity}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newAgent.creativity}
                    onChange={(e) => setNewAgent({...newAgent, creativity: parseInt(e.target.value)})}
                    className="mt-1 block w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Conservative</span>
                    <span>Creative</span>
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
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Test Agent: {selectedAgent.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Test Message</label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Agent Response:</h4>
                    <p className="text-sm text-gray-700">{testResponse}</p>
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
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
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