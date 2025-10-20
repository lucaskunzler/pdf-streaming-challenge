import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { getPdfPageCount } from '../../src/utils/pdf';
import { LocalStorage } from '../../src/utils/storage.local';
import { IStorage } from '../../src/utils/storage.types';

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

    it('should efficiently extract page count from linearized large PDF (> 5MB) using header optimization', async () => {
      const startTime = Date.now();
      const pageCount = await getPdfPageCount('large-361p-12mb.pdf', storage);
      const duration = Date.now() - startTime;
      
      expect(pageCount).toBe(361);
      // Should be fast since we only read header (~16KB), not full 12MB
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should throw error for non-existent file', async () => {
      await expect(getPdfPageCount('non-existent.pdf', storage)).rejects.toThrow();
    });

    describe('optimization strategies', () => {
      it('should extract page count from linearized PDF header', async () => {
        // Create a mock storage that returns a linearized PDF header
        const mockStorage: IStorage = {
          getMetadata: vi.fn().mockResolvedValue({
            size: 10 * 1024 * 1024, // 10MB - triggers optimization
            lastModified: new Date(),
            etag: 'test-etag'
          }),
          getBuffer: vi.fn().mockImplementation(async (key: string, range?: any) => {
            // Simulate linearized PDF header with /N field
            const linearizedHeader = `%PDF-1.4
983 0 obj
<< /Linearized 1 /L 10485760 /H [ 573 1256 ] /O 986 /E 2648 /N 42 /T 10465280 >>
endobj`;
            return Buffer.from(linearizedHeader, 'latin1');
          }),
          getStream: vi.fn()
        };

        const pageCount = await getPdfPageCount('test.pdf', mockStorage);
        
        expect(pageCount).toBe(42);
        expect(mockStorage.getBuffer).toHaveBeenCalledTimes(1);
        // Verify it only read the header, not the trailer or full file
        expect(mockStorage.getBuffer).toHaveBeenCalledWith('test.pdf', { start: 0, end: 16383 });
      });

      it('should fall back to trailer extraction for non-linearized PDFs', async () => {
        let callCount = 0;
        const mockStorage: IStorage = {
          getMetadata: vi.fn().mockResolvedValue({
            size: 10 * 1024 * 1024, // 10MB - triggers optimization
            lastModified: new Date(),
            etag: 'test-etag'
          }),
          getBuffer: vi.fn().mockImplementation(async (key: string, range?: any) => {
            callCount++;
            if (callCount === 1) {
              // First call: header doesn't contain linearization info
              return Buffer.from('%PDF-1.4\nSome non-linearized content', 'latin1');
            } else if (callCount === 2) {
              // Second call: trailer contains page count
              const trailer = `<< /Type /Pages /Count 99 /Kids [] >>
endobj
trailer
<< /Size 100 >>
startxref
%%EOF`;
              return Buffer.from(trailer, 'latin1');
            }
            return Buffer.from('', 'latin1');
          }),
          getStream: vi.fn()
        };

        const pageCount = await getPdfPageCount('test.pdf', mockStorage);
        
        expect(pageCount).toBe(99);
        expect(mockStorage.getBuffer).toHaveBeenCalledTimes(2);
        // First call should be for header
        expect(mockStorage.getBuffer).toHaveBeenNthCalledWith(1, 'test.pdf', { start: 0, end: 16383 });
        // Second call should be for trailer
        expect(mockStorage.getBuffer).toHaveBeenNthCalledWith(2, 'test.pdf', { 
          start: 10 * 1024 * 1024 - 8192, 
          end: 10 * 1024 * 1024 - 1 
        });
      });

      it('should fall back to full PDF parsing when both optimizations fail', async () => {
        const mockStorage: IStorage = {
          getMetadata: vi.fn().mockResolvedValue({
            size: 10 * 1024 * 1024, // 10MB - triggers optimization
            lastModified: new Date(),
            etag: 'test-etag'
          }),
          getBuffer: vi.fn().mockImplementation(async (key: string, range?: any) => {
            if (range) {
              // Both header and trailer return content without page count
              return Buffer.from('%PDF-1.4\nNo page count here', 'latin1');
            } else {
              // Full file request - return a valid minimal PDF
              const storage = new LocalStorage(FIXTURES_PATH);
              return await storage.getBuffer('tiny-1p.pdf');
            }
          }),
          getStream: vi.fn()
        };

        const pageCount = await getPdfPageCount('test.pdf', mockStorage);
        
        expect(pageCount).toBe(1); // tiny-1p.pdf has 1 page
        expect(mockStorage.getBuffer).toHaveBeenCalledTimes(3);
        // First two calls for optimization (header and trailer)
        expect(mockStorage.getBuffer).toHaveBeenNthCalledWith(1, 'test.pdf', { start: 0, end: 16383 });
        expect(mockStorage.getBuffer).toHaveBeenNthCalledWith(2, 'test.pdf', expect.any(Object));
        // Third call for full file
        expect(mockStorage.getBuffer).toHaveBeenNthCalledWith(3, 'test.pdf');
      });

      it('should skip optimization for small files (< 5MB)', async () => {
        const mockStorage: IStorage = {
          getMetadata: vi.fn().mockResolvedValue({
            size: 1024 * 1024, // 1MB - below threshold
            lastModified: new Date(),
            etag: 'test-etag'
          }),
          getBuffer: vi.fn().mockImplementation(async (key: string, range?: any) => {
            // Return a valid small PDF
            const storage = new LocalStorage(FIXTURES_PATH);
            return await storage.getBuffer('small-2p.pdf');
          }),
          getStream: vi.fn()
        };

        const pageCount = await getPdfPageCount('test.pdf', mockStorage);
        
        expect(pageCount).toBe(2); // small-2p.pdf has 2 pages
        expect(mockStorage.getBuffer).toHaveBeenCalledTimes(1);
        // Should directly request full file without range
        expect(mockStorage.getBuffer).toHaveBeenCalledWith('test.pdf');
      });
    });
  });
});

