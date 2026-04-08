import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

type Influence = {
  id: string;
  week: string;
  influencer_count: number | null;
  influencer_count_obj: number | null;
  reach_millions: number | null;
  reach_millions_obj: number | null;
  engagement_rate: number | null;
  engagement_rate_obj: number | null;
  vtf: number | null;
  vtf_obj: number | null;
  conversion_rate: number | null;
  conversion_rate_obj: number | null;
  cost_per_reach: number | null;
  cost_per_reach_obj: number | null;
};

type Press = {
  id: string;
  date: string;
  media_name: string;
  title: string;
  url: string | null;
  tonality: string;
  estimated_reach: number | null;
  journalist_name: string | null;
};

function getCondColor(actual: number | null, obj: number | null): string {
  if (actual == null || obj == null || obj === 0) return '';
  const ratio = actual / obj;
  if (ratio >= 1) return 'text-[#22c55e]';
  if (ratio >= 0.8) return 'text-black dark:text-white font-semibold';
  return 'text-[#ef4444]';
}

function getCondBg(actual: number | null, obj: number | null): string {
  if (actual == null || obj == null || obj === 0) return 'border-l-[#9ca3af]';
  const ratio = actual / obj;
  if (ratio >= 1) return 'border-l-[#22c55e]';
  if (ratio >= 0.8) return 'border-l-black';
  return 'border-l-[#ef4444]';
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-16 h-5 mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <Line type="monotone" dataKey="v" stroke="#E8FF4C" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const TONALITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: 'bg-[#22c55e]/20', text: 'text-[#22c55e]', label: 'Positif' },
  neutral: { bg: 'bg-gray-200', text: 'text-muted-foreground', label: 'Neutre' },
  negative: { bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]', label: 'Négatif' },
};

const PAGE_SIZE = 20;

