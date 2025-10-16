export function parseRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const range = rangeHeader.slice(6);
  
  if (range.includes('-')) {
    const [startStr, endStr] = range.split('-');
    
    if (startStr === '') {
      // Suffix range: bytes=-500
      const suffix = parseInt(endStr);
      if (isNaN(suffix) || suffix <= 0) return null;
      const start = Math.max(0, fileSize - suffix);
      return { start, end: fileSize - 1 };
    }
    
    if (endStr === '') {
      // Open-ended range: bytes=1000-
      const start = parseInt(startStr);
      if (isNaN(start) || start < 0) return null;
      return { start, end: fileSize - 1 };
    }
    
    // Full range: bytes=0-1023
    const start = parseInt(startStr);
    const end = parseInt(endStr);
    if (isNaN(start) || isNaN(end) || start < 0 || end < start) return null;
    return { start, end };
  }
  
  return null;
}
