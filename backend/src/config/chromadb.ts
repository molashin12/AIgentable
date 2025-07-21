import { ChromaClient, OpenAIEmbeddingFunction, Collection, IncludeEnum, Metadata } from 'chromadb';
import { config } from './config';
import logger from '../utils/logger';
import OpenAI from 'openai';

interface DocumentMetadata {
  tenantId: string;
  agentId: string;
  documentId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  chunkIndex: number;
  totalChunks: number;
  source: string;
  [key: string]: string | number | boolean;
}

interface SearchResult {
  id: string;
  document: string;
  metadata: DocumentMetadata;
  distance: number;
}

class ChromaDBConnection {
  private static instance: ChromaDBConnection;
  private client: ChromaClient;
  private openai: OpenAI;
  private embeddingFunction: OpenAIEmbeddingFunction;
  private collections: Map<string, Collection> = new Map();
  private isConnected: boolean = false;

  private constructor() {
    // Initialize OpenAI client for embeddings
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Initialize ChromaDB client
    this.client = new ChromaClient({
      path: `http://${config.chromaHost}:${config.chromaPort}`,
    });

    // Initialize OpenAI embedding function
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: config.openaiApiKey,
      openai_model: config.openaiEmbeddingModel,
    });
  }

  public static getInstance(): ChromaDBConnection {
    if (!ChromaDBConnection.instance) {
      ChromaDBConnection.instance = new ChromaDBConnection();
    }
    return ChromaDBConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      // Test the connection
      await this.client.heartbeat();
      this.isConnected = true;
      logger.info('Successfully connected to ChromaDB');
      
      // Initialize default collection
      await this.initializeCollections();
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to ChromaDB:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.collections.clear();
      this.isConnected = false;
      logger.info('Disconnected from ChromaDB');
    } catch (error) {
      logger.error('Error disconnecting from ChromaDB:', error);
      throw error;
    }
  }

  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  public async healthCheck(): Promise<{ status: string; timestamp: Date; latency?: number }> {
    try {
      const start = Date.now();
      await this.client.heartbeat();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        latency,
      };
    } catch (error) {
      logger.error('ChromaDB health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }

  private async initializeCollections(): Promise<void> {
    try {
      // Create or get the main collection
      const mainCollection = await this.getOrCreateCollection(config.chromaCollectionName);
      this.collections.set('main', mainCollection);
      
      logger.info('ChromaDB collections initialized');
    } catch (error) {
      logger.error('Failed to initialize ChromaDB collections:', error);
      throw error;
    }
  }

  public async getOrCreateCollection(name: string): Promise<Collection> {
    try {
      // Try to get existing collection
      let collection: Collection;
      try {
        collection = await this.client.getCollection({
          name,
          embeddingFunction: this.embeddingFunction,
        });
        logger.info(`Retrieved existing collection: ${name}`);
      } catch (error) {
        // Collection doesn't exist, create it
        collection = await this.client.createCollection({
          name,
          embeddingFunction: this.embeddingFunction,
          metadata: {
            description: `AIgentable collection for ${name}`,
            created_at: new Date().toISOString(),
          },
        });
        logger.info(`Created new collection: ${name}`);
      }
      
      return collection;
    } catch (error) {
      logger.error(`Failed to get or create collection ${name}:`, error);
      throw error;
    }
  }

  public async getTenantCollection(tenantId: string): Promise<Collection> {
    const collectionName = `tenant_${tenantId}`;
    
    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName)!;
    }
    
    const collection = await this.getOrCreateCollection(collectionName);
    this.collections.set(collectionName, collection);
    
    return collection;
  }

  public async addDocuments(
    tenantId: string,
    documents: string[],
    metadatas: DocumentMetadata[],
    ids?: string[]
  ): Promise<void> {
    try {
      const collection = await this.getTenantCollection(tenantId);
      
      const documentIds = ids || documents.map((_, index) => 
        `${tenantId}_${metadatas[index].documentId}_${metadatas[index].chunkIndex}_${Date.now()}`
      );
      
      await collection.add({
        ids: documentIds,
        documents,
        metadatas: metadatas as Metadata[],
      });
      
      logger.info(`Added ${documents.length} documents to collection for tenant ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to add documents for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  public async searchDocuments(
    tenantId: string,
    query: string,
    nResults: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const collection = await this.getTenantCollection(tenantId);
      
      const results = await collection.query({
        queryTexts: [query],
        nResults,
        where: filter,
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
      });
      
      const searchResults: SearchResult[] = [];
      
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          searchResults.push({
            id: results.ids?.[0]?.[i] || '',
            document: results.documents[0][i] || '',
            metadata: (results.metadatas?.[0]?.[i] as unknown as DocumentMetadata) || {} as DocumentMetadata,
            distance: results.distances?.[0]?.[i] || 0,
          });
        }
      }
      
      logger.info(`Found ${searchResults.length} results for query in tenant ${tenantId}`);
      return searchResults;
    } catch (error) {
      logger.error(`Failed to search documents for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  public async deleteDocuments(tenantId: string, documentId: string): Promise<void> {
    try {
      const collection = await this.getTenantCollection(tenantId);
      
      // Find all chunks for this document
      const results = await collection.get({
        where: { documentId },
        include: [IncludeEnum.Metadatas],
      });
      
      if (results.ids && results.ids.length > 0) {
        await collection.delete({
          ids: results.ids,
        });
        
        logger.info(`Deleted ${results.ids.length} chunks for document ${documentId} in tenant ${tenantId}`);
      }
    } catch (error) {
      logger.error(`Failed to delete document ${documentId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  public async updateDocuments(
    tenantId: string,
    ids: string[],
    documents?: string[],
    metadatas?: DocumentMetadata[]
  ): Promise<void> {
    try {
      const collection = await this.getTenantCollection(tenantId);
      
      await collection.update({
        ids,
        documents,
        metadatas: metadatas as Metadata[],
      });
      
      logger.info(`Updated ${ids.length} documents in tenant ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to update documents for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  public async getDocumentCount(tenantId: string): Promise<number> {
    try {
      const collection = await this.getTenantCollection(tenantId);
      const count = await collection.count();
      return count;
    } catch (error) {
      logger.error(`Failed to get document count for tenant ${tenantId}:`, error);
      return 0;
    }
  }

  public async getDocumentsByAgent(tenantId: string, agentId: string): Promise<SearchResult[]> {
    try {
      const collection = await this.getTenantCollection(tenantId);
      
      const results = await collection.get({
        where: { agentId },
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
      });
      
      const documents: SearchResult[] = [];
      
      if (results.documents && results.metadatas) {
        for (let i = 0; i < results.documents.length; i++) {
          documents.push({
            id: results.ids?.[i] || '',
            document: results.documents[i] || '',
            metadata: (results.metadatas[i] as unknown as DocumentMetadata) || {} as DocumentMetadata,
            distance: 0, // Not applicable for direct retrieval
          });
        }
      }
      
      return documents;
    } catch (error) {
      logger.error(`Failed to get documents for agent ${agentId} in tenant ${tenantId}:`, error);
      return [];
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: config.openaiEmbeddingModel,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  public async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: config.openaiEmbeddingModel,
        input: texts,
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Failed to generate batch embeddings:', error);
      throw error;
    }
  }

  // Utility method to chunk text for better embeddings
  public chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      
      if (end === text.length) break;
      start = end - overlap;
    }
    
    return chunks;
  }

  // Advanced search with semantic similarity
  public async semanticSearch(
    tenantId: string,
    query: string,
    options: {
      nResults?: number;
      agentId?: string;
      fileType?: string;
      dateRange?: { start: string; end: string };
      minSimilarity?: number;
    } = {}
  ): Promise<SearchResult[]> {
    try {
      const {
        nResults = 5,
        agentId,
        fileType,
        dateRange,
        minSimilarity = 0.7
      } = options;
      
      // Build filter
      const filter: Record<string, any> = {};
      if (agentId) filter.agentId = agentId;
      if (fileType) filter.fileType = fileType;
      if (dateRange) {
        filter.uploadedAt = {
          $gte: dateRange.start,
          $lte: dateRange.end,
        };
      }
      
      const results = await this.searchDocuments(tenantId, query, nResults * 2, filter);
      
      // Filter by similarity threshold
      return results.filter(result => (1 - result.distance) >= minSimilarity);
    } catch (error) {
      logger.error(`Semantic search failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Collection management
  public async deleteCollection(tenantId: string): Promise<void> {
    try {
      const collectionName = `tenant_${tenantId}`;
      await this.client.deleteCollection({ name: collectionName });
      this.collections.delete(collectionName);
      
      logger.info(`Deleted collection for tenant ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to delete collection for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  public async listCollections(): Promise<string[]> {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      logger.error('Failed to list collections:', error);
      return [];
    }
  }
}

// Export singleton instance
export const chromadb = ChromaDBConnection.getInstance();
export default chromadb;
export type { DocumentMetadata, SearchResult };

// Export function for backward compatibility
export const getChromaClient = () => chromadb;

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await chromadb.disconnect();
});

process.on('SIGINT', async () => {
  await chromadb.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await chromadb.disconnect();
  process.exit(0);
});