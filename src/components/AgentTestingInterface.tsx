import React, { useState, useRef, useEffect } from 'react'
import { PlayIcon, StopIcon, TrashIcon, DocumentDuplicateIcon, ClockIcon } from '@heroicons/react/24/outline'
import { RealTimeChat } from './RealTimeChat'
import { FileUpload } from './FileUpload'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

interface TestSession {
  id: string
  agentId: string
  agentName: string
  conversationId: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'failed'
  messageCount: number
}

interface AgentTestingInterfaceProps {
  agentId: string
  agentName: string
  agentConfig?: any
  className?: string
  onTestComplete?: (session: TestSession) => void
}

export const AgentTestingInterface: React.FC<AgentTestingInterfaceProps> = ({
  agentId,
  agentName,
  agentConfig,
  className = '',
  onTestComplete
}) => {
  const { user } = useAuth()
  const { socket, isConnected } = useSocket()
  const [currentSession, setCurrentSession] = useState<TestSession | null>(null)
  const [testHistory, setTestHistory] = useState<TestSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const sessionIdRef = useRef<string | null>(null)

  // Generate unique session ID
  const generateSessionId = () => {
    return `test-${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Start new test session
  const startTestSession = async () => {
    if (!isConnected) {
      toast.error('Real-time connection required for testing')
      return
    }

    setIsLoading(true)
    const sessionId = generateSessionId()
    sessionIdRef.current = sessionId

    try {
      // Create a new conversation for testing
      const conversationId = `test-conv-${sessionId}`
      
      const newSession: TestSession = {
        id: sessionId,
        agentId,
        agentName,
        conversationId,
        startTime: new Date().toISOString(),
        status: 'active',
        messageCount: 0
      }

      setCurrentSession(newSession)
      
      // Join the test conversation
      if (socket) {
        socket.emit('join_test_session', {
          sessionId,
          agentId,
          conversationId,
          agentConfig,
          files: uploadedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
        })
      }

      toast.success('Test session started')
    } catch (error) {
      console.error('Failed to start test session:', error)
      toast.error('Failed to start test session')
    } finally {
      setIsLoading(false)
    }
  }

  // End current test session
  const endTestSession = () => {
    if (!currentSession) return

    const completedSession: TestSession = {
      ...currentSession,
      endTime: new Date().toISOString(),
      status: 'completed'
    }

    setTestHistory(prev => [completedSession, ...prev])
    setCurrentSession(null)
    sessionIdRef.current = null

    // Leave the test conversation
    if (socket) {
      socket.emit('leave_test_session', {
        sessionId: currentSession.id,
        conversationId: currentSession.conversationId
      })
    }

    onTestComplete?.(completedSession)
    toast.success('Test session completed')
  }

  // Clear test history
  const clearHistory = () => {
    setTestHistory([])
    toast.success('Test history cleared')
  }

  // Handle file uploads for testing
  const handleFilesSelected = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files])
    toast.success(`${files.length} file(s) added for testing`)
  }

  // Handle new messages to update session stats
  const handleNewMessage = () => {
    if (currentSession) {
      setCurrentSession(prev => prev ? {
        ...prev,
        messageCount: prev.messageCount + 1
      } : null)
    }
  }

  // Format session duration
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffSecs = Math.floor((diffMs % 60000) / 1000)
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`
    }
    return `${diffSecs}s`
  }

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    const handleTestSessionError = (data: { sessionId: string; error: string }) => {
      if (data.sessionId === sessionIdRef.current) {
        toast.error(`Test session error: ${data.error}`)
        if (currentSession) {
          setCurrentSession(prev => prev ? { ...prev, status: 'failed' } : null)
        }
      }
    }

    socket.on('test_session_error', handleTestSessionError)

    return () => {
      socket.off('test_session_error', handleTestSessionError)
    }
  }, [socket, currentSession])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Test Controls */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Agent Testing: {agentName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Test your agent in a controlled environment
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {currentSession ? (
              <>
                <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-full text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Active Session</span>
                </div>
                <button
                  onClick={endTestSession}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <StopIcon className="h-4 w-4" />
                  <span>End Test</span>
                </button>
              </>
            ) : (
              <button
                onClick={startTestSession}
                disabled={isLoading || !isConnected}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <PlayIcon className="h-4 w-4" />
                <span>{isLoading ? 'Starting...' : 'Start Test'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Session Status */}
        {currentSession && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDuration(currentSession.startTime)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Messages</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentSession.messageCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {currentSession.status}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* File Upload for Testing */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
          Test Files
        </h4>
        <FileUpload
          onFilesSelected={handleFilesSelected}
          disabled={!!currentSession}
          maxFiles={5}
          className=""
        />
        {uploadedFiles.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {uploadedFiles.length} file(s) ready for testing
            </p>
          </div>
        )}
      </div>

      {/* Real-time Chat Interface */}
      {currentSession && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
              Test Conversation
            </h4>
          </div>
          <RealTimeChat
            conversationId={currentSession.conversationId}
            onNewMessage={handleNewMessage}
            className="h-96"
          />
        </div>
      )}

      {/* Test History */}
      {testHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
              Test History
            </h4>
            <button
              onClick={clearHistory}
              className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <TrashIcon className="h-4 w-4" />
              <span>Clear</span>
            </button>
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {testHistory.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    session.status === 'completed' ? 'bg-green-500' :
                    session.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Session {session.id.slice(-6)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(session.startTime, session.endTime)} • {session.messageCount} messages
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(session.startTime).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentTestingInterface