import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { IStorage, StorageMetadata, ByteRange } from './storage.types.js';

export class S3Storage implements IStorage {
  private s3Client: S3Client;
  private bucket: string;

  constructor(bucket: string, region: string = 'us-east-1') {
    this.s3Client = new S3Client({ region });
    this.bucket = bucket;
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client.send(command);
      
      return {
        size: response.ContentLength!,
        lastModified: response.LastModified!,
        etag: response.ETag!
      };
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
    
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    
    return Buffer.concat(chunks);
  }
}

