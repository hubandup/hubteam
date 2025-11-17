import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkPreviewProps {
  url: string;
}

interface PreviewData {
  success: boolean;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain?: string;
  reason?: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const MAX_RETRIES = 2;

  useEffect(() => {
    const fetchPreview = async (attemptNumber: number = 0) => {
      try {
        setLoading(true);
        setError(false);
        
        if (attemptNumber > 0) {
          setIsRetrying(true);
          console.log(`[LinkPreview] Retry attempt ${attemptNumber}/${MAX_RETRIES} for:`, url);
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attemptNumber - 1), 3000)));
        } else {
          console.log('[LinkPreview] Fetching preview for:', url);
        }

        // Use POST method explicitly for better compatibility
        const { data, error } = await supabase.functions.invoke('url-preview', {
          method: 'POST',
          body: { url },
        });

        console.log('[LinkPreview] Response:', { data, error, attempt: attemptNumber });

        if (error) {
          console.error('[LinkPreview] Edge function error:', error);
          throw error;
        }
        
        if (data) {
          console.log('[LinkPreview] Preview data received:', {
            success: data.success,
            hasTitle: !!data.title,
            hasImage: !!data.image,
            reason: data.reason
          });
          
          // Store the response regardless of success
          setPreview(data);
          
          // Set error state only if success is explicitly false
          if (data.success === false) {
            setError(true);
          }
          setIsRetrying(false);
        } else {
          console.log('[LinkPreview] No data received');
          throw new Error('No data received');
        }
      } catch (err) {
        console.error('[LinkPreview] Error fetching link preview:', err);
        
        // Retry if we haven't exceeded max attempts
        if (attemptNumber < MAX_RETRIES) {
          setRetryCount(attemptNumber + 1);
          fetchPreview(attemptNumber + 1);
        } else {
          setError(true);
          setIsRetrying(false);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  // Enhanced skeleton loader
  if (loading || isRetrying) {
    return (
      <Card className="mt-3 overflow-hidden animate-fade-in">
        <div className="w-full h-48 bg-muted animate-pulse" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-32" />
          {isRetrying && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Nouvelle tentative... ({retryCount}/{MAX_RETRIES})</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Handle fallback for failed previews or blocked domains
  if (error || !preview || preview.success === false) {
    const domain = preview?.domain || new URL(url).hostname.replace('www.', '');
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    
    console.log('[LinkPreview] Rendering fallback for domain:', domain, 'reason:', preview?.reason);
    
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

  // Render rich preview for successful fetches
  console.log('[LinkPreview] Rendering rich preview');
  
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
              alt={preview.title || 'Preview'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="p-4">
          {preview.siteName && (
            <p className="text-xs text-muted-foreground mb-1">
              {preview.siteName}
            </p>
          )}
          {preview.title && (
            <h3 className="font-semibold text-sm mb-2 line-clamp-2">
              {preview.title}
            </h3>
          )}
          {preview.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {preview.description}
            </p>
          )}
          <p className="text-xs text-primary hover:underline flex items-center gap-1">
            {new URL(url).hostname.replace('www.', '')} <ExternalLink className="h-3 w-3" />
          </p>
        </div>
      </Card>
    </a>
  );
}
