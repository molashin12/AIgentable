import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, StarIcon, LinkIcon, Cog6ToothIcon, RocketLaunchIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { CpuChipIcon, ChatBubbleLeftRightIcon, ChartBarIcon, BeakerIcon, CommandLineIcon, CloudIcon } from '@heroicons/react/24/solid';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [visibleChains, setVisibleChains] = useState<number[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chainIndex = parseInt(entry.target.getAttribute('data-chain') || '0');
            setVisibleChains(prev => [...prev, chainIndex].filter((v, i, a) => a.indexOf(v) === i));
          }
        });
      },
      { threshold: 0.3 }
    );

    const chainElements = document.querySelectorAll('[data-chain]');
    chainElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <CpuChipIcon className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">AIgentable</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 transition-colors">About</a>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => navigate('/login')}
                  className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg transition-colors"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => navigate('/register')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </button>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 hover:text-gray-900 p-2"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-md">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <a href="#features" className="block px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors">Features</a>
                <a href="#pricing" className="block px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
                <a href="#about" className="block px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors">About</a>
                <div className="pt-2 space-y-2">
                  <button 
                    onClick={() => {
                      navigate('/login');
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => {
                      navigate('/register');
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors mx-3"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Build Intelligent
              <span className="text-blue-600 block">AI Agents</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              The complete platform for creating, deploying, and managing AI agents that transform your business operations with intelligent automation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate('/register')}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 transition-all duration-200 flex items-center justify-center group"
              >
                Start Building
                <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 transition-colors">
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Building Chain */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Build AI Agents in Minutes</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Watch how our intelligent platform guides you through the agent creation process with seamless automation.
            </p>
          </div>
          
          <div className="relative">
            {/* Chain Animation Container */}
            <div className="flex flex-col lg:flex-row items-center justify-between space-y-12 lg:space-y-0 lg:space-x-8">
              
              {/* Step 1: Design */}
              <div 
                data-chain="1"
                className={`relative bg-white p-8 rounded-2xl shadow-lg transform transition-all duration-1000 ${
                  visibleChains.includes(1) ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
              >
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  1
                </div>
                <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto">
                  <BeakerIcon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Design & Configure</h3>
                <p className="text-gray-600 text-center mb-6">
                  Define your agent's personality, knowledge base, and conversation flows with our intuitive visual builder.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <img 
                    src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20AI%20agent%20configuration%20interface%20with%20drag%20and%20drop%20elements%2C%20clean%20UI%20design%2C%20blue%20and%20white%20color%20scheme&image_size=landscape_4_3" 
                    alt="Agent Design Interface" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              </div>
              
              {/* Chain Link 1 */}
              <div className={`hidden lg:block transition-all duration-1000 delay-500 ${
                visibleChains.includes(1) ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-gradient-to-r from-blue-400 to-green-400 animate-pulse"></div>
                  <LinkIcon className="h-6 w-6 text-blue-500 mx-2" />
                  <div className="w-8 h-0.5 bg-gradient-to-r from-blue-400 to-green-400 animate-pulse"></div>
                </div>
              </div>
              
              {/* Step 2: Train */}
              <div 
                data-chain="2"
                className={`relative bg-white p-8 rounded-2xl shadow-lg transform transition-all duration-1000 delay-300 ${
                  visibleChains.includes(2) ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
              >
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  2
                </div>
                <div className="bg-green-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto">
                  <CommandLineIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Train & Optimize</h3>
                <p className="text-gray-600 text-center mb-6">
                  Upload your data, train the AI model, and fine-tune responses for optimal performance.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <img 
                    src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20training%20dashboard%20with%20data%20visualization%2C%20progress%20bars%2C%20neural%20network%20diagrams%2C%20modern%20interface&image_size=landscape_4_3" 
                    alt="AI Training Dashboard" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              </div>
              
              {/* Chain Link 2 */}
              <div className={`hidden lg:block transition-all duration-1000 delay-700 ${
                visibleChains.includes(2) ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-gradient-to-r from-green-400 to-purple-400 animate-pulse"></div>
                  <LinkIcon className="h-6 w-6 text-green-500 mx-2" />
                  <div className="w-8 h-0.5 bg-gradient-to-r from-green-400 to-purple-400 animate-pulse"></div>
                </div>
              </div>
              
              {/* Step 3: Deploy */}
              <div 
                data-chain="3"
                className={`relative bg-white p-8 rounded-2xl shadow-lg transform transition-all duration-1000 delay-600 ${
                  visibleChains.includes(3) ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
              >
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  3
                </div>
                <div className="bg-purple-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto">
                  <RocketLaunchIcon className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Deploy & Scale</h3>
                <p className="text-gray-600 text-center mb-6">
                  Launch your agent across multiple channels and monitor performance in real-time.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <img 
                    src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=multi%2Dchannel%20deployment%20interface%20showing%20WhatsApp%2C%20Facebook%2C%20web%20chat%20integrations%2C%20analytics%20dashboard&image_size=landscape_4_3" 
                    alt="Multi-Channel Deployment" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              </div>
            </div>
            
            {/* Floating Animation Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className={`absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-bounce transition-opacity duration-1000 ${
                visibleChains.includes(1) ? 'opacity-100' : 'opacity-0'
              }`} style={{ animationDelay: '0s' }}></div>
              <div className={`absolute top-1/3 right-1/4 w-2 h-2 bg-green-400 rounded-full animate-bounce transition-opacity duration-1000 ${
                visibleChains.includes(2) ? 'opacity-100' : 'opacity-0'
              }`} style={{ animationDelay: '1s' }}></div>
              <div className={`absolute bottom-1/4 left-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce transition-opacity duration-1000 ${
                visibleChains.includes(3) ? 'opacity-100' : 'opacity-0'
              }`} style={{ animationDelay: '2s' }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Highlights Showcase */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Platform Highlights</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover the powerful features that make AIgentable the leading AI agent platform.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Real-time Chat Interface */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl">
                <img 
                  src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20real%2Dtime%20chat%20interface%20with%20AI%20agent%20responses%2C%20typing%20indicators%2C%20message%20bubbles%2C%20clean%20UI&image_size=landscape_16_9" 
                  alt="Real-time Chat Interface" 
                  className="w-full h-64 object-cover rounded-xl shadow-lg"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-3xl font-bold text-gray-900 mb-6">Real-time Conversations</h3>
              <p className="text-lg text-gray-600 mb-6">
                Experience lightning-fast AI responses with our advanced real-time chat system. 
                Watch typing indicators, see instant message delivery, and enjoy seamless conversations.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">WebSocket-powered real-time messaging</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Live typing indicators and presence</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Multi-user conversation support</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center mt-20">
            {/* Analytics Dashboard */}
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">Advanced Analytics</h3>
              <p className="text-lg text-gray-600 mb-6">
                Monitor your AI agents' performance with comprehensive analytics and insights. 
                Track conversations, measure satisfaction, and optimize your agents continuously.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Real-time performance metrics</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Customer satisfaction tracking</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Conversation flow analysis</span>
                </li>
              </ul>
            </div>
            <div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl">
                <img 
                  src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=analytics%20dashboard%20with%20charts%2C%20graphs%2C%20KPI%20metrics%2C%20conversation%20statistics%2C%20modern%20data%20visualization&image_size=landscape_16_9" 
                  alt="Analytics Dashboard" 
                  className="w-full h-64 object-cover rounded-xl shadow-lg"
                />
              </div>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center mt-20">
            {/* Agent Builder Interface */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-8 rounded-2xl">
                <img 
                  src="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20agent%20builder%20interface%20with%20drag%20and%20drop%20components%2C%20workflow%20designer%2C%20visual%20programming&image_size=landscape_16_9" 
                  alt="Agent Builder Interface" 
                  className="w-full h-64 object-cover rounded-xl shadow-lg"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-3xl font-bold text-gray-900 mb-6">Visual Agent Builder</h3>
              <p className="text-lg text-gray-600 mb-6">
                Create sophisticated AI agents without coding using our intuitive visual builder. 
                Design conversation flows, set up integrations, and customize behaviors with ease.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Drag-and-drop interface design</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Pre-built templates and components</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Real-time testing and preview</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features to build, deploy, and scale AI agents across your organization.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Multi-Channel Support</h3>
              <p className="text-gray-600 leading-relaxed">
                Deploy agents across WhatsApp, Facebook, Instagram, and web chat with unified conversation management.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <CpuChipIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Advanced AI Models</h3>
              <p className="text-gray-600 leading-relaxed">
                Powered by state-of-the-art language models with RAG technology for intelligent, context-aware responses.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Real-time Analytics</h3>
              <p className="text-gray-600 leading-relaxed">
                Monitor performance, track conversations, and optimize your agents with comprehensive analytics dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Trusted by teams worldwide</h2>
            <p className="text-xl text-gray-600">Join thousands of companies using AIgentable to transform their operations</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "AIgentable transformed our customer support. Response times dropped by 80% and satisfaction scores increased dramatically."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-300 rounded-full mr-3"></div>
                <div>
                  <p className="font-medium text-gray-900">Sarah Chen</p>
                  <p className="text-sm text-gray-600">Head of Support, TechCorp</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "The multi-channel capabilities are incredible. Our agents work seamlessly across all platforms with perfect context."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-300 rounded-full mr-3"></div>
                <div>
                  <p className="font-medium text-gray-900">Marcus Rodriguez</p>
                  <p className="text-sm text-gray-600">CTO, RetailPlus</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "Implementation was smooth and the results were immediate. Our team loves how easy it is to manage everything."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-300 rounded-full mr-3"></div>
                <div>
                  <p className="font-medium text-gray-900">Emily Watson</p>
                  <p className="text-sm text-gray-600">Operations Manager, StartupXYZ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-xl text-gray-600">Choose the plan that fits your needs. Upgrade or downgrade at any time.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <p className="text-gray-600 mb-6">Perfect for small teams getting started</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$29</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Up to 1,000 conversations/month</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">2 AI agents</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Basic analytics</span>
                </li>
              </ul>
              <button 
                onClick={() => navigate('/register')}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:border-gray-400 transition-colors"
              >
                Get Started
              </button>
            </div>
            
            <div className="bg-white p-8 rounded-xl border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">Most Popular</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional</h3>
              <p className="text-gray-600 mb-6">For growing businesses</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$99</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Up to 10,000 conversations/month</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">10 AI agents</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Advanced analytics</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Multi-channel support</span>
                </li>
              </ul>
              <button 
                onClick={() => navigate('/register')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>
            
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-6">For large organizations</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Unlimited conversations</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Unlimited AI agents</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Custom integrations</span>
                </li>
                <li className="flex items-center">
                  <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Dedicated support</span>
                </li>
              </ul>
              <button 
                onClick={() => navigate('/contact')}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:border-gray-400 transition-colors"
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to transform your business?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of companies already using AIgentable to automate their operations and delight their customers.
          </p>
          <button 
            onClick={() => navigate('/register')}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 transition-all duration-200 inline-flex items-center group"
          >
            Start Your Free Trial
            <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <CpuChipIcon className="h-8 w-8 text-blue-400" />
                <span className="text-xl font-bold">AIgentable</span>
              </div>
              <p className="text-gray-400">
                The complete platform for building intelligent AI agents.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 AIgentable. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;