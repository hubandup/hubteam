import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { LagostinaSubTabs } from './LagostinaSubTabs';
import { NoteableCell, useCellNotes } from './CellNotePopover';

// Theme-aware chart accent: dark=#E8FF4C, light=#0f1422
function getChartAccent(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return '#E8FF4C';
  return '#0f1422';
}

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
  month: string | null;
  budget_mois: number | null;
  emv: number | null;
  cpm: number | null;
  impressions_globales: number | null;
  reel_engagement: number | null;
  stories_clics_vues: number | null;
  stories_clics_mentions: number | null;
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

function normalizeTonalityKey(value: string | null | undefined): 'positive' | 'neutral' | 'negative' {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.startsWith('pos')) return 'positive';
  if (normalized.startsWith('neg')) return 'negative';
  return 'neutral';
}

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
          <Line type="monotone" dataKey="v" stroke={getChartAccent()} strokeWidth={1.5} dot={false} />
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

const TONALITY_COLORS: Record<string, string> = {
  positive: '#22c55e',
  neutral: '#9ca3af',
  negative: '#ef4444',
};

const PAGE_SIZE = 20;

export function LagostinaInfluenceRP({ learningsButton, learningsPanel }: { learningsButton?: React.ReactNode; learningsPanel?: React.ReactNode }) {
  const [tonalityFilter, setTonalityFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const { data: cellNotesMap } = useCellNotes();

  const { data: influenceData, isLoading: loadingInfluence } = useQuery({
    queryKey: ['lagostina-influence'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_influence').select('*');
      if (error) throw error;
      return (data as Influence[]).sort((a, b) => {
        const numA = parseInt(a.week.replace(/\D/g, ''), 10);
        const numB = parseInt(b.week.replace(/\D/g, ''), 10);
        return numA - numB;
      });
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

  const latest = useMemo(() => {
    if (!influenceData?.length) return null;
    return influenceData[influenceData.length - 1];
  }, [influenceData]);

  const kpis = useMemo(() => {
    if (!latest) return [];
    return [
      { label: 'Nb influenceurs', actual: latest.influencer_count, obj: latest.influencer_count_obj, vals: influenceData?.map((d) => d.influencer_count).filter((v): v is number => v != null) || [] },
      { label: 'Reach potentiel (M)', actual: latest.reach_millions, obj: latest.reach_millions_obj, vals: influenceData?.map((d) => d.reach_millions).filter((v): v is number => v != null) || [] },
      { label: 'Budget mois', actual: latest.budget_mois, obj: null, vals: influenceData?.map((d) => d.budget_mois).filter((v): v is number => v != null) || [] },
      { label: 'Engagement rate (%)', actual: latest.engagement_rate, obj: latest.engagement_rate_obj, vals: influenceData?.map((d) => d.engagement_rate).filter((v): v is number => v != null) || [] },
      { label: 'EMV', actual: latest.emv, obj: null, vals: influenceData?.map((d) => d.emv).filter((v): v is number => v != null) || [] },
      { label: 'Taux conversion (%)', actual: latest.conversion_rate, obj: latest.conversion_rate_obj, vals: influenceData?.map((d) => d.conversion_rate).filter((v): v is number => v != null) || [] },
      { label: 'Coût / reach potentiel', actual: latest.cost_per_reach, obj: latest.cost_per_reach_obj, vals: influenceData?.map((d) => d.cost_per_reach).filter((v): v is number => v != null) || [] },
      { label: 'CPM', actual: latest.cpm, obj: null, vals: influenceData?.map((d) => d.cpm).filter((v): v is number => v != null) || [] },
      { label: 'Impressions globales', actual: latest.impressions_globales, obj: null, vals: influenceData?.map((d) => d.impressions_globales).filter((v): v is number => v != null) || [] },
      { label: 'Reel engagement', actual: latest.reel_engagement, obj: null, vals: influenceData?.map((d) => d.reel_engagement).filter((v): v is number => v != null) || [] },
      { label: 'Stories clics / vues', actual: latest.stories_clics_vues, obj: null, vals: influenceData?.map((d) => d.stories_clics_vues).filter((v): v is number => v != null) || [] },
      { label: 'Stories clics / mentions', actual: latest.stories_clics_mentions, obj: null, vals: influenceData?.map((d) => d.stories_clics_mentions).filter((v): v is number => v != null) || [] },
    ];
  }, [latest, influenceData]);

  // Tonality pie chart data (count)
  const tonalityPieData = useMemo(() => {
    if (!pressData?.length) return [];
    const counts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    pressData.forEach((p) => {
      const tonality = normalizeTonalityKey(p.tonality);
      if (counts[tonality] !== undefined) counts[tonality]++;
      else counts.neutral++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: TONALITY_STYLES[key]?.label || key,
        value,
        color: TONALITY_COLORS[key] || '#9ca3af',
      }));
  }, [pressData]);

  // Tonality pie chart data (reach)
  const tonalityReachPieData = useMemo(() => {
    if (!pressData?.length) return [];
    const reachSums: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    pressData.forEach((p) => {
      const tonality = normalizeTonalityKey(p.tonality);
      reachSums[tonality] = (reachSums[tonality] || 0) + (p.estimated_reach || 0);
    });
    return Object.entries(reachSums)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: TONALITY_STYLES[key]?.label || key,
        value,
        color: TONALITY_COLORS[key] || '#9ca3af',
      }));
  }, [pressData]);

  const filteredPress = useMemo(() => {
    if (!pressData) return [];
    if (tonalityFilter === 'all') return pressData;
    return pressData.filter((p) => normalizeTonalityKey(p.tonality) === tonalityFilter);
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
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#1a1f2e] animate-pulse" />)}
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

  const tabs = [
    { id: 'influence', label: 'Influence' },
    { id: 'presse', label: 'Revue de presse' },
  ];

  return (
    <LagostinaSubTabs tabs={tabs} defaultTab="influence" rightAction={learningsButton} belowTabs={learningsPanel}>
      {(tab) => (
        <>
      {/* Influence tab */}
      {tab === 'influence' && influenceData && influenceData.length > 0 && (() => {
        // Group data by month
        const monthlyGroups = new Map<string, Influence[]>();
        influenceData.forEach((d) => {
          const m = d.month || 'N/A';
          if (!monthlyGroups.has(m)) monthlyGroups.set(m, []);
          monthlyGroups.get(m)!.push(d);
        });

        const KPI_KEYS: { key: keyof Influence; label: string }[] = [
          { key: 'influencer_count', label: 'Nb influenceurs' },
          { key: 'reach_millions', label: 'Reach (M)' },
          { key: 'budget_mois', label: 'Budget mois' },
          { key: 'engagement_rate', label: 'Engagement (%)' },
          { key: 'emv', label: 'EMV' },
          { key: 'conversion_rate', label: 'Conversion (%)' },
          { key: 'cost_per_reach', label: 'Coût/reach' },
          { key: 'cpm', label: 'CPM' },
          { key: 'impressions_globales', label: 'Impressions' },
          { key: 'reel_engagement', label: 'Reel engagement' },
          { key: 'stories_clics_vues', label: 'Stories vues' },
          { key: 'stories_clics_mentions', label: 'Stories mentions' },
        ];

        const months = [...monthlyGroups.keys()];
        const fmtNum = (n: number | null) => {
          if (n == null) return '—';
          if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
          if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
          if (n % 1 !== 0) return n.toFixed(2);
          return n.toLocaleString('fr-FR');
        };

        // Chart data: one point per row (month-based)
        const chartData = influenceData.map((d) => ({
          label: d.month || d.week,
          reach: d.reach_millions,
          engagement: d.engagement_rate,
          budget: d.budget_mois,
          cpm: d.cpm,
        }));

        const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'];

        return (
        <div className="space-y-6">
          {/* KPI cards */}
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

          {/* Evolution charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Reach & Engagement</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" className="dark:stroke-[#1e293b]" />
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'Roboto' }} />
                    <Line yAxisId="left" type="monotone" dataKey="reach" name="Reach (M)" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="engagement" name="Engagement (%)" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Budget & CPM</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" className="dark:stroke-[#1e293b]" />
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'Roboto' }} />
                    <Bar dataKey="budget" name="Budget" fill={CHART_COLORS[2]} />
                    <Bar dataKey="cpm" name="CPM" fill={CHART_COLORS[3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed monthly table */}
          <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
            <div className="px-4 py-3 border-b border-border/40">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">Détail mensuel</h3>
            </div>
            <table className="w-full text-sm font-['Roboto']">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider sticky left-0 bg-white dark:bg-[#0f1422] z-10 min-w-[140px]">KPI</th>
                  {months.map((m) => (
                    <th key={m} className="text-center px-3 py-2 text-foreground font-semibold uppercase tracking-wider min-w-[90px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KPI_KEYS.map((kpi) => (
                  <tr key={kpi.key} className="border-b border-border/20 hover:bg-gray-50 dark:hover:bg-[#141928]">
                    <td className="px-3 py-2 text-foreground text-xs font-medium sticky left-0 bg-white dark:bg-[#0f1422] z-10">{kpi.label}</td>
                    {months.map((m) => {
                      const entries = monthlyGroups.get(m) || [];
                      const vals = entries.map((e) => e[kpi.key] as number | null).filter((v): v is number => v != null);
                      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      return (
                        <NoteableCell key={m} levier="influence" kpiName={kpi.label} week={m} notesMap={cellNotesMap} levierColor="#a78bfa" className="px-3 py-2 text-center text-foreground text-xs tabular-nums">
                          {fmtNum(avg)}
                        </NoteableCell>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* Presse tab */}
      {tab === 'presse' && pressData && pressData.length > 0 && (
        <div className="space-y-6">
          {/* Tonality pie chart + counters */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Pie charts side by side */}
            <div className="flex flex-col gap-4 shrink-0 w-full md:w-60">
              {/* Pie chart - count */}
              <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-5 flex flex-col items-center w-full">
                <p className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider mb-3">Retombées par tonalité</p>
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tonalityPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={2} stroke="var(--background)">
                        {tonalityPieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value} retombées`, name]} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', fontSize: 13, fontFamily: 'Roboto' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {tonalityPieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs font-['Roboto']">
                      <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: entry.color }} />
                      <span className="text-foreground">{entry.name}</span>
                      <span className="text-muted-foreground">({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pie chart - reach */}
              <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-5 flex flex-col items-center w-full">
                <p className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider mb-3">Reach par tonalité</p>
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tonalityReachPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={2} stroke="var(--background)">
                        {tonalityReachPieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}`, name]} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', fontSize: 13, fontFamily: 'Roboto' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {tonalityReachPieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs font-['Roboto']">
                      <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: entry.color }} />
                      <span className="text-foreground">{entry.name}</span>
                      <span className="text-muted-foreground">({entry.value >= 1000000 ? `${(entry.value / 1000000).toFixed(1)}M` : entry.value >= 1000 ? `${(entry.value / 1000).toFixed(0)}K` : entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: filters + counters + table */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {['all', 'positive', 'neutral', 'negative'].map((t) => {
                  const label = t === 'all' ? 'Tout' : TONALITY_STYLES[t]?.label || t;
                  return (
                    <button
                      key={t}
                      onClick={() => { setTonalityFilter(t); setPage(0); }}
                      className={`px-3 py-1.5 text-xs font-['Roboto'] transition-colors ${
                        tonalityFilter === t ? 'bg-black dark:bg-[#E8FF4C] text-white dark:text-black font-medium' : 'bg-gray-100 dark:bg-[#1a1f2e] text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Counters */}
              <div className="flex gap-6">
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
                <table className="w-full text-sm font-['Roboto']">
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
                      const tonality = normalizeTonalityKey(p.tonality);
                      const style = TONALITY_STYLES[tonality] || TONALITY_STYLES.neutral;
                      return (
                        <tr key={p.id} className="border-b border-border/20 hover:bg-gray-50 dark:hover:bg-[#141928]">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="px-3 py-2 text-foreground font-medium">{p.media_name}</td>
                          <td className="px-3 py-2 text-foreground max-w-xs truncate">
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white font-semibold flex items-center gap-1">
                                {p.title}
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            ) : p.title}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
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
          </div>
        </div>
      )}
        </>
      )}
    </LagostinaSubTabs>
  );
}
