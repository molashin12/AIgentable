import { useState } from 'react'
import {
  ChartBarIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays } from 'date-fns'

interface MetricCard {
  title: string
  value: string
  change: string
  changeType: 'increase' | 'decrease'
  icon: React.ComponentType<any>
}

const conversationData = [
  { date: '2024-01-08', conversations: 45, resolved: 38, escalated: 7 },
  { date: '2024-01-09', conversations: 52, resolved: 44, escalated: 8 },
  { date: '2024-01-10', conversations: 48, resolved: 41, escalated: 7 },
  { date: '2024-01-11', conversations: 61, resolved: 53, escalated: 8 },
  { date: '2024-01-12', conversations: 58, resolved: 49, escalated: 9 },
  { date: '2024-01-13', conversations: 67, resolved: 58, escalated: 9 },
  { date: '2024-01-14', conversations: 72, resolved: 63, escalated: 9 },
]

const responseTimeData = [
  { hour: '00:00', avgTime: 2.3 },
  { hour: '04:00', avgTime: 1.8 },
  { hour: '08:00', avgTime: 3.2 },
  { hour: '12:00', avgTime: 4.1 },
  { hour: '16:00', avgTime: 3.8 },
  { hour: '20:00', avgTime: 2.9 },
]

const channelData = [
  { name: 'WhatsApp', value: 35, color: '#25D366' },
  { name: 'Website', value: 28, color: '#3B82F6' },
  { name: 'Facebook', value: 22, color: '#1877F2' },
  { name: 'Telegram', value: 15, color: '#0088CC' },
]

const agentPerformanceData = [
  { name: 'Sales Assistant', conversations: 156, satisfaction: 4.8, responseTime: 2.1 },
  { name: 'Support Bot', conversations: 134, satisfaction: 4.6, responseTime: 1.8 },
  { name: 'Lead Qualifier', conversations: 98, satisfaction: 4.7, responseTime: 2.3 },
  { name: 'FAQ Helper', conversations: 87, satisfaction: 4.5, responseTime: 1.5 },
]

const satisfactionTrendData = [
  { date: '2024-01-08', satisfaction: 4.2 },
  { date: '2024-01-09', satisfaction: 4.3 },
  { date: '2024-01-10', satisfaction: 4.1 },
  { date: '2024-01-11', satisfaction: 4.4 },
  { date: '2024-01-12', satisfaction: 4.6 },
  { date: '2024-01-13', satisfaction: 4.7 },
  { date: '2024-01-14', satisfaction: 4.8 },
]

const metricCards: MetricCard[] = [
  {
    title: 'Total Conversations',
    value: '2,847',
    change: '+12.5%',
    changeType: 'increase',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    title: 'Avg Response Time',
    value: '2.3s',
    change: '-8.2%',
    changeType: 'decrease',
    icon: undefined
  },
  {
    title: 'Customer Satisfaction',
    value: '4.7/5',
    change: '+5.1%',
    changeType: 'increase',
    icon: UserGroupIcon,
  },
  {
    title: 'Resolution Rate',
    value: '87.3%',
    change: '+3.4%',
    changeType: 'increase',
    icon: ChartBarIcon,
  },
]

export default function Analytics() {
  const [dateRange, setDateRange] = useState('7d')
  const [selectedMetric, setSelectedMetric] = useState('conversations')

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM dd')
  }

  const formatHour = (hourStr: string) => {
    return hourStr
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Insights</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track performance metrics, conversation trends, and agent effectiveness.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <CalendarIcon className="-ml-1 mr-2 h-4 w-4" />
              Custom Range
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {metricCards.map((metric, index) => {
          const IconComponent = metric.icon || ClockIcon
          return (
            <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <IconComponent className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{metric.title}</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{metric.value}</div>
                        <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                          metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {metric.changeType === 'increase' ? (
                            <ArrowTrendingUpIcon className="self-center flex-shrink-0 h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowTrendingDownIcon className="self-center flex-shrink-0 h-4 w-4 text-red-500" />
                          )}
                          <span className="ml-1">{metric.change}</span>
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Conversation Trends */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Conversation Trends</h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="conversations">Total Conversations</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={conversationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip 
                labelFormatter={(value) => formatDate(value as string)}
              />
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Response Time by Hour */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Average Response Time by Hour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tickFormatter={formatHour}
                fontSize={12}
              />
              <YAxis 
                label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }}
                fontSize={12}
              />
              <Tooltip 
                formatter={(value) => [`${value}s`, 'Response Time']}
              />
              <Line
                type="monotone"
                dataKey="avgTime"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversations by Channel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={channelData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {channelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Satisfaction Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Satisfaction Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={satisfactionTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                fontSize={12}
              />
              <YAxis 
                domain={[3.5, 5]}
                label={{ value: 'Rating', angle: -90, position: 'insideLeft' }}
                fontSize={12}
              />
              <Tooltip 
                labelFormatter={(value) => formatDate(value as string)}
                formatter={(value) => [`${value}/5`, 'Satisfaction']}
              />
              <Line
                type="monotone"
                dataKey="satisfaction"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Agent Performance</h3>
          <p className="mt-1 text-sm text-gray-500">
            Compare performance metrics across all your AI agents.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Satisfaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agentPerformanceData.map((agent, index) => {
                const performanceScore = ((agent.satisfaction / 5) * 0.4 + 
                                        (agent.conversations / 200) * 0.3 + 
                                        (3 / agent.responseTime) * 0.3) * 100
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-blue-600 font-medium text-sm">
                            {agent.name.charAt(0)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agent.conversations.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">{agent.satisfaction}/5</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`text-sm ${
                                i < Math.floor(agent.satisfaction) ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agent.responseTime}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(performanceScore, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">
                          {Math.round(performanceScore)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Export Reports</h3>
            <p className="mt-1 text-sm text-gray-500">
              Download detailed analytics reports for further analysis.
            </p>
          </div>
          <div className="flex space-x-3">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Export CSV
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Export PDF
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
              Schedule Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}