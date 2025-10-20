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
    schema: {
      tags: ['health'],
      summary: 'Health check',
      description: 'Returns the current health status of the API',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  app.get('/api/documents/:id/metadata', {
    schema: {
      tags: ['documents'],
      summary: 'Get document metadata',
      description: 'Retrieves metadata for a PDF document including page count, file size, and modification date. Supports conditional requests with ETag.',
      params: {
        type: 'object',
        properties: {
          id: { 
            type: 'string', 
            description: 'Document ID (filename)'
          }
        },
        required: ['id']
      },
      headers: {
        type: 'object',
        properties: {
          'if-none-match': { 
            type: 'string', 
            description: 'ETag value for conditional request'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          description: 'Document metadata',
          properties: {
            id: { type: 'string', description: 'Document ID' },
            filename: { type: 'string', description: 'Document filename' },
            pageCount: { type: 'number', description: 'Number of pages in the PDF' },
            fileSize: { type: 'number', description: 'File size in bytes' },
            lastModified: { type: 'string', format: 'date-time', description: 'Last modification timestamp' },
            etag: { type: 'string', description: 'Entity tag for caching' }
          }
        },
        304: {
          type: 'null',
          description: 'Not Modified - cached version is still valid'
        },
        404: {
          type: 'object',
          description: 'Document not found',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          description: 'Internal server error',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
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
    schema: {
      tags: ['documents'],
      summary: 'Get document headers',
      description: 'Returns document headers without the body. Useful for checking file size, ETag, and range support before downloading.',
      params: {
        type: 'object',
        properties: {
          id: { 
            type: 'string', 
            description: 'Document ID (filename)'
          }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'null',
          description: 'Success - check response headers for file information',
          headers: {
            'content-type': { type: 'string' },
            'accept-ranges': { type: 'string' },
            'content-length': { type: 'string', description: 'File size in bytes' },
            'etag': { type: 'string', description: 'Entity tag for caching' },
            'last-modified': { type: 'string', description: 'Last modification date' },
            'cache-control': { type: 'string' }
          }
        },
        404: {
          type: 'object',
          description: 'Document not found',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
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
    schema: {
      tags: ['documents'],
      summary: 'Stream document with range support',
      description: 'Streams a PDF document with support for HTTP range requests (partial content). If no Range header is provided, returns the full file. Supports If-Range header for conditional range requests.',
      params: {
        type: 'object',
        properties: {
          id: { 
            type: 'string', 
            description: 'Document ID (filename)'
          }
        },
        required: ['id']
      },
      headers: {
        type: 'object',
        properties: {
          'range': { 
            type: 'string', 
            description: 'Byte range to request (e.g., "bytes=0-1023")'
          },
          'if-range': { 
            type: 'string', 
            description: 'ETag value - only return range if document matches this ETag'
          }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'Full PDF file content',
          headers: {
            'content-type': { type: 'string' },
            'accept-ranges': { type: 'string' },
            'content-length': { type: 'string', description: 'File size in bytes' },
            'etag': { type: 'string', description: 'Entity tag for caching' },
            'last-modified': { type: 'string', description: 'Last modification date' },
            'cache-control': { type: 'string' }
          }
        },
        206: {
          type: 'string',
          format: 'binary',
          description: 'Partial content - requested byte range',
          headers: {
            'content-type': { type: 'string' },
            'accept-ranges': { type: 'string' },
            'content-range': { type: 'string', description: 'Byte range returned' },
            'content-length': { type: 'string', description: 'Size of returned range in bytes' },
            'etag': { type: 'string', description: 'Entity tag for caching' },
            'last-modified': { type: 'string', description: 'Last modification date' },
            'cache-control': { type: 'string' }
          }
        },
        416: {
          type: 'object',
          description: 'Range Not Satisfiable - requested range is invalid or If-Range condition failed',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' }
          },
          headers: {
            'content-range': { type: 'string', description: 'Total file size' }
          }
        },
        404: {
          type: 'object',
          description: 'Document not found',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          description: 'Internal server error',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
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
