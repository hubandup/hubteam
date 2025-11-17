import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LinkPreviewProps {
  url: string;
}

interface PreviewData {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
          body: { url },
        });

        if (error) throw error;
        
        if (data && (data.title || data.image)) {
          setPreview(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching link preview:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <Card className="mt-3 p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-muted rounded w-full"></div>
      </Card>
    );
  }

  if (error || !preview) {
    // Fallback for blocked domains (LinkedIn, etc.)
    const domain = new URL(url).hostname.replace('www.', '');
    
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-3 no-underline"
      >
        <Card className="overflow-hidden hover:bg-accent/50 transition-colors">
          <div className="p-4 flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <ExternalLink className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">
                Prévisualisation indisponible
              </p>
              <p className="text-xs text-muted-foreground mb-1">
                {domain} bloque l'accès aux informations d'aperçu
              </p>
              <p className="text-xs text-primary hover:underline flex items-center gap-1">
                Afficher le lien <ExternalLink className="h-3 w-3" />
              </p>
            </div>
          </div>
        </Card>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-3 no-underline"
    >
      <Card className="overflow-hidden hover:bg-accent/50 transition-colors">
        {preview.image && (
          <div className="w-full h-48 overflow-hidden bg-muted">
            <img
              src={preview.image}
              alt={preview.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="p-4">
          {preview.siteName && (
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {preview.siteName}
            </p>
          )}
          {preview.title && (
            <h3 className="font-semibold text-sm line-clamp-2 mb-1">
              {preview.title}
            </h3>
          )}
          {preview.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {preview.description}
            </p>
          )}
        </div>
      </Card>
    </a>
  );
}
