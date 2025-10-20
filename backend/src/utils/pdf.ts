import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { IStorage } from './storage.types.js';

// Configuration constants
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const HEADER_READ_SIZE = 16384; // 16KB - enough for linearization dictionary
const TRAILER_READ_SIZE = 8192; // 8KB - enough for page catalog
const MAX_PAGE_COUNT = 100000;

// PDF structure regex patterns
const PDF_PATTERNS = {
  // Linearized PDFs: << /Linearized 1 /N 361 ... >>
  LINEARIZED_MARKER: /\/Linearized\s+1/,
  LINEARIZED_PAGE_COUNT: /\/N\s+(\d+)/,
  
  // Non-linearized PDFs: << /Type /Pages /Count 99 ... >>
  PAGES_OBJECT: /\/Type\s*\/Pages/,
  PAGE_COUNT: /\/Count\s+(\d+)/,
} as const;

/**
 * Validates that a page count is within acceptable bounds
 */
function isValidPageCount(count: number): boolean {
  return count > 0 && count < MAX_PAGE_COUNT;
}

/**
 * Extracts page count from a linearized PDF header
 * Linearized PDFs store metadata at the beginning for fast web streaming
 */
function extractFromLinearizedHeader(content: string): number | null {
  if (!PDF_PATTERNS.LINEARIZED_MARKER.test(content)) {
    return null;
  }

  const match = content.match(PDF_PATTERNS.LINEARIZED_PAGE_COUNT);
  if (!match) {
    return null;
  }

  const pageCount = parseInt(match[1], 10);
  return isValidPageCount(pageCount) ? pageCount : null;
}

/**
 * Extracts page count from a non-linearized PDF trailer
 * Traditional PDFs store the page catalog at the end
 */
function extractFromPagesCatalog(content: string): number | null {
  if (!PDF_PATTERNS.PAGES_OBJECT.test(content)) {
    return null;
  }

  const match = content.match(PDF_PATTERNS.PAGE_COUNT);
  if (!match) {
    return null;
  }

  const pageCount = parseInt(match[1], 10);
  return isValidPageCount(pageCount) ? pageCount : null;
}

/**
 * Attempts to extract page count from PDF header (first 16KB)
 * Fast path for linearized/web-optimized PDFs
 */
async function tryExtractFromHeader(
  key: string,
  fileSize: number,
  storage: IStorage
): Promise<number | null> {
  try {
    const readSize = Math.min(HEADER_READ_SIZE, fileSize);
    const buffer = await storage.getBuffer(key, { start: 0, end: readSize - 1 });
    const content = buffer.toString('latin1');
    
    return extractFromLinearizedHeader(content);
  } catch {
    // Header extraction failed, will try other methods
    return null;
  }
}

/**
 * Attempts to extract page count from PDF trailer (last 8KB)
 * Fallback for non-linearized PDFs
 */
async function tryExtractFromTrailer(
  key: string,
  fileSize: number,
  storage: IStorage
): Promise<number | null> {
  try {
    const readSize = Math.min(TRAILER_READ_SIZE, fileSize);
    const start = fileSize - readSize;
    const buffer = await storage.getBuffer(key, { start, end: fileSize - 1 });
    const content = buffer.toString('latin1');
    
    return extractFromPagesCatalog(content);
  } catch {
    // Trailer extraction failed, will fall back to full parsing
    return null;
  }
}

/**
 * Parses the entire PDF file to extract page count
 * Last resort when optimizations fail
 */
async function parseFullPdf(key: string, storage: IStorage): Promise<number> {
  const buffer = await storage.getBuffer(key);
  const uint8Array = new Uint8Array(buffer);
  
  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    verbosity: 0,
  });
  
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

/**
 * Extracts page count from a PDF using multiple strategies:
 * 1. Header extraction (fast) - for linearized PDFs
 * 2. Trailer extraction (fast) - for non-linearized PDFs
 * 3. Full parsing (slow) - when both optimizations fail
 * 
 * Small files (< 5MB) skip optimization and parse directly
 */
export async function getPdfPageCount(key: string, storage: IStorage): Promise<number> {
  try {
    const metadata = await storage.getMetadata(key);
    
    // Only attempt optimizations for large files
    if (metadata.size > LARGE_FILE_THRESHOLD) {
      // Try header first (most common for web-optimized PDFs)
      const fromHeader = await tryExtractFromHeader(key, metadata.size, storage);
      if (fromHeader !== null) {
        return fromHeader;
      }
      
      // Try trailer second (for traditional PDFs)
      const fromTrailer = await tryExtractFromTrailer(key, metadata.size, storage);
      if (fromTrailer !== null) {
        return fromTrailer;
      }
    }
    
    // Fall back to full parsing for small files or when optimizations fail
    return await parseFullPdf(key, storage);
    
  } catch (error) {
    console.error(`PDF parsing failed for ${key}:`, error);
    throw new Error(`Unable to extract page count from PDF: ${key}`);
  }
}

