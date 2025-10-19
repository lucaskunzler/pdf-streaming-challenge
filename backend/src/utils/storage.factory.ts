import { IStorage } from './storage.types.js';
import { LocalStorage } from './storage.local.js';
import { S3Storage } from './storage.s3.js';

export interface LocalStorageConfig {
  type: 'local';
  basePath: string;
}

export interface S3StorageConfig {
  type: 's3';
  bucket: string;
  region?: string;
}

export type StorageConfig = LocalStorageConfig | S3StorageConfig;

export function createStorage(config: StorageConfig): IStorage {
  if (config.type === 'local') {
    return new LocalStorage(config.basePath);
  } else {
    return new S3Storage(config.bucket, config.region);
  }
}

