# Backend Architecture

## Overview

Node.js backend service that streams PDF documents using HTTP range requests. Serves byte-range chunks on demand without loading entire files into memory.

## Core Components

### API Layer
- **Stack**: Node.js + TypeScript + Fastify
- **Endpoints**:
  - `GET /api/documents/:id/metadata` - Returns page count, file size, ETag
  - `GET /api/documents/:id/range` - Handles byte range requests (HTTP 206)
  - `HEAD /api/documents/:id/range` - Range capability discovery
  - `GET /health` - Health check

### Storage Layer
- **Local Storage**: File system access (development)
- **S3 Storage**: AWS S3 integration (production)


## Request Flow

```
┌─────────┐           ┌─────────┐           ┌─────────┐
│ Browser │           │ Backend │           │ Storage │
└────┬────┘           └────┬────┘           └────┬────┘
     │                     │                     │
     │  Range Request      │                     │
     │ ─────────────────>  │                     │
     │                     │                     │
     │                     │  Parse Range        │
     │                     │  Get Bytes          │
     │                     │ ─────────────────>  │
     │                     │                     │
     │                     │  Stream Data        │
     │                     │ <─────────────────  │
     │                     │                     │
     │  206 Partial        │                     │
     │  Content-Range      │                     │
     │ <─────────────────  │                     │
     │                     │                     │
```

## Key Design Decisions

**HTTP Range Requests (RFC 7233)**
- Reads only requested byte ranges from storage
- Returns 206 (Partial Content) with proper Content-Range headers


**Streaming Architecture**
- No full file buffering in memory
- Direct pipe from storage to HTTP response
- Handles large files

## Project Structure

```
backend/
├── src/
│   ├── app.ts                  # Fastify server + routes
│   └── utils/
│       ├── range.ts            # HTTP range header parsing
│       ├── pdf.ts              # PDF metadata extraction
│       ├── storage.types.ts    # Storage interface
│       ├── storage.factory.ts  # Storage backend factory
│       ├── storage.local.ts    # Local filesystem storage
│       └── storage.s3.ts       # AWS S3 storage
└── tests/
    ├── unit/                   # Unit tests
    └── integration/            # API integration tests
```

## Configuration

Environment variables:

```bash
STORAGE_TYPE=local|s3          # Storage backend selection
AWS_REGION=us-east-2           # AWS region (S3 only)
AWS_S3_BUCKET=bucket-name      # S3 bucket name (S3 only)
NODE_ENV=development|production
PORT=3000                      # Server port
```

## Running Locally

```bash
# With Docker
docker-compose up -d --build

# Backend available at
http://localhost:3000
```
