import fs from 'fs/promises';
import { Stats } from 'fs';
import crypto from 'crypto';

export function generateETag(stats: Stats): string {
  return `"${crypto.createHash('md5').update(`${stats.size}-${stats.mtime.getTime()}`).digest('hex')}"`;
}

export async function validateDocument(documentPath: string): Promise<Stats> {
  const stats = await fs.stat(documentPath);
  
  if (!stats.isFile()) {
    const error = new Error('Document not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }
  
  return stats;
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
