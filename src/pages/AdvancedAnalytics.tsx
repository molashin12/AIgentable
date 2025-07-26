import { useState, useEffect } from 'react'
import {
  ChartBarIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  DocumentChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'
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

interface DateRange {
  start: string
  end: string
  preset?: string
}

interface MetricFilter {
  id: string
  name: string
  type: 'number' | 'percentage' | 'duration' | 'count'
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between'
  value: number | [number, number]
  enabled: boolean
}

interface CustomMetric {
  id: string
  name: string
  description: string
  formula: string
  category: string
  dataType: 'number' | 'percentage' | 'duration'
  enabled: boolean
  createdAt: string
}

interface AnalyticsData {
  conversations: {
    total: number
    completed: number
    escalated: number
    averageDuration: number
    satisfactionScore: number
    trend: number
  }
  agents: {
    total: number
    active: number
    trainingHours: number
    averageResponseTime: number
    accuracyScore: number
    trend: number
  }
  users: {
    total: number
    active: number
    newUsers: number
    retentionRate: number
    engagementScore: number
    trend: number
  }
  performance: {
    uptime: number
    errorRate: number
    averageLatency: number
    throughput: number
    cpuUsage: number
    memoryUsage: number
  }
}

interface ChartData {
  name: string
  conversations: number
  agents: number
  users: number
  satisfaction: number
  responseTime: number
  errorRate: number
}

const mockAnalyticsData: AnalyticsData = {
  conversations: {
    total: 15420,
    completed: 13890,
    escalated: 1530,
    averageDuration: 8.5,
    satisfactionScore: 4.2,
    trend: 12.5
  },
  agents: {
    total: 45,
    active: 38,
    trainingHours: 1250,
    averageResponseTime: 2.3,
    accuracyScore: 94.8,
    trend: 8.2
  },
  users: {
    total: 8920,
    active: 3450,
    newUsers: 890,
    retentionRate: 78.5,
    engagementScore: 85.2,
    trend: -2.1
  },
  performance: {
    uptime: 99.8,
    errorRate: 0.2,
    averageLatency: 145,
    throughput: 2340,
    cpuUsage: 65.4,
    memoryUsage: 72.1
  }
}

const mockChartData: ChartData[] = [
  { name: 'Jan', conversations: 1200, agents: 35, users: 2800, satisfaction: 4.1, responseTime: 2.8, errorRate: 0.3 },
  { name: 'Feb', conversations: 1350, agents: 38, users: 3100, satisfaction: 4.0, responseTime: 2.5, errorRate: 0.25 },
  { name: 'Mar', conversations: 1480, agents: 42, users: 3400, satisfaction: 4.2, responseTime: 2.4, errorRate: 0.2 },
  { name: 'Apr', conversations: 1620, agents: 45, users: 3650, satisfaction: 4.3, responseTime: 2.2, errorRate: 0.18 },
  { name: 'May', conversations: 1750, agents: 45, users: 3890, satisfaction: 4.1, responseTime: 2.3, errorRate: 0.22 },
  { name: 'Jun', conversations: 1890, agents: 45, users: 4120, satisfaction: 4.4, responseTime: 2.1, errorRate: 0.15 }
]

const mockCustomMetrics: CustomMetric[] = [
  {
    id: 'metric_1',
    name: 'Agent Efficiency Score',
    description: 'Measures agent performance based on response time and accuracy',
    formula: '(accuracy_score * 0.7) + ((1 / response_time) * 0.3) * 100',
    category: 'Performance',
    dataType: 'percentage',
    enabled: true,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 'metric_2',
    name: 'Customer Satisfaction Index',
    description: 'Composite score of satisfaction rating and resolution rate',
    formula: '(satisfaction_score * 0.6) + (resolution_rate * 0.4)',
    category: 'Customer Experience',
    dataType: 'number',
    enabled: true,
    createdAt: '2024-01-10T14:30:00Z'
  },
  {
    id: 'metric_3',
    name: 'Training ROI',
    description: 'Return on investment for agent training programs',
    formula: '((post_training_performance - pre_training_performance) / training_cost) * 100',
    category: 'Training',
    dataType: 'percentage',
    enabled: false,
    createdAt: '2024-01-05T09:15:00Z'
  }
]

const datePresets = [
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'Last 3 months', value: 'last_3_months' },
  { label: 'Last 6 months', value: 'last_6_months' },
  { label: 'Last year', value: 'last_year' },
  { label: 'Year to date', value: 'ytd' },
  { label: 'Custom range', value: 'custom' }
]

const exportFormats = [
  { label: 'CSV', value: 'csv', icon: DocumentChartBarIcon },
  { label: 'Excel', value: 'xlsx', icon: DocumentChartBarIcon },
  { label: 'PDF Report', value: 'pdf', icon: DocumentChartBarIcon },
  { label: 'JSON', value: 'json', icon: DocumentChartBarIcon }
]

