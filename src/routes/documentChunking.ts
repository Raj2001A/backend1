/**
 * Document Chunking Routes
 * 
 * Handles large file uploads by splitting them into manageable chunks
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { authenticateJWT } from '../middleware/auth';
import { DocumentChunkingService } from '../services/documentChunkingService';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error';

const router = express.Router();

// Initialize upload
router.post(
  '/initialize',
  authenticateJWT,
  [
    body('filename').isString().notEmpty().withMessage('Filename is required'),
    body('mimeType').isString().notEmpty().withMessage('MIME type is required'),
    body('totalSize').isInt({ min: 1 }).withMessage('Total size must be a positive integer')
  ],
  validateRequest,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { filename, mimeType, totalSize } = req.body;

      const result = await DocumentChunkingService.initializeUpload(
        filename,
        mimeType,
        totalSize
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Upload chunk
router.post(
  '/chunk/:uploadId/:chunkIndex',
  authenticateJWT,
  [
    param('uploadId').isUUID().withMessage('Invalid upload ID'),
    param('chunkIndex').isInt({ min: 0 }).withMessage('Chunk index must be a non-negative integer')
  ],
  validateRequest,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { uploadId, chunkIndex } = req.params;

      // Check if request has data
      if (!req.body || !Buffer.isBuffer(req.body)) {
        throw new ApiError('Request body must be a buffer', 400);
      }

      const result = await DocumentChunkingService.uploadChunk(
        uploadId,
        parseInt(chunkIndex, 10),
        req.body
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Finalize upload
router.post(
  '/finalize/:uploadId',
  authenticateJWT,
  [
    param('uploadId').isUUID().withMessage('Invalid upload ID'),
    body('employeeId').isUUID().withMessage('Invalid employee ID'),
    body('documentType').isString().notEmpty().withMessage('Document type is required')
  ],
  validateRequest,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { uploadId } = req.params;
      const { employeeId, documentType } = req.body;

      const result = await DocumentChunkingService.finalizeUpload(
        uploadId,
        employeeId,
        documentType
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get upload status
router.get(
  '/status/:uploadId',
  authenticateJWT,
  [
    param('uploadId').isUUID().withMessage('Invalid upload ID')
  ],
  validateRequest,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { uploadId } = req.params;

      const result = DocumentChunkingService.getUploadStatus(uploadId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Cancel upload
router.delete(
  '/cancel/:uploadId',
  authenticateJWT,
  [
    param('uploadId').isUUID().withMessage('Invalid upload ID')
  ],
  validateRequest,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { uploadId } = req.params;

      DocumentChunkingService.cancelUpload(uploadId);

      res.status(200).json({
        success: true,
        message: 'Upload cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
