import { describe, it, expect } from 'vitest';
import path from 'path';
import { getPdfPageCount } from '../../src/utils/pdf';

const FIXTURES_PATH = path.join(__dirname, '../fixtures');

describe('PDF Utils', () => {
  describe('getPdfPageCount', () => {
    it('should extract page count from tiny PDF (< 5MB)', async () => {
      const filePath = path.join(FIXTURES_PATH, 'tiny-1p.pdf');
      const pageCount = await getPdfPageCount(filePath);
      expect(pageCount).toBe(1);
    });

    it('should extract page count from small PDF (< 5MB)', async () => {
      const filePath = path.join(FIXTURES_PATH, 'small-2p.pdf');
      const pageCount = await getPdfPageCount(filePath);
      expect(pageCount).toBe(2);
    });

    it('should extract page count from multi-page PDF (< 5MB)', async () => {
      const filePath = path.join(FIXTURES_PATH, 'text-and-images.pdf');
      const pageCount = await getPdfPageCount(filePath);
      expect(pageCount).toBe(9);
    });

    it('should efficiently extract page count from large PDF (> 5MB) using trailer optimization', async () => {
      const filePath = path.join(FIXTURES_PATH, 'large-361p-12mb.pdf');
      const startTime = Date.now();
      const pageCount = await getPdfPageCount(filePath);
      const duration = Date.now() - startTime;
      
      expect(pageCount).toBe(361);
      // Should be fast since we only read trailer (~8KB), not full 12MB
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle PDF with images correctly', async () => {
      const filePath = path.join(FIXTURES_PATH, 'small-images.pdf');
      const pageCount = await getPdfPageCount(filePath);
      expect(pageCount).toBeGreaterThan(0);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(FIXTURES_PATH, 'non-existent.pdf');
      await expect(getPdfPageCount(filePath)).rejects.toThrow();
    });
  });
});

