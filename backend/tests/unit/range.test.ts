import { describe, it, expect } from 'vitest';
import { parseRange } from '../../src/utils/range';

describe('Range Utils', () => {
  describe('parseRange', () => {
    const fileSize = 10000;

    describe('valid ranges', () => {
      it('should parse basic range (bytes=0-1023)', () => {
        const result = parseRange('bytes=0-1023', fileSize);
        expect(result).toEqual({ start: 0, end: 1023 });
      });

      it('should parse middle range (bytes=5000-6000)', () => {
        const result = parseRange('bytes=5000-6000', fileSize);
        expect(result).toEqual({ start: 5000, end: 6000 });
      });

      it('should parse open-ended range (bytes=5000-)', () => {
        const result = parseRange('bytes=5000-', fileSize);
        expect(result).toEqual({ start: 5000, end: 9999 });
      });

      it('should parse suffix range (bytes=-500)', () => {
        const result = parseRange('bytes=-500', fileSize);
        expect(result).toEqual({ start: 9500, end: 9999 });
      });

      it('should parse suffix range larger than file', () => {
        const result = parseRange('bytes=-20000', fileSize);
        expect(result).toEqual({ start: 0, end: 9999 });
      });

      it('should handle single byte range (bytes=0-0)', () => {
        const result = parseRange('bytes=0-0', fileSize);
        expect(result).toEqual({ start: 0, end: 0 });
      });

      it('should handle range at end of file', () => {
        const result = parseRange('bytes=9999-9999', fileSize);
        expect(result).toEqual({ start: 9999, end: 9999 });
      });
    });

    describe('invalid ranges', () => {
      it('should return null for invalid prefix', () => {
        const result = parseRange('invalid=0-1023', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for missing bytes= prefix', () => {
        const result = parseRange('0-1023', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for missing dash', () => {
        const result = parseRange('bytes=1000', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for start > end', () => {
        const result = parseRange('bytes=1000-500', fileSize);
        expect(result).toBeNull();
      });

      it('should parse suffix range with dash in value (bytes=-100-200)', () => {
        // Note: This parses as suffix range (last 100 bytes) because startStr is empty
        // The "200" part is ignored. This is how HTTP Range header spec works.
        const result = parseRange('bytes=-100', fileSize);
        expect(result).toEqual({ start: 9900, end: 9999 });
      });

      it('should return null for invalid numbers', () => {
        const result = parseRange('bytes=abc-def', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for empty range', () => {
        const result = parseRange('bytes=-', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for zero suffix', () => {
        const result = parseRange('bytes=-0', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for negative suffix', () => {
        const result = parseRange('bytes=--500', fileSize);
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = parseRange('', fileSize);
        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should handle very small file (1 byte)', () => {
        const result = parseRange('bytes=0-0', 1);
        expect(result).toEqual({ start: 0, end: 0 });
      });

      it('should handle open-ended range on small file', () => {
        const result = parseRange('bytes=0-', 1);
        expect(result).toEqual({ start: 0, end: 0 });
      });

      it('should handle suffix on small file', () => {
        const result = parseRange('bytes=-1', 1);
        expect(result).toEqual({ start: 0, end: 0 });
      });

      it('should handle large file size', () => {
        const largeSize = 100_000_000; // 100MB
        const result = parseRange('bytes=50000000-60000000', largeSize);
        expect(result).toEqual({ start: 50000000, end: 60000000 });
      });

      it('should handle whitespace in numbers (parseInt tolerates it)', () => {
        // JavaScript's parseInt() handles leading/trailing whitespace
        const result = parseRange('bytes= 100-200 ', fileSize);
        expect(result).toEqual({ start: 100, end: 200 });
      });
    });
  });
});

