import { IStorage } from './storage.types.js';

export interface DocumentMetadata {
  size: number;
  mtime: Date;
  etag: string;
}

export async function validateDocument(key: string, storage: IStorage): Promise<DocumentMetadata> {
  const metadata = await storage.getMetadata(key);
  return {
    size: metadata.size,
    mtime: metadata.lastModified,
    etag: metadata.etag
  };
}

export function createErrorResponse(error: unknown, context: 'metadata' | 'range'): { status: number; body: object } {
  const isFileError = error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT';
  const status = isFileError ? 404 : 500;
  const errorMessage = isFileError 
    ? 'Document not found' 
    : context === 'metadata' ? 'PDF processing failed' : 'Server error';
  
  return {
    status,
    body: {
      error: errorMessage,
      statusCode: status
    }
  };
}
