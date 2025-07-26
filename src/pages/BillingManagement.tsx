import { useState, useEffect } from 'react'
import {
  CreditCardIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface Subscription {
  id: string
  planId: string
  planName: string
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  amount: number
  currency: string
  interval: 'month' | 'year'
}

interface Plan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: string[]
  limits: {
    agents: number
    conversations: number
    documents: number
    apiCalls: number
  }
  popular?: boolean
}

interface PaymentMethod {
  id: string
  type: 'card' | 'bank_account'
  last4: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
}

interface Invoice {
  id: string
  number: string
  status: 'paid' | 'pending' | 'failed'
  amount: number
  currency: string
  date: string
  dueDate: string
  downloadUrl?: string
}

const mockSubscription: Subscription = {
  id: 'sub_1',
  planId: 'plan_pro',
  planName: 'Pro Plan',
  status: 'ACTIVE',
  currentPeriodStart: '2024-01-01T00:00:00Z',
  currentPeriodEnd: '2024-02-01T00:00:00Z',
  cancelAtPeriodEnd: false,
  amount: 99,
  currency: 'USD',
  interval: 'month'
}

const mockPlans: Plan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    price: 29,
    currency: 'USD',
    interval: 'month',
    features: [
      'Up to 3 AI agents',
      '1,000 conversations/month',
      'Basic analytics',
      'Email support',
      'Standard integrations'
    ],
    limits: {
      agents: 3,
      conversations: 1000,
      documents: 100,
      apiCalls: 10000
    }
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    description: 'Best for growing businesses',
    price: 99,
    currency: 'USD',
    interval: 'month',
    features: [
      'Up to 10 AI agents',
      '10,000 conversations/month',
      'Advanced analytics',
      'Priority support',
      'All integrations',
      'Custom branding',
      'API access'
    ],
    limits: {
      agents: 10,
      conversations: 10000,
      documents: 1000,
      apiCalls: 100000
    },
    popular: true
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 299,
    currency: 'USD',
    interval: 'month',
    features: [
      'Unlimited AI agents',
      'Unlimited conversations',
      'Enterprise analytics',
      'Dedicated support',
      'Custom integrations',
      'White-label solution',
      'SLA guarantee',
      'On-premise deployment'
    ],
    limits: {
      agents: -1, // unlimited
      conversations: -1,
      documents: -1,
      apiCalls: -1
    }
  }
]

const mockPaymentMethods: PaymentMethod[] = [
  {
    id: 'pm_1',
    type: 'card',
    last4: '4242',
    brand: 'Visa',
    expiryMonth: 12,
    expiryYear: 2025,
    isDefault: true
  },
  {
    id: 'pm_2',
    type: 'card',
    last4: '0005',
    brand: 'Mastercard',
    expiryMonth: 8,
    expiryYear: 2026,
    isDefault: false
  }
]

