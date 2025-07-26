import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '../lib/api';
import {
  EmbeddingResult,
  TextSimilarityResult,
  SimilarText,
  EmbeddingProvider,
  EmbeddingProvidersResponse,
  EmbeddingApiResponse
} from '../types/embeddings';

export interface UseEmbeddingsState {
  isLoading: boolean;
  error: string | null;
  providers: EmbeddingProvider[];
  models: Record<EmbeddingProvider, any> | null;
}

export interface UseEmbeddingsActions {
  generateEmbedding: (text: string, provider?: EmbeddingProvider) => Promise<EmbeddingResult | null>;
  generateBatchEmbeddings: (texts: string[], provider?: EmbeddingProvider, batchSize?: number) => Promise<EmbeddingResult | null>;
  calculateSimilarity: (text1: string, text2: string, provider?: EmbeddingProvider) => Promise<TextSimilarityResult | null>;
  findSimilarTexts: (queryText: string, candidateTexts: string[], topK?: number, provider?: EmbeddingProvider) => Promise<SimilarText[] | null>;
  loadProviders: () => Promise<void>;
  validateTextLength: (text: string, provider?: EmbeddingProvider) => boolean;
  chunkText: (text: string, provider?: EmbeddingProvider) => string[];
}

export interface UseEmbeddingsReturn extends UseEmbeddingsState, UseEmbeddingsActions {}

const MODEL_LIMITS = {
  openai: {
    maxTokens: 8191,
    dimensions: 1536,
    model: 'text-embedding-ada-002'
  },
  gemini: {
    maxTokens: 2048,
    dimensions: 768,
    model: 'gemini-embedding-001'
  }
} as const;

export const useEmbeddings = (): UseEmbeddingsReturn => {
  const [state, setState] = useState<UseEmbeddingsState>({
    isLoading: false,
    error: null,
    providers: [],
    models: null
  });

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const handleApiError = useCallback((error: any, operation: string) => {
    console.error(`Embedding ${operation} error:`, error);
    const errorMessage = error.response?.data?.message || error.message || `Failed to ${operation}`;
    setError(errorMessage);
    toast.error(errorMessage);
  }, [setError]);

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response: EmbeddingApiResponse<EmbeddingProvidersResponse> = await apiClient.getEmbeddingProviders();
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          providers: response.data.providers,
          models: response.data.models
        }));
      } else {
        throw new Error(response.message || 'Failed to load providers');
      }
    } catch (error) {
      handleApiError(error, 'load providers');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, handleApiError]);

  const validateTextLength = useCallback((text: string, provider: EmbeddingProvider = 'gemini'): boolean => {
    const limits = MODEL_LIMITS[provider];
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedTokens = text.length / 4;
    return estimatedTokens <= limits.maxTokens;
  }, []);

  const chunkText = useCallback((text: string, provider: EmbeddingProvider = 'gemini'): string[] => {
    const limits = MODEL_LIMITS[provider];
    const maxChars = limits.maxTokens * 4; // Rough estimation
    const overlap = 100;
    
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      start = end - overlap;
    }
    
    return chunks;
  }, []);

  const generateEmbedding = useCallback(async (
    text: string,
    provider: EmbeddingProvider = 'gemini'
  ): Promise<EmbeddingResult | null> => {
    try {
      setLoading(true);
      setError(null);

      if (!validateTextLength(text, provider)) {
        throw new Error(`Text is too long for ${provider} model. Maximum ${MODEL_LIMITS[provider].maxTokens} tokens allowed.`);
      }

      const response: EmbeddingApiResponse<EmbeddingResult> = await apiClient.generateEmbedding(text, provider);
      
      if (response.success) {
        toast.success('Embedding generated successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to generate embedding');
      }
    } catch (error) {
      handleApiError(error, 'generate embedding');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, handleApiError, validateTextLength]);

  const generateBatchEmbeddings = useCallback(async (
    texts: string[],
    provider: EmbeddingProvider = 'gemini',
    batchSize: number = 50
  ): Promise<EmbeddingResult | null> => {
    try {
      setLoading(true);
      setError(null);

      // Validate all texts
      const invalidTexts = texts.filter(text => !validateTextLength(text, provider));
      if (invalidTexts.length > 0) {
        throw new Error(`${invalidTexts.length} texts are too long for ${provider} model.`);
      }

      if (texts.length > 100) {
        throw new Error('Maximum 100 texts allowed per batch');
      }

      const response: EmbeddingApiResponse<EmbeddingResult> = await apiClient.generateBatchEmbeddings(
        texts,
        provider,
        batchSize
      );
      
      if (response.success) {
        toast.success(`Generated embeddings for ${texts.length} texts`);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to generate batch embeddings');
      }
    } catch (error) {
      handleApiError(error, 'generate batch embeddings');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, handleApiError, validateTextLength]);

  const calculateSimilarity = useCallback(async (
    text1: string,
    text2: string,
    provider: EmbeddingProvider = 'gemini'
  ): Promise<TextSimilarityResult | null> => {
    try {
      setLoading(true);
      setError(null);

      if (!validateTextLength(text1, provider) || !validateTextLength(text2, provider)) {
        throw new Error(`One or both texts are too long for ${provider} model.`);
      }

      const response: EmbeddingApiResponse<TextSimilarityResult> = await apiClient.calculateTextSimilarity(
        text1,
        text2,
        provider
      );
      
      if (response.success) {
        toast.success(`Similarity calculated: ${(response.data.similarity * 100).toFixed(1)}%`);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to calculate similarity');
      }
    } catch (error) {
      handleApiError(error, 'calculate similarity');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, handleApiError, validateTextLength]);

  const findSimilarTexts = useCallback(async (
    queryText: string,
    candidateTexts: string[],
    topK: number = 5,
    provider: EmbeddingProvider = 'gemini'
  ): Promise<SimilarText[] | null> => {
    try {
      setLoading(true);
      setError(null);

      if (!validateTextLength(queryText, provider)) {
        throw new Error(`Query text is too long for ${provider} model.`);
      }

      const invalidTexts = candidateTexts.filter(text => !validateTextLength(text, provider));
      if (invalidTexts.length > 0) {
        throw new Error(`${invalidTexts.length} candidate texts are too long for ${provider} model.`);
      }

      if (candidateTexts.length > 1000) {
        throw new Error('Maximum 1000 candidate texts allowed');
      }

      if (topK > 100) {
        throw new Error('Maximum topK value is 100');
      }

      const response: EmbeddingApiResponse<SimilarText[]> = await apiClient.findSimilarTexts(
        queryText,
        candidateTexts,
        topK,
        provider
      );
      
      if (response.success) {
        toast.success(`Found ${response.data.length} similar texts`);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to find similar texts');
      }
    } catch (error) {
      handleApiError(error, 'find similar texts');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, handleApiError, validateTextLength]);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    providers: state.providers,
    models: state.models,
    
    // Actions
    generateEmbedding,
    generateBatchEmbeddings,
    calculateSimilarity,
    findSimilarTexts,
    loadProviders,
    validateTextLength,
    chunkText
  };
};

export default useEmbeddings;