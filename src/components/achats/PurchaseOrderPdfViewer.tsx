import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PurchaseOrderPdfViewerProps {
  /** URL (blob ou signée) du PDF à afficher */
  url: string;
}

/**
 * Rendu du PDF via pdf.js (canvas) : l'iframe native est bloquée par Chrome
 * dans les iframes sandboxées (aperçu / PWA).
 */
export function PurchaseOrderPdfViewer({ url }: PurchaseOrderPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-auto rounded-2xl border bg-muted/20 p-2">
      <Document
        file={url}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        }
        error={
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Impossible d'afficher le PDF
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width ? width - 16 : undefined}
            className="mb-3 overflow-hidden rounded-xl shadow-sm"
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        ))}
      </Document>
    </div>
  );
}
