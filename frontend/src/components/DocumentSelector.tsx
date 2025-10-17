import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const AVAILABLE_DOCUMENTS = [
  { id: "tiny-1p.pdf", name: "Tiny PDF (1 page)", description: "1.8 KB - Minimal test document" },
  { id: "small-2p.pdf", name: "Small PDF (2 pages)", description: "87 KB - Small test document" },
  { id: "text-and-images.pdf", name: "Text and Images", description: "110 KB - Document with mixed content" },
  { id: "large-361p-12mb.pdf", name: "Large PDF (361 pages)", description: "12 MB" },
];

interface DocumentSelectorProps {
  onDocumentSelect: (documentId: string) => void;
  currentDocument?: string;
}

export const DocumentSelector = ({ onDocumentSelect, currentDocument }: DocumentSelectorProps) => {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Select Document
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={currentDocument} onValueChange={onDocumentSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a PDF document to view" />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_DOCUMENTS.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{doc.name}</span>
                  <span className="text-xs text-muted-foreground">{doc.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

