/**
 * Prometheus metrics collection for the PDF streaming service
 * Provides basic observability metrics for production monitoring
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Enable default metrics collection (CPU, memory, etc.)
collectDefaultMetrics();

// Custom metrics for our application
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const pdfOperationsTotal = new Counter({
  name: 'pdf_operations_total',
  help: 'Total number of PDF operations',
  labelNames: ['operation', 'status']
});

export const pdfOperationDuration = new Histogram({
  name: 'pdf_operation_duration_seconds',
  help: 'Duration of PDF operations in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

export const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections'
});

export const documentCacheHits = new Counter({
  name: 'document_cache_hits_total',
  help: 'Total number of document cache hits',
  labelNames: ['cache_type']
});

export const documentCacheMisses = new Counter({
  name: 'document_cache_misses_total',
  help: 'Total number of document cache misses',
  labelNames: ['cache_type']
});

export const storageOperationsTotal = new Counter({
  name: 'storage_operations_total',
  help: 'Total number of storage operations',
  labelNames: ['operation', 'storage_type', 'status']
});

export const storageOperationDuration = new Histogram({
  name: 'storage_operation_duration_seconds',
  help: 'Duration of storage operations in seconds',
  labelNames: ['operation', 'storage_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics registry for custom operations
 */
export function getRegister() {
  return register;
}

/**
 * Helper function to record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
) {
  httpRequestDuration
    .labels(method, route, statusCode.toString())
    .observe(duration);
  
  httpRequestTotal
    .labels(method, route, statusCode.toString())
    .inc();
}

/**
 * Helper function to record PDF operation metrics
 */
export function recordPdfOperation(
  operation: 'metadata' | 'page_count' | 'range_request',
  status: 'success' | 'error',
  duration: number
) {
  pdfOperationsTotal
    .labels(operation, status)
    .inc();
  
  pdfOperationDuration
    .labels(operation)
    .observe(duration);
}

/**
 * Helper function to record storage operation metrics
 */
export function recordStorageOperation(
  operation: 'get_metadata' | 'get_stream' | 'get_buffer',
  storageType: 'local' | 's3',
  status: 'success' | 'error',
  duration: number
) {
  storageOperationsTotal
    .labels(operation, storageType, status)
    .inc();
  
  storageOperationDuration
    .labels(operation, storageType)
    .observe(duration);
}

/**
 * Helper function to record cache metrics
 */
export function recordCacheOperation(
  cacheType: 'etag' | 'metadata',
  hit: boolean
) {
  if (hit) {
    documentCacheHits.labels(cacheType).inc();
  } else {
    documentCacheMisses.labels(cacheType).inc();
  }
}

/**
 * Helper function to update active connections gauge
 */
export function updateActiveConnections(count: number) {
  activeConnections.set(count);
}

