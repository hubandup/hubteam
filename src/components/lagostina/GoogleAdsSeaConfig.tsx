import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2, AlertCircle, Save } from 'lucide-react';

function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // assume raw id
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function GoogleAdsSeaConfig() {
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [cellRange, setCellRange] = useState('A1:Z200');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['lagostina-google-ads-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_google_ads_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setUrlInput(`https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}/edit`);
        setSheetName(data.sheet_name);
        setCellRange(data.cell_range);
      }
      return data;
    },
  });

  const handleSave = async () => {
    const id = extractSpreadsheetId(urlInput);
    if (!id) { toast.error('URL Google Sheet invalide'); return; }
    setSaving(true);
    try {
      if (cfg?.id) {
        const { error } = await supabase
          .from('lagostina_google_ads_config')
          .update({ spreadsheet_id: id, sheet_name: sheetName, cell_range: cellRange })
          .eq('id', cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lagostina_google_ads_config')
          .insert({ spreadsheet_id: id, sheet_name: sheetName, cell_range: cellRange });
        if (error) throw error;
      }
      toast.success('Configuration enregistrée');
      queryClient.invalidateQueries({ queryKey: ['lagostina-google-ads-config'] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'enregistrement');
    } finally { setSaving(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-ads-sea', { body: {} });
      if (error) throw error;
      toast.success(`Synchronisation OK : ${data?.kpis_inserted ?? 0} KPIs importés`);
      queryClient.invalidateQueries({ queryKey: ['lagostina-google-ads-config'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-media-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['lagostina-scorecards'] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur de synchronisation');
    } finally { setSyncing(false); }
  };

  return (
    <div className="bg-card border border-border/30">
      <div className="px-4 py-3 border-b border-border/40">
        <h2 className="text-foreground font-['Instrument_Sans'] font-bold text-sm">Google Ads SEA</h2>
        <p className="text-muted-foreground font-['Roboto'] text-xs mt-1">
          Synchronisation auto quotidienne (6h Paris) depuis un Google Sheet alimenté par Google Ads.
        </p>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-['Roboto'] uppercase tracking-wider">URL du Google Sheet</label>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full mt-1 px-3 py-2 bg-background border border-border/40 text-foreground font-['Roboto'] text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-['Roboto'] uppercase tracking-wider">Onglet</label>
            <input
              type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border/40 text-foreground font-['Roboto'] text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-['Roboto'] uppercase tracking-wider">Plage</label>
            <input
              type="text" value={cellRange} onChange={(e) => setCellRange(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border/40 text-foreground font-['Roboto'] text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSave} disabled={saving || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground border border-border/40 font-['Roboto'] text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            onClick={handleSync} disabled={syncing || !cfg}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground border border-border/40 font-['Roboto'] text-sm hover:bg-muted/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </button>
        </div>
        {cfg?.last_synced_at && (
          <div className="flex items-center gap-2 text-xs font-['Roboto'] pt-2 border-t border-border/30">
            {cfg.last_sync_status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
            ) : (
              <AlertCircle className="h-4 w-4 text-[#ef4444]" />
            )}
            <span className="text-muted-foreground">
              Dernière synchro : {new Date(cfg.last_synced_at).toLocaleString('fr-FR')}
            </span>
            {cfg.last_sync_error && (
              <span className="text-[#ef4444] truncate" title={cfg.last_sync_error}>
                — {cfg.last_sync_error.slice(0, 80)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
