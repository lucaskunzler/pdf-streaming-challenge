import { getS3ObjectMetadata } from './s3.js';

export interface DocumentMetadata {
  size: number;
  mtime: Date;
  etag: string;
}

export function generateETag(metadata: DocumentMetadata): string {
  return metadata.etag;
}

export async function validateDocument(key: string): Promise<DocumentMetadata> {
  try {
    const metadata = await getS3ObjectMetadata(key);
    return {
      size: metadata.size,
      mtime: metadata.lastModified,
      etag: metadata.etag
    };
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
      const err = new Error('Document not found') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    throw error;
  }
}

export function createErrorResponse(error: unknown, context: 'metadata' | 'range'): { status: number; body: object } {
  const isFileError = (error as NodeJS.ErrnoException).code === 'ENOENT';
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
