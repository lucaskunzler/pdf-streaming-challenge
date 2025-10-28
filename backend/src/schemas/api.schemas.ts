/**
 * OpenAPI/Swagger schemas for API endpoints
 */

export const healthSchema = {
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
} as const;

export const metricsSchema = {
  tags: ['monitoring'],
  summary: 'Prometheus metrics',
  description: 'Returns application metrics in Prometheus format for monitoring and alerting',
  response: {
    200: {
      type: 'string',
      description: 'Prometheus metrics in text format',
      example: '# HELP http_request_duration_seconds Duration of HTTP requests in seconds\n# TYPE http_request_duration_seconds histogram\nhttp_request_duration_seconds_bucket{method="GET",route="/health",status_code="200",le="0.1"} 1\n...'
    },
    500: {
      type: 'string',
      description: 'Error generating metrics'
    }
  }
} as const;

export const documentMetadataSchema = {
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
} as const;

export const documentHeadSchema = {
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
} as const;

export const documentRangeSchema = {
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
} as const;

