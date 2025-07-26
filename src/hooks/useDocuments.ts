import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/api'
import { toast } from 'sonner'
import { useSocket } from '../contexts/SocketContext'

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

  const fetchDocuments = useCallback(async (params?: any) => {
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
  }, [])

  const uploadDocument = useCallback(async (file: File, agentId?: string, metadata?: any) => {
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
      formData.append('files', file)
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
      const uploadedDocument = response.data.documents[0]
      setDocuments(prev => prev.map(doc => 
        doc.id === tempId ? uploadedDocument : doc
      ))
      
      setUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev
        return rest
      })
      
      toast.success('Document uploaded successfully')
      return uploadedDocument
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
  }, [])

  const deleteDocument = useCallback(async (id: string) => {
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
  }, [])

  const processDocument = useCallback(async (id: string) => {
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
  }, [])

  const searchDocuments = useCallback(async (query: string, params?: any) => {
    try {
      const response = await apiClient.searchDocuments(query, params)
      return response.documents || []
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to search documents'
      toast.error(errorMessage)
      throw err
    }
  }, [])

  const { socket } = useSocket()

  // Socket event listeners for real-time updates
  useEffect(() => {
    if (!socket) return

    // Join documents room for real-time updates
    socket.emit('join_documents')

    // Listen for document uploaded events
    const handleDocumentUploaded = (data: { document: Document }) => {
      setDocuments(prev => {
        const exists = prev.find(doc => doc.id === data.document.id)
        const hasTempDocs = prev.some(doc => doc.id.startsWith('temp-'))
        
        // Show toast only for socket-based uploads (not direct uploads)
        if (!hasTempDocs) {
          toast.success(`Document "${data.document.name}" uploaded successfully`)
        }
        
        if (exists) {
          // Only update if it's not a temporary document (avoid conflicts with direct upload)
          if (!exists.id.startsWith('temp-')) {
            return prev.map(doc => doc.id === data.document.id ? data.document : doc)
          }
          return prev
        }
        
        // Don't add document if we have temp docs (direct upload in progress)
        if (hasTempDocs) {
          return prev
        }
        
        return [...prev, data.document]
      })
    }

    // Listen for document status updates
    const handleDocumentStatusUpdate = (data: { documentId: string, status: string, metadata?: any }) => {
      setDocuments(prev => prev.map(doc => 
        doc.id === data.documentId 
          ? { ...doc, status: data.status as Document['status'], metadata: data.metadata || doc.metadata }
          : doc
      ))
    }

    // Listen for document processed events
    const handleDocumentProcessed = (data: { documentId: string, chunks: number, processingTime: number, metadata?: any }) => {
      setDocuments(prev => prev.map(doc => 
        doc.id === data.documentId 
          ? { 
              ...doc, 
              status: 'READY' as Document['status'], 
              metadata: { 
                ...doc.metadata, 
                chunks: data.chunks, 
                processingTime: data.processingTime,
                ...data.metadata 
              }
            }
          : doc
      ))
      toast.success(`Document processing completed with ${data.chunks} chunks`)
    }

    // Listen for document deleted events
    const handleDocumentDeleted = (data: { documentId: string }) => {
      setDocuments(prev => prev.filter(doc => doc.id !== data.documentId))
      toast.info('Document deleted')
    }

    // Register event listeners
    socket.on('document_uploaded', handleDocumentUploaded)
    socket.on('document_status_update', handleDocumentStatusUpdate)
    socket.on('document_processed', handleDocumentProcessed)
    socket.on('document_deleted', handleDocumentDeleted)

    // Cleanup listeners on unmount
    return () => {
      socket.off('document_uploaded', handleDocumentUploaded)
      socket.off('document_status_update', handleDocumentStatusUpdate)
      socket.off('document_processed', handleDocumentProcessed)
      socket.off('document_deleted', handleDocumentDeleted)
      socket.emit('leave_documents')
    }
  }, [socket])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

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