const mockInvoices: Invoice[] = [
  {
    id: 'inv_1',
    number: 'INV-2024-001',
    status: 'paid',
    amount: 99,
    currency: 'USD',
    date: '2024-01-01T00:00:00Z',
    dueDate: '2024-01-15T00:00:00Z',
    downloadUrl: '#'
  },
  {
    id: 'inv_2',
    number: 'INV-2023-012',
    status: 'paid',
    amount: 99,
    currency: 'USD',
    date: '2023-12-01T00:00:00Z',
    dueDate: '2023-12-15T00:00:00Z',
    downloadUrl: '#'
  },
  {
    id: 'inv_3',
    number: 'INV-2023-011',
    status: 'paid',
    amount: 99,
    currency: 'USD',
    date: '2023-11-01T00:00:00Z',
    dueDate: '2023-11-15T00:00:00Z',
    downloadUrl: '#'
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'CANCELLED':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'PAST_DUE':
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'TRIALING':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

const formatLimit = (limit: number) => {
  if (limit === -1) return 'Unlimited'
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`
  return limit.toString()
}

export default function BillingManagement() {
  const { t } = useLanguage()
  const [subscription, setSubscription] = useState<Subscription>(mockSubscription)
  const [plans] = useState<Plan[]>(mockPlans)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(mockPaymentMethods)
  const [invoices] = useState<Invoice[]>(mockInvoices)
  const [activeTab, setActiveTab] = useState('overview')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    name: ''
  })

  const currentPlan = plans.find(p => p.id === subscription.planId)
  const daysUntilRenewal = Math.ceil(
    (new Date(subscription.currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  const handleChangePlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setShowPlanModal(true)
  }

  const confirmPlanChange = () => {
    if (!selectedPlan) return
    
    setSubscription(prev => ({
      ...prev,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      amount: selectedPlan.price
    }))
    
    setShowPlanModal(false)
    setSelectedPlan(null)
    toast.success(`Successfully upgraded to ${selectedPlan.name}`)
  }

  const handleCancelSubscription = () => {
    setSubscription(prev => ({ ...prev, cancelAtPeriodEnd: true }))
    toast.success('Subscription will be cancelled at the end of the current period')
  }

  const handleReactivateSubscription = () => {
    setSubscription(prev => ({ ...prev, cancelAtPeriodEnd: false }))
    toast.success('Subscription reactivated')
  }

  const handleAddPaymentMethod = () => {
    if (!newPaymentMethod.cardNumber || !newPaymentMethod.expiryMonth || !newPaymentMethod.expiryYear || !newPaymentMethod.cvc) {
      toast.error('Please fill in all required fields')
      return
    }

    const paymentMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      type: 'card',
      last4: newPaymentMethod.cardNumber.slice(-4),
      brand: 'Visa', // In real app, detect from card number
      expiryMonth: parseInt(newPaymentMethod.expiryMonth),
      expiryYear: parseInt(newPaymentMethod.expiryYear),
      isDefault: paymentMethods.length === 0
    }

    setPaymentMethods(prev => [...prev, paymentMethod])
    setNewPaymentMethod({ cardNumber: '', expiryMonth: '', expiryYear: '', cvc: '', name: '' })
    setShowPaymentModal(false)
    toast.success('Payment method added successfully')
  }

  const handleSetDefaultPaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.map(pm => ({ ...pm, isDefault: pm.id === id })))
    toast.success('Default payment method updated')
  }

  const handleDeletePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(pm => pm.id !== id))
    toast.success('Payment method removed')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your subscription, billing, and payment methods
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: CreditCardIcon },
            { id: 'plans', name: 'Plans', icon: BanknotesIcon },
            { id: 'payment', name: 'Payment Methods', icon: CreditCardIcon },
            { id: 'invoices', name: 'Invoices', icon: DocumentTextIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Current Subscription */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Current Subscription</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white">{currentPlan?.name}</h4>
                    <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                      {subscription.status}
                    </span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">{currentPlan?.description}</p>
                  <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    <span>
                      {subscription.cancelAtPeriodEnd
                        ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()} (${daysUntilRenewal} days)`
                      }
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${subscription.amount}
                    <span className="text-lg font-normal text-gray-500 dark:text-gray-400">/{subscription.interval}</span>
                  </div>
                  <div className="mt-4 space-x-2">
                    {subscription.cancelAtPeriodEnd ? (
                      <button
                        onClick={handleReactivateSubscription}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelSubscription}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Change Plan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Agents', current: 7, limit: currentPlan?.limits.agents || 0, icon: '🤖' },
              { name: 'Conversations', current: 2847, limit: currentPlan?.limits.conversations || 0, icon: '💬' },
              { name: 'Documents', current: 156, limit: currentPlan?.limits.documents || 0, icon: '📄' },
              { name: 'API Calls', current: 45230, limit: currentPlan?.limits.apiCalls || 0, icon: '🔌' }
            ].map((stat) => {
              const percentage = stat.limit === -1 ? 0 : (stat.current / stat.limit) * 100
              return (
                <div key={stat.name} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">{stat.icon}</span>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{stat.name}</dt>
                          <dd className="text-lg font-medium text-gray-900 dark:text-white">
                            {stat.current.toLocaleString()} / {formatLimit(stat.limit)}
                          </dd>
                        </dl>
                        {stat.limit !== -1 && (
                          <div className="mt-2">
                            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-lg shadow border-2 ${
                plan.popular
                  ? 'border-blue-500'
                  : plan.id === subscription.planId
                  ? 'border-green-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
                    Most Popular
                  </span>
                </div>
              )}
              {plan.id === subscription.planId && (
                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                    Current Plan
                  </span>
                </div>
              )}
              
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">{plan.description}</p>
                
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
                  <span className="text-gray-500 dark:text-gray-400">/{plan.interval}</span>
                </div>
                
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-8">
                  {plan.id === subscription.planId ? (
                    <button
                      disabled
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleChangePlan(plan)}
                      className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        plan.popular
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {plan.price > (currentPlan?.price || 0) ? 'Upgrade' : 'Downgrade'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Methods Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Payment Methods</h3>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Add Payment Method
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {paymentMethods.map((method) => (
              <div key={method.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CreditCardIcon className="h-8 w-8 text-gray-400" />
                    <div className="ml-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {method.brand} •••• {method.last4}
                        </span>
                        {method.isDefault && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                            Default
                          </span>
                        )}
                      </div>
                      {method.expiryMonth && method.expiryYear && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.isDefault && (
                      <button
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                        className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      className="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Invoice History</h3>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-8 w-8 text-gray-400 mr-4" />
                    <div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{invoice.number}</span>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(invoice.date).toLocaleDateString()} • ${invoice.amount} {invoice.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {invoice.downloadUrl && (
                      <button
                        onClick={() => window.open(invoice.downloadUrl, '_blank')}
                        className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Plan Change Modal */}
      {showPlanModal && selectedPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {selectedPlan.price > (currentPlan?.price || 0) ? 'Upgrade' : 'Downgrade'} to {selectedPlan.name}
              </h3>
              
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white">Plan Changes</h4>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Current: {currentPlan?.name}</span>
                      <span className="text-gray-900 dark:text-white">${currentPlan?.price}/{currentPlan?.interval}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">New: {selectedPlan.name}</span>
                      <span className="text-gray-900 dark:text-white">${selectedPlan.price}/{selectedPlan.interval}</span>
                    </div>
                    <hr className="border-gray-200 dark:border-gray-600" />
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-900 dark:text-white">Difference</span>
                      <span className={selectedPlan.price > (currentPlan?.price || 0) ? 'text-red-600' : 'text-green-600'}>
                        {selectedPlan.price > (currentPlan?.price || 0) ? '+' : '-'}${Math.abs(selectedPlan.price - (currentPlan?.price || 0))}/{selectedPlan.interval}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedPlan.price > (currentPlan?.price || 0)
                    ? 'You will be charged the prorated amount immediately.'
                    : 'The change will take effect at the next billing cycle.'}
                </p>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPlanChange}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Confirm {selectedPlan.price > (currentPlan?.price || 0) ? 'Upgrade' : 'Downgrade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Payment Method</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cardholder Name</label>
                  <input
                    type="text"
                    value={newPaymentMethod.name}
                    onChange={(e) => setNewPaymentMethod({...newPaymentMethod, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Card Number</label>
                  <input
                    type="text"
                    value={newPaymentMethod.cardNumber}
                    onChange={(e) => setNewPaymentMethod({...newPaymentMethod, cardNumber: e.target.value})}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Month</label>
                    <select
                      value={newPaymentMethod.expiryMonth}
                      onChange={(e) => setNewPaymentMethod({...newPaymentMethod, expiryMonth: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Month</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month.toString().padStart(2, '0')}>
                          {month.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Year</label>
                    <select
                      value={newPaymentMethod.expiryYear}
                      onChange={(e) => setNewPaymentMethod({...newPaymentMethod, expiryYear: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                        <option key={year} value={year.toString()}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CVC</label>
                    <input
                      type="text"
                      value={newPaymentMethod.cvc}
                      onChange={(e) => setNewPaymentMethod({...newPaymentMethod, cvc: e.target.value})}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPaymentMethod}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Payment Method
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}