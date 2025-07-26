import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter, TokenTextSplitter } from '@langchain/textsplitters';
// Enhanced LangChain document loaders (only available ones)
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveUrlLoader } from '@langchain/community/document_loaders/web/recursive_url';
import { SitemapLoader } from '@langchain/community/document_loaders/web/sitemap';
// Note: TextLoader, JSONLoader, and DirectoryLoader are not available, using fallbacks
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import csvParser from 'csv-parser';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChromaClient } from 'chromadb';
import { langchainProvider, AIProvider } from './langchainProvider';
import { config } from '../config/config';
import logger from '../utils/logger';

export interface DocumentProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  splitterType?: 'recursive' | 'token';
  metadata?: Record<string, any>;
  embeddingProvider?: AIProvider;
}

export interface DirectoryProcessingOptions extends DocumentProcessingOptions {
  glob?: string;
  exclude?: string[];
  recursive?: boolean;
  maxDepth?: number;
  fileExtensions?: string[];
}

export interface WebProcessingOptions extends DocumentProcessingOptions {
  maxDepth?: number;
  excludeDirs?: string[];
  timeout?: number;
  maxPages?: number;
}

export interface RAGSearchOptions {
  k?: number;
  filter?: Record<string, any>;
  threshold?: number;
  embeddingProvider?: AIProvider;
}

export interface ProcessedDocument {
  id: string;
  chunks: Document[];
  metadata: Record<string, any>;
  processingTime: number;
}

export interface BatchProcessingResult {
  successful: ProcessedDocument[];
  failed: Array<{ source: string; error: string }>;
  totalProcessingTime: number;
}

class LangChainRAGService {
  private chromaClient: ChromaClient;
  private openaiEmbeddings: OpenAIEmbeddings;
  private geminiEmbeddings: GoogleGenerativeAIEmbeddings;
  private vectorStores: Map<string, Chroma> = new Map();
  private collectionName: string;
  private defaultEmbeddingProvider: AIProvider;

