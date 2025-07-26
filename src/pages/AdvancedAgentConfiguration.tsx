import { useState, useCallback, useRef, useEffect } from 'react'
import {
  PlusIcon,
  TrashIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  PlayIcon,
  PauseIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  CodeBracketIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface WorkflowNode {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'response'
  position: { x: number; y: number }
  data: {
    label: string
    config: Record<string, any>
    description?: string
  }
  connections: string[] // IDs of connected nodes
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface AgentWorkflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  isActive: boolean
  lastModified: string
  version: number
}

const nodeTypes = {
  trigger: {
    label: 'Trigger',
    icon: BoltIcon,
    color: 'bg-green-500',
    options: [
      { id: 'message_received', label: 'Message Received', config: { keywords: [], channels: [] } },
      { id: 'user_joined', label: 'User Joined', config: { channels: [] } },
      { id: 'scheduled', label: 'Scheduled', config: { cron: '', timezone: 'UTC' } },
      { id: 'webhook', label: 'Webhook', config: { url: '', method: 'POST' } }
    ]
  },
  condition: {
    label: 'Condition',
    icon: ExclamationTriangleIcon,
    color: 'bg-yellow-500',
    options: [
      { id: 'text_contains', label: 'Text Contains', config: { keywords: [], caseSensitive: false } },
      { id: 'user_role', label: 'User Role', config: { roles: [] } },
      { id: 'time_range', label: 'Time Range', config: { start: '', end: '', timezone: 'UTC' } },
      { id: 'sentiment', label: 'Sentiment Analysis', config: { threshold: 0.5, type: 'positive' } }
    ]
  },
  action: {
    label: 'Action',
    icon: Cog6ToothIcon,
    color: 'bg-blue-500',
    options: [
      { id: 'send_message', label: 'Send Message', config: { message: '', channel: '' } },
      { id: 'api_call', label: 'API Call', config: { url: '', method: 'GET', headers: {}, body: '' } },
      { id: 'update_user', label: 'Update User', config: { fields: {} } },
      { id: 'create_ticket', label: 'Create Ticket', config: { title: '', priority: 'medium' } }
    ]
  },
  response: {
    label: 'Response',
    icon: ChatBubbleLeftRightIcon,
    color: 'bg-purple-500',
    options: [
      { id: 'text_response', label: 'Text Response', config: { message: '', variables: [] } },
      { id: 'template_response', label: 'Template Response', config: { templateId: '', variables: {} } },
      { id: 'dynamic_response', label: 'Dynamic Response', config: { prompt: '', model: 'gpt-3.5-turbo' } },
      { id: 'file_response', label: 'File Response', config: { fileUrl: '', fileName: '' } }
    ]
  }
}

const mockWorkflows: AgentWorkflow[] = [
  {
    id: 'wf_1',
    name: 'Customer Support Flow',
    description: 'Automated customer support workflow with escalation',
    nodes: [
      {
        id: 'node_1',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: {
          label: 'Message Received',
          config: { keywords: ['help', 'support', 'issue'], channels: ['chat', 'email'] }
        },
        connections: ['node_2']
      },
      {
        id: 'node_2',
        type: 'condition',
        position: { x: 300, y: 100 },
        data: {
          label: 'Sentiment Analysis',
          config: { threshold: 0.3, type: 'negative' }
        },
        connections: ['node_3', 'node_4']
      },
      {
        id: 'node_3',
        type: 'action',
        position: { x: 500, y: 50 },
        data: {
          label: 'Create Ticket',
          config: { title: 'Urgent Support Request', priority: 'high' }
        },
        connections: ['node_5']
      },
      {
        id: 'node_4',
        type: 'response',
        position: { x: 500, y: 150 },
        data: {
          label: 'Text Response',
          config: { message: 'Thank you for contacting us. How can I help you today?', variables: [] }
        },
        connections: []
      },
      {
        id: 'node_5',
        type: 'response',
        position: { x: 700, y: 50 },
        data: {
          label: 'Template Response',
          config: { templateId: 'escalation_template', variables: { ticketId: '{{ticket.id}}' } }
        },
        connections: []
      }
    ],
    edges: [
      { id: 'edge_1', source: 'node_1', target: 'node_2' },
      { id: 'edge_2', source: 'node_2', target: 'node_3', label: 'Negative' },
      { id: 'edge_3', source: 'node_2', target: 'node_4', label: 'Positive' },
      { id: 'edge_4', source: 'node_3', target: 'node_5' }
    ],
    isActive: true,
    lastModified: '2024-01-15T10:30:00Z',
    version: 2
  }
]

export default function AdvancedAgentConfiguration() {
  const { t } = useLanguage()
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>(mockWorkflows)
  const [selectedWorkflow, setSelectedWorkflow] = useState<AgentWorkflow | null>(workflows[0] || null)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false)
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationStep, setSimulationStep] = useState(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  const createNewWorkflow = () => {
    const newWorkflow: AgentWorkflow = {
      id: `wf_${Date.now()}`,
      name: 'New Workflow',
      description: 'A new agent workflow',
      nodes: [],
      edges: [],
      isActive: false,
      lastModified: new Date().toISOString(),
      version: 1
    }
    setWorkflows(prev => [...prev, newWorkflow])
    setSelectedWorkflow(newWorkflow)
    toast.success('New workflow created')
  }

  const deleteWorkflow = (workflowId: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== workflowId))
    if (selectedWorkflow?.id === workflowId) {
      setSelectedWorkflow(workflows.find(w => w.id !== workflowId) || null)
    }
    toast.success('Workflow deleted')
  }

  const updateWorkflow = (updates: Partial<AgentWorkflow>) => {
    if (!selectedWorkflow) return
    
    const updatedWorkflow = {
      ...selectedWorkflow,
      ...updates,
      lastModified: new Date().toISOString(),
      version: selectedWorkflow.version + 1
    }
    
    setWorkflows(prev => prev.map(w => w.id === selectedWorkflow.id ? updatedWorkflow : w))
    setSelectedWorkflow(updatedWorkflow)
  }

  const addNode = useCallback((type: string, position: { x: number; y: number }) => {
    if (!selectedWorkflow) return
    
    const nodeType = nodeTypes[type as keyof typeof nodeTypes]
    if (!nodeType) return
    
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: type as WorkflowNode['type'],
      position,
      data: {
        label: nodeType.options[0].label,
        config: { ...nodeType.options[0].config }
      },
      connections: []
    }
    
    updateWorkflow({
      nodes: [...selectedWorkflow.nodes, newNode]
    })
  }, [selectedWorkflow])

  const deleteNode = (nodeId: string) => {
    if (!selectedWorkflow) return
    
    const updatedNodes = selectedWorkflow.nodes.filter(n => n.id !== nodeId)
    const updatedEdges = selectedWorkflow.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    
    updateWorkflow({
      nodes: updatedNodes,
      edges: updatedEdges
    })
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null)
      setIsConfigPanelOpen(false)
    }
  }

  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    if (!selectedWorkflow) return
    
    const updatedNodes = selectedWorkflow.nodes.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    )
    
    updateWorkflow({ nodes: updatedNodes })
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, ...updates })
    }
  }

  const connectNodes = (sourceId: string, targetId: string) => {
    if (!selectedWorkflow) return
    
    const edgeExists = selectedWorkflow.edges.some(e => e.source === sourceId && e.target === targetId)
    if (edgeExists) return
    
    const newEdge: WorkflowEdge = {
      id: `edge_${Date.now()}`,
      source: sourceId,
      target: targetId
    }
    
    updateWorkflow({
      edges: [...selectedWorkflow.edges, newEdge]
    })
  }

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedNodeType || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const position = {
      x: (e.clientX - rect.left - canvasOffset.x) / zoom,
      y: (e.clientY - rect.top - canvasOffset.y) / zoom
    }
    
    addNode(draggedNodeType, position)
    setDraggedNodeType(null)
  }

  const simulateWorkflow = async () => {
    if (!selectedWorkflow || selectedWorkflow.nodes.length === 0) {
      toast.error('No workflow to simulate')
      return
    }
    
    setIsSimulating(true)
    setSimulationStep(0)
    
    // Find trigger nodes
    const triggerNodes = selectedWorkflow.nodes.filter(n => n.type === 'trigger')
    if (triggerNodes.length === 0) {
      toast.error('Workflow must have at least one trigger node')
      setIsSimulating(false)
      return
    }
    
    // Simulate step by step
    for (let i = 0; i < selectedWorkflow.nodes.length; i++) {
      setSimulationStep(i + 1)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    setIsSimulating(false)
    setSimulationStep(0)
    toast.success('Workflow simulation completed')
  }

  const exportWorkflow = () => {
    if (!selectedWorkflow) return
    
    const dataStr = JSON.stringify(selectedWorkflow, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedWorkflow.name.replace(/\s+/g, '_')}.json`
    link.click()
    
    URL.revokeObjectURL(url)
    toast.success('Workflow exported')
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Workflow List */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Workflows</h2>
            <button
              onClick={createNewWorkflow}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-md"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              onClick={() => setSelectedWorkflow(workflow)}
              className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                selectedWorkflow?.id === workflow.id ? 'bg-blue-50 dark:bg-blue-900 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">{workflow.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{workflow.description}</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      workflow.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      v{workflow.version} • {workflow.nodes.length} nodes
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteWorkflow(workflow.id)
                  }}
                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {selectedWorkflow && (
                <>
                  <input
                    type="text"
                    value={selectedWorkflow.name}
                    onChange={(e) => updateWorkflow({ name: e.target.value })}
                    className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => updateWorkflow({ isActive: !selectedWorkflow.isActive })}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedWorkflow.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {selectedWorkflow.isActive ? (
                      <><PauseIcon className="h-4 w-4 mr-1" /> Active</>
                    ) : (
                      <><PlayIcon className="h-4 w-4 mr-1" /> Inactive</>
                    )}
                  </button>
                </>
              )}
            </div>
            
            {selectedWorkflow && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={simulateWorkflow}
                  disabled={isSimulating}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isSimulating ? (
                    <><ClockIcon className="h-4 w-4 mr-2" /> Simulating...</>
                  ) : (
                    <><PlayIcon className="h-4 w-4 mr-2" /> Simulate</>
                  )}
                </button>
                <button
                  onClick={exportWorkflow}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Node Palette */}
          <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Node Types</h3>
            <div className="space-y-3">
              {Object.entries(nodeTypes).map(([type, config]) => (
                <div key={type}>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    {config.label}
                  </h4>
                  <div className="space-y-2">
                    {config.options.map((option) => (
                      <div
                        key={option.id}
                        draggable
                        onDragStart={() => setDraggedNodeType(type)}
                        className={`p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-move hover:border-gray-400 dark:hover:border-gray-500 transition-colors`}
                      >
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full ${config.color} mr-2`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            {selectedWorkflow ? (
              <div
                ref={canvasRef}
                className="w-full h-full bg-gray-100 dark:bg-gray-900 relative"
                onDrop={handleCanvasDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
                  backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                  backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`
                }}
              >
                {/* Render Edges */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {selectedWorkflow.edges.map((edge) => {
                    const sourceNode = selectedWorkflow.nodes.find(n => n.id === edge.source)
                    const targetNode = selectedWorkflow.nodes.find(n => n.id === edge.target)
                    
                    if (!sourceNode || !targetNode) return null
                    
                    const x1 = (sourceNode.position.x + 100) * zoom + canvasOffset.x
                    const y1 = (sourceNode.position.y + 25) * zoom + canvasOffset.y
                    const x2 = targetNode.position.x * zoom + canvasOffset.x
                    const y2 = (targetNode.position.y + 25) * zoom + canvasOffset.y
                    
                    return (
                      <g key={edge.id}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#6b7280"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                        />
                        {edge.label && (
                          <text
                            x={(x1 + x2) / 2}
                            y={(y1 + y2) / 2 - 5}
                            textAnchor="middle"
                            className="text-xs fill-gray-600 dark:fill-gray-400"
                          >
                            {edge.label}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill="#6b7280"
                      />
                    </marker>
                  </defs>
                </svg>

                {/* Render Nodes */}
                {selectedWorkflow.nodes.map((node, index) => {
                  const nodeType = nodeTypes[node.type]
                  const isCurrentlySimulating = isSimulating && index < simulationStep
                  
                  return (
                    <div
                      key={node.id}
                      className={`absolute bg-white dark:bg-gray-800 border-2 rounded-lg shadow-lg cursor-pointer transition-all ${
                        selectedNode?.id === node.id
                          ? 'border-blue-500 shadow-blue-200 dark:shadow-blue-900'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      } ${isSimulating ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}
                      style={{
                        left: node.position.x * zoom + canvasOffset.x,
                        top: node.position.y * zoom + canvasOffset.y,
                        width: 200 * zoom,
                        transform: `scale(${zoom})`
                      }}
                      onClick={() => {
                        setSelectedNode(node)
                        setIsConfigPanelOpen(true)
                      }}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${nodeType.color} mr-2`} />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {node.data.label}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNode(node.id)
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </div>
                        {node.data.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {node.data.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Workflow Selected
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Select a workflow from the sidebar or create a new one to get started.
                  </p>
                  <button
                    onClick={createNewWorkflow}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                    Create Workflow
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      {isConfigPanelOpen && selectedNode && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Node Configuration</h3>
              <button
                onClick={() => setIsConfigPanelOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Node Type
              </label>
              <select
                value={selectedNode.type}
                onChange={(e) => {
                  const newType = e.target.value as WorkflowNode['type']
                  const nodeType = nodeTypes[newType]
                  updateNode(selectedNode.id, {
                    type: newType,
                    data: {
                      label: nodeType.options[0].label,
                      config: { ...nodeType.options[0].config }
                    }
                  })
                }}
                className="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                {Object.entries(nodeTypes).map(([type, config]) => (
                  <option key={type} value={type}>{config.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Node Subtype
              </label>
              <select
                value={selectedNode.data.label}
                onChange={(e) => {
                  const nodeType = nodeTypes[selectedNode.type]
                  const option = nodeType.options.find(opt => opt.label === e.target.value)
                  if (option) {
                    updateNode(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        label: option.label,
                        config: { ...option.config }
                      }
                    })
                  }
                }}
                className="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                {nodeTypes[selectedNode.type].options.map((option) => (
                  <option key={option.id} value={option.label}>{option.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNode(selectedNode.id, {
                  data: { ...selectedNode.data, description: e.target.value }
                })}
                rows={3}
                className="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Optional description for this node"
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Configuration</h4>
              <div className="space-y-3">
                {Object.entries(selectedNode.data.config).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </label>
                    {typeof value === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, [key]: e.target.checked }
                          }
                        })}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700"
                      />
                    ) : Array.isArray(value) ? (
                      <textarea
                        value={value.join(', ')}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            config: {
                              ...selectedNode.data.config,
                              [key]: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                            }
                          }
                        })}
                        rows={2}
                        className="w-full text-xs border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Comma-separated values"
                      />
                    ) : (
                      <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: {
                            ...selectedNode.data,
                            config: {
                              ...selectedNode.data.config,
                              [key]: typeof value === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                            }
                          }
                        })}
                        className="w-full text-xs border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}