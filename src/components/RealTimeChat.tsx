import React, { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, UserIcon, CpuChipIcon } from '@heroicons/react/24/outline'
import { useRealTimeMessages } from '../hooks/useRealTimeMessages'
import { useTypingIndicator } from '../hooks/useTypingIndicator'
import { useAuth } from '../contexts/AuthContext'
import { Message } from '../hooks/useConversations'
import { toast } from 'sonner'

interface RealTimeChatProps {
  conversationId: string
  initialMessages?: Message[]
  onNewMessage?: (message: Message) => void
  className?: string
  disabled?: boolean
}

interface TypingIndicatorProps {
  isVisible: boolean
  text: string
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible, text }) => {
  if (!isVisible) return null

  return (
    <div className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{text}</span>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex items-start space-x-3 ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        message.role === 'user' 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-500 text-white'
      }`}>
        {message.role === 'user' ? (
          <UserIcon className="w-4 h-4" />
        ) : (
          <CpuChipIcon className="w-4 h-4" />
        )}
      </div>
      
      <div className={`flex flex-col max-w-xs lg:max-w-md ${
        isOwn ? 'items-end' : 'items-start'
      }`}>
        <div className={`px-4 py-2 rounded-lg ${
          message.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

export const RealTimeChat: React.FC<RealTimeChatProps> = ({
  conversationId,
  initialMessages = [],
  onNewMessage,
  className = '',
  disabled = false
}) => {
  const { user } = useAuth()
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    isAgentTyping,
    isConnected,
    sendRealtimeMessage,
    addMessage,
    clearMessages
  } = useRealTimeMessages({
    conversationId,
    onNewMessage,
    onAgentResponse: (response) => {
      toast.success('Agent responded')
    }
  })

  const {
    typingText,
    isAnyoneTyping,
    startTyping,
    stopTyping
  } = useTypingIndicator({
    conversationId,
    currentUserId: user?.id,
    typingTimeout: 3000
  })

  // Load initial messages
  useEffect(() => {
    if (initialMessages.length > 0) {
      clearMessages()
      initialMessages.forEach(addMessage)
    }
  }, [initialMessages, addMessage, clearMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAgentTyping, isAnyoneTyping])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    
    if (e.target.value.trim() && !disabled) {
      startTyping()
    } else {
      stopTyping()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSendMessage = async () => {
    const content = inputValue.trim()
    if (!content || isSending || disabled) return

    setIsSending(true)
    setInputValue('')
    stopTyping()

    try {
      sendRealtimeMessage(content)
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
      setInputValue(content) // Restore input on error
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const allMessages = [...messages]
  const showTypingIndicator = isAgentTyping || isAnyoneTyping

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Connecting to real-time services...
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CpuChipIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Start a conversation with the AI agent
              </p>
            </div>
          </div>
        ) : (
          allMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.role === 'user'}
            />
          ))
        )}
        
        {/* Typing Indicators */}
        <TypingIndicator
          isVisible={showTypingIndicator}
          text={isAgentTyping ? 'AI is thinking...' : typingText}
        />
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={disabled ? 'Chat is disabled' : 'Type your message...'}
              disabled={disabled || isSending}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                minHeight: '40px',
                maxHeight: '120px',
                height: 'auto'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending || disabled || !isConnected}
            className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {!isConnected && (
          <p className="text-xs text-red-500 mt-2">
            Real-time features unavailable - messages will be sent when connection is restored
          </p>
        )}
      </div>
    </div>
  )
}

export default RealTimeChat