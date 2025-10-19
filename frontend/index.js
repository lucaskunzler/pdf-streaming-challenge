// Configuration for backend API
const BACKEND_URL = "http://localhost:3000";
const DOCUMENT_ID = "large-361p-12mb.pdf";

// Change DOCUMENT_ID to load different documents
// small-2p.pdf
// text-and-images.pdf
// large-361p-12mb.pdf
// large-361p-12mb-linearized.pdf



import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';

// Set worker source to CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

// PDF URL from backend API that supports range requests
const pdfUrl = `${BACKEND_URL}/api/documents/${DOCUMENT_ID}/range`;

const pageNum = document.querySelector("#page_num");
const pageCount = document.querySelector("#page_count");
const currentPage = document.querySelector("#current_page");
const previousPage = document.querySelector("#prev_page");
const nextPage = document.querySelector("#next_page");
const zoomIn = document.querySelector("#zoom_in");
const zoomOut = document.querySelector("#zoom_out");

const initialState = {
  pdfDoc: null,
  currentPage: 1,
  pageCount: 0,
  zoom: 1,
};

// Render the page
const renderPage = () => {
  // load the first page
  // console.log(initialState.pdfDoc, "pdfDoc");
  initialState.pdfDoc.getPage(initialState.currentPage).then((page) => {
    // console.log("page", page);

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
  });
};

// Load the Document from backend API with range request support
pdfjsLib
  .getDocument({
    url: pdfUrl,
    rangeChunkSize: 65536, // 64KB chunks - optimizes range requests
    disableAutoFetch: true, // Only fetch data when needed
    disableStream: true,    // Disable full-file streaming, use range requests only
    disableRange: false,    // Explicitly enable range requests (default, but being explicit)
  })
  .promise.then((data) => {
    initialState.pdfDoc = data;
    console.log("pdfDocument loaded from backend API", initialState.pdfDoc);

    pageCount.textContent = initialState.pdfDoc.numPages;

    renderPage();
  })
  .catch((err) => {
    console.error("Error loading PDF:", err);
    alert(`Failed to load PDF: ${err.message}`);
  });

const showPrevPage = () => {
  if (initialState.pdfDoc === null || initialState.currentPage <= 1) return;
  initialState.currentPage--;
  // render the current page
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

// Button Events
previousPage.addEventListener("click", showPrevPage);
nextPage.addEventListener("click", showNextPage);

// Keypress Event
currentPage.addEventListener("keypress", (event) => {
  if (initialState.pdfDoc === null) return;
  // get the key code
  const keycode = event.keyCode ? event.keyCode : event.which;

  if (keycode === 13) {
    // get the new page number and render it
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
