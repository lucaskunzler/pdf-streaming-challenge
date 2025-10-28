import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { IStorage, StorageMetadata, ByteRange } from './storage.types.js';

export class S3Storage implements IStorage {
  private s3Client: S3Client;
  private bucket: string;
  private metadataCache: Map<string, { metadata: StorageMetadata; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(bucket: string, region: string = 'us-east-1') {
    this.s3Client = new S3Client({ 
      region,
      // Performance optimizations
      maxAttempts: 3,
      retryMode: 'adaptive'
    });
    this.bucket = bucket;
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    // Check cache first
    const cached = this.metadataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.metadata;
    }

    try {
      const command = new HeadObjectCommand({ 
        Bucket: this.bucket, 
        Key: key
      });
      
      const response = await this.s3Client.send(command);
      
      const metadata: StorageMetadata = {
        size: response.ContentLength!,
        lastModified: response.LastModified!,
        etag: response.ETag!
      };

      // Cache the metadata
      this.metadataCache.set(key, {
        metadata,
        timestamp: Date.now()
      });

      return metadata;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        const err = new Error('Document not found') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        throw err;
      }
      throw error;
    }
  }

  async getStream(key: string, range?: ByteRange): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined
      });
      
      const response = await this.s3Client.send(command);
      return response.Body as Readable;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        const err = new Error('Document not found') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        throw err;
      }
      throw error;
    }
  }

  async getBuffer(key: string, range?: ByteRange): Promise<Buffer> {
    const stream = await this.getStream(key, range);
    const chunks: Buffer[] = [];
    
    // Optimized buffer collection
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        chunks.push(chunk as Buffer);
      });
      
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.metadataCache.size,
      keys: Array.from(this.metadataCache.keys())
    };
  }
}

