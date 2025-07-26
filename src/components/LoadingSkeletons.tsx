import React from 'react'

// Base skeleton component
interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
  animate?: boolean
}

export function Skeleton({ 
  className = '', 
  width, 
  height, 
  rounded = false, 
  animate = true 
}: SkeletonProps) {
  const baseClasses = `bg-gray-200 dark:bg-gray-700 ${animate ? 'animate-pulse' : ''} ${
    rounded ? 'rounded-full' : 'rounded'
  }`
  
  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height
  
  return <div className={`${baseClasses} ${className}`} style={style} />
}

// Text skeleton with multiple lines
interface TextSkeletonProps {
  lines?: number
  className?: string
  animate?: boolean
}

export function TextSkeleton({ lines = 3, className = '', animate = true }: TextSkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-4 ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
          animate={animate}
        />
      ))}
    </div>
  )
}

// Avatar skeleton
interface AvatarSkeletonProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  animate?: boolean
}

export function AvatarSkeleton({ size = 'md', className = '', animate = true }: AvatarSkeletonProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  }
  
  return (
    <Skeleton
      className={`${sizeClasses[size]} ${className}`}
      rounded
      animate={animate}
    />
  )
}

// Card skeleton
interface CardSkeletonProps {
  className?: string
  animate?: boolean
  showAvatar?: boolean
  showImage?: boolean
  lines?: number
}

export function CardSkeleton({ 
  className = '', 
  animate = true, 
  showAvatar = false, 
  showImage = false, 
  lines = 3 
}: CardSkeletonProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
      {showImage && (
        <Skeleton className="h-48 w-full mb-4" animate={animate} />
      )}
      
      <div className="flex items-start space-x-4">
        {showAvatar && (
          <AvatarSkeleton animate={animate} />
        )}
        
        <div className="flex-1">
          <Skeleton className="h-6 w-3/4 mb-2" animate={animate} />
          <TextSkeleton lines={lines} animate={animate} />
        </div>
      </div>
    </div>
  )
}

// Table skeleton
interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
  animate?: boolean
  showHeader?: boolean
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className = '', 
  animate = true, 
  showHeader = true 
}: TableSkeletonProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {showHeader && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-20" animate={animate} />
            ))}
          </div>
        </div>
      )}
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton 
                  key={colIndex} 
                  className={`h-4 ${colIndex === 0 ? 'w-32' : 'w-24'}`} 
                  animate={animate} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Dashboard skeleton
export function DashboardSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-64 mb-2" animate={animate} />
        <Skeleton className="h-4 w-96" animate={animate} />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center">
              <Skeleton className="h-8 w-8" rounded animate={animate} />
              <div className="ml-4 flex-1">
                <Skeleton className="h-4 w-24 mb-2" animate={animate} />
                <Skeleton className="h-6 w-16" animate={animate} />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
        <Skeleton className="h-6 w-32 mb-4" animate={animate} />
        <Skeleton className="h-64 w-full" animate={animate} />
      </div>
      
      {/* Table */}
      <TableSkeleton animate={animate} />
    </div>
  )
}

// Agent list skeleton
export function AgentListSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <AvatarSkeleton size="lg" animate={animate} />
              <div className="flex-1">
                <Skeleton className="h-6 w-48 mb-2" animate={animate} />
                <Skeleton className="h-4 w-32 mb-3" animate={animate} />
                <TextSkeleton lines={2} animate={animate} />
              </div>
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-20" animate={animate} />
              <Skeleton className="h-8 w-8" animate={animate} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Conversation list skeleton
export function ConversationListSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <AvatarSkeleton size="sm" animate={animate} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" animate={animate} />
                <Skeleton className="h-3 w-16" animate={animate} />
              </div>
              <Skeleton className="h-3 w-48 mt-1" animate={animate} />
            </div>
            <Skeleton className="h-2 w-2" rounded animate={animate} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Chat message skeleton
