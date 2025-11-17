import { Card } from '@/components/ui/card';
import { FileText, ExternalLink, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  url: string;
  fileName?: string;
}

export function PDFPreview({ url, fileName }: PDFPreviewProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  
  const displayName = fileName || 'Document PDF';

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  return (
    <Card className="mt-3 overflow-hidden">
      {!showPreview ? (
        // Compact preview header
        <div className="p-4 flex items-center justify-between gap-3 bg-muted/30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">Document PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Prévisualiser
            </Button>

            <Button variant="ghost" size="icon" asChild>
              <a href={url} download target="_blank" rel="noopener noreferrer" className="flex items-center">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      ) : (
        // Full preview
        <div className="flex flex-col">
          <div className="p-3 bg-muted/30 flex items-center justify-between gap-3 border-b">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm font-medium truncate">{displayName}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                Réduire
              </Button>

              <Button variant="ghost" size="icon" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>

              <Button variant="ghost" size="icon" asChild>
                <a href={url} download target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="relative w-full bg-muted/10 flex flex-col items-center py-4">
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="p-4 text-sm text-muted-foreground">
                  Chargement du PDF...
                </div>
              }
              error={
                <div className="p-4 text-sm text-muted-foreground">
                  Erreur de chargement. 
                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    Ouvrir dans un nouvel onglet
                  </a>
                </div>
              }
            >
              <Page 
                pageNumber={pageNumber} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
                width={Math.min(800, window.innerWidth - 40)}
              />
            </Document>

            {numPages > 1 && (
              <div className="flex items-center gap-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-muted-foreground">
                  Page {pageNumber} sur {numPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                  disabled={pageNumber >= numPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
