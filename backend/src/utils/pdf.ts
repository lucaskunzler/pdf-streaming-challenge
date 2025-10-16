import fs from 'fs/promises';
import path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function getPdfPageCount(filePath: string): Promise<number> {
  try {
    const buffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(buffer);
    
    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      verbosity: 0
    });
    
    const pdf = await loadingTask.promise;
    return pdf.numPages;
    
  } catch (error) {
    const filename = path.basename(filePath);
    console.error(`PDF parsing failed for ${filename}:`, error);
    
    throw new Error(`Unable to extract page count from PDF: ${filename}`);
  }
}
