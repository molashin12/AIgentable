import React, { useState, useEffect } from 'react'
import {
  WifiIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CloudIcon,
  SignalSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'

// Types for offline functionality
interface OfflineData {
  conversations: any[]
  agents: any[]
  documents: any[]
  settings: any
  lastSync: string
}

interface QueuedAction {
  id: string
  type: 'create' | 'update' | 'delete'
  resource: string
  data: any
  timestamp: string
  retryCount: number
}

// Hook for offline functionality
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([])
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null)
  const [syncInProgress, setSyncInProgress] = useState(false)

  useEffect(() => {
    // Load offline data from localStorage
    loadOfflineData()
    loadQueuedActions()

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Connection restored! Syncing data...')
      syncQueuedActions()
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.warning('You are now offline. Changes will be saved locally.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadOfflineData = () => {
    try {
      const data = localStorage.getItem('offline_data')
      if (data) {
        setOfflineData(JSON.parse(data))
      }
    } catch (error) {
      console.error('Failed to load offline data:', error)
    }
  }

  const loadQueuedActions = () => {
    try {
      const actions = localStorage.getItem('queued_actions')
      if (actions) {
        setQueuedActions(JSON.parse(actions))
      }
    } catch (error) {
      console.error('Failed to load queued actions:', error)
    }
  }

  const saveOfflineData = (data: Partial<OfflineData>) => {
    try {
      const currentData = offlineData || {
        conversations: [],
        agents: [],
        documents: [],
        settings: {},
        lastSync: new Date().toISOString()
      }
      
      const updatedData = { ...currentData, ...data, lastSync: new Date().toISOString() }
      localStorage.setItem('offline_data', JSON.stringify(updatedData))
      setOfflineData(updatedData)
    } catch (error) {
      console.error('Failed to save offline data:', error)
      toast.error('Failed to save data offline')
    }
  }

  const queueAction = (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>) => {
    const queuedAction: QueuedAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0
    }

    const updatedActions = [...queuedActions, queuedAction]
    setQueuedActions(updatedActions)
    
    try {
      localStorage.setItem('queued_actions', JSON.stringify(updatedActions))
    } catch (error) {
      console.error('Failed to save queued action:', error)
    }

    if (!isOnline) {
      toast.info('Action queued for when connection is restored')
    }
  }

  const syncQueuedActions = async () => {
    if (!isOnline || queuedActions.length === 0 || syncInProgress) {
      return
    }

    setSyncInProgress(true)
    const failedActions: QueuedAction[] = []
    let successCount = 0

    for (const action of queuedActions) {
      try {
        // Simulate API call - replace with actual API calls
        await simulateApiCall(action)
        successCount++
      } catch (error) {
        console.error('Failed to sync action:', action, error)
        
        // Retry logic
        if (action.retryCount < 3) {
          failedActions.push({
            ...action,
            retryCount: action.retryCount + 1
          })
        } else {
          toast.error(`Failed to sync ${action.type} ${action.resource} after 3 attempts`)
        }
      }
    }

    setQueuedActions(failedActions)
    localStorage.setItem('queued_actions', JSON.stringify(failedActions))
    setSyncInProgress(false)

    if (successCount > 0) {
      toast.success(`Successfully synced ${successCount} actions`)
    }

    if (failedActions.length > 0) {
      toast.warning(`${failedActions.length} actions failed to sync and will be retried`)
    }
  }

  const simulateApiCall = async (action: QueuedAction): Promise<void> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error('Simulated network error')
    }
  }

  const clearOfflineData = () => {
    localStorage.removeItem('offline_data')
    localStorage.removeItem('queued_actions')
    setOfflineData(null)
    setQueuedActions([])
    toast.success('Offline data cleared')
  }

  return {
    isOnline,
    queuedActions,
    offlineData,
    syncInProgress,
    saveOfflineData,
    queueAction,
    syncQueuedActions,
    clearOfflineData
  }
}

// Service Worker registration
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered:', registration)
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast.info('New version available! Refresh to update.', {
                  action: {
                    label: 'Refresh',
                    onClick: () => window.location.reload()
                  }
                })
              }
            })
          }
        })
      } catch (error) {
        console.error('Service Worker registration failed:', error)
      }
    })
  }
}

