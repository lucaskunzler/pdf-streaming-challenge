// Configuration for backend API
const BACKEND_URL = "http://localhost:3000";

import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';

// Set worker source to CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

// DOM Elements
const pageNum = document.querySelector("#page_num");
const pageCount = document.querySelector("#page_count");
const currentPage = document.querySelector("#current_page");
const previousPage = document.querySelector("#prev_page");
const nextPage = document.querySelector("#next_page");
const zoomIn = document.querySelector("#zoom_in");
const zoomOut = document.querySelector("#zoom_out");
const docFilename = document.querySelector("#doc_filename");
const docSize = document.querySelector("#doc_size");
const docSelector = document.querySelector("#doc_selector");

const initialState = {
  pdfDoc: null,
  currentPage: 1,
  pageCount: 0,
  zoom: 1,
  currentDocumentId: docSelector.value,
  pageCache: new Map(), // Cache for prefetched pages
  prefetchQueue: new Set(), // Track pages being prefetched
};

// Prefetch adjacent pages for smoother navigation
const prefetchAdjacentPages = async () => {
  if (!initialState.pdfDoc) return;
  
  const totalPages = initialState.pdfDoc.numPages;
  const current = initialState.currentPage;
  const pagesToPrefetch = [];
  
  // Prefetch next page (higher priority)
  if (current < totalPages) {
    pagesToPrefetch.push(current + 1);
  }
  
  // Prefetch previous page
  if (current > 1) {
    pagesToPrefetch.push(current - 1);
  }
  
  // Prefetch next 2 pages ahead for forward navigation
  if (current + 2 <= totalPages) {
    pagesToPrefetch.push(current + 2);
  }
  
  // Prefetch pages in background
  for (const pageNum of pagesToPrefetch) {
    // Skip if already cached or being prefetched
    if (initialState.pageCache.has(pageNum) || initialState.prefetchQueue.has(pageNum)) {
      continue;
    }
    
    initialState.prefetchQueue.add(pageNum);
    
    // Prefetch page data (triggers range request)
    initialState.pdfDoc.getPage(pageNum)
      .then(page => {
        initialState.pageCache.set(pageNum, page);
        initialState.prefetchQueue.delete(pageNum);
        console.log(`📦 Prefetched page ${pageNum}`);
      })
      .catch(err => {
        initialState.prefetchQueue.delete(pageNum);
        console.warn(`Failed to prefetch page ${pageNum}:`, err);
      });
  }
  
  // Clean up old cached pages (keep only nearby pages)
  const cacheLimit = 5;
  if (initialState.pageCache.size > cacheLimit * 2) {
    for (const [cachedPageNum] of initialState.pageCache) {
      if (Math.abs(cachedPageNum - current) > cacheLimit) {
        initialState.pageCache.delete(cachedPageNum);
        console.log(`🗑️  Removed page ${cachedPageNum} from cache`);
      }
    }
  }
};

// Render the current page
const renderPage = () => {
  if (!initialState.pdfDoc) return;
  
  initialState.pdfDoc.getPage(initialState.currentPage).then((page) => {
    const canvas = document.querySelector("#canvas");
    const ctx = canvas.getContext("2d");
    const viewport = page.getViewport({ scale: initialState.zoom });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page into canvas context
    const renderCtx = {
      canvasContext: ctx,
      viewport: viewport,
    };

    page.render(renderCtx);
    pageNum.textContent = initialState.currentPage;
    
    // Prefetch adjacent pages after rendering current page
    setTimeout(() => prefetchAdjacentPages(), 100);
  });
};

// Load a PDF document
const loadDocument = async (documentId) => {
  try {
    // Update UI to show loading
    docFilename.textContent = 'Loading...';
    docSize.textContent = '';
    
    // Fetch document metadata
    const metadataResponse = await fetch(`${BACKEND_URL}/api/documents/${documentId}/metadata`);
    const metadata = await metadataResponse.json();
    
    const sizeMB = (metadata.fileSize / 1024 / 1024).toFixed(2);
    docFilename.textContent = metadata.filename;
    docSize.textContent = `${sizeMB} MB`;
    
    // PDF URL from backend API that supports range requests
    const pdfUrl = `${BACKEND_URL}/api/documents/${documentId}/range`;
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      rangeChunkSize: 128 * 1024, // 128KB chunks - optimizes range requests
      disableAutoFetch: true, // Only fetch data when needed
      disableStream: true,    // Disable full-file streaming, use range requests only
      disableRange: false,    // Explicitly enable range requests
    });
    
    const pdfDoc = await loadingTask.promise;
    
    // Update state
    initialState.pdfDoc = pdfDoc;
    initialState.currentPage = 1;
    initialState.zoom = 1;
    initialState.currentDocumentId = documentId;
    initialState.pageCache.clear(); // Clear cache for new document
    initialState.prefetchQueue.clear(); // Clear prefetch queue
    
    pageCount.textContent = pdfDoc.numPages;
    currentPage.value = 1;
    
    console.log("PDF Document loaded from backend API", pdfDoc);
    
    // Render the first page
    renderPage();
    
  } catch (err) {
    console.error('Error loading PDF:', err);
    docFilename.textContent = 'Error loading document';
    docSize.textContent = '';
    alert(`Failed to load PDF: ${err.message}`);
  }
};

// Navigation functions
const showPrevPage = () => {
  if (initialState.pdfDoc === null || initialState.currentPage <= 1) return;
  initialState.currentPage--;
  currentPage.value = initialState.currentPage;
  renderPage();
};

const showNextPage = () => {
  if (
    initialState.pdfDoc === null ||
    initialState.currentPage >= initialState.pdfDoc._pdfInfo.numPages
  )
    return;

  initialState.currentPage++;
  currentPage.value = initialState.currentPage;
  renderPage();
};

// Event Listeners
previousPage.addEventListener("click", showPrevPage);
nextPage.addEventListener("click", showNextPage);

// Page navigation with Enter key
currentPage.addEventListener("keypress", (event) => {
  if (initialState.pdfDoc === null) return;
  const keycode = event.keyCode ? event.keyCode : event.which;

  if (keycode === 13) {
    let desiredPage = currentPage.valueAsNumber;
    initialState.currentPage = Math.min(
      Math.max(desiredPage, 1),
      initialState.pdfDoc._pdfInfo.numPages
    );

    currentPage.value = initialState.currentPage;
    renderPage();
  }
});

// Zoom Events
zoomIn.addEventListener("click", () => {
  if (initialState.pdfDoc === null) return;
  initialState.zoom *= 4 / 3;
  renderPage();
});

zoomOut.addEventListener("click", () => {
  if (initialState.pdfDoc === null) return;
  initialState.zoom *= 2 / 3;
  renderPage();
});

// Document selector change event
docSelector.addEventListener("change", (event) => {
  const newDocumentId = event.target.value;
  console.log(`Switching to document: ${newDocumentId}`);
  loadDocument(newDocumentId);
});

// Load the initial document
loadDocument(initialState.currentDocumentId);
