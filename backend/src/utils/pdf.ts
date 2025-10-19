import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getS3ObjectBuffer, getS3ObjectMetadata } from './s3.js';

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const TRAILER_READ_SIZE = 8192; // 8KB
const MAX_PAGE_COUNT = 100000;

async function extractPageCountFromTrailer(key: string, fileSize: number): Promise<number | null> {
  try {
    const readSize = Math.min(TRAILER_READ_SIZE, fileSize);
    const start = fileSize - readSize;
    const buffer = await getS3ObjectBuffer(key, { start, end: fileSize - 1 });
    
    const content = buffer.toString('latin1');
    const pagesMatch = content.match(/\/Type\s*\/Pages/);
    
    if (pagesMatch) {
      const afterPages = content.substring(pagesMatch.index!);
      const countMatch = afterPages.match(/\/Count\s+(\d+)/);
      
      if (countMatch) {
        const pageCount = parseInt(countMatch[1], 10);
        return (pageCount > 0 && pageCount < MAX_PAGE_COUNT) ? pageCount : null;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

async function parseFullPdf(key: string): Promise<number> {
  const buffer = await getS3ObjectBuffer(key);
  const uint8Array = new Uint8Array(buffer);
  
  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    verbosity: 0
  });
  
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

export async function getPdfPageCount(key: string): Promise<number> {
  try {
    const metadata = await getS3ObjectMetadata(key);
    
    if (metadata.size > LARGE_FILE_THRESHOLD) {
      const pageCount = await extractPageCountFromTrailer(key, metadata.size);
      if (pageCount !== null) {
        return pageCount;
      }
    }
    
    return await parseFullPdf(key);
    
  } catch (error) {
    console.error(`PDF parsing failed for ${key}:`, error);
    throw new Error(`Unable to extract page count from PDF: ${key}`);
  }
}
