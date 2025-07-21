import { useState } from 'react'
import {
  UserIcon,
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  KeyIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface SettingsSection {
  id: string
  name: string
  icon: React.ComponentType<any>
}

const settingsSections: SettingsSection[] = [
  { id: 'profile', name: 'Profile', icon: UserIcon },
  { id: 'account', name: 'Account', icon: CogIcon },
  { id: 'notifications', name: 'Notifications', icon: BellIcon },
  { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  { id: 'billing', name: 'Billing', icon: CreditCardIcon },
  { id: 'api', name: 'API Keys', icon: KeyIcon },
  { id: 'integrations', name: 'Integrations', icon: GlobeAltIcon },
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    // Profile
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+1 (555) 123-4567',
    company: 'Acme Corp',
    timezone: 'America/New_York',
    language: 'en',
    
    // Account
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    weeklyReports: true,
    securityAlerts: true,
    
    // Security
    twoFactorEnabled: false,
    sessionTimeout: '30',
    
    // Billing
    plan: 'pro',
    billingEmail: 'billing@company.com',
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    toast.success('Settings saved successfully!')
  }

  const handlePasswordChange = () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    toast.success('Password updated successfully!')
    setFormData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }))
  }

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
        <p className="mt-1 text-sm text-gray-500">
          Update your personal information and preferences.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Company</label>
          <input
            type="text"
            value={formData.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Timezone</label>
          <select
            value={formData.timezone}
            onChange={(e) => handleInputChange('timezone', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
          </select>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  )

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Account Settings</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account security and password.
        </p>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Change Password</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Current Password</label>
            <input
              type="password"
              value={formData.currentPassword}
              onChange={(e) => handleInputChange('currentPassword', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                ) : (
                  <EyeIcon className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={handlePasswordChange}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Update Password
          </button>
        </div>
      </div>
      
      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-red-900 mb-2">Danger Zone</h4>
        <p className="text-sm text-red-700 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50">
          Delete Account
        </button>
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        <p className="mt-1 text-sm text-gray-500">
          Choose how you want to be notified about important events.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900">Email Notifications</div>
              <div className="text-sm text-gray-500">Receive notifications via email</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.emailNotifications}
              onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BellIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900">Push Notifications</div>
              <div className="text-sm text-gray-500">Receive push notifications in your browser</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.pushNotifications}
              onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900">SMS Notifications</div>
              <div className="text-sm text-gray-500">Receive important alerts via SMS</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.smsNotifications}
              onChange={(e) => handleInputChange('smsNotifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CogIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900">Weekly Reports</div>
              <div className="text-sm text-gray-500">Receive weekly analytics reports</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.weeklyReports}
              onChange={(e) => handleInputChange('weeklyReports', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900">Security Alerts</div>
              <div className="text-sm text-gray-500">Get notified about security events</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.securityAlerts}
              onChange={(e) => handleInputChange('securityAlerts', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Save Preferences
        </button>
      </div>
    </div>
  )

  const renderSecuritySection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account security and access controls.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Two-Factor Authentication</div>
            <div className="text-sm text-gray-500">Add an extra layer of security to your account</div>
          </div>
          <button
            onClick={() => handleInputChange('twoFactorEnabled', !formData.twoFactorEnabled)}
            className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
              formData.twoFactorEnabled
                ? 'border-red-300 text-red-700 bg-white hover:bg-red-50'
                : 'border-green-300 text-green-700 bg-white hover:bg-green-50'
            }`}
          >
            {formData.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Session Timeout</label>
          <select
            value={formData.sessionTimeout}
            onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 max-w-xs"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="240">4 hours</option>
            <option value="480">8 hours</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Automatically log out after this period of inactivity.
          </p>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Active Sessions</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-900">Current Session</div>
              <div className="text-xs text-gray-500">Chrome on Windows • Last active: Now</div>
            </div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-900">Mobile App</div>
              <div className="text-xs text-gray-500">iPhone • Last active: 2 hours ago</div>
            </div>
            <button className="text-xs text-red-600 hover:text-red-800">
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBillingSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Billing &amp; Subscription</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and billing information.
        </p>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-medium text-blue-900">Pro Plan</h4>
            <p className="text-sm text-blue-700">$99/month • Billed monthly</p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50">
            Change Plan
          </button>
        </div>
      </div>
      
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-4">Payment Method</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center mr-3">
                VISA
              </div>
              <div>
                <div className="text-sm text-gray-900">•••• •••• •••• 4242</div>
                <div className="text-xs text-gray-500">Expires 12/25</div>
              </div>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-800">
              Update
            </button>
          </div>
        </div>
      </div>
      
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-4">Billing History</h4>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            <li className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">January 2024</div>
                  <div className="text-sm text-gray-500">Pro Plan • Paid on Jan 1, 2024</div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 mr-4">$99.00</span>
                  <button className="text-sm text-blue-600 hover:text-blue-800">
                    Download
                  </button>
                </div>
              </div>
            </li>
            <li className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">December 2023</div>
                  <div className="text-sm text-gray-500">Pro Plan • Paid on Dec 1, 2023</div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 mr-4">$99.00</span>
                  <button className="text-sm text-blue-600 hover:text-blue-800">
                    Download
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )

  const renderApiSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage API keys for integrating with external services.
        </p>
      </div>
      
      <div className="bg-yellow-50 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <ShieldCheckIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Keep your API keys secure
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Never share your API keys publicly or commit them to version control.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-900">Your API Keys</h4>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
            Generate New Key
          </button>
        </div>
        
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            <li className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Production API Key</div>
                  <div className="text-sm text-gray-500 font-mono">ak_live_••••••••••••••••••••••••••••••••</div>
                  <div className="text-xs text-gray-500 mt-1">Created on Jan 15, 2024 • Last used 2 hours ago</div>
                </div>
                <div className="flex space-x-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800">
                    Copy
                  </button>
                  <button className="text-sm text-red-600 hover:text-red-800">
                    Revoke
                  </button>
                </div>
              </div>
            </li>
            <li className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Development API Key</div>
                  <div className="text-sm text-gray-500 font-mono">ak_test_••••••••••••••••••••••••••••••••</div>
                  <div className="text-xs text-gray-500 mt-1">Created on Jan 10, 2024 • Last used 1 day ago</div>
                </div>
                <div className="flex space-x-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800">
                    Copy
                  </button>
                  <button className="text-sm text-red-600 hover:text-red-800">
                    Revoke
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )

  const renderIntegrationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Integrations</h3>
        <p className="mt-1 text-sm text-gray-500">
          Connect with third-party services and tools.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-green-600 font-bold text-sm">WA</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">WhatsApp Business</div>
                <div className="text-xs text-gray-500">Connected</div>
              </div>
            </div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Active
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Send and receive messages through WhatsApp Business API.
          </p>
          <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
            Configure
          </button>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold text-sm">FB</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Facebook Messenger</div>
                <div className="text-xs text-gray-500">Connected</div>
              </div>
            </div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Active
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Integrate with Facebook Messenger for customer support.
          </p>
          <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
            Configure
          </button>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-gray-600 font-bold text-sm">SL</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Slack</div>
                <div className="text-xs text-gray-500">Not connected</div>
              </div>
            </div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
              Inactive
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Get notifications and manage conversations in Slack.
          </p>
          <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
            Connect
          </button>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-gray-600 font-bold text-sm">ZP</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">Zapier</div>
                <div className="text-xs text-gray-500">Not connected</div>
              </div>
            </div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
              Inactive
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Automate workflows with 5000+ apps through Zapier.
          </p>
          <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
            Connect
          </button>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection()
      case 'account':
        return renderAccountSection()
      case 'notifications':
        return renderNotificationsSection()
      case 'security':
        return renderSecuritySection()
      case 'billing':
        return renderBillingSection()
      case 'api':
        return renderApiSection()
      case 'integrations':
        return renderIntegrationsSection()
      default:
        return renderProfileSection()
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 mr-8">
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const IconComponent = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-left ${
                    activeSection === section.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <IconComponent className="mr-3 h-5 w-5" />
                  {section.name}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 max-w-4xl">
          <div className="bg-white shadow rounded-lg p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}