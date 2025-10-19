import { describe, it, expect } from 'vitest';
import path from 'path';
import { getPdfPageCount } from '../../src/utils/pdf';
import { LocalStorage } from '../../src/utils/storage.local';

const FIXTURES_PATH = path.join(__dirname, '../fixtures');

describe('PDF Utils', () => {
  describe('getPdfPageCount', () => {
    const storage = new LocalStorage(FIXTURES_PATH);

    it('should extract page count from tiny PDF (< 5MB)', async () => {
      const pageCount = await getPdfPageCount('tiny-1p.pdf', storage);
      expect(pageCount).toBe(1);
    });

    it('should extract page count from small PDF (< 5MB)', async () => {
      const pageCount = await getPdfPageCount('small-2p.pdf', storage);
      expect(pageCount).toBe(2);
    });

    it('should extract page count from multi-page PDF (< 5MB)', async () => {
      const pageCount = await getPdfPageCount('text-and-images.pdf', storage);
      expect(pageCount).toBe(9);
    });

    it('should efficiently extract page count from large PDF (> 5MB) using trailer optimization', async () => {
      const startTime = Date.now();
      const pageCount = await getPdfPageCount('large-361p-12mb.pdf', storage);
      const duration = Date.now() - startTime;
      
      expect(pageCount).toBe(361);
      // Should be fast since we only read trailer (~8KB), not full 12MB
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle PDF with images correctly', async () => {
      const pageCount = await getPdfPageCount('small-images.pdf', storage);
      expect(pageCount).toBeGreaterThan(0);
    });

    it('should throw error for non-existent file', async () => {
      await expect(getPdfPageCount('non-existent.pdf', storage)).rejects.toThrow();
    });
  });
});

