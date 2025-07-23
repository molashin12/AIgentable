import express from 'express';
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { chromadb } from '../config/chromadb';
import { authenticate, requireTenant, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery, documentSchemas, validateId, validatePagination, validateFileUpload } from '../utils/validation';
import { asyncHandler } from '../utils/errors';
import {
  ApiError,
  NotFoundError,
  ValidationError,
  FileUploadError,
} from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import csv from 'csv-parser';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(config.uploadPath, 'documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 5, // Maximum 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = config.allowedFileTypes;
    const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new FileUploadError(`File type .${fileExtension} is not allowed`));
    }
  },
});

// Apply authentication and tenant requirement to all routes
router.use(authenticate);
router.use(requireTenant);

// Helper function to get MIME type from file extension
const getMimeTypeFromExtension = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Text extraction functions
const extractTextFromFile = async (filePath: string, fileName: string): Promise<string> => {
  const mimeType = getMimeTypeFromExtension(fileName);
  try {
    switch (mimeType) {
      case 'application/pdf':
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(pdfBuffer);
        return pdfData.text;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        const docBuffer = fs.readFileSync(filePath);
        const docData = await mammoth.extractRawText({ buffer: docBuffer });
        return docData.value;
      
      case 'text/plain':
      case 'text/csv':
        return fs.readFileSync(filePath, 'utf-8');
      
      case 'application/json':
        const jsonContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(jsonContent);
        return JSON.stringify(jsonData, null, 2);
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    logger.error('Text extraction failed:', {
      filePath,
      mimeType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new FileUploadError('Failed to extract text from file');
  }
};

// Get all documents for tenant
router.get('/', validatePagination, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const { agentId, search } = req.query;
  const tenantId = req.user!.tenantId;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build where clause
  const where: Record<string, any> = { tenantId };
  if (agentId) where.agentId = agentId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { originalName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      documents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
}));

// Get document by ID
router.get('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!document) {
    throw new NotFoundError('Document');
  }

  res.json({
    success: true,
    data: { document },
  });
}));

// Upload documents
router.post('/upload', 
  upload.array('files', 5),
  validateFileUpload(config.allowedFileTypes, config.maxFileSize),
  validateBody(documentSchemas.upload),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { agentId } = req.body;
    const tenantId = req.user!.tenantId;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    // Verify agent exists if provided
    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, tenantId },
      });
      if (!agent) {
        throw new NotFoundError('Agent');
      }
    }

    const uploadedDocuments = [];

    for (const file of files) {
      try {
        // Extract text from file
        const extractedText = await extractTextFromFile(file.path, file.originalname);
        
        // Determine document type from file extension
        const fileExtension = path.extname(file.originalname).toLowerCase();
        let documentType: string;
        switch (fileExtension) {
          case '.pdf': documentType = 'PDF'; break;
          case '.doc': documentType = 'DOC'; break;
          case '.docx': documentType = 'DOCX'; break;
          case '.txt': documentType = 'TXT'; break;
          case '.csv': documentType = 'CSV'; break;
          case '.json': documentType = 'JSON'; break;
          case '.html': case '.htm': documentType = 'HTML'; break;
          case '.md': case '.markdown': documentType = 'MD'; break;
          default: documentType = 'TXT'; // Default fallback
        }
        
        // Create document record
        const document = await prisma.document.create({
          data: {
            name: file.originalname,
            originalName: file.originalname,
            type: documentType as any,
            path: file.path,
            size: file.size,
            content: extractedText,
            tenantId,
            agentId: agentId || null,
          },
        });

        // Process text for ChromaDB
        const chunks = chromadb.chunkText(extractedText, 1000, 200);
        const chunkMetadatas = chunks.map((chunk, index) => ({
          tenantId,
          agentId: agentId || '',
          documentId: document.id,
          fileName: file.originalname,
          fileType: path.extname(file.originalname).substring(1),
          uploadedAt: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length,
          source: 'upload',
        }));

        // Add to ChromaDB
        await chromadb.addDocuments(tenantId, chunks, chunkMetadatas);

        uploadedDocuments.push(document);

        logger.business('Document uploaded', {
          documentId: document.id,
          fileName: file.originalname,
          size: file.size,
          chunks: chunks.length,
          agentId,
          tenantId,
          userId: req.user!.id,
        });
      } catch (error) {
        logger.error('Document processing failed:', {
          fileName: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        // Clean up file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        throw new FileUploadError(`Failed to process file: ${file.originalname}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      data: { documents: uploadedDocuments },
    });
  })
);

