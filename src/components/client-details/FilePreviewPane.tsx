import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, Loader2, FileIcon } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface FilePreviewPaneProps {
  file: {
    id: number;
    name: string;
    type: string;
    size?: number;
    created_at?: string;
  } | null;
  onClose: () => void;
  onGetFileUrl: (fileId: number) => Promise<{ url: string; mimeType?: string }>;
}

export function FilePreviewPane({ file, onClose, onGetFileUrl }: FilePreviewPaneProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      loadFileUrl();
    } else {
      // Clean up blob URL if it exists
      if (fileUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(fileUrl);
      }
      setFileUrl(null);
      setMimeType(null);
      setError(null);
    }
  }, [file?.id]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (fileUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const loadFileUrl = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onGetFileUrl(file.id);
      const proxyUrl = result.url;
      
      // For PDFs and images, fetch the content and create a blob URL
      // This allows proper display in <object> and <img> elements
      const supabase = (await import('@/integrations/supabase/client')).supabase;
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setFileUrl(blobUrl);
      setMimeType(blob.type || result.mimeType || null);
    } catch (err) {
      console.error('Failed to load file URL:', err);
      setError('Impossible de charger le fichier');
    } finally {
      setLoading(false);
    }
  };

  if (!file) return null;

  const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
  const isPdf = file.name.match(/\.pdf$/i) || mimeType?.includes('pdf');

  return (
    <Card className="fixed right-0 top-0 bottom-0 w-96 rounded-none border-l shadow-lg z-50 overflow-hidden flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold truncate flex-1">Aperçu</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <FileIcon className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium break-words">{file.name}</p>
              {file.size && (
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              )}
              {file.created_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(file.created_at).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{error}</p>
          </div>
        ) : fileUrl ? (
          <div className="space-y-4">
            {isImage && (
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={fileUrl}
                  alt={file.name}
                  className="w-full h-auto"
                />
              </div>
            )}

            {isPdf && (
              <div className="rounded-lg overflow-hidden border bg-muted">
                <object
                  data={fileUrl}
                  type="application/pdf"
                  className="w-full h-96"
                  title={file.name}
                >
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Impossible d'afficher le PDF. <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ouvrir dans un nouvel onglet</a>
                  </p>
                </object>
              </div>
            )}

            {!isImage && !isPdf && (
              <div className="text-center py-8 text-muted-foreground">
                <FileIcon className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Aperçu non disponible</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Actions */}
        {fileUrl && (
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(fileUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir dans kDrive
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const a = document.createElement('a');
                a.href = fileUrl;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
