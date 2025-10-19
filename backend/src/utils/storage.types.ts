import { Readable } from 'stream';

export interface StorageMetadata {
  size: number;
  lastModified: Date;
  etag: string;
}

export interface ByteRange {
  start: number;
  end: number;
}

export interface IStorage {
  /**
   * Get metadata for a document
   * @param key - Document identifier (file path or S3 key)
   * @throws Error if document not found
   */
  getMetadata(key: string): Promise<StorageMetadata>;

  /**
   * Get a readable stream for a document or range
   * @param key - Document identifier
   * @param range - Optional byte range to fetch
   */
  getStream(key: string, range?: ByteRange): Promise<Readable>;

  /**
   * Get a buffer for a document or range
   * @param key - Document identifier
   * @param range - Optional byte range to fetch
   */
  getBuffer(key: string, range?: ByteRange): Promise<Buffer>;
}