  constructor() {
    this.chromaClient = new ChromaClient({
      path: config.chromaUrl || 'http://localhost:8000'
    });

    this.openaiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: config.openaiEmbeddingModel || 'text-embedding-ada-002',
    });

    this.geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.geminiApiKey,
      modelName: 'gemini-embedding-001',
    });

    this.collectionName = 'aigentable_documents';
    this.defaultEmbeddingProvider = 'openai'; // Default to OpenAI for consistency
  }

  /**
   * Initialize the vector store connection for a specific embedding provider
   */
  async initialize(embeddingProvider: AIProvider = this.defaultEmbeddingProvider): Promise<void> {
    try {
      const embeddings = this.getEmbeddings(embeddingProvider);
      const collectionKey = `${this.collectionName}_${embeddingProvider}`;
      
      if (!this.vectorStores.has(collectionKey)) {
        const vectorStore = new Chroma(embeddings, {
          collectionName: collectionKey,
          url: config.chromaUrl || 'http://localhost:8000',
        });
        
        this.vectorStores.set(collectionKey, vectorStore);
      }
      
      logger.info(`LangChain RAG service initialized successfully for ${embeddingProvider}`);
    } catch (error) {
      logger.error(`Failed to initialize LangChain RAG service for ${embeddingProvider}:`, error);
      throw error;
    }
  }

  /**
   * Get embeddings instance for the specified provider
   */
  private getEmbeddings(provider: AIProvider): OpenAIEmbeddings | GoogleGenerativeAIEmbeddings {
    switch (provider) {
      case 'openai':
        return this.openaiEmbeddings;
      case 'gemini':
        return this.geminiEmbeddings;
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  /**
   * Get vector store for the specified provider
   */
  private async getVectorStore(provider: AIProvider = this.defaultEmbeddingProvider): Promise<Chroma> {
    const collectionKey = `${this.collectionName}_${provider}`;
    
    if (!this.vectorStores.has(collectionKey)) {
      await this.initialize(provider);
    }
    
    return this.vectorStores.get(collectionKey)!;
  }

  /**
   * Process a document file and return chunks
   */
  async processDocument(
    filePath: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      // Load document based on file type
      const documents = await this.loadDocument(filePath);
      
      // Split documents into chunks
      const chunks = await this.splitDocuments(documents, options);
      
      // Add metadata
      const enhancedChunks = chunks.map(chunk => {
        chunk.metadata = {
          ...chunk.metadata,
          ...options.metadata,
          source: filePath,
          processedAt: new Date().toISOString(),
        };
        return chunk;
      });

      const processingTime = Date.now() - startTime;
      
      return {
        id: path.basename(filePath),
        chunks: enhancedChunks,
        metadata: {
          originalFile: filePath,
          chunkCount: enhancedChunks.length,
          processingTime,
          ...options.metadata
        },
        processingTime
      };
    } catch (error) {
      logger.error(`Error processing document ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process text content directly
   */
  async processText(
    text: string,
    metadata: Record<string, any> = {},
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      const document = new Document({
        pageContent: text,
        metadata: {
          source: 'direct_text',
          ...metadata
        }
      });

      const chunks = await this.splitDocuments([document], options);
      
      const enhancedChunks = chunks.map(chunk => {
        chunk.metadata = {
          ...chunk.metadata,
          processedAt: new Date().toISOString(),
        };
        return chunk;
      });

      const processingTime = Date.now() - startTime;
      
      return {
        id: `text_${Date.now()}`,
        chunks: enhancedChunks,
        metadata: {
          chunkCount: enhancedChunks.length,
          processingTime,
          ...metadata
        },
        processingTime
      };
    } catch (error) {
      logger.error('Error processing text:', error);
      throw error;
    }
  }

  /**
   * Add processed documents to vector store
   */
  async addDocuments(
    processedDoc: ProcessedDocument, 
    embeddingProvider: AIProvider = this.defaultEmbeddingProvider
  ): Promise<void> {
    try {
      const vectorStore = await this.getVectorStore(embeddingProvider);
      await vectorStore.addDocuments(processedDoc.chunks);
      logger.info(`Added ${processedDoc.chunks.length} chunks to vector store using ${embeddingProvider}`);
    } catch (error) {
      logger.error(`Error adding documents to vector store with ${embeddingProvider}:`, error);
      throw error;
    }
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(
    query: string,
    options: RAGSearchOptions = {}
  ): Promise<Document[]> {
    const embeddingProvider = options.embeddingProvider || this.defaultEmbeddingProvider;
    
    try {
      const vectorStore = await this.getVectorStore(embeddingProvider);
      const k = options.k || 5;
      const results = await vectorStore.similaritySearch(query, k, options.filter);
      
      // Filter by threshold if provided
      if (options.threshold) {
        const resultsWithScores = await vectorStore.similaritySearchWithScore(query, k, options.filter);
        return resultsWithScores
          .filter(([_, score]: [any, number]) => score >= options.threshold!)
          .map(([doc, _]: [any, number]) => doc);
      }
      
      return results;
    } catch (error) {
      logger.error(`Error searching similar documents with ${embeddingProvider}:`, error);
      
      // Fallback to OpenAI if using Gemini and it fails
      if (embeddingProvider === 'gemini') {
        logger.info('Falling back to OpenAI for similarity search...');
        return await this.searchSimilar(query, { ...options, embeddingProvider: 'openai' });
      }
      
      throw error;
    }
  }

  /**
   * Search with scores
   */
  async searchSimilarWithScores(
    query: string,
    options: RAGSearchOptions = {}
  ): Promise<[Document, number][]> {
    const embeddingProvider = options.embeddingProvider || this.defaultEmbeddingProvider;
    
    try {
      const vectorStore = await this.getVectorStore(embeddingProvider);
      const k = options.k || 5;
      const results = await vectorStore.similaritySearchWithScore(query, k, options.filter);
      
      // Filter by threshold if provided
      if (options.threshold) {
        return results.filter(([_, score]: [any, number]) => score >= options.threshold!);
      }
      
      return results;
    } catch (error) {
      logger.error(`Error searching similar documents with scores using ${embeddingProvider}:`, error);
      
      // Fallback to OpenAI if using Gemini and it fails
      if (embeddingProvider === 'gemini') {
        logger.info('Falling back to OpenAI for similarity search with scores...');
        return await this.searchSimilarWithScores(query, { ...options, embeddingProvider: 'openai' });
      }
      
      throw error;
    }
  }

  /**
   * Delete documents by filter
   */
  async deleteDocuments(
    filter: Record<string, any>, 
    embeddingProvider: AIProvider = this.defaultEmbeddingProvider
  ): Promise<void> {
    try {
      // Note: ChromaVectorStore doesn't have a direct delete method
      // This would need to be implemented based on ChromaDB's delete capabilities
      logger.warn(`Document deletion not yet implemented for ChromaVectorStore with ${embeddingProvider}`);
    } catch (error) {
      logger.error(`Error deleting documents with ${embeddingProvider}:`, error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(embeddingProvider: AIProvider = this.defaultEmbeddingProvider): Promise<{
    documentCount: number;
    collectionName: string;
    embeddingProvider: AIProvider;
  }> {
    const collectionKey = `${this.collectionName}_${embeddingProvider}`;
    
    try {
      const collection = await this.chromaClient.getCollection({
        name: collectionKey,
        embeddingFunction: null as any // ChromaDB will use default embedding function
      });
      
      const count = await collection.count();
      
      return {
        documentCount: count,
        collectionName: collectionKey,
        embeddingProvider
      };
    } catch (error) {
      logger.error(`Error getting collection stats for ${embeddingProvider}:`, error);
      return {
        documentCount: 0,
        collectionName: collectionKey,
        embeddingProvider
      };
    }
  }

  /**
   * Get statistics for all embedding providers
   */
  async getAllCollectionStats(): Promise<Array<{
    documentCount: number;
    collectionName: string;
    embeddingProvider: AIProvider;
  }>> {
    const providers: AIProvider[] = ['openai', 'gemini'];
    const stats = await Promise.all(
      providers.map(provider => this.getCollectionStats(provider))
    );
    return stats;
  }

  /**
   * Set default embedding provider
   */
  setDefaultEmbeddingProvider(provider: AIProvider): void {
    this.defaultEmbeddingProvider = provider;
    logger.info(`Default embedding provider set to: ${provider}`);
  }

  /**
   * Get default embedding provider
   */
  getDefaultEmbeddingProvider(): AIProvider {
    return this.defaultEmbeddingProvider;
  }

  /**
   * Get available embedding providers
   */
  getAvailableEmbeddingProviders(): AIProvider[] {
    return ['openai', 'gemini'];
  }

  /**
   * Get retriever for LangChain RetrievalQAChain
   */
  async getRetriever(embeddingProvider: AIProvider = this.defaultEmbeddingProvider, k: number = 5) {
    const vectorStore = await this.getVectorStore(embeddingProvider);
    return vectorStore.asRetriever(k);
  }

  // Private helper methods

  private async loadDocument(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.pdf':
          return await this.loadPDFDocumentWithLangChain(filePath);
          
        case '.docx':
          return await this.loadDocxDocumentWithLangChain(filePath);
          
        case '.txt':
        case '.md':
          return await this.loadTextDocumentWithLangChain(filePath);
          
        case '.csv':
          return await this.loadCSVDocumentWithLangChain(filePath);
          
        case '.json':
          return await this.loadJSONDocumentWithLangChain(filePath);
          
        case '.html':
        case '.htm':
          return await this.loadHTMLDocumentFallback(filePath);
          
        default:
          // Fallback to text loader for unknown file types
          try {
            return await this.loadTextDocumentFallback(filePath);
          } catch (textError) {
            // Final fallback - read as plain text
            const content = fs.readFileSync(filePath, 'utf-8');
            return [new Document({
              pageContent: content,
              metadata: { source: filePath, type: 'unknown' }
            })];
          }
      }
    } catch (error) {
      logger.error(`Error loading document ${filePath}:`, error);
      throw error;
    }
  }

  // Enhanced LangChain-based document loaders
  private async loadPDFDocumentWithLangChain(filePath: string): Promise<Document[]> {
    try {
      const loader = new PDFLoader(filePath);
      return await loader.load();
    } catch (error) {
      // Fallback to custom PDF parser
      logger.warn(`LangChain PDF loader failed, using fallback: ${error}`);
      return await this.loadPDFDocumentFallback(filePath);
    }
  }

  private async loadDocxDocumentWithLangChain(filePath: string): Promise<Document[]> {
    try {
      const loader = new DocxLoader(filePath);
      return await loader.load();
    } catch (error) {
      // Fallback to custom DOCX parser
      logger.warn(`LangChain DOCX loader failed, using fallback: ${error}`);
      return await this.loadDocxDocumentFallback(filePath);
    }
  }

  private async loadTextDocumentWithLangChain(filePath: string): Promise<Document[]> {
    // TextLoader not available, using fallback
    return await this.loadTextDocumentFallback(filePath);
  }

  private async loadTextDocumentFallback(filePath: string): Promise<Document[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return [new Document({
        pageContent: content,
        metadata: {
          source: filePath,
          type: path.extname(filePath).toLowerCase().slice(1) || 'txt'
        }
      })];
    } catch (error) {
      throw new Error(`Failed to load text document: ${error}`);
    }
  }

  private async loadCSVDocumentWithLangChain(filePath: string): Promise<Document[]> {
    try {
      const loader = new CSVLoader(filePath);
      return await loader.load();
    } catch (error) {
      // Fallback to custom CSV parser
      logger.warn(`LangChain CSV loader failed, using fallback: ${error}`);
      return await this.loadCSVDocumentFallback(filePath);
    }
  }

  private async loadJSONDocumentWithLangChain(filePath: string): Promise<Document[]> {
    // JSONLoader not available, using fallback
    return await this.loadJSONDocumentFallback(filePath);
  }

  private async loadHTMLDocumentFallback(filePath: string): Promise<Document[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Simple HTML content extraction - remove tags for basic text content
      const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return [new Document({
        pageContent: textContent,
        metadata: {
          source: filePath,
          type: 'html'
        }
      })];
    } catch (error) {
      throw new Error(`Failed to load HTML document: ${error}`);
    }
  }

  // Fallback methods for when LangChain loaders fail
  private async loadPDFDocumentFallback(filePath: string): Promise<Document[]> {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return [new Document({
      pageContent: data.text,
      metadata: {
        source: filePath,
        type: 'pdf',
        pages: data.numpages
      }
    })];
  }

  private async loadDocxDocumentFallback(filePath: string): Promise<Document[]> {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return [new Document({
      pageContent: result.value,
      metadata: {
        source: filePath,
        type: 'docx'
      }
    })];
  }

  private async loadCSVDocumentFallback(filePath: string): Promise<Document[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: any) => results.push(data))
        .on('end', () => {
          const content = results.map(row => 
            Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ')
          ).join('\n');
          
          resolve([new Document({
            pageContent: content,
            metadata: {
              source: filePath,
              type: 'csv',
              rows: results.length
            }
          })]);
        })
        .on('error', reject);
    });
  }

  private async loadJSONDocumentFallback(filePath: string): Promise<Document[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    const textContent = JSON.stringify(jsonData, null, 2);
    
    return [new Document({
      pageContent: textContent,
      metadata: {
        source: filePath,
        type: 'json'
      }
    })];
  }

  private async splitDocuments(
    documents: Document[],
    options: DocumentProcessingOptions
  ): Promise<Document[]> {
    const chunkSize = options.chunkSize || 1000;
    const chunkOverlap = options.chunkOverlap || 200;
    const splitterType = options.splitterType || 'recursive';

    let splitter;
    
    if (splitterType === 'token') {
      splitter = new TokenTextSplitter({
        chunkSize,
        chunkOverlap,
      });
    } else {
      splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        separators: ['\n\n', '\n', ' ', ''],
      });
    }

    return await splitter.splitDocuments(documents);
  }

  /**
   * Load web content
   */
  async loadWebContent(
    url: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      const loader = new CheerioWebBaseLoader(url);
      const documents = await loader.load();
      
      const chunks = await this.splitDocuments(documents, options);
      
      const enhancedChunks = chunks.map(chunk => {
        chunk.metadata = {
          ...chunk.metadata,
          ...options.metadata,
          source: url,
          processedAt: new Date().toISOString(),
        };
        return chunk;
      });

      const processingTime = Date.now() - startTime;
      
      return {
        id: `web_${Date.now()}`,
        chunks: enhancedChunks,
        metadata: {
          originalUrl: url,
          chunkCount: enhancedChunks.length,
          processingTime,
          ...options.metadata
        },
        processingTime
      };
    } catch (error) {
      logger.error(`Error loading web content from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Process an entire directory of documents
   */
  async processDirectory(
    directoryPath: string,
    options: DirectoryProcessingOptions = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const successful: ProcessedDocument[] = [];
    const failed: Array<{ source: string; error: string }> = [];
    
    try {
      const {
        recursive = true,
        fileExtensions = ['.txt', '.md', '.pdf', '.docx', '.csv', '.json', '.html', '.htm']
      } = options;
      
      // Get all files in directory
      const files = await this.getFilesInDirectory(directoryPath, recursive, fileExtensions);
      
      // Process each file
      for (const filePath of files) {
        try {
          const processedDoc = await this.processDocument(filePath, options);
          successful.push(processedDoc);
        } catch (error) {
          failed.push({
            source: filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      const totalProcessingTime = Date.now() - startTime;
      
      logger.info(`Directory processing completed: ${successful.length} successful, ${failed.length} failed`);
      
      return {
        successful,
        failed,
        totalProcessingTime
      };
    } catch (error) {
      logger.error(`Error processing directory ${directoryPath}:`, error);
      throw error;
    }
  }

  /**
   * Get all files in a directory with specified extensions
   */
  private async getFilesInDirectory(
    directoryPath: string,
    recursive: boolean = true,
    fileExtensions: string[] = []
  ): Promise<string[]> {
    const files: string[] = [];
    
    const processDirectory = (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && recursive) {
          processDirectory(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (fileExtensions.length === 0 || fileExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    processDirectory(directoryPath);
    return files;
  }

  /**
   * Recursively crawl and load web content
   */
  async loadRecursiveWebContent(
    url: string,
    options: WebProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      const {
        maxDepth = 2,
        excludeDirs = [],
        timeout = 10000,
        maxPages = 50
      } = options;
      
      const loader = new RecursiveUrlLoader(url, {
        maxDepth,
        excludeDirs,
        timeout,
        // Add other RecursiveUrlLoader options as needed
      });
      
      const documents = await loader.load();
      
      // Limit the number of pages if specified
      const limitedDocuments = maxPages ? documents.slice(0, maxPages) : documents;
      
      const chunks = await this.splitDocuments(limitedDocuments, options);
      
      const enhancedChunks = chunks.map(chunk => {
        chunk.metadata = {
          ...chunk.metadata,
          ...options.metadata,
          processedAt: new Date().toISOString(),
        };
        return chunk;
      });

      const processingTime = Date.now() - startTime;
      
      return {
        id: `recursive_web_${Date.now()}`,
        chunks: enhancedChunks,
        metadata: {
          originalUrl: url,
          chunkCount: enhancedChunks.length,
          processingTime,
          pagesProcessed: limitedDocuments.length,
          maxDepth,
          ...options.metadata
        },
        processingTime
      };
    } catch (error) {
      logger.error(`Error loading recursive web content from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Load content from a sitemap
   */
  async loadSitemapContent(
    sitemapUrl: string,
    options: WebProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      const { maxPages = 100 } = options;
      
      const loader = new SitemapLoader(sitemapUrl, {
        // Add SitemapLoader options as needed
      });
      
      const documents = await loader.load();
      
      // Limit the number of pages if specified
      const limitedDocuments = maxPages ? documents.slice(0, maxPages) : documents;
      
      const chunks = await this.splitDocuments(limitedDocuments, options);
      
      const enhancedChunks = chunks.map(chunk => {
        chunk.metadata = {
          ...chunk.metadata,
          ...options.metadata,
          processedAt: new Date().toISOString(),
        };
        return chunk;
      });

      const processingTime = Date.now() - startTime;
      
      return {
        id: `sitemap_${Date.now()}`,
        chunks: enhancedChunks,
        metadata: {
          originalSitemap: sitemapUrl,
          chunkCount: enhancedChunks.length,
          processingTime,
          pagesProcessed: limitedDocuments.length,
          ...options.metadata
        },
        processingTime
      };
    } catch (error) {
      logger.error(`Error loading sitemap content from ${sitemapUrl}:`, error);
      throw error;
    }
  }

  /**
   * Batch process multiple documents
   */
  async batchProcessDocuments(
    sources: Array<{ type: 'file' | 'url' | 'directory'; path: string; options?: DocumentProcessingOptions }>,
    embeddingProvider: AIProvider = this.defaultEmbeddingProvider
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const successful: ProcessedDocument[] = [];
    const failed: Array<{ source: string; error: string }> = [];
    
    for (const source of sources) {
      try {
        let processedDoc: ProcessedDocument;
        
        switch (source.type) {
          case 'file':
            processedDoc = await this.processDocument(source.path, source.options);
            break;
          case 'url':
            processedDoc = await this.loadWebContent(source.path, source.options);
            break;
          case 'directory':
            const dirResult = await this.processDirectory(source.path, source.options as DirectoryProcessingOptions);
            successful.push(...dirResult.successful);
            failed.push(...dirResult.failed);
            continue;
          default:
            throw new Error(`Unsupported source type: ${source.type}`);
        }
        
        // Add to vector store
        await this.addDocuments(processedDoc, embeddingProvider);
        successful.push(processedDoc);
        
      } catch (error) {
        failed.push({
          source: source.path,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const totalProcessingTime = Date.now() - startTime;
    
    logger.info(`Batch processing completed: ${successful.length} successful, ${failed.length} failed`);
    
    return {
      successful,
      failed,
      totalProcessingTime
    };
  }
}

// Export singleton instance
export const langchainRAG = new LangChainRAGService();
export default langchainRAG;