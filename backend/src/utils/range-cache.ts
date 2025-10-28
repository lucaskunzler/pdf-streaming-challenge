/**
 * Range Request Cache
 * 
 * Implements intelligent caching for S3 range requests to improve performance:
 * - Caches frequently accessed ranges
 * - Implements LRU eviction
 * - Supports range coalescing
 * - Memory-efficient storage
 */

import { ByteRange } from './storage.types.js';

interface CachedRange {
  data: Buffer;
  range: ByteRange;
  timestamp: number;
  accessCount: number;
}

export class RangeRequestCache {
  private cache: Map<string, CachedRange[]> = new Map();
  private readonly maxCacheSize: number;
  private readonly maxRangesPerFile: number;
  private readonly ttl: number;
  private currentSize: number = 0;

  constructor(
    maxCacheSize: number = 50 * 1024 * 1024, // 50MB
    maxRangesPerFile: number = 10,
    ttl: number = 10 * 60 * 1000 // 10 minutes
  ) {
    this.maxCacheSize = maxCacheSize;
    this.maxRangesPerFile = maxRangesPerFile;
    this.ttl = ttl;
  }

  /**
   * Get cached range data
   */
  get(key: string, range: ByteRange): Buffer | null {
    const fileRanges = this.cache.get(key);
    if (!fileRanges) return null;

    // Find overlapping range
    for (const cached of fileRanges) {
      if (this.rangesOverlap(cached.range, range)) {
        // Check TTL
        if (Date.now() - cached.timestamp > this.ttl) {
          this.removeRange(key, cached);
          continue;
        }

        // Extract the requested range from cached data
        const extracted = this.extractRange(cached.data, cached.range, range);
        if (extracted) {
          cached.accessCount++;
          cached.timestamp = Date.now();
          return extracted;
        }
      }
    }

    return null;
  }

  /**
   * Cache range data
   */
  set(key: string, range: ByteRange, data: Buffer): void {
    // Clean up expired entries first
    this.cleanupExpired();

    // Check if we need to evict
    if (this.currentSize + data.length > this.maxCacheSize) {
      this.evictLRU();
    }

    const fileRanges = this.cache.get(key) || [];
    
    // Remove overlapping ranges to avoid duplication
    this.removeOverlappingRanges(key, range);

    // Add new range
    const cached: CachedRange = {
      data: Buffer.from(data), // Create a copy
      range: { ...range },
      timestamp: Date.now(),
      accessCount: 1
    };

    fileRanges.push(cached);
    this.cache.set(key, fileRanges);
    this.currentSize += data.length;

    // Limit ranges per file
    if (fileRanges.length > this.maxRangesPerFile) {
      this.evictLRUFromFile(key);
    }
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(range1: ByteRange, range2: ByteRange): boolean {
    return range1.start <= range2.end && range2.start <= range1.end;
  }

  /**
   * Extract a sub-range from cached data
   */
  private extractRange(cachedData: Buffer, cachedRange: ByteRange, requestedRange: ByteRange): Buffer | null {
    const overlapStart = Math.max(cachedRange.start, requestedRange.start);
    const overlapEnd = Math.min(cachedRange.end, requestedRange.end);

    if (overlapStart > overlapEnd) return null;

    const startOffset = overlapStart - cachedRange.start;
    const endOffset = overlapEnd - cachedRange.start;
    const length = endOffset - startOffset + 1;

    return cachedData.slice(startOffset, startOffset + length);
  }

  /**
   * Remove overlapping ranges for a file
   */
  private removeOverlappingRanges(key: string, range: ByteRange): void {
    const fileRanges = this.cache.get(key);
    if (!fileRanges) return;

    const filtered = fileRanges.filter(cached => !this.rangesOverlap(cached.range, range));
    
    // Update size
    const removedSize = fileRanges.reduce((total, cached) => {
      if (this.rangesOverlap(cached.range, range)) {
        return total + cached.data.length;
      }
      return total;
    }, 0);
    
    this.currentSize -= removedSize;
    this.cache.set(key, filtered);
  }

  /**
   * Remove a specific range
   */
  private removeRange(key: string, range: CachedRange): void {
    const fileRanges = this.cache.get(key);
    if (!fileRanges) return;

    const filtered = fileRanges.filter(cached => cached !== range);
    this.currentSize -= range.data.length;
    this.cache.set(key, filtered);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    
    for (const [key, fileRanges] of this.cache.entries()) {
      const validRanges = fileRanges.filter(cached => now - cached.timestamp <= this.ttl);
      
      if (validRanges.length !== fileRanges.length) {
        const removedSize = fileRanges.reduce((total, cached) => {
          if (!validRanges.includes(cached)) {
            return total + cached.data.length;
          }
          return total;
        }, 0);
        
        this.currentSize -= removedSize;
        this.cache.set(key, validRanges);
      }
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const allRanges: Array<{ key: string; cached: CachedRange }> = [];
    
    for (const [key, fileRanges] of this.cache.entries()) {
      for (const cached of fileRanges) {
        allRanges.push({ key, cached });
      }
    }

    // Sort by access count and timestamp
    allRanges.sort((a, b) => {
      if (a.cached.accessCount !== b.cached.accessCount) {
        return a.cached.accessCount - b.cached.accessCount;
      }
      return a.cached.timestamp - b.cached.timestamp;
    });

    // Remove 20% of entries
    const toRemove = Math.ceil(allRanges.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      const { key, cached } = allRanges[i];
      this.removeRange(key, cached);
    }
  }

  /**
   * Evict LRU from a specific file
   */
  private evictLRUFromFile(key: string): void {
    const fileRanges = this.cache.get(key);
    if (!fileRanges) return;

    // Sort by access count and timestamp
    fileRanges.sort((a, b) => {
      if (a.accessCount !== b.accessCount) {
        return a.accessCount - b.accessCount;
      }
      return a.timestamp - b.timestamp;
    });

    // Remove the least recently used
    const toRemove = fileRanges[0];
    this.removeRange(key, toRemove);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalSize: number;
    fileCount: number;
    rangeCount: number;
    hitRate?: number;
  } {
    let rangeCount = 0;
    for (const fileRanges of this.cache.values()) {
      rangeCount += fileRanges.length;
    }

    return {
      totalSize: this.currentSize,
      fileCount: this.cache.size,
      rangeCount
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }
}
