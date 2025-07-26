import { useState, useEffect } from 'react'
import {
  PlusIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  PlayIcon,
  DocumentTextIcon,
  DocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'
import { useAgents, Agent } from '../hooks/useAgents'
import { useDocuments } from '../hooks/useDocuments'

// Agent interface is now imported from useAgents hook

const personalityTraits = [
  'Professional', 'Friendly', 'Helpful', 'Empathetic', 'Technical',
  'Persuasive', 'Patient', 'Enthusiastic', 'Formal', 'Casual'
]

const roles = [
  'Sales', 'Customer Service', 'Lead Generation', 'Technical Support',
  'Marketing', 'HR Assistant', 'Appointment Booking'
]

const agentTypes = [
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'SALES', label: 'Sales' },
  { value: 'SUPPORT', label: 'Technical Support' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'HR', label: 'HR Assistant' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'CUSTOM', label: 'Custom' }
]

export default function AgentBuilder() {
  const { t } = useLanguage()
  const { agents, loading, error, createAgent, updateAgent, deleteAgent, testAgent } = useAgents()
  const { documents, fetchDocuments, loading: documentsLoading } = useDocuments()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [isTestingAgent, setIsTestingAgent] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])

  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    type: '',
    personality: '',
    instructions: '',
    temperature: 0.7,
    maxTokens: 1000,
    category: '',
    documentIds: [],
  })

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleCreateAgent = async () => {
    if (!newAgent.name || !newAgent.description || !newAgent.type) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      // Convert personality string to JSON object for backend
      const personalityData = newAgent.personality ? {
        traits: newAgent.personality.split(',').map(trait => trait.trim()).filter(Boolean),
        tone: 'professional',
        style: 'conversational'
      } : {
        traits: [],
        tone: 'professional',
        style: 'conversational'
      }

      await createAgent({
        name: newAgent.name,
        description: newAgent.description,
        type: newAgent.type,
        temperature: newAgent.temperature,
        maxTokens: newAgent.maxTokens,
        systemPrompt: newAgent.instructions || 'You are a helpful AI assistant.',
        isActive: true,
        documentIds: selectedDocuments
      })
      setNewAgent({
        name: '',
        description: '',
        type: '',
        personality: '',
        instructions: '',
        temperature: 0.7,
        maxTokens: 1000,
        category: '',
        documentIds: [],
      })
      setSelectedDocuments([])
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
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('agentBuilder.title')}</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t('agentBuilder.description')}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            {t('agentBuilder.createAgent')}
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4"></div>
              <div className="flex space-x-2">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 mb-8">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No agents yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first AI agent.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Create Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 mb-8">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <CpuChipIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{agent.name}</h3>
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
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{agent.description}</p>
                
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {agent.personality && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                        {typeof agent.personality === 'string' ? agent.personality : agent.personality.traits?.join(', ') || 'Custom'}
                      </span>
                    )}
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                      {agent.model}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Temperature:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{agent.temperature}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Max Tokens:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{agent.maxTokens}</span>
                  </div>
                  {agent.documentIds && agent.documentIds.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Documents:</span>
                      <div className="flex items-center text-blue-600 dark:text-blue-400">
                        <DocumentIcon className="h-4 w-4 mr-1" />
                        <span className="font-medium">{agent.documentIds.length}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedAgent(agent)}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                  >
                    <Cog6ToothIcon className="-ml-1 mr-2 h-4 w-4" />
                    Configure
                  </button>
                  <button
                    onClick={() => setSelectedAgent(agent)}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm"
                  >
                    <ChatBubbleLeftIcon className="-ml-1 mr-2 h-4 w-4" />
                    Test
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto border border-gray-200 dark:border-gray-700 w-full max-w-2xl shadow-2xl rounded-xl bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Agent</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agent Name *</label>
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white transition-colors duration-200"
                    placeholder="e.g., Sales Assistant"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agent Type *</label>
                  <select
                    value={newAgent.type}
                    onChange={(e) => setNewAgent({...newAgent, type: e.target.value})}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white transition-colors duration-200"
                  >
                    <option value="">Select agent type</option>
                    {agentTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                  <select
                    value={newAgent.category}
                    onChange={(e) => setNewAgent({...newAgent, category: e.target.value})}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white transition-colors duration-200"
                  >
                    <option value="">Select a category</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description *</label>
                  <textarea
                    value={newAgent.description}
                    onChange={(e) => setNewAgent({...newAgent, description: e.target.value})}
                    rows={3}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white transition-colors duration-200"
                    placeholder="Describe what this agent will do..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Personality</label>
                  <input
                    type="text"
                    value={newAgent.personality}
                    onChange={(e) => setNewAgent({...newAgent, personality: e.target.value})}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white transition-colors duration-200"
                    placeholder="e.g., Professional, helpful, and empathetic"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructions</label>
                  <textarea
                    value={newAgent.instructions}
                    onChange={(e) => setNewAgent({...newAgent, instructions: e.target.value})}
                    rows={3}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white transition-colors duration-200"
                    placeholder="Specific instructions for how the agent should behave..."
                  />
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Knowledge Base Documents</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                    {documentsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading documents...</span>
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="text-center py-4">
                        <DocumentIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <div className="text-sm text-gray-500 dark:text-gray-400">No documents available</div>
                        <p className="text-xs text-gray-400 mt-1">Upload documents to provide knowledge to your agent</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {documents.map((doc) => (
                          <label key={doc.id} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-gray-600 transition-colors duration-200">
                            <input
                              type="checkbox"
                              checked={selectedDocuments.includes(doc.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDocuments([...selectedDocuments, doc.id])
                                } else {
                                  setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id))
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <DocumentIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{doc.name}</span>
                            {selectedDocuments.includes(doc.id) && (
                              <CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    💡 Select documents to provide context and knowledge to your agent. Selected documents will be used to answer questions.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setSelectedDocuments([])
                  }}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAgent}
                  disabled={!newAgent.name || !newAgent.type || !newAgent.description}
                  className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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