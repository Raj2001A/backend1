// Using require for backblaze-b2 as it doesn't have proper TypeScript types
declare const B2: any;

import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

// Import the B2 client
const B2Client = require('backblaze-b2');

interface B2Config {
  accountId: string;
  applicationKey: string;
  bucketId: string;
  bucketName: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  uploadTimestamp: number;
}

export class B2StorageService {
  private b2: any; // Using any type due to missing type definitions
  private bucketId: string;
  private bucketName: string;
  private isAuthorized: boolean = false;
  private authorizationTimestamp: number = 0;
  private readonly AUTH_EXPIRY = 23 * 60 * 60 * 1000; // 23 hours in milliseconds

  constructor(config: B2Config) {
    this.b2 = new B2Client({
      accountId: config.accountId,
      applicationKey: config.applicationKey,
      retry: {
        retries: 3,
        retryDelay: 1000
      },
      axios: {
        timeout: 30000
      }
    });

    this.bucketId = config.bucketId;
    this.bucketName = config.bucketName;

    logger.info('B2 Storage Service initialized', {
      bucketName: this.bucketName,
      bucketId: this.bucketId.substring(0, 8) + '...',
      accountId: config.accountId.substring(0, 4) + '...'
    });
  }

  private async authorize(): Promise<void> {
    const now = Date.now();
    if (this.isAuthorized && (now - this.authorizationTimestamp) < this.AUTH_EXPIRY) {
      return;
    }

    try {
      logger.debug('Authorizing with Backblaze B2...');
      const response = await this.b2.authorize();
      
      if (!response.data?.authorizationToken) {
        throw new Error('Invalid authorization response from Backblaze B2');
      }
      
      this.isAuthorized = true;
      this.authorizationTimestamp = now;
      
      logger.debug('Successfully authorized with Backblaze B2', {
        accountId: response.data.accountId,
        apiUrl: response.data.apiUrl
      });
    } catch (error) {
      this.isAuthorized = false;
      const errorMessage = `Backblaze B2 authorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage, { error });
      throw new ApiError(errorMessage, 401);
    }
  }

  private generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(4).toString('hex');
    const fileExt = path.extname(originalName);
    const baseName = path.basename(originalName, fileExt);
    
    // Clean the base name
    const cleanName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
    
    return `${cleanName}_${timestamp}_${randomString}${fileExt}`;
  }

  private async getStreamLength(stream: Readable): Promise<number> {
    return new Promise<number>((resolve) => {
      if ('length' in stream) {
        return resolve((stream as any).length);
      }
      
      let length = 0;
      stream.on('data', (chunk: Buffer) => {
        length += chunk.length;
      });
      
      stream.once('end', () => resolve(length));
      
      // If the stream is already ended
      if (stream.readableEnded) {
        resolve(0);
      }
    });
  }

  private async streamToBuffer(stream: Readable | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(stream)) {
      return stream;
    }
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  public async uploadFile(
    fileBuffer: Buffer | Readable,
    originalName: string,
    mimeType: string,
    folder: string = 'documents'
  ): Promise<UploadResult> {
    // Get file size
    const fileSize = Buffer.isBuffer(fileBuffer) 
      ? fileBuffer.length 
      : await this.getStreamLength(fileBuffer as Readable);
    if (!fileBuffer || !originalName || !mimeType) {
      throw new ApiError('Missing required file information', 400);
    }

    const uniqueFileName = this.generateUniqueFileName(originalName);
    const filePath = `${folder}/${uniqueFileName}`;
      // Log upload details
      logger.debug('Uploading file to B2', {
        originalName,
        uniqueFileName,
        filePath,
        size: fileSize,
        mimeType
      });

    try {
      await this.authorize();

      // Get upload URL
      const { data: uploadUrlData } = await this.b2.getUploadUrl({
        bucketId: this.bucketId,
      });

      if (!uploadUrlData.uploadUrl || !uploadUrlData.authorizationToken) {
        throw new Error('Invalid upload URL response from Backblaze B2');
      }

      // Upload the file
      // Ensure we have a Buffer for upload
      const uploadBuffer = fileBuffer instanceof Buffer 
        ? fileBuffer 
        : await this.streamToBuffer(fileBuffer);

      const uploadResponse = await this.b2.uploadFile({
        uploadUrl: uploadUrlData.uploadUrl || '',
        uploadAuthToken: uploadUrlData.authorizationToken || '',
        fileName: filePath,
        data: uploadBuffer,
        mimeType,
        info: {
          originalFileName: originalName
        },
        onUploadProgress: (event: any) => {
          if (event.loaded && event.total) {
            const percent = Math.round((event.loaded / event.total) * 100);
            logger.debug(`Upload progress: ${percent}%`);
          }
        }
      });

      if (!uploadResponse.data?.fileId) {
        throw new Error('Invalid upload response from Backblaze B2');
      }

      const result: UploadResult = {
        fileId: uploadResponse.data.fileId,
        fileName: uniqueFileName,
        filePath: uploadResponse.data.fileName,
        fileSize: uploadResponse.data.contentLength,
        contentType: uploadResponse.data.contentType,
        uploadTimestamp: uploadResponse.data.uploadTimestamp
      };

      logger.info('File uploaded successfully', {
        fileId: result.fileId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        filePath: result.filePath
      });

      return result;
    } catch (error) {
      const errorMessage = `Failed to upload file to Backblaze B2: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage, { error, originalName, mimeType });
      
      if ('response' in (error as any)) {
        const err = error as any;
        logger.error('Backblaze B2 API error response:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data
        });
      }
      
