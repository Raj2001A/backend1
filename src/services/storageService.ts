const B2 = require('backblaze-b2');
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error';
import path from 'path';
import crypto from 'crypto';

// Interface for upload result
interface UploadResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  uploadTimestamp: number;
}

// Storage service class
class StorageService {
  private b2: any;
  private bucketId: string;
  private bucketName: string;
  private isAuthorized: boolean = false;
  private authorizationTimestamp: number = 0;
  private readonly AUTH_EXPIRY = 23 * 60 * 60 * 1000; // 23 hours in milliseconds

  constructor() {
    // Initialize B2 client
    this.b2 = new B2({
      accountId: process.env.B2_APP_KEY_ID || '',
      applicationKey: process.env.B2_APP_KEY || '',
    });

    this.bucketId = process.env.B2_BUCKET_ID || '';
    this.bucketName = process.env.B2_BUCKET_NAME || '';

    // Log initialization
    logger.info('Storage service initialized', {
      bucketName: this.bucketName,
      bucketId: this.bucketId ? this.bucketId.substring(0, 8) + '...' : 'Not set'
    });
  }

  /**
   * Authorize B2 client
   * @returns Promise<void>
   */
  private async authorize(): Promise<void> {
    try {
      // Check if already authorized and not expired
      const now = Date.now();
      if (this.isAuthorized && (now - this.authorizationTimestamp) < this.AUTH_EXPIRY) {
        return;
      }

      // Authorize
      await this.b2.authorize();
      this.isAuthorized = true;
      this.authorizationTimestamp = now;

      logger.info('B2 authorization successful');
    } catch (error) {
      this.isAuthorized = false;
      logger.error('B2 authorization failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ApiError('Storage service authorization failed', 500);
    }
  }

  /**
   * Generate a unique filename
   * @param originalFilename Original filename
   * @returns Unique filename
   */
  private generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    
    return `${basename}-${timestamp}-${random}${ext}`;
  }

  /**
   * Upload a file to B2
   * @param fileBuffer File buffer
   * @param originalFilename Original filename
   * @param contentType Content type
   * @param prefix Path prefix (folder)
   * @returns Upload result
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    contentType: string,
    prefix: string = 'uploads'
  ): Promise<UploadResult> {
    try {
      // Authorize
      await this.authorize();

      // Generate unique filename
      const uniqueFilename = this.generateUniqueFilename(originalFilename);
      
      // Create full path
      const filePath = `${prefix}/${uniqueFilename}`;

      // Get upload URL
      const { uploadUrl, authorizationToken } = await this.b2.getUploadUrl({
        bucketId: this.bucketId
      });

      // Upload file
      const uploadResult = await this.b2.uploadFile({
        uploadUrl,
        uploadAuthToken: authorizationToken,
        fileName: filePath,
        data: fileBuffer,
        contentType
      });

      logger.info('File uploaded successfully', {
        fileName: uniqueFilename,
        filePath,
        fileSize: fileBuffer.length,
        contentType
      });

      return {
        fileId: uploadResult.fileId,
        fileName: uniqueFilename,
        filePath,
        fileSize: fileBuffer.length,
        contentType,
        uploadTimestamp: Date.now()
      };
    } catch (error) {
      logger.error('File upload failed', {
        originalFilename,
        contentType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ApiError('File upload failed', 500);
    }
  }

  /**
   * Get download URL for a file
   * @param fileId File ID
   * @param fileName File name
   * @returns Download URL
   */
  async getDownloadUrl(fileId: string, fileName: string): Promise<string> {
    try {
      // Authorize
      await this.authorize();
      // Fallback: Construct download URL manually (public bucket or use b2_download_file_by_id)
      const downloadUrl = `https://f000.backblazeb2.com/file/${this.bucketName}/${fileName}`;
      logger.info('Download URL generated', { fileId, fileName });
      return downloadUrl;
    } catch (error) {
      logger.error('Failed to get download URL', { fileId, fileName, error: error instanceof Error ? error.message : String(error) });
      throw new ApiError('Failed to get download URL', 500);
    }
  }

  /**
   * Delete a file from B2
   * @param fileId File ID
   * @returns Success status
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      // Authorize
      await this.authorize();

      // Delete file
      await this.b2.deleteFileVersion({
        fileId,
        fileName: '' // Not needed when fileId is provided
      });

      logger.info('File deleted successfully', {
        fileId
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete file', {
        fileId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ApiError('Failed to delete file', 500);
    }
  }

  /**
   * List files in a folder
   * @param prefix Folder prefix
   * @param maxFileCount Maximum number of files to return
   * @returns List of files
   */
  async listFiles(prefix: string, maxFileCount: number = 1000): Promise<any[]> {
    try {
      // Authorize
      await this.authorize();

      // List files
      const response = await this.b2.listFileNames({
        bucketId: this.bucketId,
        prefix,
        maxFileCount
      });

      logger.info('Files listed successfully', {
        prefix,
        fileCount: response.files.length
      });

      return response.files;
    } catch (error) {
      logger.error('Failed to list files', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ApiError('Failed to list files', 500);
    }
  }
}

// Create and export storage service instance
export const storageService = new StorageService();
