# PDF Streaming Challenge

A full-stack PDF viewer application with HTTP range support for efficient streaming of large documents.

## Quick Start

### With Docker (Recommended)

```bash
docker-compose up --build
```

- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:3000
- **API Documentation**: http://localhost:3000/docs

### Backend Development

```bash
cd backend
npm install

# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

Server runs on `http://localhost:3000`

## API Documentation

Interactive Swagger UI documentation is available at:
```
http://localhost:3000/docs
```

OpenAPI JSON specification:
```
http://localhost:3000/docs/json
```

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
HEAD /api/documents/:id/range
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
cd backend
npm test
```

## Documentation

- [Feature Brief](./docs/feature-brief.md)
- [Architecture Overview](./docs/architecture.md)

## Tech Stack

- **Backend**: Fastify + TypeScript + pdf-parse
- **Frontend**: Vanilla JS + PDF.js
- **Infrastructure**: Docker + Docker Compose
