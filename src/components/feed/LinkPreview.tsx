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
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-3 no-underline"
      >
        <Card className="overflow-hidden hover:bg-accent/50 transition-colors border-border/50">
          <div className="p-4 flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={faviconUrl}
                alt={domain}
                className="w-8 h-8"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">
                {domain}
              </p>
              <p className="text-xs text-muted-foreground mb-1">
                Prévisualisation indisponible pour ce site
              </p>
              <p className="text-xs text-primary hover:underline flex items-center gap-1">
                Ouvrir dans un nouvel onglet <ExternalLink className="h-3 w-3" />
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
