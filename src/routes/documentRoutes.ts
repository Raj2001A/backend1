import express from 'express';
import multer from 'multer';
import { validate } from '../middleware/validation';
import { validationSchemas } from '../utils/validationSchemas';
import { logger } from '../utils/logger';
import { verifyToken, requireAdmin } from '../middleware/auth';
import { DocumentModel } from '../models/document';
import { storageService } from '../services/storageService';
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

      // Upload file to Backblaze B2
      const uploadResult = await storageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        `documents/${employee_id}`
      );

      // Create document record in database
      const document = await DocumentModel.create({
        name,
        type,
        employee_id,
        file_id: uploadResult.fileId,
        file_name: req.file.originalname,
        file_path: uploadResult.filePath,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        expiry_date: expiry_date ? new Date(expiry_date) : undefined,
        notes,
        status: 'active'
      });

      logger.info('Document uploaded successfully', {
        documentId: document.id,
        employeeId: employee_id,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });

      res.status(201).json({
        success: true,
        data: document
      });
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
      throw new NotFoundError(`Document with ID ${req.params.id} not found`);
    }
    
    // Check if user has access to this document
    if (req.user?.role !== 'Administrator' && document.employee_id !== req.user?.uid) {
      throw new ApiError('Access denied', 403);
    }
    
    // Get download URL from Backblaze B2
    const downloadUrl = await storageService.getDownloadUrl(document.file_id!, document.file_name!);
    
    // Log download
    logger.info('Document download requested', {
      documentId: document.id,
      employeeId: document.employee_id,
      userId: req.user?.uid,
      fileName: document.file_name
    });
    
    // Redirect to download URL
    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName: document.file_name,
        mimeType: document.mime_type
      }
    });
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
      throw new NotFoundError(`Document with ID ${req.params.id} not found`);
    }
    
    // Delete file from Backblaze B2
    if (document.file_id) {
      await storageService.deleteFile(document.file_id);
    }
    
    // Delete document record from database
    const deleted = await DocumentModel.delete(req.params.id);
    
    if (!deleted) {
      throw new ApiError('Failed to delete document', 500);
    }
    
    logger.info('Document deleted successfully', {
      documentId: req.params.id,
      employeeId: document.employee_id,
      fileName: document.file_name
    });
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
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
