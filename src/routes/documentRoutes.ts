import express from 'express';
import multer from 'multer';
import { validate } from '../middleware/validation';
import { validationSchemas } from '../utils/validationSchemas';
import { logger } from '../utils/logger';
import { verifyToken, requireAdmin } from '../middleware/auth';
import { DocumentModel } from '../models/document';
import { b2StorageService } from '../services/b2StorageService';
import { ApiError, NotFoundError } from '../middleware/error';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common document types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

/**
 * @route   GET /api/documents
 * @desc    Get all documents
 * @access  Private (Admin)
 */
router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const documents = await DocumentModel.getAll();
    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/documents/:id
 * @desc    Get document by ID
 * @access  Private
 */
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const document = await DocumentModel.getById(req.params.id);
    
    if (!document) {
      throw new NotFoundError(`Document with ID ${req.params.id} not found`);
    }
    
    // Check if user has access to this document
    if (req.user?.role !== 'Administrator' && document.employee_id !== req.user?.uid) {
      throw new ApiError('Access denied', 403);
    }
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/documents/employee/:employeeId
 * @desc    Get documents by employee ID
 * @access  Private
 */
router.get('/employee/:employeeId', verifyToken, async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    
    // Check if user has access to this employee's documents
    if (req.user?.role !== 'Administrator' && employeeId !== req.user?.uid) {
      throw new ApiError('Access denied', 403);
    }
    
    const documents = await DocumentModel.getByEmployeeId(employeeId);
    
    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/documents
 * @desc    Upload a new document
 * @access  Private
 */
router.post('/', 
  verifyToken, 
  upload.single('file'),
  async (req, res, next) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        throw new ApiError('No file uploaded', 400);
      }

      const { 
        name, 
        type, 
        employee_id, 
        expiry_date, 
        notes 
      } = req.body;

      // Validate required fields
      if (!name || !type || !employee_id) {
        throw new ApiError('Missing required fields', 400);
      }

      // Check if user has access to upload for this employee
      if (req.user?.role !== 'Administrator' && employee_id !== req.user?.uid) {
        throw new ApiError('Access denied', 403);
      }

      try {
        // Ensure we have a buffer for the file
        const fileBuffer = Buffer.isBuffer(req.file.buffer) 
          ? req.file.buffer 
          : Buffer.from(await req.file.buffer);
        
        // Upload file to Backblaze B2
        const uploadResult = await b2StorageService.uploadFile(
          fileBuffer,
          req.file.originalname,
          req.file.mimetype,
          'employee-documents'
        );

        // Create document record in database
        const documentData = {
          name,
          type,
          employee_id,
          file_id: uploadResult.fileId,
          file_name: uploadResult.fileName,
          file_path: uploadResult.filePath,
        };

        // Get file size
        const fileSize = Buffer.isBuffer(req.file.buffer) 
          ? req.file.buffer.length 
          : req.file.size;

        // Log upload details with proper typing
        logger.debug('Uploading file to B2', {
          originalName: req.file.originalname,
          size: fileSize,
          mimeType: req.file.mimetype
        });

        const document = await DocumentModel.create(documentData);

        logger.info('Document uploaded successfully', {
          documentId: document.id,
          employeeId: employee_id,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize
        });

        res.status(201).json({
          success: true,
          data: document
        });
      } catch (error) {
        // Log error with proper typing
        logger.error('Error uploading document to B2', {
          error: error instanceof Error ? error.message : 'Unknown error',
          originalName: req.file?.originalname || 'unknown'
        });
        throw new ApiError('Failed to upload document to storage', 500);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/documents/download/:id
 * @desc    Download a document
 * @access  Private
 */
router.get('/download/:id', verifyToken, async (req, res, next) => {
  try {
    const document = await DocumentModel.getById(req.params.id);
    
    if (!document) {
      throw new NotFoundError('Document not found');
    }
    
    // Check if user has access to this document
    if (req.user?.role !== 'Administrator' && document.employee_id !== req.user?.uid) {
      throw new ApiError('Access denied', 403);
    }
    
    try {
      // Get download URL from B2 storage service
      if (!document.file_id) {
        throw new ApiError('File ID is missing', 404);
      }
      
      const downloadUrl = await b2StorageService.getDownloadUrl(
        document.file_id,
        document.file_name || undefined
      );
      
      // Redirect to the download URL
      res.redirect(downloadUrl);
    } catch (error) {
      logger.error('Error generating download URL:', error);
      throw new ApiError('Failed to generate download URL', 500);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document
 * @access  Private (Admin)
 */
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const document = await DocumentModel.getById(req.params.id);
    
    if (!document) {
      throw new NotFoundError('Document not found');
    }
    
    try {
      // Delete file from B2 storage if file_id exists
      if (document.file_id) {
        try {
          // Delete the file - pass empty string if file_name is undefined
          await b2StorageService.deleteFile(document.file_id, document.file_name || '');
        } catch (error) {
          // Log error with proper typing
          logger.error('Error deleting file from storage', {
            documentId: document.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Continue with database deletion even if storage deletion fails
        }
      }
      
      // Delete document from database
      await DocumentModel.delete(document.id);
      
      logger.info('Document deleted successfully', {
        documentId: document.id,
        employeeId: document.employee_id,
        fileName: document.file_name
      });
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting document from storage:', { 
        documentId: document.id,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new ApiError('Failed to delete document from storage', 500);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/documents/expiring
 * @desc    Get documents with expiring dates
 * @access  Private (Admin)
 */
router.get('/expiring/:days', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const documents = await DocumentModel.getExpiringDocuments(days);
    
    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    next(error);
  }
});

export default router;