export function LagostinaInfluenceRP() {
  const [tonalityFilter, setTonalityFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const { data: influenceData, isLoading: loadingInfluence } = useQuery({
    queryKey: ['lagostina-influence'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_influence').select('*').order('week');
      if (error) throw error;
      return data as Influence[];
    },
  });

  const { data: pressData, isLoading: loadingPress } = useQuery({
    queryKey: ['lagostina-press'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_press').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data as Press[];
    },
  });

  // Latest influence data
  const latest = useMemo(() => {
    if (!influenceData?.length) return null;
    return influenceData[influenceData.length - 1];
  }, [influenceData]);

  const kpis = useMemo(() => {
    if (!latest) return [];
    return [
      { label: 'Nb influenceurs', actual: latest.influencer_count, obj: latest.influencer_count_obj, vals: influenceData?.map((d) => d.influencer_count).filter((v): v is number => v != null) || [] },
      { label: 'Reach potentiel (M)', actual: latest.reach_millions, obj: latest.reach_millions_obj, vals: influenceData?.map((d) => d.reach_millions).filter((v): v is number => v != null) || [] },
      { label: 'Engagement rate (%)', actual: latest.engagement_rate, obj: latest.engagement_rate_obj, vals: influenceData?.map((d) => d.engagement_rate).filter((v): v is number => v != null) || [] },
      { label: 'VTF', actual: latest.vtf, obj: latest.vtf_obj, vals: influenceData?.map((d) => d.vtf).filter((v): v is number => v != null) || [] },
      { label: 'Taux conversion (%)', actual: latest.conversion_rate, obj: latest.conversion_rate_obj, vals: influenceData?.map((d) => d.conversion_rate).filter((v): v is number => v != null) || [] },
      { label: 'Coût / reach potentiel', actual: latest.cost_per_reach, obj: latest.cost_per_reach_obj, vals: influenceData?.map((d) => d.cost_per_reach).filter((v): v is number => v != null) || [] },
    ];
  }, [latest, influenceData]);

  // Filtered press
  const filteredPress = useMemo(() => {
    if (!pressData) return [];
    if (tonalityFilter === 'all') return pressData;
    return pressData.filter((p) => p.tonality === tonalityFilter);
  }, [pressData, tonalityFilter]);

  const totalPages = Math.ceil(filteredPress.length / PAGE_SIZE);
  const pagedPress = filteredPress.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const uniqueJournalists = useMemo(() => new Set(filteredPress.map((p) => p.journalist_name).filter(Boolean)).size, [filteredPress]);
  const totalReach = useMemo(() => filteredPress.reduce((s, p) => s + (p.estimated_reach || 0), 0), [filteredPress]);

  const isLoading = loadingInfluence || loadingPress;
  const isEmpty = !influenceData?.length && !pressData?.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données Influence & RP non disponibles</p>
        <p className="text-muted-foreground font-['Roboto'] text-sm">Importez un fichier Influence & RP depuis l'admin</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Influence KPI cards */}
      {kpis.length > 0 && (
        <div>
          <h2 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Influence</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`bg-white dark:bg-[#0f1422] border border-border/30 border-l-[3px] ${getCondBg(kpi.actual, kpi.obj)} p-4`}>
                <p className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider mb-1">{kpi.label}</p>
                <div className="flex items-end gap-2">
                  <span className={`text-xl font-bold font-['Instrument_Sans'] ${getCondColor(kpi.actual, kpi.obj) || 'text-foreground'}`}>
                    {kpi.actual != null ? kpi.actual.toLocaleString('fr-FR') : '—'}
                  </span>
                  {kpi.obj != null && (
                    <span className="text-muted-foreground text-xs font-['Roboto'] mb-0.5">/ {kpi.obj.toLocaleString('fr-FR')}</span>
                  )}
                </div>
                <Sparkline data={kpi.vals} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Press review */}
      {pressData && pressData.length > 0 && (
        <div>
          <h2 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Revue de presse</h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {['all', 'positive', 'neutral', 'negative'].map((t) => {
              const label = t === 'all' ? 'Tout' : TONALITY_STYLES[t]?.label || t;
              return (
                <button
                  key={t}
                  onClick={() => { setTonalityFilter(t); setPage(0); }}
                  className={`px-3 py-1.5 text-xs font-['Roboto'] transition-colors ${
                    tonalityFilter === t ? 'bg-black text-[#0f1422] font-medium' : 'bg-gray-100 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Counters */}
          <div className="flex gap-6 mb-4">
            <div className="text-muted-foreground text-xs font-['Roboto']">
              <span className="text-foreground font-bold text-sm">{filteredPress.length}</span> retombées
            </div>
            <div className="text-muted-foreground text-xs font-['Roboto']">
              <span className="text-foreground font-bold text-sm">{uniqueJournalists}</span> journalistes
            </div>
            <div className="text-muted-foreground text-xs font-['Roboto']">
              Reach cumulé : <span className="text-foreground font-bold text-sm">{totalReach >= 1000000 ? `${(totalReach / 1000000).toFixed(1)}M` : totalReach >= 1000 ? `${(totalReach / 1000).toFixed(0)}K` : totalReach}</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
            <table className="w-full text-xs font-['Roboto']">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider">Date</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider">Média</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider">Titre</th>
                  <th className="text-center px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider">Tonalité</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider">Reach</th>
                </tr>
              </thead>
              <tbody>
                {pagedPress.map((p) => {
                  const style = TONALITY_STYLES[p.tonality] || TONALITY_STYLES.neutral;
                  return (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-gray-50 dark:bg-[#141928]">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-3 py-2 text-foreground font-medium">{p.media_name}</td>
                      <td className="px-3 py-2 text-foreground max-w-xs truncate">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-black dark:text-white font-semibold flex items-center gap-1">
                            {p.title}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : p.title}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {p.estimated_reach ? p.estimated_reach.toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-muted-foreground text-xs font-['Roboto']">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
