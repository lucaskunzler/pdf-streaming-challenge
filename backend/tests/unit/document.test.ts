import { describe, it, expect, vi } from 'vitest';
import { validateDocument, createErrorResponse } from '../../src/utils/document';
import { IStorage, StorageMetadata } from '../../src/utils/storage.types';

describe('Document Utils', () => {
  describe('validateDocument', () => {
    it('should return document metadata for valid document', async () => {
      const mockStorage: IStorage = {
        getMetadata: vi.fn().mockResolvedValue({
          size: 12345,
          lastModified: new Date('2025-01-01T00:00:00Z'),
          etag: '"abc123"'
        } as StorageMetadata),
        getStream: vi.fn(),
        getBuffer: vi.fn()
      };

      const result = await validateDocument('test.pdf', mockStorage);

      expect(result).toEqual({
        size: 12345,
        mtime: new Date('2025-01-01T00:00:00Z'),
        etag: '"abc123"'
      });
      expect(mockStorage.getMetadata).toHaveBeenCalledWith('test.pdf');
    });

    it('should propagate errors from storage', async () => {
      const mockError = new Error('Storage error');
      const mockStorage: IStorage = {
        getMetadata: vi.fn().mockRejectedValue(mockError),
        getStream: vi.fn(),
        getBuffer: vi.fn()
      };

      await expect(validateDocument('test.pdf', mockStorage)).rejects.toThrow('Storage error');
    });

    it('should handle file not found errors', async () => {
      const notFoundError = new Error('Document not found') as NodeJS.ErrnoException;
      notFoundError.code = 'ENOENT';
      
      const mockStorage: IStorage = {
        getMetadata: vi.fn().mockRejectedValue(notFoundError),
        getStream: vi.fn(),
        getBuffer: vi.fn()
      };

      await expect(validateDocument('missing.pdf', mockStorage)).rejects.toThrow('Document not found');
    });
  });

  describe('createErrorResponse', () => {
    describe('file not found errors', () => {
      it('should return 404 for ENOENT error in metadata context', () => {
        const error = new Error('Document not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';

        const result = createErrorResponse(error, 'metadata');

        expect(result).toEqual({
          status: 404,
          body: {
            error: 'Document not found',
            statusCode: 404
          }
        });
      });

      it('should return 404 for ENOENT error in range context', () => {
        const error = new Error('Document not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';

        const result = createErrorResponse(error, 'range');

        expect(result).toEqual({
          status: 404,
          body: {
            error: 'Document not found',
            statusCode: 404
          }
        });
      });
    });

    describe('other errors', () => {
      it('should return 500 with PDF processing message for metadata context', () => {
        const error = new Error('PDF parsing failed');

        const result = createErrorResponse(error, 'metadata');

        expect(result).toEqual({
          status: 500,
          body: {
            error: 'PDF processing failed',
            statusCode: 500
          }
        });
      });

      it('should return 500 with server error message for range context', () => {
        const error = new Error('Unexpected error');

        const result = createErrorResponse(error, 'range');

        expect(result).toEqual({
          status: 500,
          body: {
            error: 'Server error',
            statusCode: 500
          }
        });
      });

      it('should handle generic Error objects', () => {
        const error = new Error('Something went wrong');

        const result = createErrorResponse(error, 'range');

        expect(result.status).toBe(500);
        expect(result.body).toHaveProperty('error');
        expect(result.body).toHaveProperty('statusCode', 500);
      });

      it('should handle non-Error objects', () => {
        const error = { message: 'Unknown error' };

        const result = createErrorResponse(error, 'metadata');

        expect(result.status).toBe(500);
        expect(result.body).toEqual({
          error: 'PDF processing failed',
          statusCode: 500
        });
      });

      it('should handle null/undefined errors', () => {
        const result = createErrorResponse(null, 'range');

        expect(result.status).toBe(500);
        expect(result.body).toEqual({
          error: 'Server error',
          statusCode: 500
        });
      });
    });
  });
});