export function ChatMessageSkeleton({ animate = true, isUser = false }: { animate?: boolean; isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2 max-w-xs lg:max-w-md`}>
        {!isUser && <AvatarSkeleton size="sm" animate={animate} />}
        <div className={`px-4 py-2 rounded-lg ${
          isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 dark:bg-gray-700'
        }`}>
          <TextSkeleton lines={Math.floor(Math.random() * 3) + 1} animate={animate} />
        </div>
      </div>
    </div>
  )
}

// Chat skeleton
export function ChatSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-3">
          <AvatarSkeleton animate={animate} />
          <div>
            <Skeleton className="h-5 w-32 mb-1" animate={animate} />
            <Skeleton className="h-3 w-20" animate={animate} />
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {Array.from({ length: 6 }).map((_, index) => (
          <ChatMessageSkeleton 
            key={index} 
            animate={animate} 
            isUser={index % 3 === 0} 
          />
        ))}
      </div>
      
      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <Skeleton className="h-10 w-full" animate={animate} />
      </div>
    </div>
  )
}

// Analytics skeleton
export function AnalyticsSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-48 mb-2" animate={animate} />
        <Skeleton className="h-4 w-80" animate={animate} />
      </div>
      
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex space-x-4">
            <Skeleton className="h-10 w-32" animate={animate} />
            <Skeleton className="h-10 w-32" animate={animate} />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-24" animate={animate} />
            <Skeleton className="h-10 w-32" animate={animate} />
            <Skeleton className="h-10 w-20" animate={animate} />
          </div>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div className="flex items-center">
              <Skeleton className="h-6 w-6" animate={animate} />
              <div className="ml-5 flex-1">
                <Skeleton className="h-4 w-24 mb-2" animate={animate} />
                <div className="flex items-center">
                  <Skeleton className="h-6 w-16 mr-2" animate={animate} />
                  <Skeleton className="h-4 w-12" animate={animate} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" animate={animate} />
          <div className="flex space-x-4">
            <Skeleton className="h-8 w-24" animate={animate} />
            <div className="flex space-x-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-16" animate={animate} />
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="h-96 w-full" animate={animate} />
      </div>
    </div>
  )
}

// Form skeleton
interface FormSkeletonProps {
  fields?: number
  animate?: boolean
  className?: string
}

export function FormSkeleton({ fields = 5, animate = true, className = '' }: FormSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index}>
          <Skeleton className="h-4 w-24 mb-2" animate={animate} />
          <Skeleton className="h-10 w-full" animate={animate} />
        </div>
      ))}
      
      <div className="flex justify-end space-x-3 pt-4">
        <Skeleton className="h-10 w-20" animate={animate} />
        <Skeleton className="h-10 w-24" animate={animate} />
      </div>
    </div>
  )
}

// Settings skeleton
export function SettingsSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-32 mb-2" animate={animate} />
        <Skeleton className="h-4 w-64" animate={animate} />
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <div className="flex space-x-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-16 mb-4" animate={animate} />
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-6">
          <FormSkeleton fields={6} animate={animate} />
        </div>
      </div>
    </div>
  )
}

// List skeleton with search
export function ListWithSearchSkeleton({ animate = true }: { animate?: boolean }) {
  return (
    <div>
      {/* Search and filters */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <Skeleton className="h-10 w-64" animate={animate} />
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-24" animate={animate} />
            <Skeleton className="h-10 w-32" animate={animate} />
          </div>
        </div>
      </div>
      
      {/* List items */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <CardSkeleton key={index} showAvatar animate={animate} />
        ))}
      </div>
    </div>
  )
}

// Loading overlay
interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  className?: string
  animate?: boolean
}

export function LoadingOverlay({ isLoading, children, className = '', animate = true }: LoadingOverlayProps) {
  if (!isLoading) {
    return <>{children}</>
  }
  
  return (
    <div className={`relative ${className}`}>
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50">
        <div className="flex items-center space-x-3">
          <div className={`h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full ${animate ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Loading...</span>
        </div>
      </div>
    </div>
  )
}

export default {
  Skeleton,
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  AgentListSkeleton,
  ConversationListSkeleton,
  ChatMessageSkeleton,
  ChatSkeleton,
  AnalyticsSkeleton,
  FormSkeleton,
  SettingsSkeleton,
  ListWithSearchSkeleton,
  LoadingOverlay
}