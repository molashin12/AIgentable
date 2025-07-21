import { ChromaClient } from 'chromadb';
import { config } from './config';
import logger from '../utils/logger';

let chromaClient: ChromaClient | null = null;

export const initializeChroma = async (): Promise<ChromaClient> => {
  try {
    if (!chromaClient) {
      chromaClient = new ChromaClient({
        path: `http://${config.chromaHost}:${config.chromaPort}`,
      });
      
      // Test connection
      await chromaClient.heartbeat();
      logger.info('ChromaDB connected successfully', {
        url: `http://${config.chromaHost}:${config.chromaPort}`,
      });
    }
    
    return chromaClient;
  } catch (error) {
    logger.error('Failed to connect to ChromaDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: `http://${config.chromaHost}:${config.chromaPort}`,
    });
    throw error;
  }
};

export const getChromaClient = (): ChromaClient => {
  if (!chromaClient) {
    throw new Error('ChromaDB client not initialized. Call initializeChroma() first.');
  }
  return chromaClient;
};

export const closeChroma = async (): Promise<void> => {
  if (chromaClient) {
    // ChromaDB doesn't have an explicit close method
    chromaClient = null;
    logger.info('ChromaDB connection closed');
  }
};

export default chromaClient;