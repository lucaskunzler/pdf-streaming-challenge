import { useState, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Configure PDF.js worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  url: string;
  onMetadataLoad?: (metadata: { numPages: number; fileSize?: number }) => void;
}

export const PDFViewer = ({ url, onMetadataLoad }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [loading, setLoading] = useState(true);
  const [hasShownToast, setHasShownToast] = useState(false);

  const documentOptions = useMemo(
    () => ({
      httpHeaders: {},
      withCredentials: false,
    }),
    []
  );

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      setLoading(false);
      onMetadataLoad?.({ numPages: pages });
      if (!hasShownToast) {
        toast.success(`PDF loaded successfully (${pages} pages)`);
        setHasShownToast(true);
      }
    },
    [onMetadataLoad, hasShownToast]
  );

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("Error loading PDF:", error);
    setLoading(false);
    if (!hasShownToast) {
      toast.error("Failed to load PDF");
      setHasShownToast(true);
    }
  }, [hasShownToast]);

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1;
      setPageNumber(newPage);
      setPageInput(String(newPage));
    }
  };

  const goToNextPage = () => {
    if (pageNumber < numPages) {
      const newPage = pageNumber + 1;
      setPageNumber(newPage);
      setPageInput(String(newPage));
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput, 10);
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
    } else {
      setPageInput(String(pageNumber));
      toast.error(`Please enter a page number between 1 and ${numPages}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Bar */}
      <div className="flex items-center justify-center gap-4 p-4 bg-[hsl(var(--nav-bg))] border-b border-border shadow-[var(--shadow-subtle)]">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevPage}
          disabled={pageNumber <= 1 || loading}
          className="transition-[var(--transition-smooth)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
          <Input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            disabled={loading}
            className="w-16 text-center"
          />
          <span className="text-sm text-muted-foreground">
            of {numPages || "..."}
          </span>
        </form>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNextPage}
          disabled={pageNumber >= numPages || loading}
          className="transition-[var(--transition-smooth)]"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* PDF Display */}
      <div className="flex-1 overflow-auto bg-[hsl(var(--background))] p-8">
        <div className="flex justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading PDF...</span>
            </div>
          )}
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
            className="shadow-[var(--shadow-md)]"
            options={documentOptions}
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="bg-[hsl(var(--document-bg))]"
              width={Math.min(window.innerWidth * 0.7, 800)}
            />
          </Document>
        </div>
      </div>
    </div>
  );
};
