import { useState } from 'react'
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
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'

interface TrainingDocument {
  id: string
  name: string
  type: 'PDF' | 'DOC' | 'TXT' | 'CSV' | 'JSON'
  size: string
  uploadDate: string
  status: 'Processing' | 'Completed' | 'Failed'
  category: string
  chunks: number
  vectorized: boolean
}

const mockDocuments: TrainingDocument[] = [
  {
    id: '1',
    name: 'Product Catalog 2024.pdf',
    type: 'PDF',
    size: '2.4 MB',
    uploadDate: '2024-01-15',
    status: 'Completed',
    category: 'Product Information',
    chunks: 45,
    vectorized: true,
  },
  {
    id: '2',
    name: 'FAQ Document.docx',
    type: 'DOC',
    size: '856 KB',
    uploadDate: '2024-01-14',
    status: 'Completed',
    category: 'Support',
    chunks: 23,
    vectorized: true,
  },
  {
    id: '3',
    name: 'Company Policies.pdf',
    type: 'PDF',
    size: '1.2 MB',
    uploadDate: '2024-01-13',
    status: 'Processing',
    category: 'Policies',
    chunks: 0,
    vectorized: false,
  },
]

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
    case 'Completed':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    case 'Processing':
      return <ClockIcon className="h-5 w-5 text-yellow-500" />
    case 'Failed':
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
    default:
      return <ClockIcon className="h-5 w-5 text-gray-500" />
  }
}

const getFileIcon = (type: string) => {
  return <DocumentTextIcon className="h-8 w-8 text-blue-500" />
}

export default function TrainingCenter() {
  const { t } = useLanguage()
  const [documents, setDocuments] = useState<TrainingDocument[]>(mockDocuments)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})

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

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      
      // Simulate upload progress
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 30
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          
          // Add completed document
          const newDoc: TrainingDocument = {
            id: fileId,
            name: file.name,
            type: file.name.split('.').pop()?.toUpperCase() as any || 'TXT',
            size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'Processing',
            category: 'Uncategorized',
            chunks: 0,
            vectorized: false,
          }
          
          setDocuments(prev => [...prev, newDoc])
          setUploadProgress(prev => {
            const newProgress = {...prev}
            delete newProgress[fileId]
            return newProgress
          })
          
          toast.success(`${file.name} uploaded successfully!`)
          
          // Simulate processing completion
          setTimeout(() => {
            setDocuments(prev => prev.map(doc => 
              doc.id === fileId 
                ? {...doc, status: 'Completed', chunks: Math.floor(Math.random() * 50) + 10, vectorized: true}
                : doc
            ))
          }, 3000)
        } else {
          setUploadProgress(prev => ({...prev, [fileId]: progress}))
        }
      }, 500)
    })
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id))
    toast.success('Document deleted successfully')
  }

  const filteredDocuments = selectedCategory === 'All' 
    ? documents 
    : documents.filter(doc => doc.category === selectedCategory)

  const totalDocuments = documents.length
  const processedDocuments = documents.filter(doc => doc.status === 'Completed').length
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks, 0)
  const vectorizedDocuments = documents.filter(doc => doc.vectorized).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('training.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('training.description')}
        </p>
      </div>

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
                <CloudArrowUpIcon className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('training.vectorized')}</dt>
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
          className={`relative border-2 border-dashed rounded-lg p-6 ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
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
                <span className="mt-2 block text-sm font-medium text-gray-900">
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
              <p className="mt-1 text-sm text-gray-500">
                Supports PDF, DOC, TXT, CSV, JSON files up to 10MB
              </p>
            </div>
          </div>
        </div>
        
        {/* Upload Progress */}
        {Object.entries(uploadProgress).map(([fileId, progress]) => (
          <div key={fileId} className="mt-4 bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Uploading...</span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
            className={`px-3 py-1 text-sm rounded-full border ${
              selectedCategory === 'All'
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
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
                className={`px-3 py-1 text-sm rounded-full border ${
                  selectedCategory === category
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {category} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Training Documents</h3>
          
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload your first training document to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chunks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {getFileIcon(doc.type)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                            <div className="text-sm text-gray-500">{doc.type} • {doc.size}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(doc.status)}
                          <span className="ml-2 text-sm text-gray-900">{doc.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.chunks > 0 ? doc.chunks : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.uploadDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => deleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-900"
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