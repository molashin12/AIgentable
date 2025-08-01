import React, { useState, useEffect } from 'react'
import {
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useChannels, Channel } from '../hooks/useChannels'
import { ChannelStats, WidgetConfig } from '../types/channel'



const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    case 'CONFIGURING':
      return <ClockIcon className="h-5 w-5 text-yellow-500" />
    case 'INACTIVE':
      return <XCircleIcon className="h-5 w-5 text-red-500" />
    case 'ERROR':
      return <XCircleIcon className="h-5 w-5 text-red-600" />
    default:
      return <XCircleIcon className="h-5 w-5 text-gray-500" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800'
    case 'CONFIGURING':
      return 'bg-yellow-100 text-yellow-800'
    case 'INACTIVE':
      return 'bg-red-100 text-red-800'
    case 'ERROR':
      return 'bg-red-200 text-red-900'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getChannelIcon = (type: string) => {
  switch (type) {
    case 'WHATSAPP':
      return '💬'
    case 'TELEGRAM':
      return '✈️'
    case 'SLACK':
      return '💼'
    case 'DISCORD':
      return '🎮'
    case 'EMAIL':
      return '📧'
    case 'SMS':
      return '📱'
    case 'WEB_CHAT':
      return '🌐'
    default:
      return '💬'
  }
}

const getChannelDescription = (type: string) => {
  switch (type) {
    case 'WHATSAPP':
      return 'WhatsApp Business integration'
    case 'TELEGRAM':
      return 'Telegram bot integration'
    case 'SLACK':
      return 'Slack workspace integration'
    case 'DISCORD':
      return 'Discord server integration'
    case 'EMAIL':
      return 'Email support integration'
    case 'SMS':
      return 'SMS messaging integration'
    case 'WEB_CHAT':
      return 'Website chat widget'
    default:
      return 'Channel integration'
  }
}

