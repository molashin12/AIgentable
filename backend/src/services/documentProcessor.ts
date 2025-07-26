import { langchainRAG, DocumentProcessingOptions, ProcessedDocument } from './langchainRAG';
import { prisma } from '../config/database';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { broadcastDocumentUploaded, broadcastDocumentStatusUpdate, broadcastDocumentProcessed } from '../sockets/socketHandlers';
import { getIO } from '../server';

export interface DocumentUploadOptions {
  tenantId: string;
  agentId?: string;
  name: string;
  description?: string;
  tags?: string[];
  processingOptions?: DocumentProcessingOptions;
}

export interface DocumentProcessingResult {
  documentId: string;
  chunksCreated: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

class DocumentProcessorService {
  private static instance: DocumentProcessorService;

  private constructor() {}

  public static getInstance(): DocumentProcessorService {
    if (!DocumentProcessorService.instance) {
      DocumentProcessorService.instance = new DocumentProcessorService();
    }
    return DocumentProcessorService.instance;
  }

  /**
   * Process and store a document file
   */
  async processDocumentFile(
    filePath: string,
    options: DocumentUploadOptions
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    let documentId: string | null = null;

    try {
      // Initialize LangChain RAG
      await langchainRAG.initialize();

      // Process document with LangChain
      const processedDoc = await langchainRAG.processDocument(filePath, {
        ...options.processingOptions,
        metadata: {
          tenantId: options.tenantId,
          agentId: options.agentId,
          name: options.name,
          // description: options.description, // Field doesn't exist in schema
          tags: options.tags,
          uploadedAt: new Date().toISOString(),
        }
      });

      // Store document metadata in database
      const document = await prisma.document.create({
        data: {
          id: uuidv4(),
          tenantId: options.tenantId,
          agentId: options.agentId,
          name: options.name,
          originalName: path.basename(filePath),
          type: this.getDocumentType(filePath),
          size: (await fs.stat(filePath)).size,
          path: filePath,
          status: 'PROCESSING',
          metadata: {
            chunks: processedDoc.chunks.length,
            processingTime: processedDoc.processingTime,
            tags: options.tags || [],
          },
        },
      });

      documentId = document.id;

      // Broadcast document upload event
      try {
        const io = getIO();
        broadcastDocumentUploaded(io, options.tenantId, document);
      } catch (socketError) {
        logger.warn('Failed to broadcast document upload', { documentId: document.id, socketError });
      }

      // Add processed chunks to vector store
      await langchainRAG.addDocuments({
        ...processedDoc,
        metadata: {
          ...processedDoc.metadata,
          documentId: document.id,
        }
      });

      // Update document status to completed
      const updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: { 
          status: 'COMPLETED',
          metadata: {
            chunks: processedDoc.chunks.length,
            processingTime: processedDoc.processingTime,
            tags: options.tags || [],
          }
        },
      });

      // Broadcast document processing completion
      try {
        const io = getIO();
        broadcastDocumentProcessed(io, options.tenantId, updatedDocument);
      } catch (socketError) {
        logger.warn('Failed to broadcast document processing completion', { documentId: document.id, socketError });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Document processed successfully', {
        documentId: document.id,
        tenantId: options.tenantId,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
      });

