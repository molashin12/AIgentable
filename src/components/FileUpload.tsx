import React, { useState, useRef, useCallback } from 'react'
import { DocumentArrowUpIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  onUploadProgress?: (progress: number, file: File) => void
  onUploadComplete?: (file: File, response: any) => void
  onUploadError?: (file: File, error: string) => void
  acceptedTypes?: string[]
  maxFileSize?: number // in bytes
  maxFiles?: number
  multiple?: boolean
  disabled?: boolean
  className?: string
}

interface FileWithProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  id: string
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  acceptedTypes = ['pdf', 'doc', 'docx', 'txt', 'csv', 'json', 'html', 'md'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  multiple = true,
  disabled = false,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File size exceeds ${Math.round(maxFileSize / (1024 * 1024))}MB limit`
    }

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (fileExtension && !acceptedTypes.includes(fileExtension)) {
      return `File type .${fileExtension} is not supported`
    }

    return null
  }

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: File[] = []
    const errors: string[] = []

    // Check total file count
    if (files.length + fileList.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    Array.from(fileList).forEach((file) => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        newFiles.push(file)
      }
    })

    // Show validation errors
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
    }

    // Add valid files
    if (newFiles.length > 0) {
      const filesWithProgress: FileWithProgress[] = newFiles.map(file => ({
        file,
        progress: 0,
        status: 'pending' as const,
        id: `${file.name}-${Date.now()}-${Math.random()}`
      }))

      setFiles(prev => [...prev, ...filesWithProgress])
      onFilesSelected(newFiles)
    }
  }, [files.length, maxFiles, acceptedTypes, maxFileSize, onFilesSelected])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles)
    }
  }, [disabled, processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles)
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFiles])

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  const clearAllFiles = useCallback(() => {
    setFiles([])
  }, [])

  const updateFileProgress = useCallback((fileId: string, progress: number, status: FileWithProgress['status'], error?: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, progress, status, error }
        : f
    ))
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: FileWithProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
      case 'uploading':
        return (
          <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )
      default:
        return <DocumentArrowUpIcon className="h-5 w-5 text-gray-400" />
    }
  }

  // Note: updateFileProgress function is available for parent components to call directly

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${
            isDragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.map(type => `.${type}`).join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        
        <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {isDragOver ? 'Drop files here' : 'Upload files'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag and drop files here, or click to select
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Supported formats: {acceptedTypes.join(', ')}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Max file size: {Math.round(maxFileSize / (1024 * 1024))}MB • Max files: {maxFiles}
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Files ({files.length})
            </h4>
            <button
              onClick={clearAllFiles}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
            </button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((fileWithProgress) => (
              <div
                key={fileWithProgress.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(fileWithProgress.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {fileWithProgress.file.name}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(fileWithProgress.file.size)}
                    </span>
                  </div>
                  
                  {fileWithProgress.status === 'uploading' && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${fileWithProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {fileWithProgress.progress}% uploaded
                      </p>
                    </div>
                  )}
                  
                  {fileWithProgress.status === 'error' && fileWithProgress.error && (
                    <p className="text-xs text-red-500 mt-1">
                      {fileWithProgress.error}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={() => removeFile(fileWithProgress.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUpload