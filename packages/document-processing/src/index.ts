export interface ExtractedPage { pageNumber: number; text: string; }
export interface DocumentTextExtractor { extract(filePath: string): Promise<ExtractedPage[]>; }

// URL Security
export {
  validateURLStructure,
  validateIPv4,
  validateIPv6,
  validateHostnameAndResolve,
  validateURLForFetch,
  validateRedirect,
  type URLValidationResult,
  type IPValidationResult,
} from "./url-security.js";

// File Validation
export {
  ALLOWED_MIME_TYPES,
  detectMIMEFromContent,
  validateFileContent,
  sanitizeFilename,
  getExtensionForMIME,
  getLabelForMIME,
  validateFile,
  type MIMETypeInfo,
  type FileValidationResult,
} from "./file-validation.js";

// Streaming Downloader
export {
  downloadFileSecurely,
  moveToFinalDestination,
  cleanupTempFile,
  type DownloadOptions,
  type DownloadResult,
} from "./streaming-downloader.js";

// Document Service
export {
  getProjectDocument,
  listProjectDocuments,
  downloadDocument,
  uploadDocument,
  deletePhysicalFile,
  removeDocumentFromProject,
  type DocumentMetadata,
  type ProjectDocumentLink,
  type DownloadDocumentOptions,
  type DownloadDocumentResult,
  type UploadDocumentOptions,
  type DeleteFileOptions,
  type RemoveFromProjectOptions,
} from "./document-service.js";
