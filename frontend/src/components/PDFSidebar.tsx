import { FileText, Hash, HardDrive, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PDFSidebarProps {
  metadata: {
    fileName: string;
    numPages: number;
    fileSize?: number;
    loadedAt: Date;
  };
}

export const PDFSidebar = ({ metadata }: PDFSidebarProps) => {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <aside className="w-80 bg-[hsl(var(--sidebar-bg))] border-l border-border p-6 overflow-y-auto">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Document Info
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                File Name
              </div>
              <div className="text-sm break-words">{metadata.fileName}</div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pages
                </div>
                <div className="text-sm">{metadata.numPages}</div>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <HardDrive className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  File Size
                </div>
                <div className="text-sm">{formatFileSize(metadata.fileSize)}</div>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Loaded At
                </div>
                <div className="text-sm">{formatDate(metadata.loadedAt)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-none shadow-none bg-card/50">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            This PDF viewer supports byte range requests for efficient loading. Only the
            current page is loaded into memory at a time.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
};
