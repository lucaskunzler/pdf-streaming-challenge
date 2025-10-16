# PDF Streaming Backend

A Fastify-based API for PDF document metadata extraction with HTTP range support.

## Quick Start

### Setup
```bash
npm install
```

### Run Server
```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Health Check
```bash
GET /health
```
```json
{
  "status": "ok",
  "timestamp": "2025-10-16T18:21:30.123Z"
}
```

### Document Metadata
```bash
GET /api/documents/:id/metadata
```

**Example:**
```bash
curl http://localhost:3000/api/documents/sample.pdf/metadata
```

**Response:**
```json
{
  "id": "sample.pdf",
  "filename": "sample.pdf", 
  "pageCount": 10,
  "fileSize": 1024000,
  "lastModified": "2025-10-16T18:21:30.123Z",
  "etag": "\"abc123def456\""
}
```

**Error Responses:**
- `404` - Document not found
- `500` - PDF processing failed

### HTTP Range Support
```bash
GET /api/documents/:id/range
```

**Example:**
```bash
curl -H "Range: bytes=0-1023" http://localhost:3000/api/documents/sample.pdf/range
```

**Response:** 206 Partial Content with binary PDF data

**Supported Range Types:**
- `bytes=0-1023` - Specific byte range
- `bytes=1000-` - From byte to end of file
- `bytes=-500` - Last 500 bytes

**Error Responses:**
- `400` - Range header required
- `404` - Document not found  
- `416` - Range not satisfiable

## Configuration

Set document storage path via environment variable:
```bash
export DOCUMENTS_PATH=/path/to/pdf/documents
npm run dev
```

Default: `./documents/`

## Testing

```bash
npm test
```