      throw new ApiError(errorMessage, 500);
    }
  }

  public async getDownloadUrl(fileId: string, fileName?: string): Promise<string> {
    try {
      await this.authorize();
      
      // Get file info to ensure it exists
      const { data: fileInfo } = await this.b2.getFileInfo(fileId);
      
      if (!fileInfo) {
        throw new Error('File not found');
      }
      
      // Get download authorization
      const { data: downloadAuth } = await this.b2.getDownloadAuthorization({
        bucketId: this.bucketId,
        fileNamePrefix: fileInfo.fileName,
        validDurationInSeconds: 3600 // 1 hour
      });
      
      return `${downloadAuth.downloadUrl}/file/${this.bucketName}/${fileInfo.fileName}?Authorization=${downloadAuth.authorizationToken}`;
    } catch (error) {
      const errorMessage = `Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage, { error, fileId, fileName });
      throw new ApiError(errorMessage, 500);
    }
  }

  public async deleteFile(fileId: string, fileName?: string): Promise<boolean> {
    if (!fileId) {
      throw new Error('File ID is required for deletion');
    }
    try {
      await this.authorize();
      
      // If fileName is not provided, use an empty string as the fileName
      // Backblaze B2 API accepts an empty string when fileId is provided
      const fileNameToUse = fileName || '';
      
      // Delete the file
      await this.b2.deleteFileVersion({
        fileId,
        fileName: fileNameToUse
      });
      
      logger.info('File deleted successfully', { fileId, fileName: fileNameToUse });
      return true;
    } catch (error) {
      const errorMessage = `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage, { error, fileId });
      throw new ApiError(errorMessage, 500);
    }
  }
}

// Validate required environment variables
const requiredEnvVars = [
  'B2_APP_KEY_ID',
  'B2_APP_KEY',
  'B2_BUCKET_ID',
  'B2_BUCKET_NAME'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  const errorMessage = `Missing required Backblaze B2 environment variables: ${missingVars.join(', ')}`;
  logger.error(errorMessage);
  throw new Error(errorMessage);
}

// Create and export a singleton instance
export const b2StorageService = new B2StorageService({
  accountId: process.env.B2_APP_KEY_ID!,
  applicationKey: process.env.B2_APP_KEY!,
  bucketId: process.env.B2_BUCKET_ID!,
  bucketName: process.env.B2_BUCKET_NAME!
});
