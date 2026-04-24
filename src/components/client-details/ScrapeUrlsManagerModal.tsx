import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Plus, RefreshCw, Trash2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trackingId: string;
}

export function ScrapeUrlsManagerModal({ open, onOpenChange, trackingId }: Props) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);

  const { data: urls = [], isLoading } = useQuery({
    queryKey: ['commercial-scrape-urls', trackingId],
    enabled: open && !!trackingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_scrape_urls')
        .select('*')
        .eq('tracking_id', trackingId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const add = async () => {
    if (!url.trim()) return;
    const { error } = await supabase.from('commercial_scrape_urls').insert({
      tracking_id: trackingId,
      url: url.trim(),
      label: label.trim() || null,
    });
    if (error) return toast.error('Erreur');
    setUrl('');
    setLabel('');
    qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    toast.success('URL ajoutée');
  };

  const remove = async (id: string) => {
    await supabase.from('commercial_scrape_urls').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    toast.success('URL supprimée');
  };

  const scrapeOne = async (id: string) => {
    setScrapingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-commercial-urls', { body: { url_id: id } });
      if (error) throw error;
      const ok = (data as any)?.results?.[0]?.ok;
      toast[ok ? 'success' : 'error'](ok ? 'URL scrapée' : 'Échec du scraping');
      qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur scraping');
    } finally {
      setScrapingId(null);
    }
  };

  const scrapeAll = async () => {
    if (urls.length === 0) return;
    setScrapingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-commercial-urls', { body: { tracking_id: trackingId } });
      if (error) throw error;
      toast.success(`${(data as any)?.scraped || 0} URL(s) scrapée(s)`);
      qc.invalidateQueries({ queryKey: ['commercial-scrape-urls', trackingId] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur scraping');
    } finally {
      setScrapingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 display">
            <Link2 className="h-5 w-5" style={{ color: '#0f1422' }} />
            URLs veille IA
          </DialogTitle>
          <DialogDescription>
            Scraping automatique chaque lundi matin. Vous pouvez aussi déclencher manuellement.
          </DialogDescription>
        </DialogHeader>

        {/* Add form */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-none"
            />
            <Input
              placeholder="Libellé (optionnel)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="md:w-[200px] rounded-none"
            />
            <Button onClick={add} className="rounded-none" style={{ background: '#0f1422', color: '#fff' }}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>

          {urls.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={scrapeAll}
                disabled={scrapingAll}
                className="rounded-none"
              >
                {scrapingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Scraper toutes
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-neutral-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
            </div>
          ) : urls.length === 0 ? (
            <p className="text-sm text-neutral-500 italic py-4 text-center">
              Aucune URL configurée pour ce client.
            </p>
          ) : (
            <ul className="space-y-2">
              {urls.map((u: any) => (
                <li key={u.id} className="border border-neutral-200 p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {u.label && <p className="text-sm font-medium" style={{ color: '#0f1422' }}>{u.label}</p>}
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neutral-700 hover:underline truncate block"
                    >
                      {u.url}
                    </a>
                    {u.last_scraped_at && (
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        Dernier scrape : {format(new Date(u.last_scraped_at), 'd MMM yyyy HH:mm', { locale: fr })}
                        {u.last_scrape_status === 'failed' && (
                          <span className="text-red-600 ml-1">· échec</span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrapeOne(u.id)}
                    disabled={scrapingId === u.id}
                    className="p-1.5 text-neutral-400 hover:text-neutral-900 disabled:opacity-50"
                    title="Rescraper"
                    aria-label="Rescraper"
                  >
                    {scrapingId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(u.id)}
                    className="p-1.5 text-neutral-400 hover:text-red-600"
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