      return {
        documentId: document.id,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
        success: true,
      };
    } catch (error) {
      // Update document status to failed if document was created
      if (documentId) {
        try {
          await prisma.document.update({
            where: { id: documentId },
            data: { 
              status: 'ERROR',
              metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
                failedAt: new Date().toISOString(),
              }
            },
          });
        } catch (updateError) {
          logger.error('Failed to update document status', { documentId, updateError });
        }
      }

      logger.error('Document processing failed', {
        filePath,
        tenantId: options.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        documentId: documentId || '',
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process text content directly
   */
  async processTextContent(
    text: string,
    options: DocumentUploadOptions
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    let documentId: string | null = null;

    try {
      // Initialize LangChain RAG
      await langchainRAG.initialize();

      // Process text with LangChain
      const processedDoc = await langchainRAG.processText(text, {
        tenantId: options.tenantId,
        agentId: options.agentId,
        name: options.name,
        description: options.description,
        tags: options.tags,
        uploadedAt: new Date().toISOString(),
      }, options.processingOptions);

      // Store document metadata in database
      const document = await prisma.document.create({
        data: {
          id: uuidv4(),
          tenantId: options.tenantId,
          agentId: options.agentId,
          name: options.name,
          originalName: options.name,
          type: 'TXT',
          size: Buffer.byteLength(text, 'utf8'),
          path: '',
          content: text,
          status: 'PROCESSING',
          metadata: {
            chunks: processedDoc.chunks.length,
            processingTime: processedDoc.processingTime,
            tags: options.tags || [],
          },
        },
      });

      documentId = document.id;

      // Broadcast document upload event
      try {
        const io = getIO();
        broadcastDocumentUploaded(io, options.tenantId, document);
      } catch (socketError) {
        logger.warn('Failed to broadcast document upload', { documentId: document.id, socketError });
      }

      // Add processed chunks to vector store
      await langchainRAG.addDocuments({
        ...processedDoc,
        metadata: {
          ...processedDoc.metadata,
          documentId: document.id,
        }
      });

      // Update document status to completed
      const updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: { 
          status: 'COMPLETED',
          metadata: {
            chunks: processedDoc.chunks.length,
            processingTime: processedDoc.processingTime,
            tags: options.tags || [],
          }
        },
      });

      // Broadcast document processing completion
      try {
        const io = getIO();
        broadcastDocumentProcessed(io, options.tenantId, updatedDocument);
      } catch (socketError) {
        logger.warn('Failed to broadcast document processing completion', { documentId: document.id, socketError });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Text content processed successfully', {
        documentId: document.id,
        tenantId: options.tenantId,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
      });

      return {
        documentId: document.id,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
        success: true,
      };
    } catch (error) {
      // Update document status to failed if document was created
      if (documentId) {
        try {
          await prisma.document.update({
            where: { id: documentId },
            data: { 
              status: 'ERROR',
              metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
                failedAt: new Date().toISOString(),
              }
            },
          });
        } catch (updateError) {
          logger.error('Failed to update document status', { documentId, updateError });
        }
      }

      logger.error('Text content processing failed', {
        tenantId: options.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        documentId: documentId || '',
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process web content
   */
  async processWebContent(
    url: string,
    options: DocumentUploadOptions
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    let documentId: string | null = null;

    try {
      // Initialize LangChain RAG
      await langchainRAG.initialize();

      // Process web content with LangChain
      const processedDoc = await langchainRAG.loadWebContent(url, {
        ...options.processingOptions,
        metadata: {
          tenantId: options.tenantId,
          agentId: options.agentId,
          name: options.name,
          description: options.description,
          tags: options.tags,
          uploadedAt: new Date().toISOString(),
        }
      });

      // Store document metadata in database
      const document = await prisma.document.create({
        data: {
          id: uuidv4(),
          tenantId: options.tenantId,
          agentId: options.agentId,
          name: options.name,
          originalName: url,
          type: 'HTML',
          size: Buffer.byteLength(processedDoc.chunks.map(chunk => chunk.pageContent).join('\n'), 'utf8'),
          path: url,
          content: processedDoc.chunks.map(chunk => chunk.pageContent).join('\n'),
          status: 'PROCESSING',
          metadata: {
            chunks: processedDoc.chunks.length,
            processingTime: processedDoc.processingTime,
            tags: options.tags || [],
          },
        },
      });

      documentId = document.id;

      // Broadcast document upload event
      try {
        const io = getIO();
        broadcastDocumentUploaded(io, options.tenantId, document);
      } catch (socketError) {
        logger.warn('Failed to broadcast document upload', { documentId: document.id, socketError });
      }

      // Add processed chunks to vector store
      await langchainRAG.addDocuments({
        ...processedDoc,
        metadata: {
          ...processedDoc.metadata,
          documentId: document.id,
        }
      });

      // Update document status to completed
      const updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: { 
          status: 'COMPLETED',
          metadata: {
            chunks: processedDoc.chunks.length,
            processingTime: processedDoc.processingTime,
            tags: options.tags || [],
          }
        },
      });

      // Broadcast document processing completion
      try {
        const io = getIO();
        broadcastDocumentProcessed(io, options.tenantId, updatedDocument);
      } catch (socketError) {
        logger.warn('Failed to broadcast document processing completion', { documentId: document.id, socketError });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Web content processed successfully', {
        documentId: document.id,
        tenantId: options.tenantId,
        url,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
      });

      return {
        documentId: document.id,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
        success: true,
      };
    } catch (error) {
      // Update document status to failed if document was created
      if (documentId) {
        try {
          await prisma.document.update({
            where: { id: documentId },
            data: { 
              status: 'ERROR',
              metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
                failedAt: new Date().toISOString(),
              }
            },
          });
        } catch (updateError) {
          logger.error('Failed to update document status', { documentId, updateError });
        }
      }

      logger.error('Web content processing failed', {
        url,
        tenantId: options.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        documentId: documentId || '',
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get document type from file path
   */
  private getDocumentType(filePath: string): 'PDF' | 'DOC' | 'DOCX' | 'TXT' | 'CSV' | 'JSON' | 'HTML' | 'MD' {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'PDF';
      case '.txt':
        return 'TXT';
      case '.doc':
        return 'DOC';
      case '.docx':
        return 'DOCX';
      case '.csv':
        return 'CSV';
      case '.json':
        return 'JSON';
      case '.html':
      case '.htm':
        return 'HTML';
      case '.md':
        return 'MD';
      default:
        return 'TXT'; // Default to TXT for unknown types
    }
  }

  /**
   * Get MIME type from file path
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.txt':
        return 'text/plain';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.csv':
        return 'text/csv';
      case '.json':
        return 'application/json';
      case '.html':
      case '.htm':
        return 'text/html';
      case '.md':
        return 'text/markdown';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Reprocess existing document with new options
   */
  async reprocessDocument(
    documentId: string,
    processingOptions?: DocumentProcessingOptions
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();

    try {
      // Get document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update status to processing
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      // Broadcast status update
      try {
        const io = getIO();
        broadcastDocumentStatusUpdate(io, document.tenantId, {
          id: documentId,
          status: 'PROCESSING',
          tenantId: document.tenantId
        });
      } catch (socketError) {
        logger.warn('Failed to broadcast document status update', { documentId, socketError });
      }

      let processedDoc: ProcessedDocument;

      // Process based on document type
      if (document.path) {
        processedDoc = await langchainRAG.processDocument(document.path, {
          ...processingOptions,
          metadata: {
            ...document.metadata as Record<string, any>,
            reprocessedAt: new Date().toISOString(),
          }
        });
      } else if (document.content) {
        processedDoc = await langchainRAG.processText(document.content, {
          ...document.metadata as Record<string, any>,
          reprocessedAt: new Date().toISOString(),
        }, processingOptions);
      // URL processing not supported in current schema
      } else {
        throw new Error('Document has no processable content');
      }

      // Add processed chunks to vector store
      await langchainRAG.addDocuments({
        ...processedDoc,
        metadata: {
          ...processedDoc.metadata,
          documentId: document.id,
        }
      });

      // Update document metadata
      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...document.metadata as Record<string, any>,
            chunks: processedDoc.chunks.length,
            lastProcessingTime: processedDoc.processingTime,
            reprocessedAt: new Date().toISOString(),
          },
        },
      });

      // Broadcast document processing completion
      try {
        const io = getIO();
        broadcastDocumentProcessed(io, document.tenantId, updatedDocument);
      } catch (socketError) {
        logger.warn('Failed to broadcast document reprocessing completion', { documentId, socketError });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Document reprocessed successfully', {
        documentId,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
      });

      return {
        documentId,
        chunksCreated: processedDoc.chunks.length,
        processingTime,
        success: true,
      };
    } catch (error) {
      // Update document status to failed
      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { 
              status: 'ERROR',
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
              failedAt: new Date().toISOString(),
            }
          },
        });
      } catch (updateError) {
        logger.error('Failed to update document status', { documentId, updateError });
      }

      logger.error('Document reprocessing failed', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        documentId,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const documentProcessor = DocumentProcessorService.getInstance();
export default documentProcessor;