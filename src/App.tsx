import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LanguageProvider } from './contexts/LanguageContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { OfflineSupportProvider } from './components/OfflineSupport'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import AgentBuilder from './pages/AgentBuilder'
import TrainingCenter from './pages/TrainingCenter'
import ChannelIntegration from './pages/ChannelIntegration'
import ConversationManager from './pages/ConversationManager'
import Analytics from './pages/Analytics'
import AdvancedAnalytics from './pages/AdvancedAnalytics'
import Settings from './pages/Settings'
import UserManagement from './pages/UserManagement'
import BillingManagement from './pages/BillingManagement'
import AdvancedAgentConfiguration from './pages/AdvancedAgentConfiguration'
import TenantManagement from './pages/TenantManagement'
import APIKeyManagement from './pages/APIKeyManagement'
import WebhookConfiguration from './pages/WebhookConfiguration'
import Login from './pages/Login'
import Register from './pages/Register'
import Contact from './pages/Contact'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Public Route Component (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <>{children}</>
}

// Landing Route Component (show landing page for non-authenticated users)
function LandingRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <LandingPage />
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="agents" element={<AgentBuilder />} />
          <Route path="agents/advanced" element={<AdvancedAgentConfiguration />} />
          <Route path="training" element={<TrainingCenter />} />
          <Route path="channels" element={<ChannelIntegration />} />
          <Route path="conversations" element={<ConversationManager />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="analytics/advanced" element={<AdvancedAnalytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="billing" element={<BillingManagement />} />
          <Route path="tenants" element={<TenantManagement />} />
          <Route path="api-keys" element={<APIKeyManagement />} />
          <Route path="webhooks" element={<WebhookConfiguration />} />
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary level="critical" showDetails={process.env.NODE_ENV === 'development'}>
      <LanguageProvider>
        <AuthProvider>
          <SocketProvider>
            <OfflineSupportProvider>
              <Router>
                <ErrorBoundary level="page" showDetails={process.env.NODE_ENV === 'development'}>
                  <AppRoutes />
                </ErrorBoundary>
              </Router>
            </OfflineSupportProvider>
          </SocketProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}

export default App
