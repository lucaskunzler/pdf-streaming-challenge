import { useState } from "react";
import { PDFViewer } from "@/components/PDFViewer";
import { PDFSidebar } from "@/components/PDFSidebar";

const Index = () => {
  // Example PDF URL - using a sample PDF from Mozilla
  const pdfUrl = "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";
  const fileName = "tracemonkey-pldi-09.pdf";

  const [metadata, setMetadata] = useState({
    fileName,
    numPages: 0,
    fileSize: undefined,
    loadedAt: new Date(),
  });

  const handleMetadataLoad = (data: { numPages: number; fileSize?: number }) => {
    setMetadata((prev) => ({
      ...prev,
      numPages: data.numPages,
      fileSize: data.fileSize,
    }));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <PDFViewer url={pdfUrl} onMetadataLoad={handleMetadataLoad} />
      </div>
      <PDFSidebar metadata={metadata} />
    </div>
  );
};

export default Index;
