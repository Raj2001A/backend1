/**
 * Document Chunking Service
 * 
 * Handles large file uploads by splitting them into manageable chunks
 * and reassembling them for storage in Backblaze B2.
 */

import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { authorizeB2 } from '../config/storage';

// Chunk size (5MB - Backblaze B2 minimum chunk size)
const CHUNK_SIZE = 5 * 1024 * 1024;

// Maximum file size (5GB)
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

// Temporary directory for chunks
const TEMP_DIR = path.join(os.tmpdir(), 'employee-management-chunks');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Interface for chunk metadata
interface ChunkMetadata {
  id: string;
  originalFilename: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  uploadId: string;
  timestamp: number;
  checksum: string;
}

// Interface for chunk upload result
interface ChunkUploadResult {
  chunkIndex: number;
  chunkId: string;
  uploadId: string;
  success: boolean;
}

// Interface for file upload result
interface FileUploadResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadTimestamp: number;
  downloadUrl: string;
  checksum: string;
}

// Document chunking service
export const DocumentChunkingService = {
  /**
   * Initialize a chunked upload
   * @param originalFilename Original filename
   * @param mimeType MIME type
   * @param totalSize Total file size
   * @returns Upload ID and metadata
   */
  async initializeUpload(
    originalFilename: string,
    mimeType: string,
    totalSize: number
  ): Promise<{ uploadId: string, totalChunks: number, chunkSize: number }> {
    try {
      // Validate file size
      if (totalSize > MAX_FILE_SIZE) {
        throw new ApiError(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`, 400);
      }

      // Generate upload ID
      const uploadId = uuidv4();

      // Calculate total chunks
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

      // Create metadata
      const metadata: ChunkMetadata = {
        id: uuidv4(),
        originalFilename,
        mimeType,
        totalSize,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        uploadId,
        timestamp: Date.now(),
        checksum: '' // Will be updated when all chunks are received
      };

      // Create directory for this upload
      const uploadDir = path.join(TEMP_DIR, uploadId);
      fs.mkdirSync(uploadDir, { recursive: true });

      // Save metadata
      fs.writeFileSync(
        path.join(uploadDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      logger.info('Chunked upload initialized', {
        uploadId,
        originalFilename,
        totalSize,
        totalChunks
      });

      return {
        uploadId,
        totalChunks,
        chunkSize: CHUNK_SIZE
      };
    } catch (error) {
      logger.error('Error initializing chunked upload', {
        error: error instanceof Error ? error.message : String(error),
        originalFilename,
        totalSize
      });

      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to initialize chunked upload', 500);
    }
  },

  /**
   * Upload a chunk
   * @param uploadId Upload ID
   * @param chunkIndex Chunk index (0-based)
   * @param chunkData Chunk data
   * @returns Chunk upload result
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<ChunkUploadResult> {
    try {
      // Get upload directory
      const uploadDir = path.join(TEMP_DIR, uploadId);

      // Check if upload exists
      if (!fs.existsSync(uploadDir)) {
        throw new ApiError('Upload not found', 404);
      }

      // Read metadata
      const metadataPath = path.join(uploadDir, 'metadata.json');
      const metadata: ChunkMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= metadata.totalChunks) {
        throw new ApiError(`Invalid chunk index: ${chunkIndex}`, 400);
      }

      // Validate chunk size (except for last chunk)
      if (chunkIndex < metadata.totalChunks - 1 && chunkData.length !== metadata.chunkSize) {
        throw new ApiError(`Invalid chunk size: ${chunkData.length}`, 400);
      }

      // Save chunk
      const chunkPath = path.join(uploadDir, `chunk_${chunkIndex}`);
      fs.writeFileSync(chunkPath, chunkData);

      // Generate chunk ID
      const chunkId = crypto.createHash('md5').update(chunkData).digest('hex');

      logger.info('Chunk uploaded', {
        uploadId,
        chunkIndex,
        chunkSize: chunkData.length,
        chunkId
      });

      return {
        chunkIndex,
        chunkId,
        uploadId,
        success: true
      };
    } catch (error) {
      logger.error('Error uploading chunk', {
        error: error instanceof Error ? error.message : String(error),
        uploadId,
        chunkIndex
      });

      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to upload chunk', 500);
    }
  },

  /**
   * Finalize upload and store in Backblaze B2
   * @param uploadId Upload ID
   * @param employeeId Employee ID
   * @param documentType Document type
   * @returns File upload result
   */
  async finalizeUpload(
    uploadId: string,
    employeeId: string,
    documentType: string
  ): Promise<FileUploadResult> {
    try {
      // Get upload directory
      const uploadDir = path.join(TEMP_DIR, uploadId);

      // Check if upload exists
      if (!fs.existsSync(uploadDir)) {
        throw new ApiError('Upload not found', 404);
      }

      // Read metadata
      const metadataPath = path.join(uploadDir, 'metadata.json');
      const metadata: ChunkMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Check if all chunks are present
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          throw new ApiError(`Missing chunk: ${i}`, 400);
        }
      }

      // Create temporary file to combine chunks
      const tempFilePath = path.join(uploadDir, 'combined');
      const tempFile = fs.createWriteStream(tempFilePath);

      // Combine chunks
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `chunk_${i}`);
        const chunkData = fs.readFileSync(chunkPath);
        tempFile.write(chunkData);
      }

      // Close file
      tempFile.end();

      // Wait for file to be written
      await new Promise<void>((resolve, reject) => {
        tempFile.on('finish', resolve);
        tempFile.on('error', reject);
      });

      // Calculate checksum
      const fileBuffer = fs.readFileSync(tempFilePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Update metadata with checksum
      metadata.checksum = checksum;
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      // Authorize B2 client
      const authorizedB2 = await authorizeB2();

      // Generate file path
      const timestamp = Date.now();
      const sanitizedFileName = metadata.originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `employees/${employeeId}/${documentType}/${timestamp}_${sanitizedFileName}`;

      // Get upload URL
      const uploadUrlResponse = await authorizedB2.getUploadUrl({
        bucketId: process.env.B2_BUCKET_ID || '',
      });

      if (!uploadUrlResponse.data) {
        throw new ApiError('Failed to get upload URL from Backblaze B2', 500);
      }

      // Upload file
      const uploadResponse = await authorizedB2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName: filePath,
        data: fileBuffer,
        contentType: metadata.mimeType,
      });

      if (!uploadResponse.data) {
        throw new ApiError('Failed to upload file to Backblaze B2', 500);
      }

      // Generate download URL
      const downloadUrl = `https://f002.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${filePath}`;

      // Clean up temporary files
      this.cleanupUpload(uploadId);

      logger.info('Upload finalized', {
        uploadId,
        fileId: uploadResponse.data.fileId,
        filePath,
        fileSize: metadata.totalSize
      });

      return {
        fileId: uploadResponse.data.fileId,
        fileName: metadata.originalFilename,
        filePath,
        fileSize: metadata.totalSize,
        mimeType: metadata.mimeType,
        uploadTimestamp: timestamp,
        downloadUrl,
        checksum
      };
    } catch (error) {
      logger.error('Error finalizing upload', {
        error: error instanceof Error ? error.message : String(error),
        uploadId
      });

      // Clean up on error
      this.cleanupUpload(uploadId);

      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to finalize upload', 500);
    }
  },

  /**
   * Clean up temporary files
   * @param uploadId Upload ID
   */
  cleanupUpload(uploadId: string): void {
    try {
      const uploadDir = path.join(TEMP_DIR, uploadId);

      // Check if directory exists
      if (fs.existsSync(uploadDir)) {
        // Read directory contents
        const files = fs.readdirSync(uploadDir);

        // Delete each file
        for (const file of files) {
          fs.unlinkSync(path.join(uploadDir, file));
        }

        // Delete directory
        fs.rmdirSync(uploadDir);

        logger.info('Cleaned up temporary files', { uploadId });
      }
    } catch (error) {
      logger.error('Error cleaning up temporary files', {
        error: error instanceof Error ? error.message : String(error),
        uploadId
      });
    }
  },

  /**
   * Get upload status
   * @param uploadId Upload ID
   * @returns Upload status
   */
  getUploadStatus(uploadId: string): {
    uploadId: string;
    originalFilename: string;
    totalSize: number;
    totalChunks: number;
    uploadedChunks: number;
    progress: number;
    complete: boolean;
  } {
    try {
      // Get upload directory
      const uploadDir = path.join(TEMP_DIR, uploadId);

      // Check if upload exists
      if (!fs.existsSync(uploadDir)) {
        throw new ApiError('Upload not found', 404);
      }

      // Read metadata
      const metadataPath = path.join(uploadDir, 'metadata.json');
      const metadata: ChunkMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Count uploaded chunks
      let uploadedChunks = 0;
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(uploadDir, `chunk_${i}`);
        if (fs.existsSync(chunkPath)) {
          uploadedChunks++;
        }
      }

      // Calculate progress
      const progress = Math.round((uploadedChunks / metadata.totalChunks) * 100);

      return {
        uploadId,
        originalFilename: metadata.originalFilename,
        totalSize: metadata.totalSize,
        totalChunks: metadata.totalChunks,
        uploadedChunks,
        progress,
        complete: uploadedChunks === metadata.totalChunks
      };
    } catch (error) {
      logger.error('Error getting upload status', {
        error: error instanceof Error ? error.message : String(error),
        uploadId
      });

      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to get upload status', 500);
    }
  },

  /**
   * Cancel upload
   * @param uploadId Upload ID
   */
  cancelUpload(uploadId: string): void {
    try {
      this.cleanupUpload(uploadId);
      logger.info('Upload cancelled', { uploadId });
    } catch (error) {
      logger.error('Error cancelling upload', {
        error: error instanceof Error ? error.message : String(error),
        uploadId
      });

      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to cancel upload', 500);
    }
  },

  /**
   * Clean up expired uploads (older than 24 hours)
   */
  cleanupExpiredUploads(): void {
    try {
      // Get all upload directories
      const uploads = fs.readdirSync(TEMP_DIR);

      // Current time
      const now = Date.now();

      // 24 hours in milliseconds
      const expiryTime = 24 * 60 * 60 * 1000;

      // Check each upload
      for (const uploadId of uploads) {
        const uploadDir = path.join(TEMP_DIR, uploadId);
        const metadataPath = path.join(uploadDir, 'metadata.json');

        // Skip if not a directory or no metadata
        if (!fs.statSync(uploadDir).isDirectory() || !fs.existsSync(metadataPath)) {
          continue;
        }

        try {
          // Read metadata
          const metadata: ChunkMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

          // Check if expired
          if (now - metadata.timestamp > expiryTime) {
            // Clean up
            this.cleanupUpload(uploadId);
            logger.info('Cleaned up expired upload', { uploadId });
          }
        } catch (error) {
          // If metadata is invalid, clean up anyway
          this.cleanupUpload(uploadId);
          logger.warn('Cleaned up invalid upload', { uploadId });
        }
      }
    } catch (error) {
      logger.error('Error cleaning up expired uploads', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};
