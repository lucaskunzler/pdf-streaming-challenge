import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'path';
import { createApp } from '../../src/app';

describe('Document Metadata API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Configure app to use test fixtures directory and disable logging
    const testFixturesPath = path.join(__dirname, '../fixtures');
    app = createApp({ 
      documentsPath: testFixturesPath,
      logger: false 
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/documents/:id/metadata', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/non-existent-doc/metadata'
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: 'Document not found',
        statusCode: 404
      });
    });

    it('should return document metadata with proper headers for small PDF', async () => {
      // Using a real test document from fixtures
      const documentId = 'tiny-1p.pdf';
      
      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}/metadata`
      });

      expect(response.statusCode).toBe(200);
      
      // Check response headers
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['cache-control']).toBeDefined();
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: documentId,
        filename: 'tiny-1p.pdf',
        pageCount: expect.any(Number),
        fileSize: expect.any(Number),
        lastModified: expect.any(String),
        etag: expect.any(String)
      });

      // Validate specific data for tiny PDF (based on actual file)
      expect(body.pageCount).toBe(1);
      expect(body.fileSize).toBe(1870);
      expect(() => new Date(body.lastModified)).not.toThrow();
      expect(body.etag).toMatch(/^"[a-f0-9]+"$/); // ETag format: "hash"
    });

    it('should return correct metadata for large PDF', async () => {
      // Test with a large document to ensure system handles it
      const documentId = 'large-361p-12mb.pdf';
      
      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}/metadata`
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: documentId,
        filename: 'large-361p-12mb.pdf',
        pageCount: expect.any(Number),
        fileSize: expect.any(Number),
        lastModified: expect.any(String),
        etag: expect.any(String)
      });

      // Validate specific data for large PDF (based on actual file)
      expect(body.pageCount).toBe(361);
      expect(body.fileSize).toBe(12743827); // ~12.7MB
    });

    it('should return correct metadata for mixed content PDF', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/text-and-images.pdf/metadata'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pageCount).toBe(9);
      expect(body.fileSize).toBe(112253);
    });

    it('should return same ETag for identical requests', async () => {
      const documentId = 'small-2p.pdf';
      
      const response1 = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}/metadata`
      });
      
      const response2 = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}/metadata`
      });
      
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      expect(response1.headers['etag']).toBe(response2.headers['etag']);
      
      // Verify the actual data for small-2p.pdf
      const body = JSON.parse(response1.body);
      expect(body.pageCount).toBe(2);
      expect(body.fileSize).toBe(89526);
    });

    it('should return 304 Not Modified for conditional request with matching ETag', async () => {
      const documentId = 'text-and-images.pdf';
      
      // First request to get ETag
      const initialResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}/metadata`
      });
      
      expect(initialResponse.statusCode).toBe(200);
      const etag = initialResponse.headers['etag'];
      
      // Conditional request with If-None-Match header
      const conditionalResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${documentId}/metadata`,
        headers: {
          'if-none-match': etag
        }
      });
      
      expect(conditionalResponse.statusCode).toBe(304);
      expect(conditionalResponse.body).toBe('');
    });
  });
});
