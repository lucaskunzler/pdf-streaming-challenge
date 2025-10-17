import { useState, useEffect } from "react";
import { PDFViewer } from "@/components/PDFViewer";
import { PDFSidebar } from "@/components/PDFSidebar";
import { DocumentSelector } from "@/components/DocumentSelector";
import { useDocumentMetadata } from "@/hooks/useDocumentMetadata";
import { api } from "@/services/api";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Index = () => {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("tiny-1p.pdf");
  
  const { data: backendMetadata, isLoading, error } = useDocumentMetadata(selectedDocumentId);
  
  const [metadata, setMetadata] = useState({
    fileName: "",
    numPages: 0,
    fileSize: undefined as number | undefined,
    loadedAt: new Date(),
    etag: undefined as string | undefined,
    lastModified: undefined as string | undefined,
  });

  // Update metadata when backend metadata loads
  useEffect(() => {
    if (backendMetadata) {
      setMetadata((prev) => ({
        ...prev,
        fileName: backendMetadata.filename,
        fileSize: backendMetadata.fileSize,
        etag: backendMetadata.etag,
        lastModified: backendMetadata.lastModified,
      }));
    }
  }, [backendMetadata]);

  // Reset metadata when document changes
  useEffect(() => {
    setMetadata({
      fileName: selectedDocumentId,
      numPages: 0,
      fileSize: undefined,
      loadedAt: new Date(),
      etag: undefined,
      lastModified: undefined,
    });
  }, [selectedDocumentId]);

  const handleMetadataLoad = (data: { numPages: number; fileSize?: number }) => {
    setMetadata((prev) => ({
      ...prev,
      numPages: data.numPages,
      fileSize: backendMetadata?.fileSize || data.fileSize,
    }));
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Failed to connect to backend API. Make sure the server is running on port 3000.
            <br />
            <code className="text-xs mt-2 block">cd backend && npm run dev</code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto">
          <DocumentSelector 
            onDocumentSelect={setSelectedDocumentId}
            currentDocument={selectedDocumentId}
          />
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading document metadata...</p>
              </div>
            </div>
          ) : (
            <PDFViewer 
              url={api.getDocumentUrl(selectedDocumentId)} 
              onMetadataLoad={handleMetadataLoad} 
            />
          )}
        </div>
        <PDFSidebar metadata={metadata} />
      </div>
    </div>
  );
};

export default Index;
