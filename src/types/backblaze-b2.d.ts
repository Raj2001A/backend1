declare module 'backblaze-b2' {
  export class B2 {
    constructor(options: any);
    authorize(): Promise<any>;
    getUploadUrl(options: any): Promise<any>;
    uploadFile(options: any): Promise<any>;
    downloadFileById(options: any): Promise<any>;
    deleteFileVersion(options: any): Promise<any>;
    listFileNames(options: any): Promise<any>;
    getFileInfo(options: any): Promise<any>;
  }
}
