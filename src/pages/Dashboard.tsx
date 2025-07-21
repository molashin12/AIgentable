import {
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ChartBarIcon,
  PlusIcon,
  DocumentArrowUpIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const metrics = [
  {
    name: 'Active Agents',
    value: '12',
    change: '+2.5%',
    changeType: 'positive',
    icon: CpuChipIcon,
  },
  {
    name: 'Conversations Today',
    value: '1,247',
    change: '+12.3%',
    changeType: 'positive',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Response Accuracy',
    value: '94.2%',
    change: '+1.2%',
    changeType: 'positive',
    icon: ChartBarIcon,
  },
  {
    name: 'Active Users',
    value: '342',
    change: '+5.7%',
    changeType: 'positive',
    icon: UserGroupIcon,
  },
]

const conversationData = [
  { name: 'Mon', conversations: 120, resolved: 110 },
  { name: 'Tue', conversations: 150, resolved: 140 },
  { name: 'Wed', conversations: 180, resolved: 165 },
  { name: 'Thu', conversations: 200, resolved: 185 },
  { name: 'Fri', conversations: 240, resolved: 220 },
  { name: 'Sat', conversations: 160, resolved: 145 },
  { name: 'Sun', conversations: 130, resolved: 120 },
]

const channelData = [
  { name: 'WhatsApp', value: 45 },
  { name: 'Website', value: 30 },
  { name: 'Facebook', value: 15 },
  { name: 'Telegram', value: 10 },
]

const quickActions = [
  {
    name: 'Create New Agent',
    description: 'Build a custom AI agent for your business',
    icon: PlusIcon,
    href: '/agents',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    name: 'Upload Training Data',
    description: 'Add new documents to train your agents',
    icon: DocumentArrowUpIcon,
    href: '/training',
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    name: 'View Conversations',
    description: 'Monitor live conversations and agent performance',
    icon: EyeIcon,
    href: '/conversations',
    color: 'bg-purple-500 hover:bg-purple-600',
  },
]

const recentAgents = [
  { name: 'Sales Assistant', status: 'Active', conversations: 45, accuracy: '96%' },
  { name: 'Support Bot', status: 'Active', conversations: 32, accuracy: '94%' },
  { name: 'Lead Qualifier', status: 'Training', conversations: 0, accuracy: 'N/A' },
]

import { useLanguage } from '../contexts/LanguageContext'

export default function Dashboard() {
  const { t } = useLanguage()
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('dashboard.welcome')}
        </p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {metrics.map((metric) => (
          <div key={metric.name} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <metric.icon className="h-6 w-6 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{metric.name}</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">{metric.value}</div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600 dark:text-green-400">
                        {metric.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((action) => (
            <a
              key={action.name}
              href={action.href}
              className="relative group bg-white dark:bg-gray-800 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <div>
                <span className={`rounded-lg inline-flex p-3 ${action.color} text-white`}>
                  <action.icon className="h-6 w-6" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  <span className="absolute inset-0" aria-hidden="true" />
                  {action.name}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{action.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Conversation Trends */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.conversationTrends')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={conversationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="conversations" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Performance */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.channelPerformance')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Agents */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('dashboard.recentAgents')}</h3>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.agentName')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.conversations')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('dashboard.accuracy')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {recentAgents.map((agent, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {agent.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          agent.status === 'Active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {agent.conversations}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {agent.accuracy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}