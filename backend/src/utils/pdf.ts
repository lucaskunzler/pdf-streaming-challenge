import fs from 'fs/promises';
import path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const TRAILER_READ_SIZE = 8192; // 8KB
const MAX_PAGE_COUNT = 100000;

async function extractPageCountFromTrailer(filePath: string, fileSize: number): Promise<number | null> {
  try {
    const readSize = Math.min(TRAILER_READ_SIZE, fileSize);
    const buffer = Buffer.alloc(readSize);
    
    const fileHandle = await fs.open(filePath, 'r');
    await fileHandle.read(buffer, 0, readSize, fileSize - readSize);
    await fileHandle.close();
    
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

async function parseFullPdf(filePath: string): Promise<number> {
  const buffer = await fs.readFile(filePath);
  const uint8Array = new Uint8Array(buffer);
  
  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    verbosity: 0
  });
  
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

export async function getPdfPageCount(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    
    if (stats.size > LARGE_FILE_THRESHOLD) {
      const pageCount = await extractPageCountFromTrailer(filePath, stats.size);
      if (pageCount !== null) {
        return pageCount;
      }
    }
    
    return await parseFullPdf(filePath);
    
  } catch (error) {
    const filename = path.basename(filePath);
    console.error(`PDF parsing failed for ${filename}:`, error);
    throw new Error(`Unable to extract page count from PDF: ${filename}`);
  }
}