export default function ChannelIntegration() {
  const { channels, loading, error, fetchChannels, updateChannel } = useChannels()
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [showWidgetCode, setShowWidgetCode] = useState(false)
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    theme: 'light',
    position: 'bottom-right',
    primaryColor: '#3B82F6',
    greetingMessage: 'Hello! How can I help you today?'
  })

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const connectChannel = async (channelId: string) => {
    try {
      await updateChannel(channelId, { status: 'ACTIVE' })
      toast.success('Channel connected successfully!')
    } catch (error) {
      toast.error('Failed to connect channel')
    }
  }

  const disconnectChannel = async (channelId: string) => {
    try {
      await updateChannel(channelId, { status: 'INACTIVE' })
      toast.success('Channel disconnected')
    } catch (error) {
      toast.error('Failed to disconnect channel')
    }
  }

  const generateWidgetCode = () => {
    const positionStyles = widgetConfig.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;';
    const horizontalStyles = widgetConfig.position.includes('right') ? 'right: 20px;' : 'left: 20px;';
    
    return `<!-- AIgentable Chat Widget -->
<script>
  (function() {
    var widget = document.createElement('div');
    widget.id = 'aigentable-widget';
    widget.style.cssText = '
      position: fixed;
      ${positionStyles}
      ${horizontalStyles}
      width: 350px;
      height: 500px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 9999;
    ';
    
    var iframe = document.createElement('iframe');
    iframe.src = 'https://widget.aigentable.com/chat?theme=${widgetConfig.theme}&color=${encodeURIComponent(widgetConfig.primaryColor)}&greeting=${encodeURIComponent(widgetConfig.greetingMessage)}';
    iframe.style.cssText = 'width: 100%; height: 100%; border: none; border-radius: 12px;';
    
    widget.appendChild(iframe);
    document.body.appendChild(widget);
  })();
</script>`;
  }

  const connectedChannels = channels?.filter(c => c.status === 'ACTIVE').length || 0
  const totalConversations = channels?.reduce((sum, c) => sum + c.statistics.totalConversations, 0) || 0

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-500">Loading channels...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-red-500">Error loading channels: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Channel Integration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your AI agents to multiple communication channels and manage omnichannel experiences.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Connected Channels</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{connectedChannels}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <GlobeAltIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Conversations</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{totalConversations}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DevicePhoneMobileIcon className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Agents</dt>
                  <dd className="text-2xl font-semibold text-gray-900">12</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Generator */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Website Widget Generator</h3>
          <p className="text-sm text-gray-500 mb-6">
            Customize and generate embed code for your website chat widget.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Theme</label>
                <select
                  value={widgetConfig.theme}
                  onChange={(e) => setWidgetConfig({...widgetConfig, theme: e.target.value as 'light' | 'dark'})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Position</label>
                <select
                  value={widgetConfig.position}
                  onChange={(e) => setWidgetConfig({...widgetConfig, position: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Primary Color</label>
                <input
                  type="color"
                  value={widgetConfig.primaryColor}
                  onChange={(e) => setWidgetConfig({...widgetConfig, primaryColor: e.target.value})}
                  className="mt-1 block w-full h-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Greeting Message</label>
                <input
                  type="text"
                  value={widgetConfig.greetingMessage}
                  onChange={(e) => setWidgetConfig({...widgetConfig, greetingMessage: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Hello! How can I help you today?"
                />
              </div>
              
              <button
                onClick={() => setShowWidgetCode(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <CodeBracketIcon className="-ml-1 mr-2 h-4 w-4" />
                Generate Code
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
              <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">AI</span>
                  </div>
                  <div className="ml-2">
                    <div className="text-sm font-medium">AI Assistant</div>
                    <div className="text-xs text-green-500">Online</div>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-lg p-3 mb-3">
                  <p className="text-sm text-gray-700">{widgetConfig.greetingMessage}</p>
                </div>
                <div className="flex">
                  <input
                    type="text"
                    placeholder="Type your message here..."
                    className="flex-1 text-sm border border-gray-300 rounded-l-md px-3 py-2"
                    disabled
                  />
                  <button 
                    className="px-3 py-2 text-white rounded-r-md"
                    style={{ backgroundColor: widgetConfig.primaryColor }}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Channels List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Available Channels</h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channels?.map((channel) => (
              <div key={channel.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{getChannelIcon(channel.type)}</span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{channel.name}</h4>
                      <p className="text-xs text-gray-500">{getChannelDescription(channel.type)}</p>
                    </div>
                  </div>
                  {getStatusIcon(channel.status)}
                </div>
                
                <div className="mb-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(channel.status)}`}>
                    {channel.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
                  <div>
                    <span className="font-medium">Conversations:</span> {channel.statistics.totalConversations}
                  </div>
                  <div>
                    <span className="font-medium">Last Activity:</span> {new Date(channel.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {channel.status === 'ACTIVE' ? (
                    <>
                      <button
                        onClick={() => setSelectedChannel(channel)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Cog6ToothIcon className="-ml-1 mr-1 h-3 w-3" />
                        Configure
                      </button>
                      <button
                        onClick={() => disconnectChannel(channel.id)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => connectChannel(channel.id)}
                      className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Widget Code Modal */}
      {showWidgetCode && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Widget Embed Code</h3>
              <p className="text-sm text-gray-500 mb-4">
                Copy and paste this code into your website's HTML, preferably before the closing &lt;/body&gt; tag.
              </p>
              
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <pre className="text-green-400 text-sm overflow-x-auto">
                  <code>{generateWidgetCode()}</code>
                </pre>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowWidgetCode(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateWidgetCode())
                    toast.success('Code copied to clipboard!')
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Copy Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Configuration Modal */}
      {selectedChannel && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Configure {selectedChannel.name}
              </h3>
              
              <div className="space-y-4">
                {selectedChannel.type === 'WHATSAPP' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                      <input
                        type="text"
                        defaultValue={selectedChannel.config.phoneNumber}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="+1234567890"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">API Key</label>
                      <input
                        type="password"
                        defaultValue={selectedChannel.config.apiKey}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter WhatsApp Business API key"
                      />
                    </div>
                  </>
                )}
                
                {selectedChannel.type === 'SLACK' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Page ID</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter Facebook Page ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Page Access Token</label>
                      <input
                        type="password"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter Page Access Token"
                      />
                    </div>
                  </>
                )}
                
                {selectedChannel.type === 'TELEGRAM' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Bot Token</label>
                    <input
                      type="password"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter Telegram Bot Token"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedChannel(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setSelectedChannel(null)
                    toast.success('Channel configuration saved!')
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}