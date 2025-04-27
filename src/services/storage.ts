import { b2, authorizeB2 } from '../config/storage';
import { Readable } from 'stream';
import { ApiError } from '../middleware/error';

// Interface for file upload response
interface FileUploadResponse {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadTimestamp: number;
  downloadUrl: string;
}

// Storage service
export const StorageService = {
  // Upload file to Backblaze B2
  async uploadFile(
    file: Express.Multer.File,
    employeeId: string,
    documentType: string
  ): Promise<FileUploadResponse> {
    try {
      // Authorize B2 client
      const authorizedB2 = await authorizeB2();

      // Get upload URL
      const uploadUrlResponse = await authorizedB2.getUploadUrl({
        bucketId: process.env.B2_BUCKET_ID || '',
      });

      if (!uploadUrlResponse.data) {
        throw new ApiError('Failed to get upload URL from Backblaze B2', 500);
      }

      // Generate file path
      const timestamp = Date.now();
      const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `employees/${employeeId}/${documentType}/${timestamp}_${sanitizedFileName}`;

      // Upload file
      const uploadResponse = await authorizedB2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName: filePath,
        data: file.buffer,
        contentType: file.mimetype,
        onUploadProgress: (event: { loaded: number; total: number }) => {
          // Optional progress tracking
          console.log(`Upload progress: ${Math.round((event.loaded / event.total) * 100)}%`);
        },
      });

      if (!uploadResponse.data) {
        throw new ApiError('Failed to upload file to Backblaze B2', 500);
      }

      // Generate download URL
      const downloadUrl = `https://f002.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${filePath}`;

      return {
        fileId: uploadResponse.data.fileId,
        fileName: sanitizedFileName,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadTimestamp: timestamp,
        downloadUrl: downloadUrl
      };
    } catch (error) {
      console.error('Error uploading file to Backblaze B2:', error);
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to upload file', 500);
    }
  },

  // Get file download URL
  async getFileDownloadUrl(fileId: string): Promise<string> {
    try {
      // Authorize B2 client
      const authorizedB2 = await authorizeB2();

      // Get file info
      const fileInfoResponse = await authorizedB2.getFileInfo({
        fileId: fileId
      });

      if (!fileInfoResponse.data) {
        throw new ApiError('File not found', 404);
      }

      // Generate download URL
      const downloadUrl = `https://f002.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileInfoResponse.data.fileName}`;

      return downloadUrl;
    } catch (error) {
      console.error('Error getting file download URL:', error);
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to get file download URL', 500);
    }
  },

  // Delete file
  async deleteFile(fileId: string): Promise<void> {
    try {
      // Authorize B2 client
      const authorizedB2 = await authorizeB2();

      // Delete file
      await authorizedB2.deleteFileVersion({
        fileId: fileId,
        fileName: '' // Not needed when fileId is provided
      });
    } catch (error) {
      console.error('Error deleting file from Backblaze B2:', error);
      throw error instanceof ApiError
        ? error
        : new ApiError('Failed to delete file', 500);
    }
  }
};