const chartTypes = [
  { label: 'Line Chart', value: 'line' },
  { label: 'Area Chart', value: 'area' },
  { label: 'Bar Chart', value: 'bar' },
  { label: 'Pie Chart', value: 'pie' }
]

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

const getDateRange = (preset: string): DateRange => {
  const now = new Date()
  const start = new Date()
  
  switch (preset) {
    case 'last_7_days':
      start.setDate(now.getDate() - 7)
      break
    case 'last_30_days':
      start.setDate(now.getDate() - 30)
      break
    case 'last_3_months':
      start.setMonth(now.getMonth() - 3)
      break
    case 'last_6_months':
      start.setMonth(now.getMonth() - 6)
      break
    case 'last_year':
      start.setFullYear(now.getFullYear() - 1)
      break
    case 'ytd':
      start.setMonth(0, 1)
      break
    default:
      start.setDate(now.getDate() - 30)
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
    preset
  }
}

export default function AdvancedAnalytics() {
  const { t } = useLanguage()
  const [analyticsData] = useState<AnalyticsData>(mockAnalyticsData)
  const [chartData] = useState<ChartData[]>(mockChartData)
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>(mockCustomMetrics)
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('last_30_days'))
  const [metricFilters, setMetricFilters] = useState<MetricFilter[]>([])
  const [selectedChartType, setSelectedChartType] = useState('line')
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [showMetricModal, setShowMetricModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['conversations', 'satisfaction', 'responseTime'])
  const [isLoading, setIsLoading] = useState(false)
  
  const [newMetric, setNewMetric] = useState({
    name: '',
    description: '',
    formula: '',
    category: 'Performance',
    dataType: 'number' as 'number' | 'percentage' | 'duration'
  })
  
  const [newFilter, setNewFilter] = useState({
    name: '',
    type: 'number' as 'number' | 'percentage' | 'duration' | 'count',
    operator: 'gt' as 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between',
    value: 0
  })

  const handleDateRangeChange = (preset: string) => {
    if (preset === 'custom') {
      setDateRange({ ...dateRange, preset })
    } else {
      setDateRange(getDateRange(preset))
    }
  }

  const handleCustomDateChange = (field: 'start' | 'end', value: string) => {
    setDateRange({ ...dateRange, [field]: value })
  }

  const handleAddFilter = () => {
    if (!newFilter.name) {
      toast.error('Please provide a filter name')
      return
    }

    const filter: MetricFilter = {
      id: `filter_${Date.now()}`,
      name: newFilter.name,
      type: newFilter.type,
      operator: newFilter.operator,
      value: newFilter.value,
      enabled: true
    }

    setMetricFilters(prev => [...prev, filter])
    setNewFilter({ name: '', type: 'number', operator: 'gt', value: 0 })
    toast.success('Filter added successfully')
  }

  const handleRemoveFilter = (filterId: string) => {
    setMetricFilters(prev => prev.filter(f => f.id !== filterId))
    toast.success('Filter removed')
  }

  const handleToggleFilter = (filterId: string) => {
    setMetricFilters(prev => prev.map(f => 
      f.id === filterId ? { ...f, enabled: !f.enabled } : f
    ))
  }

  const handleCreateMetric = () => {
    if (!newMetric.name || !newMetric.formula) {
      toast.error('Please provide metric name and formula')
      return
    }

    const metric: CustomMetric = {
      id: `metric_${Date.now()}`,
      name: newMetric.name,
      description: newMetric.description,
      formula: newMetric.formula,
      category: newMetric.category,
      dataType: newMetric.dataType,
      enabled: true,
      createdAt: new Date().toISOString()
    }

    setCustomMetrics(prev => [...prev, metric])
    setNewMetric({ name: '', description: '', formula: '', category: 'Performance', dataType: 'number' })
    setShowMetricModal(false)
    toast.success('Custom metric created successfully')
  }

  const handleDeleteMetric = (metricId: string) => {
    setCustomMetrics(prev => prev.filter(m => m.id !== metricId))
    toast.success('Custom metric deleted')
  }

  const handleToggleMetric = (metricId: string) => {
    setCustomMetrics(prev => prev.map(m => 
      m.id === metricId ? { ...m, enabled: !m.enabled } : m
    ))
  }

  const handleExport = (format: string) => {
    setIsLoading(true)
    
    // Simulate export process
    setTimeout(() => {
      setIsLoading(false)
      setShowExportModal(false)
      toast.success(`Analytics exported as ${format.toUpperCase()}`)
    }, 2000)
  }

  const handleApplyFilters = () => {
    setIsLoading(true)
    
    // Simulate filter application
    setTimeout(() => {
      setIsLoading(false)
      setShowFiltersModal(false)
      toast.success('Filters applied successfully')
    }, 1000)
  }

  const renderChart = () => {
    const commonProps = {
      width: '100%',
      height: 400,
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (selectedChartType) {
      case 'area':
        return (
          <ResponsiveContainer {...commonProps}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.includes('conversations') && (
                <Area type="monotone" dataKey="conversations" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
              )}
              {selectedMetrics.includes('satisfaction') && (
                <Area type="monotone" dataKey="satisfaction" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              )}
              {selectedMetrics.includes('responseTime') && (
                <Area type="monotone" dataKey="responseTime" stackId="3" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.includes('conversations') && (
                <Bar dataKey="conversations" fill="#3B82F6" />
              )}
              {selectedMetrics.includes('satisfaction') && (
                <Bar dataKey="satisfaction" fill="#10B981" />
              )}
              {selectedMetrics.includes('responseTime') && (
                <Bar dataKey="responseTime" fill="#F59E0B" />
              )}
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'pie':
        const pieData = [
          { name: 'Completed', value: analyticsData.conversations.completed, color: '#10B981' },
          { name: 'Escalated', value: analyticsData.conversations.escalated, color: '#F59E0B' },
          { name: 'In Progress', value: analyticsData.conversations.total - analyticsData.conversations.completed - analyticsData.conversations.escalated, color: '#3B82F6' }
        ]
        
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )
      
      default: // line
        return (
          <ResponsiveContainer {...commonProps}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.includes('conversations') && (
                <Line type="monotone" dataKey="conversations" stroke="#3B82F6" strokeWidth={2} />
              )}
              {selectedMetrics.includes('satisfaction') && (
                <Line type="monotone" dataKey="satisfaction" stroke="#10B981" strokeWidth={2} />
              )}
              {selectedMetrics.includes('responseTime') && (
                <Line type="monotone" dataKey="responseTime" stroke="#F59E0B" strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        )
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Deep insights with custom metrics, advanced filtering, and data export capabilities
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Date Range */}
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                <select
                  value={dateRange.preset || 'custom'}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  {datePresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              
              {dateRange.preset === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFiltersModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <FunnelIcon className="-ml-1 mr-2 h-5 w-5" />
                Filters ({metricFilters.filter(f => f.enabled).length})
              </button>
              
              <button
                onClick={() => setShowMetricModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                Custom Metric
              </button>
              
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Conversations</dt>
                  <dd className="flex items-center">
                    <div className="text-lg font-medium text-gray-900 dark:text-white">{analyticsData.conversations.total.toLocaleString()}</div>
                    <div className={`ml-2 flex items-center text-sm ${
                      analyticsData.conversations.trend > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {analyticsData.conversations.trend > 0 ? (
                        <ArrowTrendingUpIcon className="h-4 w-4" />
                      ) : (
                        <ArrowTrendingDownIcon className="h-4 w-4" />
                      )}
                      {Math.abs(analyticsData.conversations.trend)}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Agents</dt>
                  <dd className="flex items-center">
                    <div className="text-lg font-medium text-gray-900 dark:text-white">{analyticsData.agents.active}</div>
                    <div className={`ml-2 flex items-center text-sm ${
                      analyticsData.agents.trend > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {analyticsData.agents.trend > 0 ? (
                        <ArrowTrendingUpIcon className="h-4 w-4" />
                      ) : (
                        <ArrowTrendingDownIcon className="h-4 w-4" />
                      )}
                      {Math.abs(analyticsData.agents.trend)}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Satisfaction Score</dt>
                  <dd className="flex items-center">
                    <div className="text-lg font-medium text-gray-900 dark:text-white">{analyticsData.conversations.satisfactionScore}/5</div>
                    <div className="ml-2 flex items-center text-sm text-green-600">
                      <ArrowTrendingUpIcon className="h-4 w-4" />
                      2.1%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Avg Response Time</dt>
                  <dd className="flex items-center">
                    <div className="text-lg font-medium text-gray-900 dark:text-white">{analyticsData.agents.averageResponseTime}s</div>
                    <div className="ml-2 flex items-center text-sm text-green-600">
                      <ArrowTrendingDownIcon className="h-4 w-4" />
                      5.2%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 mb-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Analytics Overview</h3>
            
            <div className="flex space-x-4">
              {/* Chart Type Selector */}
              <select
                value={selectedChartType}
                onChange={(e) => setSelectedChartType(e.target.value)}
                className="border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                {chartTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              
              {/* Metric Selector */}
              <div className="flex space-x-2">
                {['conversations', 'satisfaction', 'responseTime'].map((metric) => (
                  <button
                    key={metric}
                    onClick={() => {
                      if (selectedMetrics.includes(metric)) {
                        setSelectedMetrics(prev => prev.filter(m => m !== metric))
                      } else {
                        setSelectedMetrics(prev => [...prev, metric])
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedMetrics.includes(metric)
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {metric}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="h-96">
            {renderChart()}
          </div>
        </div>
      </div>

      {/* Custom Metrics */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Custom Metrics</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            User-defined metrics and calculations
          </p>
        </div>
        
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {customMetrics.map((metric) => (
            <li key={metric.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">{metric.name}</h4>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        metric.enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {metric.enabled ? 'Active' : 'Inactive'}
                      </span>
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        {metric.category}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{metric.description}</div>
                    <div className="mt-1 text-xs text-gray-400 font-mono">{metric.formula}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleMetric(metric.id)}
                    className={`p-2 ${metric.enabled ? 'text-yellow-400 hover:text-yellow-600' : 'text-green-400 hover:text-green-600'} dark:hover:text-yellow-300`}
                    title={metric.enabled ? 'Disable' : 'Enable'}
                  >
                    {metric.enabled ? <ExclamationTriangleIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteMetric(metric.id)}
                    className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-screen overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Advanced Filters</h3>
              
              {/* Existing Filters */}
              <div className="space-y-4 mb-6">
                {metricFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={filter.enabled}
                        onChange={() => handleToggleFilter(filter.id)}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{filter.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {filter.type} {filter.operator} {Array.isArray(filter.value) ? filter.value.join(' - ') : filter.value}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFilter(filter.id)}
                      className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Add New Filter */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Add New Filter</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Filter Name</label>
                    <input
                      type="text"
                      value={newFilter.name}
                      onChange={(e) => setNewFilter({...newFilter, name: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="Response Time"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Type</label>
                    <select
                      value={newFilter.type}
                      onChange={(e) => setNewFilter({...newFilter, type: e.target.value as any})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="number">Number</option>
                      <option value="percentage">Percentage</option>
                      <option value="duration">Duration</option>
                      <option value="count">Count</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Operator</label>
                    <select
                      value={newFilter.operator}
                      onChange={(e) => setNewFilter({...newFilter, operator: e.target.value as any})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="gt">Greater than</option>
                      <option value="gte">Greater than or equal</option>
                      <option value="lt">Less than</option>
                      <option value="lte">Less than or equal</option>
                      <option value="eq">Equal to</option>
                      <option value="between">Between</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Value</label>
                    <input
                      type="number"
                      value={newFilter.value}
                      onChange={(e) => setNewFilter({...newFilter, value: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleAddFilter}
                  className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
                  Add Filter
                </button>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyFilters}
                  disabled={isLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Applying...' : 'Apply Filters'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Metric Modal */}
      {showMetricModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create Custom Metric</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Metric Name *</label>
                  <input
                    type="text"
                    value={newMetric.name}
                    onChange={(e) => setNewMetric({...newMetric, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="Customer Satisfaction Index"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={newMetric.description}
                    onChange={(e) => setNewMetric({...newMetric, description: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="Describe what this metric measures..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <select
                      value={newMetric.category}
                      onChange={(e) => setNewMetric({...newMetric, category: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="Performance">Performance</option>
                      <option value="Customer Experience">Customer Experience</option>
                      <option value="Training">Training</option>
                      <option value="Operations">Operations</option>
                      <option value="Financial">Financial</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Type</label>
                    <select
                      value={newMetric.dataType}
                      onChange={(e) => setNewMetric({...newMetric, dataType: e.target.value as any})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="number">Number</option>
                      <option value="percentage">Percentage</option>
                      <option value="duration">Duration</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Formula *</label>
                  <textarea
                    value={newMetric.formula}
                    onChange={(e) => setNewMetric({...newMetric, formula: e.target.value})}
                    rows={4}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="(satisfaction_score * 0.6) + (resolution_rate * 0.4)"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Use available variables: satisfaction_score, resolution_rate, response_time, accuracy_score, etc.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowMetricModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMetric}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Metric
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/3 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Export Analytics Data</h3>
              
              <div className="space-y-3">
                {exportFormats.map((format) => {
                  const IconComponent = format.icon
                  return (
                    <button
                      key={format.value}
                      onClick={() => handleExport(format.value)}
                      disabled={isLoading}
                      className="w-full flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      <IconComponent className="h-6 w-6 text-gray-400 mr-3" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{format.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format.value === 'csv' && 'Comma-separated values for spreadsheet applications'}
                          {format.value === 'xlsx' && 'Excel workbook with multiple sheets'}
                          {format.value === 'pdf' && 'Formatted report with charts and tables'}
                          {format.value === 'json' && 'Raw data in JSON format for developers'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}