import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Globe, Bell, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export function AIContextSection() {
  const qc = useQueryClient();
  const [refreshingHubandup, setRefreshingHubandup] = useState(false);
  const [refreshingAlerts, setRefreshingAlerts] = useState(false);

  const { data: hubandupCache = [] } = useQuery({
    queryKey: ['hubandup_context_cache'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubandup_context_cache')
        .select('*')
        .order('source_url');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: alertsCache } = useQuery({
    queryKey: ['google_alerts_cache'],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_alerts_cache')
        .select('*')
        .maybeSingle();
      return data;
    },
  });

  const refreshHubandup = async () => {
    setRefreshingHubandup(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-hubandup-site');
      if (error) throw error;
      const okCount = (data as any)?.results?.filter((r: any) => r.ok).length || 0;
      const errCount = ((data as any)?.results?.length || 0) - okCount;
      toast.success(`Hub & Up rafraîchi : ${okCount} OK, ${errCount} erreur(s)`);
      qc.invalidateQueries({ queryKey: ['hubandup_context_cache'] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur de rafraîchissement');
    } finally {
      setRefreshingHubandup(false);
    }
  };

  const refreshAlerts = async () => {
    setRefreshingAlerts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-google-alerts?force=1`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Erreur');
      toast.success(`Alertes rafraîchies : ${(data.entries || []).length} entrée(s)`);
      qc.invalidateQueries({ queryKey: ['google_alerts_cache'] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur de rafraîchissement');
    } finally {
      setRefreshingAlerts(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Contexte IA pour les relances
        </CardTitle>
        <CardDescription>
          Sources externes utilisées par Gemini lors de la génération d'excuses de relance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hub & Up site cache */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Site Hub & Up</h3>
            </div>
            <Button size="sm" variant="outline" onClick={refreshHubandup} disabled={refreshingHubandup}>
              {refreshingHubandup ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Rafraîchir le contexte Hub & Up
            </Button>
          </div>
          <ul className="space-y-2">
            {hubandupCache.map((row: any) => (
              <li key={row.id} className="border border-border p-3 text-xs">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline truncate">
                    {row.source_url}
                  </a>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {row.last_scraped_at
                      ? format(new Date(row.last_scraped_at), 'd MMM yyyy HH:mm', { locale: fr })
                      : 'jamais'}
                    {row.last_scrape_status === 'error' && <span className="text-destructive ml-1">· erreur</span>}
                  </span>
                </div>
                {row.summary ? (
                  <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">{row.summary}</p>
                ) : (
                  <p className="text-muted-foreground italic">Aucun résumé encore généré.</p>
                )}
                {row.last_scrape_error && (
                  <p className="text-destructive mt-1">⚠️ {row.last_scrape_error}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">
            Rafraîchi automatiquement le 1er du mois à 3h UTC.
          </p>
        </section>

        {/* Google Alerts cache */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Google Alerts (Hub & Up)</h3>
            </div>
            <Button size="sm" variant="outline" onClick={refreshAlerts} disabled={refreshingAlerts}>
              {refreshingAlerts ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Rafraîchir les alertes
            </Button>
          </div>
          <div className="border border-border p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">
                Dernière mise à jour :{' '}
                {alertsCache?.fetched_at
                  ? format(new Date(alertsCache.fetched_at), 'd MMM yyyy HH:mm', { locale: fr })
                  : 'jamais'}
              </span>
              <span className="text-muted-foreground">
                {Array.isArray(alertsCache?.entries) ? alertsCache.entries.length : 0} entrée(s)
              </span>
            </div>
            {alertsCache?.fetch_error && (
              <p className="text-destructive">⚠️ {alertsCache.fetch_error}</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Cache de 6h. Re-scrape automatique toutes les 6h.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
