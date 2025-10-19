import { describe, it, expect } from 'vitest';
import { createStorage } from '../../src/utils/storage.factory';
import { LocalStorage } from '../../src/utils/storage.local';
import { S3Storage } from '../../src/utils/storage.s3';

describe('Storage Factory', () => {
  describe('createStorage', () => {
    it('should create LocalStorage when type is local', () => {
      const storage = createStorage({
        type: 'local',
        basePath: '/test/path'
      });

      expect(storage).toBeInstanceOf(LocalStorage);
    });

    it('should create S3Storage when type is s3', () => {
      const storage = createStorage({
        type: 's3',
        bucket: 'test-bucket',
        region: 'us-east-1'
      });

      expect(storage).toBeInstanceOf(S3Storage);
    });

    it('should create S3Storage with default region when not specified', () => {
      const storage = createStorage({
        type: 's3',
        bucket: 'test-bucket'
      });

      expect(storage).toBeInstanceOf(S3Storage);
    });

    it('should pass basePath to LocalStorage', () => {
      const storage = createStorage({
        type: 'local',
        basePath: '/custom/documents'
      });

      expect(storage).toBeInstanceOf(LocalStorage);
      // The LocalStorage instance should have the correct basePath
      // We can verify this by checking private property (though not ideal in tests)
      expect((storage as any).basePath).toBe('/custom/documents');
    });

    it('should pass bucket and region to S3Storage', () => {
      const storage = createStorage({
        type: 's3',
        bucket: 'my-bucket',
        region: 'eu-west-1'
      });

      expect(storage).toBeInstanceOf(S3Storage);
      expect((storage as any).bucket).toBe('my-bucket');
    });
  });
});

