import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'

export interface Document {
  id: string
  name: string
  type: string
  size: number
  url?: string
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR'
  agentId?: string
  metadata?: any
  createdAt: string
  updatedAt: string
}

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  const fetchDocuments = async (params?: any) => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getDocuments(params)
      setDocuments(response.documents || [])
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch documents'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const uploadDocument = async (file: File, agentId?: string, metadata?: any) => {
    const tempId = `temp-${Date.now()}`
    
    try {
      // Add temporary document to show upload progress
      const tempDoc: Document = {
        id: tempId,
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'UPLOADING',
        agentId,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      setDocuments(prev => [...prev, tempDoc])
      setUploadProgress(prev => ({ ...prev, [tempId]: 0 }))
      
      const formData = new FormData()
      formData.append('file', file)
      if (agentId) formData.append('agentId', agentId)
      if (metadata) formData.append('metadata', JSON.stringify(metadata))
      
      const response = await apiClient.uploadDocument(formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(prev => ({ ...prev, [tempId]: progress }))
          }
        }
      })
      
      // Replace temp document with actual document
      setDocuments(prev => prev.map(doc => 
        doc.id === tempId ? response.document : doc
      ))
      
      setUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev
        return rest
      })
      
      toast.success('Document uploaded successfully')
      return response.document
    } catch (err: any) {
      // Remove temp document on error
      setDocuments(prev => prev.filter(doc => doc.id !== tempId))
      setUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev
        return rest
      })
      
      const errorMessage = err.response?.data?.message || 'Failed to upload document'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      await apiClient.deleteDocument(id)
      setDocuments(prev => prev.filter(doc => doc.id !== id))
      toast.success('Document deleted successfully')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to delete document'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }

  const processDocument = async (id: string) => {
    try {
      const response = await apiClient.processDocument(id)
      setDocuments(prev => prev.map(doc => 
        doc.id === id ? { ...doc, status: 'PROCESSING' } : doc
      ))
      toast.success('Document processing started')
      return response
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to process document'
      toast.error(errorMessage)
      throw err
    }
  }

  const searchDocuments = async (query: string, params?: any) => {
    try {
      const response = await apiClient.searchDocuments(query, params)
      return response.documents || []
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to search documents'
      toast.error(errorMessage)
      throw err
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  return {
    documents,
    loading,
    error,
    uploadProgress,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    processDocument,
    searchDocuments
  }
}