import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'path';
import { createApp } from '../../src/app';

describe('HTTP Range Support API', () => {
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

  describe('GET /api/documents/:id/range', () => {
    it('should support HEAD requests to get file info without downloading', async () => {
      const response = await app.inject({
        method: 'HEAD',
        url: '/api/documents/tiny-1p.pdf/range'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['accept-ranges']).toBe('bytes');
      expect(response.headers['content-length']).toBe('1870');
      expect(response.headers['etag']).toBeDefined();
      expect(response.body).toBe('');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/non-existent.pdf/range',
        headers: { 'range': 'bytes=0-1023' }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Document not found');
    });

    it('should return 200 with full file when no Range header (signals range support)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/tiny-1p.pdf/range'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['accept-ranges']).toBe('bytes');
      expect(response.headers['content-length']).toBe('1870');
      expect(response.rawPayload).toBeInstanceOf(Buffer);
      expect(response.rawPayload.length).toBe(1870);
    });

    it('should return 416 for invalid range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/tiny-1p.pdf/range',
        headers: { 'range': 'invalid-range' }
      });

      expect(response.statusCode).toBe(416);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Range not satisfiable');
    });

    it('should return 416 for range beyond file size', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/tiny-1p.pdf/range',
        headers: { 'range': 'bytes=5000-6000' }  // tiny-1p.pdf is only 1870 bytes
      });

      expect(response.statusCode).toBe(416);
      expect(response.headers['content-range']).toBe('bytes */1870');
    });

    it('should return 206 partial content for valid byte range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/tiny-1p.pdf/range',
        headers: { 'range': 'bytes=0-1023' }
      });

      expect(response.statusCode).toBe(206);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['accept-ranges']).toBe('bytes');
      expect(response.headers['content-range']).toBe('bytes 0-1023/1870');
      expect(response.rawPayload).toBeInstanceOf(Buffer);
      expect(response.rawPayload.length).toBe(1024);
    });

    it('should handle open-ended and suffix ranges', async () => {
      // Test open-ended range (from position to end)
      const openResponse = await app.inject({
        method: 'GET',
        url: '/api/documents/tiny-1p.pdf/range',
        headers: { 'range': 'bytes=1000-' }
      });

      expect(openResponse.statusCode).toBe(206);
      expect(openResponse.headers['content-range']).toBe('bytes 1000-1869/1870');

      // Test suffix range (last N bytes)
      const suffixResponse = await app.inject({
        method: 'GET',
        url: '/api/documents/tiny-1p.pdf/range',
        headers: { 'range': 'bytes=-500' }
      });

      expect(suffixResponse.statusCode).toBe(206);
      expect(suffixResponse.headers['content-range']).toBe('bytes 1370-1869/1870');
    });

    it('should include caching headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/small-2p.pdf/range',
        headers: { 'range': 'bytes=0-1023' }
      });

      expect(response.statusCode).toBe(206);
      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
      expect(response.headers['cache-control']).toBeDefined();
    });
  });
});
