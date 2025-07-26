import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon,
  BugAntIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
  level?: 'page' | 'component' | 'critical'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Report error to monitoring service (in a real app)
    this.reportError(error, errorInfo)

    // Show toast notification for component-level errors
    if (this.props.level === 'component') {
      toast.error('A component error occurred. Please try refreshing the page.')
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error reporting service
    // like Sentry, Bugsnag, or your own logging service
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level || 'component'
    }

    // Simulate error reporting
    console.log('Error reported:', errorReport)
    
    // Store in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('app_errors') || '[]')
      existingErrors.push(errorReport)
      // Keep only last 10 errors
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10)
      }
      localStorage.setItem('app_errors', JSON.stringify(existingErrors))
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e)
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      })
      toast.success('Retrying...')
    } else {
      toast.error('Maximum retry attempts reached. Please refresh the page.')
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private copyErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state
    const errorDetails = {
      errorId,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    }

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => toast.success('Error details copied to clipboard'))
      .catch(() => toast.error('Failed to copy error details'))
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorInfo, errorId } = this.state
      const { level = 'component', showDetails = false } = this.props

      // Critical error - full page takeover
      if (level === 'critical') {
        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
              <div className="flex justify-center">
                <ExclamationTriangleIcon className="h-16 w-16 text-red-500" />
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                Critical Error
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                The application encountered a critical error and cannot continue.
              </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
              <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <div className="flex">
                      <BugAntIcon className="h-5 w-5 text-red-400 mt-0.5" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                          Error ID: {errorId}
                        </h3>
                        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                          <p>{error?.message || 'An unexpected error occurred'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={this.handleReload}
                      className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                      Reload Application
                    </button>

                    <button
                      onClick={this.copyErrorDetails}
                      className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                      Copy Error Details
                    </button>
                  </div>

                  {showDetails && error && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                        Technical Details
                      </summary>
                      <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-300 overflow-auto max-h-40">
                        <div className="mb-2">
                          <strong>Error:</strong> {error.message}
                        </div>
                        {error.stack && (
                          <div className="mb-2">
                            <strong>Stack:</strong>
                            <pre className="whitespace-pre-wrap">{error.stack}</pre>
                          </div>
                        )}
                        {errorInfo?.componentStack && (
                          <div>
                            <strong>Component Stack:</strong>
                            <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      // Page-level error
      if (level === 'page') {
        return (
          <div className="min-h-96 flex flex-col justify-center items-center px-4">
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                Page Error
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This page encountered an error and couldn't load properly.
              </p>
              
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                {this.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Try Again ({this.maxRetries - this.retryCount} left)
                  </button>
                )}
                
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <HomeIcon className="h-4 w-4 mr-2" />
                  Go Home
                </button>
              </div>

              {showDetails && (
                <div className="mt-4">
                  <button
                    onClick={this.copyErrorDetails}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Copy error details for support
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      // Component-level error (default)
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Component Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>This component encountered an error and couldn't render properly.</p>
              </div>
              <div className="mt-3">
                {this.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded-md hover:bg-red-200 dark:hover:bg-red-700 mr-2"
                  >
                    Retry ({this.maxRetries - this.retryCount} left)
                  </button>
                )}
                {showDetails && (
                  <button
                    onClick={this.copyErrorDetails}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  >
                    Copy details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  const reportError = (error: Error, context?: string) => {
    console.error('Manual error report:', error, context)
    
    const errorReport = {
      errorId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      type: 'manual'
    }

    // Store in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('app_errors') || '[]')
      existingErrors.push(errorReport)
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10)
      }
      localStorage.setItem('app_errors', JSON.stringify(existingErrors))
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e)
    }

    toast.error(`Error: ${error.message}`)
  }

  return { reportError }
}

// Component for displaying error logs (for debugging)
export function ErrorLogger() {
  const [errors, setErrors] = React.useState<any[]>([])
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]')
      setErrors(storedErrors)
    } catch (e) {
      console.warn('Failed to load errors from localStorage:', e)
    }
  }, [isOpen])

  const clearErrors = () => {
    localStorage.removeItem('app_errors')
    setErrors([])
    toast.success('Error logs cleared')
  }

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 z-50"
        title="View Error Logs"
      >
        <BugAntIcon className="h-5 w-5" />
        {errors.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-yellow-500 text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {errors.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Error Logs</h3>
              <div className="flex space-x-2">
                <button
                  onClick={clearErrors}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
            
            {errors.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No errors logged</p>
            ) : (
              <div className="space-y-4">
                {errors.map((error, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-600 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {error.errorId}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(error.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error.message}</p>
                    {error.context && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Context: {error.context}</p>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Stack trace</summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded overflow-auto max-h-32 text-gray-700 dark:text-gray-300">
                        {error.stack || 'No stack trace available'}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ErrorBoundary