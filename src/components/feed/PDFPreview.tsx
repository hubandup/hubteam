import { Card } from '@/components/ui/card';
import { FileText, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface PDFPreviewProps {
  url: string;
  fileName?: string;
}

export function PDFPreview({ url, fileName }: PDFPreviewProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = fileName || 'Document PDF';

  // Fetch the PDF as a Blob and render via blob: URL to avoid cross-origin/frame restrictions
  useEffect(() => {
    let revokeUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    (async () => {
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        revokeUrl = objectUrl;
        setBlobUrl(objectUrl);
      } catch (e) {
        console.error('[PDFPreview] Blob fetch error:', e);
        setError('preview_failed');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [url]);

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

          <div className="relative w-full" style={{ height: '600px' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Chargement du document…
              </div>
            )}

            {!loading && blobUrl && (
              <object data={blobUrl} type="application/pdf" className="w-full h-full border-0" aria-label={displayName}>
                <div className="p-4 text-sm text-muted-foreground">
                  Impossible d'afficher le PDF dans votre navigateur.
                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline ml-1">Ouvrir dans un nouvel onglet</a>.
                </div>
              </object>
            )}

            {!loading && !blobUrl && (
              <div className="p-4 text-sm text-muted-foreground">
                Impossible d'afficher l'aperçu du PDF.
                <a href={url} target="_blank" rel="noopener noreferrer" className="underline ml-1">Ouvrir dans un nouvel onglet</a>.
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
