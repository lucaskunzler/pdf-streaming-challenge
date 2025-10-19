import { createReadStream, createReadStream as fsCreateReadStream } from 'fs';
import { stat } from 'fs/promises';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import path from 'path';
import { IStorage, StorageMetadata, ByteRange } from './storage.types.js';

export class LocalStorage implements IStorage {
  constructor(private basePath: string) {}

  private resolvePath(key: string): string {
    return path.join(this.basePath, key);
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    try {
      const filePath = this.resolvePath(key);
      const stats = await stat(filePath);
      
      // Generate MD5-based ETag for local files
      const etag = `"${createHash('md5').update(`${filePath}-${stats.mtime.getTime()}-${stats.size}`).digest('hex')}"`;
      
      return {
        size: stats.size,
        lastModified: stats.mtime,
        etag
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        const err = new Error('Document not found') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        throw err;
      }
      throw error;
    }
  }

  async getStream(key: string, range?: ByteRange): Promise<Readable> {
    const filePath = this.resolvePath(key);
    
    try {
      // Verify file exists first
      await stat(filePath);
      
      const options: { start?: number; end?: number } = {};
      if (range) {
        options.start = range.start;
        options.end = range.end;
      }
      
      return createReadStream(filePath, options);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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
    
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    
    return Buffer.concat(chunks);
  }
}

