import { useState, useEffect } from 'react'
import {
  DocumentArrowUpIcon,
  FolderIcon,
  DocumentTextIcon,
  TrashIcon,
  EyeIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  SparklesIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'
import { useEmbeddings } from '../hooks/useEmbeddings'
import { useDocuments, Document } from '../hooks/useDocuments'
import { EmbeddingProvider } from '../types/embeddings'

interface TrainingDocument extends Document {
  type: 'PDF' | 'DOCX' | 'TXT' | 'MD'
  uploadDate: string
  category: string
  chunks: number
  vectorized: boolean
  embeddingProvider: EmbeddingProvider
  content?: string
}

interface SemanticSearchResult {
  document: TrainingDocument
  similarity: number
  relevantChunks: string[]
}

// Mock data removed - now using real data from useDocuments hook

const categories = [
  'Product Information',
  'Support',
  'Policies',
  'Sales Materials',
  'Training Guides',
  'Company Info',
]

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'READY':
    case 'COMPLETED':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    case 'PROCESSING':
      return <ClockIcon className="h-5 w-5 text-yellow-500" />
    case 'ERROR':
    case 'FAILED':
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
    case 'UPLOADING':
      return <CloudArrowUpIcon className="h-5 w-5 text-blue-500" />
    default:
      return <ClockIcon className="h-5 w-5 text-gray-500" />
  }
}

const getFileIcon = (type: string) => {
  return <DocumentTextIcon className="h-8 w-8 text-blue-500" />
}