// Update document
router.put('/:id', validateId, validateBody(documentSchemas.update), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const updateData = req.body;

  // Check if document exists and belongs to tenant
  const existingDocument = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!existingDocument) {
    throw new NotFoundError('Document');
  }

  // Update document
  const document = await prisma.document.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
  });

  logger.business('Document updated', {
    documentId: document.id,
    changes: Object.keys(updateData),
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Document updated successfully',
    data: { document },
  });
}));

// Delete document
router.delete('/:id', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  // Check if document exists and belongs to tenant
  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Delete from ChromaDB
  try {
    await chromadb.deleteDocuments(tenantId, id);
  } catch (error) {
    logger.warn('Failed to delete document from ChromaDB:', {
      documentId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Delete file from filesystem
  if (document.path && fs.existsSync(document.path)) {
    try {
      fs.unlinkSync(document.path);
    } catch (error) {
      logger.warn('Failed to delete file from filesystem:', {
        filePath: document.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Delete from database
  await prisma.document.delete({
    where: { id },
  });

  logger.business('Document deleted', {
    documentId: id,
    fileName: document.name,
    tenantId,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Document deleted successfully',
  });
}));

// Search documents with advanced capabilities
router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      query, 
      agentId, 
      fileType, 
      dateRange, 
      nResults = 5, 
      minSimilarity = 0.7,
      strategy = 'hybrid',
      enableReranking = 'true',
      keywordWeight = '0.3',
      semanticWeight = '0.7'
    } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    
    // Validate strategy
    const validStrategies = ['semantic', 'keyword', 'hybrid'];
    if (!validStrategies.includes(strategy as string)) {
      res.status(400).json({ 
        error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` 
      });
      return;
    }
    
    const searchOptions: any = {
      strategy: strategy as 'semantic' | 'keyword' | 'hybrid',
      nResults: parseInt(nResults as string),
      minSimilarity: parseFloat(minSimilarity as string),
      enableReranking: enableReranking === 'true',
    };
    
    // Add hybrid-specific options
    if (strategy === 'hybrid') {
      searchOptions.keywordWeight = parseFloat(keywordWeight as string);
      searchOptions.semanticWeight = parseFloat(semanticWeight as string);
      
      // Validate weights sum to 1
      if (Math.abs(searchOptions.keywordWeight + searchOptions.semanticWeight - 1) > 0.01) {
        res.status(400).json({ 
          error: 'keywordWeight and semanticWeight must sum to 1.0' 
        });
        return;
      }
    }
    
    if (agentId) searchOptions.agentId = agentId as string;
    if (fileType) searchOptions.fileType = fileType as string;
    if (dateRange) {
      try {
        searchOptions.dateRange = JSON.parse(dateRange as string);
      } catch (error) {
        res.status(400).json({ error: 'Invalid dateRange format' });
        return;
      }
    }
    
    const results = await chromadb.advancedSearch(
      req.user!.tenantId,
      query,
      searchOptions
    );
    
    res.json({
      query,
      strategy: searchOptions.strategy,
      results: results.map(result => ({
        id: result.id,
        content: result.document,
        similarity: 1 - result.distance,
        metadata: result.metadata,
      })),
      total: results.length,
      searchOptions: {
        strategy: searchOptions.strategy,
        nResults: searchOptions.nResults,
        minSimilarity: searchOptions.minSimilarity,
        enableReranking: searchOptions.enableReranking,
        ...(strategy === 'hybrid' && {
          keywordWeight: searchOptions.keywordWeight,
          semanticWeight: searchOptions.semanticWeight,
        }),
      },
    });
  } catch (error) {
    logger.error('Document search failed:', error);
    res.status(500).json({ error: 'Search failed' });
    return;
  }
});



// Semantic search endpoint
router.get('/search/semantic', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, agentId, fileType, dateRange, nResults = 5, minSimilarity = 0.7 } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    
    const searchOptions: any = {
      nResults: parseInt(nResults as string),
      minSimilarity: parseFloat(minSimilarity as string),
    };
    
    if (agentId) searchOptions.agentId = agentId as string;
    if (fileType) searchOptions.fileType = fileType as string;
    if (dateRange) {
      try {
        searchOptions.dateRange = JSON.parse(dateRange as string);
      } catch (error) {
        res.status(400).json({ error: 'Invalid dateRange format' });
        return;
      }
    }
    
    const results = await chromadb.semanticSearch(
      req.user!.tenantId,
      query,
      searchOptions
    );
    
    res.json({
      query,
      results: results.map(result => ({
        id: result.id,
        content: result.document,
        similarity: 1 - result.distance,
        metadata: result.metadata,
      })),
      total: results.length,
    });
  } catch (error) {
    logger.error('Semantic search failed:', error);
    res.status(500).json({ error: 'Search failed' });
    return;
  }
});

// Keyword search endpoint
router.get('/search/keyword', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, agentId, fileType, dateRange, nResults = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    
    const searchOptions: any = {
      nResults: parseInt(nResults as string),
    };
    
    if (agentId) searchOptions.agentId = agentId as string;
    if (fileType) searchOptions.fileType = fileType as string;
    if (dateRange) {
      try {
        searchOptions.dateRange = JSON.parse(dateRange as string);
      } catch (error) {
        res.status(400).json({ error: 'Invalid dateRange format' });
        return;
      }
    }
    
    const results = await chromadb.keywordSearch(
      req.user!.tenantId,
      query,
      searchOptions
    );
    
    res.json({
      query,
      results: results.map(result => ({
        id: result.id,
        content: result.document,
        similarity: 1 - result.distance,
        metadata: result.metadata,
      })),
      total: results.length,
    });
  } catch (error) {
    logger.error('Keyword search failed:', error);
    res.status(500).json({ error: 'Search failed' });
    return;
  }
});

// Hybrid search endpoint
router.get('/search/hybrid', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      query, 
      agentId, 
      fileType, 
      dateRange, 
      nResults = 5, 
      minSimilarity = 0.6,
      keywordWeight = '0.3',
      semanticWeight = '0.7',
      enableReranking = 'true'
    } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    
    const searchOptions: any = {
      nResults: parseInt(nResults as string),
      minSimilarity: parseFloat(minSimilarity as string),
      keywordWeight: parseFloat(keywordWeight as string),
      semanticWeight: parseFloat(semanticWeight as string),
      enableReranking: enableReranking === 'true',
    };
    
    // Validate weights sum to 1
    if (Math.abs(searchOptions.keywordWeight + searchOptions.semanticWeight - 1) > 0.01) {
      res.status(400).json({ 
        error: 'keywordWeight and semanticWeight must sum to 1.0' 
      });
      return;
    }
    
    if (agentId) searchOptions.agentId = agentId as string;
    if (fileType) searchOptions.fileType = fileType as string;
    if (dateRange) {
      try {
        searchOptions.dateRange = JSON.parse(dateRange as string);
      } catch (error) {
        res.status(400).json({ error: 'Invalid dateRange format' });
        return;
      }
    }
    
    const results = await chromadb.hybridSearch(
      req.user!.tenantId,
      query,
      searchOptions
    );
    
    res.json({
      query,
      results: results.map(result => ({
        id: result.id,
        content: result.document,
        similarity: 1 - result.distance,
        metadata: result.metadata,
      })),
      total: results.length,
      searchOptions: {
        keywordWeight: searchOptions.keywordWeight,
        semanticWeight: searchOptions.semanticWeight,
        enableReranking: searchOptions.enableReranking,
      },
    });
  } catch (error) {
    logger.error('Hybrid search failed:', error);
    res.status(500).json({ error: 'Search failed' });
    return;
  }
});

// Download document
router.get('/:id/download', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!document) {
    throw new NotFoundError('Document');
  }

  if (!document.path || !fs.existsSync(document.path)) {
    throw new NotFoundError('File not found on server');
  }

  // Set appropriate headers
  res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', document.size.toString());

  // Stream file
  const fileStream = fs.createReadStream(document.path);
  fileStream.pipe(res);

  logger.business('Document downloaded', {
    documentId: id,
    fileName: document.name,
    tenantId,
    userId: req.user!.id,
  });
}));

// Get document content (text)
router.get('/:id/content', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!document) {
    throw new NotFoundError('Document');
  }

  res.json({
    success: true,
    data: {
      id: document.id,
      name: document.name,
      content: document.content,
      type: document.type,
      size: document.size,
      createdAt: document.createdAt,
    },
  });
}));

// Reprocess document (re-extract text and update ChromaDB)
router.post('/:id/reprocess', validateId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const document = await prisma.document.findFirst({
    where: { id, tenantId },
  });

  if (!document) {
    throw new NotFoundError('Document');
  }

  if (!document.path || !fs.existsSync(document.path)) {
    throw new ValidationError('Original file not found, cannot reprocess');
  }

  try {
    // Re-extract text - derive mime type from document type
    const mimeTypeMap: Record<string, string> = {
      'PDF': 'application/pdf',
      'DOC': 'application/msword',
      'DOCX': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'TXT': 'text/plain',
      'CSV': 'text/csv',
      'JSON': 'application/json',
      'HTML': 'text/html',
      'MD': 'text/markdown'
    };
    const mimeType = mimeTypeMap[document.type] || 'application/octet-stream';
    const extractedText = await extractTextFromFile(document.path, mimeType);
    
    // Update document content
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        content: extractedText,
        updatedAt: new Date(),
      },
    });

    // Delete old chunks from ChromaDB
    await chromadb.deleteDocuments(tenantId, id);

    // Re-chunk and add to ChromaDB
    const chunks = chromadb.chunkText(extractedText, 1000, 200);
    const chunkMetadatas = chunks.map((chunk, index) => ({
      tenantId,
      agentId: document.agentId || '',
      documentId: document.id,
      fileName: document.name,
      fileType: path.extname(document.name).substring(1),
      uploadedAt: new Date().toISOString(),
      chunkIndex: index,
      totalChunks: chunks.length,
      source: 'reprocess',
    }));

    await chromadb.addDocuments(tenantId, chunks, chunkMetadatas);

    logger.business('Document reprocessed', {
      documentId: id,
      fileName: document.name,
      chunks: chunks.length,
      tenantId,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Document reprocessed successfully',
      data: {
        document: updatedDocument,
        chunks: chunks.length,
      },
    });
  } catch (error) {
    logger.error('Document reprocessing failed:', {
      documentId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new FileUploadError('Failed to reprocess document');
  }
}));

// Get document statistics
router.get('/stats/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;

  const [totalStats, categoryStats, agentStats, recentUploads] = await Promise.all([
    // Total statistics
    prisma.document.aggregate({
      where: { tenantId },
      _count: true,
      _sum: { size: true },
    }),
    
    // By type
    prisma.document.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: true,
      _sum: { size: true },
    }),
    
    // By agent
    prisma.document.groupBy({
      by: ['agentId'],
      where: { tenantId, agentId: { not: null } },
      _count: true,
      _sum: { size: true },
    }),
    
    // Recent uploads
    prisma.document.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        size: true,
        type: true,
        createdAt: true,
        agent: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      total: {
        documents: totalStats._count,
        size: totalStats._sum.size || 0,
      },
      byType: categoryStats.map(stat => ({
        type: stat.type,
        count: stat._count,
        size: stat._sum?.size || 0,
      })),
      byAgent: agentStats.map(stat => ({
        agentId: stat.agentId,
        count: stat._count,
        size: stat._sum?.size || 0,
      })),
      recentUploads,
    },
  });
}));

export default router;