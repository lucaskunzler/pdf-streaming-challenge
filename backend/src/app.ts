import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { parseRange } from './utils/range.js';
import { getPdfPageCount } from './utils/pdf.js';
import { generateETag, validateDocument, createErrorResponse } from './utils/document.js';
import { getS3ObjectStream } from './utils/s3.js';

interface AppConfig {
  logger?: boolean | object;
}

export function createApp(config: AppConfig = {}): FastifyInstance {
  const usePrettyLogs = process.env.NODE_ENV !== 'production';
  const defaultLogger = usePrettyLogs ? {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname,reqId',
        colorize: false,
        singleLine: true
      }
    }
  } : true;
  
  const app = fastify({ 
    logger: config.logger !== undefined ? config.logger : defaultLogger
  });
  
  app.register(cors, {
    origin: true,
    exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length', 'Content-Encoding']
  });
  
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  app.get('/api/documents/:id/metadata', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const metadata = await validateDocument(id);
      const pageCount = await getPdfPageCount(id);
      const etag = generateETag(metadata);
      
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return reply.status(304).send('');
      }
      
      reply.header('etag', etag);
      reply.header('cache-control', 'public, max-age=3600');
      reply.header('content-type', 'application/json; charset=utf-8');
      
      return {
        id,
        filename: id,
        pageCount,
        fileSize: metadata.size,
        lastModified: metadata.mtime.toISOString(),
        etag
      };
      
    } catch (error) {
      const { status, body } = createErrorResponse(error, 'metadata');
      return reply.status(status).send(body);
    }
  });

  // Handle HEAD requests for getting file info without downloading
  app.head('/api/documents/:id/range', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const metadata = await validateDocument(id);
      const etag = generateETag(metadata);
      
      return reply
        .status(200)
        .header('content-type', 'application/pdf')
        .header('accept-ranges', 'bytes')
        .header('content-length', metadata.size.toString())
        .header('etag', etag)
        .header('last-modified', metadata.mtime.toUTCString())
        .header('cache-control', 'public, max-age=3600')
        .send();
    } catch (error) {
      const { status, body } = createErrorResponse(error, 'range');
      return reply.status(status).send(body);
    }
  });

  app.get('/api/documents/:id/range', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rangeHeader = request.headers['range'] as string;
    
    try {
      const metadata = await validateDocument(id);
      const etag = generateETag(metadata);
      
      if (!rangeHeader) {
        const stream = await getS3ObjectStream(id);
        
        return reply
          .status(200)
          .header('content-type', 'application/pdf')
          .header('accept-ranges', 'bytes')
          .header('content-length', metadata.size.toString())
          .header('etag', etag)
          .header('last-modified', metadata.mtime.toUTCString())
          .header('cache-control', 'public, max-age=3600')
          .send(stream);
      }
      
      // Handle Range request
      const range = parseRange(rangeHeader, metadata.size);
      
      if (!range || range.start >= metadata.size || range.end >= metadata.size) {
        return reply.status(416)
          .header('content-range', `bytes */${metadata.size}`)
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
      const stream = await getS3ObjectStream(id, range);

      reply.status(206)
        .header('content-type', 'application/pdf')
        .header('accept-ranges', 'bytes')
        .header('content-range', `bytes ${range.start}-${range.end}/${metadata.size}`)
        .header('content-length', contentLength.toString())
        .header('etag', etag)
        .header('last-modified', metadata.mtime.toUTCString())
        .header('cache-control', 'public, max-age=3600');

      return reply.send(stream);
      
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
