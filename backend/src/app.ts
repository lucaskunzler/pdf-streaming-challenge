import fastify, { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// PDF.js page counting function
async function getPdfPageCount(filePath: string): Promise<number> {
  try {
    const buffer = await fs.readFile(filePath);
    
    // Convert Buffer to Uint8Array as required by PDF.js
    const uint8Array = new Uint8Array(buffer);
    
    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      verbosity: 0 // Suppress console output
    });
    
    const pdf = await loadingTask.promise;
    return pdf.numPages;
    
  } catch (error) {
    const filename = path.basename(filePath);
    console.error(`PDF parsing failed for ${filename}:`, error);
    
    throw new Error(`Unable to extract page count from PDF: ${filename}`);
  }
}

interface AppConfig {
  documentsPath?: string;
  logger?: boolean;
}

export function createApp(config: AppConfig = {}): FastifyInstance {
  const app = fastify({ 
    logger: config.logger !== undefined ? config.logger : true 
  });
  
  // Configure document storage path - defaults to a production-ready location
  const documentsPath = config.documentsPath || process.env.DOCUMENTS_PATH || path.join(process.cwd(), 'documents');

  // Health endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  });

  // Document Metadata API
  app.get('/api/documents/:id/metadata', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Path to document
    const documentPath = path.join(documentsPath, id);
    
    try {
      // Check if file exists and get stats
      const stats = await fs.stat(documentPath);
      
      if (!stats.isFile()) {
        return reply.status(404).send({
          error: 'Document not found',
          statusCode: 404
        });
      }

      // Extract page count from PDF
      const pageCount = await getPdfPageCount(documentPath);
      
      // Generate ETag from file stats
      const etag = `"${crypto.createHash('md5').update(`${stats.size}-${stats.mtime.getTime()}`).digest('hex')}"`;
      
      // Handle conditional requests (304 Not Modified)
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return reply.status(304).send('');
      }
      
      // Set cache headers
      reply.header('etag', etag);
      reply.header('cache-control', 'public, max-age=3600');
      reply.header('content-type', 'application/json; charset=utf-8');
      
      // Return metadata
      return {
        id,
        filename: path.basename(documentPath),
        pageCount,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        etag: etag
      };
      
    } catch (error) {
      // File doesn't exist or PDF processing failed
      const isFileError = (error as NodeJS.ErrnoException).code === 'ENOENT';
      return reply.status(isFileError ? 404 : 500).send({
        error: isFileError ? 'Document not found' : 'PDF processing failed',
        statusCode: isFileError ? 404 : 500
      });
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