// Offline indicator component
interface OfflineIndicatorProps {
  className?: string
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const { isOnline, queuedActions, syncInProgress } = useOffline()

  if (isOnline && queuedActions.length === 0) {
    return null
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg ${
        isOnline 
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }`}>
        {isOnline ? (
          syncInProgress ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <WifiIcon className="h-4 w-4" />
          )
        ) : (
          <SignalSlashIcon className="h-4 w-4" />
        )}
        
        <span className="text-sm font-medium">
          {isOnline 
            ? syncInProgress 
              ? 'Syncing...'
              : queuedActions.length > 0 
                ? `${queuedActions.length} pending`
                : 'Online'
            : 'Offline'
          }
        </span>
      </div>
    </div>
  )
}

// Offline banner component
interface OfflineBannerProps {
  className?: string
}

export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  const { isOnline, queuedActions, syncQueuedActions, syncInProgress } = useOffline()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isOnline) {
      setDismissed(false)
    }
  }, [isOnline])

  if (isOnline || dismissed) {
    return null
  }

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 ${className}`}>
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-yellow-400 dark:bg-yellow-600">
              <ExclamationTriangleIcon className="h-5 w-5 text-white" />
            </span>
            <p className="ml-3 font-medium text-yellow-800 dark:text-yellow-200">
              <span className="md:hidden">
                You're offline. Changes saved locally.
              </span>
              <span className="hidden md:inline">
                You're currently offline. Your changes are being saved locally and will sync when connection is restored.
                {queuedActions.length > 0 && (
                  <span className="ml-2">
                    ({queuedActions.length} actions pending)
                  </span>
                )}
              </span>
            </p>
          </div>
          
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            <div className="flex space-x-2">
              {queuedActions.length > 0 && (
                <button
                  onClick={syncQueuedActions}
                  disabled={syncInProgress}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 disabled:opacity-50"
                >
                  {syncInProgress ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CloudIcon className="h-4 w-4 mr-2" />
                  )}
                  {syncInProgress ? 'Syncing...' : 'Retry Sync'}
                </button>
              )}
              
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Offline status component for settings/debug
export function OfflineStatus() {
  const { 
    isOnline, 
    queuedActions, 
    offlineData, 
    syncInProgress, 
    syncQueuedActions, 
    clearOfflineData 
  } = useOffline()

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Offline Support Status
      </h3>
      
      <div className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isOnline ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <SignalSlashIcon className="h-5 w-5 text-red-500" />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Connection Status
            </span>
          </div>
          <span className={`text-sm ${
            isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        {/* Queued Actions */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Pending Actions
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {queuedActions.length}
          </span>
        </div>
        
        {/* Last Sync */}
        {offlineData?.lastSync && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Last Sync
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(offlineData.lastSync).toLocaleString()}
            </span>
          </div>
        )}
        
        {/* Service Worker */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Service Worker
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {'serviceWorker' in navigator ? 'Supported' : 'Not Supported'}
          </span>
        </div>
        
        {/* Storage Usage */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Local Storage
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {offlineData ? 'Active' : 'Empty'}
          </span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="mt-6 flex space-x-3">
        {queuedActions.length > 0 && (
          <button
            onClick={syncQueuedActions}
            disabled={!isOnline || syncInProgress}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {syncInProgress ? (
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CloudIcon className="h-4 w-4 mr-2" />
            )}
            {syncInProgress ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
        
        <button
          onClick={clearOfflineData}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Clear Offline Data
        </button>
      </div>
      
      {/* Queued Actions List */}
      {queuedActions.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Pending Actions
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {queuedActions.map((action) => (
              <div key={action.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {action.type} {action.resource}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(action.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Retry: {action.retryCount}/3
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Main offline support provider
interface OfflineSupportProviderProps {
  children: React.ReactNode
}

export function OfflineSupportProvider({ children }: OfflineSupportProviderProps) {
  useEffect(() => {
    // Register service worker on mount
    registerServiceWorker()
  }, [])

  return (
    <>
      {children}
      <OfflineIndicator />
      <OfflineBanner />
    </>
  )
}

export default {
  useOffline,
  registerServiceWorker,
  OfflineIndicator,
  OfflineBanner,
  OfflineStatus,
  OfflineSupportProvider
}