const getProviderBadge = (provider?: EmbeddingProvider) => {
  if (!provider) return null
  
  const colors = {
    gemini: 'bg-purple-100 text-purple-800 border-purple-200',
    openai: 'bg-green-100 text-green-800 border-green-200'
  }
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors[provider]}`}>
      <CpuChipIcon className="h-3 w-3 mr-1" />
      {provider === 'gemini' ? 'Gemini' : 'OpenAI'}
    </span>
  )
}

export default function TrainingCenter() {
  const { t } = useLanguage()
  const {
    isLoading: embeddingLoading,
    providers,
    models,
    generateEmbedding,
    findSimilarTexts,
    calculateSimilarity,
    loadProviders
  } = useEmbeddings()
  
  const {
    documents: realDocuments,
    loading: documentsLoading,
    error: documentsError,
    uploadDocument,
    deleteDocument: deleteDocumentFromAPI,
    processDocument,
    searchDocuments
  } = useDocuments()
  
  // Transform real documents to training documents format
  const documents: TrainingDocument[] = realDocuments.filter(doc => doc != null).map(doc => ({
    ...doc,
    type: doc?.name?.split('.').pop()?.toUpperCase() as any || 'TXT',
    uploadDate: doc?.createdAt ? doc.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    category: doc?.metadata?.category || 'Uncategorized',
    chunks: doc?.metadata?.chunks || 0,
    vectorized: doc?.metadata?.vectorized || false,
    embeddingProvider: doc?.metadata?.embeddingProvider,
    content: doc?.metadata?.content
  }))
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [selectedProvider, setSelectedProvider] = useState<EmbeddingProvider>('gemini')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showEmbeddingPanel, setShowEmbeddingPanel] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [similarityResults, setSimilarityResults] = useState<Array<{doc1: string, doc2: string, similarity: number}>>([])

  useEffect(() => {
    loadProviders()
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFiles = async (files: FileList) => {
    Array.from(files).forEach(async (file) => {
      try {
        // Upload document using real API
        const metadata = {
          category: 'Uncategorized',
          embeddingProvider: selectedProvider,
          chunks: 0,
          vectorized: false
        }
        
        const uploadedDoc = await uploadDocument(file, undefined, metadata)
        
        // Process document for embeddings
        if (uploadedDoc) {
          try {
            await processDocument(uploadedDoc.id)
            toast.success(`${file.name} is being processed with ${selectedProvider} embeddings!`)
          } catch (error) {
            toast.error(`Failed to process ${file.name}`)
          }
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`)
      }
    })
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      await deleteDocumentFromAPI(id)
      // Document will be removed from state by the useDocuments hook
    } catch (error) {
      // Error is already handled by the hook
    }
  }

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsSearching(true)
    try {
      const results = await searchDocuments(searchQuery)
      
      // Transform search results to SemanticSearchResult format
      const transformedResults: SemanticSearchResult[] = results.filter(doc => doc != null).map(doc => {
        const trainingDoc: TrainingDocument = {
          ...doc,
          type: doc?.name?.split('.').pop()?.toUpperCase() as any || 'TXT',
          uploadDate: doc?.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          category: doc?.metadata?.category || 'Uncategorized',
          chunks: doc?.metadata?.chunks || 0,
          vectorized: doc?.metadata?.vectorized || false,
          embeddingProvider: doc?.metadata?.embeddingProvider || selectedProvider,
          content: doc.content || ''
        }
        
        return {
          document: trainingDoc,
          similarity: doc.similarity || 0.8, // Use similarity from search results or default
          relevantChunks: [doc.content ? doc.content.substring(0, 200) + '...' : 'No content available']
        }
      })
      
      setSearchResults(transformedResults)
      toast.success(`Found ${transformedResults.length} relevant documents`)
    } catch (error) {
      toast.error('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const calculateDocumentSimilarity = async () => {
    if (selectedDocuments.length !== 2) {
      toast.error('Please select exactly 2 documents to compare')
      return
    }

    const [doc1Id, doc2Id] = selectedDocuments
    const doc1 = documents.find(d => d.id === doc1Id)
    const doc2 = documents.find(d => d.id === doc2Id)

    if (!doc1 || !doc2 || !doc1.content || !doc2.content) {
      toast.error('Selected documents must exist and have content to compare')
      return
    }

    try {
      const result = await calculateSimilarity(doc1.content, doc2.content, selectedProvider)
      if (result) {
        setSimilarityResults(prev => [...prev, {
          doc1: doc1.name,
          doc2: doc2.name,
          similarity: result.similarity
        }])
        toast.success(`Similarity: ${(result.similarity * 100).toFixed(1)}%`)
      }
    } catch (error) {
      toast.error('Failed to calculate similarity')
    }
  }

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : prev.length < 2 ? [...prev, docId] : [prev[1], docId]
    )
  }

  // Transform documents to extract metadata properly
  const transformedDocuments: TrainingDocument[] = documents.map(doc => ({
    ...doc,
    type: doc?.name?.split('.').pop()?.toUpperCase() as any || 'TXT',
    uploadDate: doc?.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    category: doc?.metadata?.category || 'Uncategorized',
    chunks: doc?.metadata?.chunks || 0,
    vectorized: doc?.metadata?.vectorized || false,
    embeddingProvider: doc?.metadata?.embeddingProvider || selectedProvider,
    content: doc.content || ''
  }))

  const filteredDocuments = selectedCategory === 'All' 
    ? transformedDocuments 
    : transformedDocuments.filter(doc => doc.category === selectedCategory)

  const totalDocuments = transformedDocuments.length
  const processedDocuments = transformedDocuments.filter(doc => doc.status === 'READY').length
  const totalChunks = transformedDocuments.reduce((sum, doc) => sum + doc.chunks, 0)
  const vectorizedDocuments = transformedDocuments.filter(doc => doc.vectorized).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('training.title')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('training.description')} - Enhanced with AI embeddings
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as EmbeddingProvider)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {providers && providers.length > 0 ? providers.map(provider => (
                <option key={provider} value={provider}>
                  {provider === 'gemini' ? 'Gemini Embeddings' : 'OpenAI Embeddings'}
                </option>
              )) : (
                <option value="gemini">Loading providers...</option>
              )}
            </select>
            <button
              onClick={() => setShowEmbeddingPanel(!showEmbeddingPanel)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              AI Tools
            </button>
          </div>
        </div>
      </div>

      {/* AI Embedding Panel */}
      {showEmbeddingPanel && (
        <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <SparklesIcon className="h-5 w-5 mr-2 text-purple-600" />
            AI-Powered Document Analysis
          </h3>
          
          {/* Semantic Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Semantic Search
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by meaning, not just keywords..."
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSemanticSearch()}
              />
              <button
                onClick={handleSemanticSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Search Results</h4>
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{result.document.name}</span>
                      <span className="text-sm text-purple-600 font-medium">
                        {(result.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {result.relevantChunks[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Similarity */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Similarity Analysis
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedDocuments.length}/2 documents
              </span>
              <button
                onClick={calculateDocumentSimilarity}
                disabled={selectedDocuments.length !== 2 || embeddingLoading}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChartBarIcon className="h-4 w-4 mr-1" />
                Compare
              </button>
            </div>
          </div>

          {/* Similarity Results */}
          {similarityResults.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Similarity Results</h4>
              <div className="space-y-1">
                {similarityResults.slice(-3).map((result, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{result.doc1}</span> vs <span className="font-medium">{result.doc2}</span>: 
                    <span className="ml-1 font-medium text-blue-600">{(result.similarity * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('training.totalDocuments')}</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{totalDocuments}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('training.processed')}</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{processedDocuments}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FolderIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('training.knowledgeChunks')}</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{totalChunks}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <SparklesIcon className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">AI Vectorized</dt>
                  <dd className="text-2xl font-semibold text-gray-900 dark:text-white">{vectorizedDocuments}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
            dragActive 
              ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20' 
              : 'border-gray-300 dark:border-gray-600'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-white">
                  Drop files here or click to upload
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.csv,.json"
                  onChange={handleFileInput}
                />
              </label>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Supports PDF, DOC, TXT, CSV, JSON files up to 10MB
              </p>
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                Files will be processed with {selectedProvider === 'gemini' ? 'Gemini' : 'OpenAI'} embeddings
              </p>
            </div>
          </div>
        </div>
        
        {/* Upload Progress */}
        {Object.entries(uploadProgress).map(([fileId, progress]) => (
          <div key={fileId} className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Uploading...</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              selectedCategory === 'All'
                ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-600 dark:text-purple-300'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All ({totalDocuments})
          </button>
          {categories.map((category) => {
            const count = documents.filter(doc => doc.category === category).length
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  selectedCategory === category
                    ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-600 dark:text-purple-300'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {category} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Training Documents</h3>
          
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No documents</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Upload your first training document to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDocuments(filteredDocuments.slice(0, 2).map(d => d.id))
                          } else {
                            setSelectedDocuments([])
                          }
                        }}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      AI Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Chunks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={() => toggleDocumentSelection(doc.id)}
                          disabled={selectedDocuments.length >= 2 && !selectedDocuments.includes(doc.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {getFileIcon(doc.type)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{doc.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{doc.type} • {doc.size ? `${(doc.size / 1024 / 1024).toFixed(1)} MB` : '0 MB'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(doc.status)}
                          <span className="ml-2 text-sm text-gray-900 dark:text-white">
                            {doc.status === 'READY' ? 'Ready' : 
                             doc.status === 'PROCESSING' ? 'Processing' : 
                             doc.status === 'UPLOADING' ? 'Uploading' : 
                             doc.status === 'ERROR' || doc.status === 'FAILED' ? 'Failed' : doc.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getProviderBadge(doc.embeddingProvider)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {doc.chunks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {doc.uploadDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => deleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}