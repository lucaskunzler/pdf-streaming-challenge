import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs/promises';
import path from 'path';
import { parseRange } from './utils/range.js';
import { getPdfPageCount } from './utils/pdf.js';
import { generateETag, validateDocument, createErrorResponse } from './utils/document.js';


interface AppConfig {
  documentsPath?: string;
  logger?: boolean;
}

export function createApp(config: AppConfig = {}): FastifyInstance {
  const app = fastify({ 
    logger: config.logger !== undefined ? config.logger : true 
  });
  
  app.register(cors, {
    origin: true
  });
  
  const documentsPath = config.documentsPath || process.env.DOCUMENTS_PATH || path.join(process.cwd(), 'documents');
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  app.get('/api/documents/:id/metadata', async (request, reply) => {
    const { id } = request.params as { id: string };
    const documentPath = path.join(documentsPath, id);
    
    try {
      const stats = await validateDocument(documentPath);
      const pageCount = await getPdfPageCount(documentPath);
      const etag = generateETag(stats);
      
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return reply.status(304).send('');
      }
      
      reply.header('etag', etag);
      reply.header('cache-control', 'public, max-age=3600');
      reply.header('content-type', 'application/json; charset=utf-8');
      
      return {
        id,
        filename: path.basename(documentPath),
        pageCount,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        etag
      };
      
    } catch (error) {
      const { status, body } = createErrorResponse(error, 'metadata');
      return reply.status(status).send(body);
    }
  });

  app.get('/api/documents/:id/range', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rangeHeader = request.headers['range'] as string;
    const documentPath = path.join(documentsPath, id);
    
    try {
      const stats = await validateDocument(documentPath);
      const etag = generateETag(stats);
      
      // If no Range header, return full file with Accept-Ranges header
      // This tells PDF.js that range requests are supported
      if (!rangeHeader) {
        const fileBuffer = await fs.readFile(documentPath);
        
        return reply
          .status(200)
          .header('content-type', 'application/pdf')
          .header('accept-ranges', 'bytes')
          .header('content-length', stats.size.toString())
          .header('etag', etag)
          .header('last-modified', stats.mtime.toUTCString())
          .header('cache-control', 'public, max-age=3600')
          .send(fileBuffer);
      }
      
      // Handle Range request
      const range = parseRange(rangeHeader, stats.size);
      
      if (!range || range.start >= stats.size || range.end >= stats.size) {
        return reply.status(416)
          .header('content-range', `bytes */${stats.size}`)
          .send({
            error: 'Range not satisfiable',
            statusCode: 416
          });
      }

      const ifRange = request.headers['if-range'];
      
      if (ifRange && ifRange !== etag) {
        return reply.status(416).send({
          error: 'Range not satisfiable',
          statusCode: 416
        });
      }

      const contentLength = range.end - range.start + 1;
      const fileHandle = await fs.open(documentPath, 'r');
      const buffer = Buffer.alloc(contentLength);
      await fileHandle.read(buffer, 0, contentLength, range.start);
      await fileHandle.close();

      reply.status(206)
        .header('content-type', 'application/pdf')
        .header('accept-ranges', 'bytes')
        .header('content-range', `bytes ${range.start}-${range.end}/${stats.size}`)
        .header('content-length', contentLength.toString())
        .header('etag', etag)
        .header('last-modified', stats.mtime.toUTCString())
        .header('cache-control', 'public, max-age=3600');

      return reply.send(buffer);
      
    } catch (error) {
      const { status, body } = createErrorResponse(error, 'range');
      return reply.status(status).send(body);
    }
  });

  return app;
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  
  const start = async () => {
    try {
      await app.listen({ port: 3000, host: '0.0.0.0' });
      console.log('Server running on http://localhost:3000');
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  
  start();
}
