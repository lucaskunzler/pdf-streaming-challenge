import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { parseRange } from './utils/range.js';
import { getPdfPageCount } from './utils/pdf.js';
import { validateDocument, createErrorResponse } from './utils/document.js';
import { createStorage, StorageConfig } from './utils/storage.factory.js';
import { IStorage } from './utils/storage.types.js';
import { createLoggerConfig, setupRequestLogging } from './utils/logger.config.js';
import { 
  healthSchema, 
  documentMetadataSchema, 
  documentHeadSchema, 
  documentRangeSchema 
} from './schemas/api.schemas.js';

interface AppConfig {
  logger?: boolean | object;
  storageType?: 'local' | 's3';
  documentsPath?: string;
  s3Bucket?: string;
  s3Region?: string;
}

export function createApp(config: AppConfig = {}): FastifyInstance {
  const usePrettyLogs = process.env.NODE_ENV !== 'production';
  const defaultLogger = createLoggerConfig(usePrettyLogs);
  
  const app = fastify({ 
    logger: config.logger !== undefined ? config.logger : defaultLogger,
    disableRequestLogging: usePrettyLogs
  });
  
  // Initialize storage based on config or environment
  const storageType = config.storageType || (process.env.STORAGE_TYPE as 'local' | 's3') || 'local';
  const storageConfig: StorageConfig = storageType === 'local'
    ? { type: 'local', basePath: config.documentsPath || './documents' }
    : {
        type: 's3',
        bucket: config.s3Bucket || process.env.AWS_S3_BUCKET || '',
        region: config.s3Region || process.env.AWS_REGION || 'us-east-1'
      };
  
  const storage: IStorage = createStorage(storageConfig);
  
  app.register(cors, {
    origin: true,
    exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length', 'Content-Encoding']
  });
  
  // Register Swagger for API documentation
  app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'PDF Streaming API',
        description: 'API for streaming PDF documents with HTTP range request support. Enables efficient partial content delivery for large PDF files.',
        version: '1.0.0'
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'documents', description: 'PDF document operations' }
      ]
    }
  });
  
  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    },
    staticCSP: true
  });
  
  // Setup custom request logging
  if (usePrettyLogs) {
    setupRequestLogging(app);
  }
  
  // Register routes
  app.register(async function routes(app) {
  app.get('/health', {
    schema: healthSchema
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  app.get('/api/documents/:id/metadata', {
    schema: documentMetadataSchema
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const metadata = await validateDocument(id, storage);
      const pageCount = await getPdfPageCount(id, storage);
      const etag = metadata.etag;
      
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
      return reply.status(status as 404 | 500).send(body);
    }
  });

  // Handle HEAD requests for getting file info without downloading
  app.head('/api/documents/:id/range', {
    schema: documentHeadSchema
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const metadata = await validateDocument(id, storage);
      const etag = metadata.etag;
      
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
      return reply.status(status as 404).send(body);
    }
  });

  app.get('/api/documents/:id/range', {
    schema: documentRangeSchema
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rangeHeader = request.headers['range'] as string;
    
    try {
      const metadata = await validateDocument(id, storage);
      const etag = metadata.etag;
      
      if (!rangeHeader) {
        const stream = await storage.getStream(id);
        
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
      const stream = await storage.getStream(id, range);

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
      return reply.status(status as 404 | 500).send(body);
    }
  });
  }); // End routes plugin

  return app;
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  
  const start = async () => {
    try {
      await app.ready();
      await app.listen({ port: 3000, host: '0.0.0.0' });
      console.log('Server running on http://localhost:3000');
      console.log('Swagger documentation available at http://localhost:3000/docs');
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  
  start();
}
