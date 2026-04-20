import { useMemo, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, CalendarClock, ChevronRight, ChevronDown } from 'lucide-react';
import { NoteableCell, useCellNotes } from './CellNotePopover';

// ──────────────────────────────────────────────────────────────────────────
// LEVIER STRUCTURE — exact list & order requested
// ──────────────────────────────────────────────────────────────────────────
type KpiDef = {
  key: string;          // unique id used for cell notes
  label: string;        // display label
  format?: 'number' | 'currency' | 'percent' | 'decimal';
};

type LevierDef = {
  id: string;
  label: string;
  color: string;
  kpis: KpiDef[];
};

const LEVIERS: LevierDef[] = [
  {
    id: 'influence',
    label: 'Influence',
    color: '#a78bfa',
    kpis: [
      { key: 'inf_nb', label: 'NB INFLUENCEURS', format: 'number' },
      { key: 'inf_reach', label: 'REACH POTENTIEL (M)', format: 'decimal' },
      { key: 'inf_budget', label: 'BUDGET MOIS', format: 'currency' },
      { key: 'inf_eng', label: 'ENGAGEMENT RATE (%)', format: 'percent' },
      { key: 'inf_emv', label: 'EMV', format: 'currency' },
      { key: 'inf_conv', label: 'TAUX CONVERSION (%)', format: 'percent' },
      { key: 'inf_cpr', label: 'COÛT / REACH POTENTIEL', format: 'decimal' },
      { key: 'inf_cpm', label: 'CPM', format: 'currency' },
      { key: 'inf_imp', label: 'IMPRESSIONS GLOBALES', format: 'number' },
      { key: 'inf_reel', label: 'REEL ENGAGEMENT', format: 'number' },
      { key: 'inf_st_vues', label: 'STORIES CLICS / VUES', format: 'percent' },
      { key: 'inf_st_men', label: 'STORIES CLICS / MENTIONS', format: 'percent' },
    ],
  },
  {
    id: 'affiliation',
    label: 'Affiliation',
    color: '#f472b6',
    kpis: [
      { key: 'aff_nb', label: 'NB AFFILIÉS', format: 'number' },
      { key: 'aff_reach', label: 'REACH (M)', format: 'decimal' },
      { key: 'aff_budget', label: 'BUDGET MOIS', format: 'currency' },
      { key: 'aff_eng', label: 'ENGAGEMENT (%)', format: 'percent' },
      { key: 'aff_emv', label: 'EMV', format: 'currency' },
      { key: 'aff_conv', label: 'CONVERSION (%)', format: 'percent' },
      { key: 'aff_cpr', label: 'COÛT/REACH', format: 'decimal' },
      { key: 'aff_cpm', label: 'CPM', format: 'currency' },
      { key: 'aff_imp', label: 'IMPRESSIONS', format: 'number' },
    ],
  },
  {
    id: 'press',
    label: 'Revue de presse',
    color: '#34d399',
    kpis: [
      { key: 'press_total', label: 'NOMBRE DE RETOMBÉES', format: 'number' },
      { key: 'press_pos', label: 'RETOMBÉES POSITIVES', format: 'number' },
      { key: 'press_neu', label: 'RETOMBÉES NEUTRES', format: 'number' },
      { key: 'press_neg', label: 'RETOMBÉES NÉGATIVES', format: 'number' },
      { key: 'press_reach_pos', label: 'REACH POSITIF', format: 'number' },
      { key: 'press_reach_neu', label: 'REACH NEUTRE', format: 'number' },
      { key: 'press_reach_neg', label: 'REACH NÉGATIF', format: 'number' },
    ],
  },
  {
    id: 'sea',
    label: 'SEA',
    color: '#6366f1',
    kpis: [
      { key: 'sea_roas', label: 'ROAS', format: 'decimal' },
      { key: 'sea_cpc', label: 'CPC', format: 'currency' },
      { key: 'sea_ctr', label: 'CTR (%)', format: 'percent' },
      { key: 'sea_imp', label: 'IMPRESSIONS', format: 'number' },
      { key: 'sea_conv', label: 'CONVERSIONS', format: 'number' },
      { key: 'sea_budget_dep', label: 'BUDGET DÉPENSÉ', format: 'currency' },
      { key: 'sea_budget_all', label: 'BUDGET ALLOUÉ', format: 'currency' },
    ],
  },
  {
    id: 'meta',
    label: 'Meta',
    color: '#3b82f6',
    kpis: [
      { key: 'meta_reach3s', label: 'REACH 3S', format: 'number' },
      { key: 'meta_compl', label: 'COMPLÉTION VIDÉO (%)', format: 'percent' },
      { key: 'meta_traffic', label: 'TRAFFIC QUALIFIÉ', format: 'number' },
      { key: 'meta_cpm', label: 'CPM', format: 'currency' },
      { key: 'meta_cpvisite', label: 'CPVISITE', format: 'currency' },
      { key: 'meta_cpc', label: 'CPC', format: 'currency' },
      { key: 'meta_conv', label: 'TAUX CONVERSION (%)', format: 'percent' },
      { key: 'meta_roas', label: 'ROAS', format: 'decimal' },
    ],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#fb923c',
    kpis: [
      { key: 'tt_reach3s', label: 'REACH 3S', format: 'number' },
      { key: 'tt_compl', label: 'COMPLÉTION VIDÉO (%)', format: 'percent' },
      { key: 'tt_eng', label: 'ENGAGEMENT RATE (%)', format: 'percent' },
      { key: 'tt_cpv', label: 'CPV', format: 'currency' },
      { key: 'tt_cpc', label: 'CPC', format: 'currency' },
      { key: 'tt_roas', label: 'ROAS', format: 'decimal' },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// MONTHS — fiscal axis used by all leviers (Jan→Dec, current year focus)
// ──────────────────────────────────────────────────────────────────────────
const MONTHS = [
  { idx: 1, short: 'Jan', long: 'janvier' },
  { idx: 2, short: 'Fév', long: 'février' },
  { idx: 3, short: 'Mar', long: 'mars' },
  { idx: 4, short: 'Avr', long: 'avril' },
  { idx: 5, short: 'Mai', long: 'mai' },
  { idx: 6, short: 'Juin', long: 'juin' },
  { idx: 7, short: 'Juil', long: 'juillet' },
  { idx: 8, short: 'Août', long: 'août' },
  { idx: 9, short: 'Sep', long: 'septembre' },
  { idx: 10, short: 'Oct', long: 'octobre' },
  { idx: 11, short: 'Nov', long: 'novembre' },
  { idx: 12, short: 'Déc', long: 'décembre' },
];

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────
function getISOWeek(d = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function monthIdxFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const n = name.toString().toLowerCase().trim();
  const m = MONTHS.find((m) => m.long === n || m.short.toLowerCase() === n);
  return m?.idx ?? null;
}

function weekToMonthIdx(week: string | null | undefined): number | null {
  if (!week) return null;
  const num = parseInt(String(week).replace(/\D/g, ''));
  if (!num || isNaN(num)) return null;
  // ISO week to month: approximate via week × 7 days from Jan 1
  const jan1 = new Date(new Date().getFullYear(), 0, 1);
  const target = new Date(jan1.getTime() + (num - 1) * 7 * 86400000);
  return target.getMonth() + 1;
}

function fmt(n: number | null | undefined, format?: KpiDef['format']): string {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  switch (format) {
    case 'percent':
      return `${v.toFixed(v < 10 ? 2 : 1)}%`;
    case 'currency':
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M€`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K€`;
      return `${v.toFixed(0)}€`;
    case 'decimal':
      return v.toFixed(2);
    case 'number':
    default:
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
      return v % 1 !== 0 ? v.toFixed(1) : String(v);
  }
}

function avg(arr: number[]): number | null {
  const f = arr.filter((v) => v != null && !isNaN(v));
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

function sum(arr: number[]): number | null {
  const f = arr.filter((v) => v != null && !isNaN(v));
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0);
}

// Aggregation rule by KPI semantic: averages for rates/CPx, sums for counts/budgets/impressions
function aggregateByKpi(values: number[], format?: KpiDef['format']): number | null {
  if (format === 'percent' || format === 'decimal') return avg(values);
  if (format === 'currency') {
    // Heuristic: sums for budgets/EMV, but CPM/CPC/CPV should average — caller decides via key
    return sum(values);
  }
  return sum(values);
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────
export function ScorecardRECC({
  learningsButton,
  learningsPanel,
}: {
  learningsButton?: React.ReactNode;
  learningsPanel?: React.ReactNode;
}) {
  const { data: cellNotesMap } = useCellNotes();
  const tableRef = useRef<HTMLDivElement>(null);

  const currentWeek = useMemo(() => getISOWeek(), []);
  const currentMonthIdx = useMemo(() => new Date().getMonth() + 1, []);
  const currentMonthLabel = MONTHS[currentMonthIdx - 1]?.long || '';

  // ── Source queries ──
  const { data: influence } = useQuery({
    queryKey: ['lagostina-influence'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_influence').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: affiliation } = useQuery({
    queryKey: ['lagostina-affiliation'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('lagostina_affiliation') as any).select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: press } = useQuery({
    queryKey: ['lagostina-press'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_press').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: media } = useQuery({
    queryKey: ['lagostina-media-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_media_kpis').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = !influence || !affiliation || !press || !media;

  // ── Build matrix [kpi_key][monthIdx] = number AND weekly [kpi_key][monthIdx][weekNum] = number ──
  const { matrix, weeklyMatrix, monthWeeks } = useMemo(() => {
    const m: Record<string, Record<number, number | null>> = {};
    const w: Record<string, Record<number, Record<number, number | null>>> = {};
    const mw: Record<number, Set<number>> = {};
    const ensure = (k: string) => (m[k] = m[k] || {});
    const ensureW = (k: string, mi: number) => {
      w[k] = w[k] || {};
      w[k][mi] = w[k][mi] || {};
      return w[k][mi];
    };
    const trackWeek = (mi: number, wk: number) => {
      mw[mi] = mw[mi] || new Set();
      mw[mi].add(wk);
    };

    const parseWeek = (week: string | null | undefined): number | null => {
      if (!week) return null;
      const num = parseInt(String(week).replace(/\D/g, ''));
      return num && !isNaN(num) ? num : null;
    };

    // ── INFLUENCE ──
    (influence || []).forEach((row: any) => {
      const mi = monthIdxFromName(row.month);
      if (!mi) return;
      const wk = parseWeek(row.week);
      const set = (kpiKey: string, val: any) => {
        if (val == null) return;
        const v = Number(val);
        ensure(kpiKey)[mi] = v;
        if (wk) { ensureW(kpiKey, mi)[wk] = v; trackWeek(mi, wk); }
      };
      set('inf_nb', row.influencer_count);
      set('inf_reach', row.reach_millions);
      set('inf_budget', row.budget_mois);
      set('inf_eng', row.engagement_rate);
      set('inf_emv', row.emv);
      set('inf_conv', row.conversion_rate);
      set('inf_cpr', row.cost_per_reach);
      set('inf_cpm', row.cpm);
      set('inf_imp', row.impressions_globales);
      set('inf_reel', row.reel_engagement);
      set('inf_st_vues', row.stories_clics_vues);
      set('inf_st_men', row.stories_clics_mentions);
    });

    // ── AFFILIATION ──
    (affiliation || []).forEach((row: any) => {
      const mi = monthIdxFromName(row.month);
      if (!mi) return;
      const wk = parseWeek(row.week);
      const set = (kpiKey: string, val: any) => {
        if (val == null) return;
        const v = Number(val);
        ensure(kpiKey)[mi] = v;
        if (wk) { ensureW(kpiKey, mi)[wk] = v; trackWeek(mi, wk); }
      };
      set('aff_nb', row.influencer_count);
      set('aff_reach', row.reach_millions);
      set('aff_budget', row.budget_mois);
      set('aff_eng', row.engagement_rate);
      set('aff_emv', row.emv);
      set('aff_conv', row.conversion_rate);
      set('aff_cpr', row.cost_per_reach);
      set('aff_cpm', row.cpm);
      set('aff_imp', row.impressions_globales);
    });

    // ── PRESSE ──
    const pressByMonth: Record<number, { pos: number; neu: number; neg: number; reachPos: number; reachNeu: number; reachNeg: number }> = {};
    const pressByWeek: Record<number, Record<number, { pos: number; neu: number; neg: number; reachPos: number; reachNeu: number; reachNeg: number }>> = {};
    (press || []).forEach((row: any) => {
      if (!row.date) return;
      const d = new Date(row.date);
      const mi = d.getMonth() + 1;
      const wk = getISOWeek(d);
      const reach = Number(row.estimated_reach || 0);
      const tone = (row.tonality || '').toLowerCase();
      const bM = (pressByMonth[mi] = pressByMonth[mi] || { pos: 0, neu: 0, neg: 0, reachPos: 0, reachNeu: 0, reachNeg: 0 });
      pressByWeek[mi] = pressByWeek[mi] || {};
      const bW = (pressByWeek[mi][wk] = pressByWeek[mi][wk] || { pos: 0, neu: 0, neg: 0, reachPos: 0, reachNeu: 0, reachNeg: 0 });
      trackWeek(mi, wk);
      if (tone.startsWith('pos')) { bM.pos++; bM.reachPos += reach; bW.pos++; bW.reachPos += reach; }
      else if (tone.startsWith('neg')) { bM.neg++; bM.reachNeg += reach; bW.neg++; bW.reachNeg += reach; }
      else { bM.neu++; bM.reachNeu += reach; bW.neu++; bW.reachNeu += reach; }
    });
    Object.entries(pressByMonth).forEach(([miStr, b]) => {
      const mi = Number(miStr);
      ensure('press_total')[mi] = b.pos + b.neu + b.neg;
      ensure('press_pos')[mi] = b.pos;
      ensure('press_neu')[mi] = b.neu;
      ensure('press_neg')[mi] = b.neg;
      ensure('press_reach_pos')[mi] = b.reachPos;
      ensure('press_reach_neu')[mi] = b.reachNeu;
      ensure('press_reach_neg')[mi] = b.reachNeg;
    });
    Object.entries(pressByWeek).forEach(([miStr, weeks]) => {
      const mi = Number(miStr);
      Object.entries(weeks).forEach(([wkStr, b]) => {
        const wk = Number(wkStr);
        ensureW('press_total', mi)[wk] = b.pos + b.neu + b.neg;
        ensureW('press_pos', mi)[wk] = b.pos;
        ensureW('press_neu', mi)[wk] = b.neu;
        ensureW('press_neg', mi)[wk] = b.neg;
        ensureW('press_reach_pos', mi)[wk] = b.reachPos;
        ensureW('press_reach_neu', mi)[wk] = b.reachNeu;
        ensureW('press_reach_neg', mi)[wk] = b.reachNeg;
      });
    });

    // ── MEDIA KPIs (SEA / SMA=Meta / TikTok) ──
    const mediaAgg: Record<string, Record<string, Record<number, Array<{ wk: number; v: number }>>>> = {};
    (media || []).forEach((row: any) => {
      const wk = parseWeek(row.week);
      const mi = weekToMonthIdx(row.week);
      if (!mi || !wk) return;
      const ch = row.channel;
      const kn = row.kpi_name;
      mediaAgg[ch] = mediaAgg[ch] || {};
      mediaAgg[ch][kn] = mediaAgg[ch][kn] || {};
      mediaAgg[ch][kn][mi] = mediaAgg[ch][kn][mi] || [];
      let v: number | null = null;
      if (row.actual != null) v = Number(row.actual);
      else if (kn === 'budget_depense' && row.budget_spent != null) v = Number(row.budget_spent);
      else if (kn === 'budget_alloue' && row.budget_allocated != null) v = Number(row.budget_allocated);
      if (v != null && !isNaN(v)) {
        mediaAgg[ch][kn][mi].push({ wk, v });
        trackWeek(mi, wk);
      }
    });

    const setMediaKpi = (channel: string, kpiName: string, kpiKey: string, agg: 'sum' | 'avg') => {
      const monthMap = mediaAgg[channel]?.[kpiName];
      if (!monthMap) return;
      Object.entries(monthMap).forEach(([miStr, entries]) => {
        const mi = Number(miStr);
        const vals = entries.map((e) => e.v);
        ensure(kpiKey)[mi] = agg === 'sum' ? sum(vals) : avg(vals);
        entries.forEach(({ wk, v }) => {
          ensureW(kpiKey, mi)[wk] = v;
        });
      });
    };

    setMediaKpi('sea', 'roas', 'sea_roas', 'avg');
    setMediaKpi('sea', 'cpc_moyen', 'sea_cpc', 'avg');
    setMediaKpi('sea', 'ctr', 'sea_ctr', 'avg');
    setMediaKpi('sea', 'impressions', 'sea_imp', 'sum');
    setMediaKpi('sea', 'conversions', 'sea_conv', 'sum');
    setMediaKpi('sea', 'budget_depense', 'sea_budget_dep', 'sum');
    setMediaKpi('sea', 'budget_alloue', 'sea_budget_all', 'sum');

    setMediaKpi('sma', 'reach_3s_views', 'meta_reach3s', 'sum');
    setMediaKpi('sma', 'completion_video', 'meta_compl', 'avg');
    setMediaKpi('sma', 'traffic_qualifie_visites_site', 'meta_traffic', 'sum');
    setMediaKpi('sma', 'cpm_reach_attentif', 'meta_cpm', 'avg');
    setMediaKpi('sma', 'cpvisite', 'meta_cpvisite', 'avg');
    setMediaKpi('sma', 'cpc', 'meta_cpc', 'avg');
    setMediaKpi('sma', 'conversion_rate', 'meta_conv', 'avg');
    setMediaKpi('sma', 'roas', 'meta_roas', 'avg');

    setMediaKpi('tiktok', 'reach', 'tt_reach3s', 'sum');
    setMediaKpi('tiktok', 'completion', 'tt_compl', 'avg');
    setMediaKpi('tiktok', 'engagement_rate', 'tt_eng', 'avg');
    setMediaKpi('tiktok', 'cpv', 'tt_cpv', 'avg');
    setMediaKpi('tiktok', 'cpc', 'tt_cpc', 'avg');
    setMediaKpi('tiktok', 'roas', 'tt_roas', 'avg');

    const monthWeeksOut: Record<number, number[]> = {};
    Object.entries(mw).forEach(([mi, set]) => {
      monthWeeksOut[Number(mi)] = Array.from(set).sort((a, b) => a - b);
    });

    return { matrix: m, weeklyMatrix: w, monthWeeks: monthWeeksOut };
  }, [influence, affiliation, press, media]);

  // Visible months
  const visibleMonths = useMemo(() => {
    const monthsWithData = new Set<number>();
    Object.values(matrix).forEach((row) => {
      Object.keys(row).forEach((mi) => monthsWithData.add(Number(mi)));
    });
    monthsWithData.add(currentMonthIdx);
    return MONTHS.filter((m) => monthsWithData.has(m.idx));
  }, [matrix, currentMonthIdx]);

  // Toggle state
  const [openLeviers, setOpenLeviers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LEVIERS.map((l) => [l.id, true]))
  );
  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({});

  const toggleLevier = (id: string) =>
    setOpenLeviers((s) => ({ ...s, [id]: !s[id] }));
  const toggleMonth = (mi: number) =>
    setExpandedMonths((s) => ({ ...s, [mi]: !s[mi] }));

  // Auto-scroll to current month column
  useEffect(() => {
    if (!tableRef.current) return;
    const el = tableRef.current.querySelector(`[data-month="${currentMonthIdx}"]`);
    if (el && 'scrollIntoView' in el) {
      try {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch {}
    }
  }, [currentMonthIdx, visibleMonths.length]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-black/5 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const hasAnyData = Object.keys(matrix).length > 0;
  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données Scorecard non disponibles</p>
        <p className="text-muted-foreground font-['Roboto'] text-sm">
          Aucune donnée trouvée dans Influence, Affiliation, Presse ou Médiatisation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: current week badge + learnings */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-[#E8FF4C] dark:text-black font-['Roboto'] text-sm font-medium">
          <CalendarClock className="h-4 w-4" />
          <span>Semaine en cours&nbsp;: <strong>S{currentWeek}</strong></span>
          <span className="opacity-60">·</span>
          <span className="capitalize">{currentMonthLabel} {new Date().getFullYear()}</span>
        </div>
        {learningsButton}
      </div>

      {learningsPanel}

      {/* Scorecard table */}
      <div ref={tableRef} className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
        <table className="w-full text-sm font-['Roboto'] border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-black/[0.02] dark:bg-white/[0.02]">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider sticky left-0 bg-white dark:bg-[#0f1422] z-20 min-w-[220px] border-r border-border/30 text-[11px]">
                Levier / KPI
              </th>
              {visibleMonths.map((mo) => {
                const isCurrent = mo.idx === currentMonthIdx;
                const isExpanded = !!expandedMonths[mo.idx];
                const weeks = monthWeeks[mo.idx] || [];
                const colSpan = isExpanded && weeks.length ? weeks.length + 1 : 1;
                return (
                  <th
                    key={mo.idx}
                    data-month={mo.idx}
                    colSpan={colSpan}
                    className={`text-center px-2 py-2 uppercase tracking-wider text-[11px] min-w-[90px] border-l border-border/30 cursor-pointer select-none transition-colors ${
                      isCurrent
                        ? 'bg-[#E8FF4C]/30 dark:bg-[#E8FF4C]/20 text-black dark:text-[#E8FF4C] font-bold'
                        : 'text-muted-foreground font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                    }`}
                    onClick={() => weeks.length && toggleMonth(mo.idx)}
                    title={weeks.length ? 'Cliquez pour afficher les semaines' : ''}
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      {weeks.length > 0 && (
                        isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                      )}
                      {mo.short}
                    </div>
                    {isCurrent && (
                      <div className="text-[9px] font-normal mt-0.5 opacity-80">en cours</div>
                    )}
                  </th>
                );
              })}
            </tr>
            {/* Sub-header: weeks if any month is expanded */}
            {Object.values(expandedMonths).some(Boolean) && (
              <tr className="border-b border-border/30 bg-black/[0.03] dark:bg-white/[0.03]">
                <th className="sticky left-0 bg-white dark:bg-[#0f1422] z-20 border-r border-border/30" />
                {visibleMonths.map((mo) => {
                  const isExpanded = !!expandedMonths[mo.idx];
                  const weeks = monthWeeks[mo.idx] || [];
                  if (!isExpanded || !weeks.length) {
                    return <th key={mo.idx} className="border-l border-border/20" />;
                  }
                  return [
                    ...weeks.map((wk) => (
                      <th
                        key={`${mo.idx}-w${wk}`}
                        className={`text-center px-1.5 py-1 text-[10px] uppercase tracking-wider border-l border-border/10 min-w-[55px] ${
                          wk === currentWeek
                            ? 'bg-[#E8FF4C]/40 dark:bg-[#E8FF4C]/25 text-black dark:text-[#E8FF4C] font-bold'
                            : 'text-muted-foreground/80'
                        }`}
                      >
                        S{wk}
                      </th>
                    )),
                    <th key={`${mo.idx}-total`} className="text-center px-1.5 py-1 text-[10px] uppercase tracking-wider border-l border-border/30 text-muted-foreground font-bold bg-black/[0.04] dark:bg-white/[0.04] min-w-[60px]">
                      Total
                    </th>,
                  ];
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {LEVIERS.map((lev) => {
              const isOpen = openLeviers[lev.id];
              return (
                <>
                  {/* Levier header row (clickable) */}
                  <tr
                    key={`hdr-${lev.id}`}
                    className="border-b border-border/30 cursor-pointer select-none hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    onClick={() => toggleLevier(lev.id)}
                  >
                    <td
                      className="px-3 py-2 text-foreground font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-white dark:bg-[#0f1422] z-10 border-r border-border/30"
                      style={{ borderLeft: `3px solid ${lev.color}` }}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <span>{lev.label}</span>
                        <span className="text-muted-foreground font-normal text-[10px] ml-1">({lev.kpis.length})</span>
                      </div>
                    </td>
                    {visibleMonths.map((mo) => {
                      const isExpanded = !!expandedMonths[mo.idx];
                      const weeks = monthWeeks[mo.idx] || [];
                      const span = isExpanded && weeks.length ? weeks.length + 1 : 1;
                      return (
                        <td
                          key={mo.idx}
                          colSpan={span}
                          className={`border-l border-border/20 ${
                            mo.idx === currentMonthIdx ? 'bg-[#E8FF4C]/10 dark:bg-[#E8FF4C]/5' : ''
                          }`}
                        />
                      );
                    })}
                  </tr>
                  {/* KPI rows (collapsible) */}
                  {isOpen && lev.kpis.map((kpi) => (
                    <tr
                      key={`${lev.id}-${kpi.key}`}
                      className="border-b border-border/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      <td
                        className="pl-9 pr-2 py-1.5 text-foreground text-[12px] sticky left-0 bg-white dark:bg-[#0f1422] z-10 border-r border-border/30"
                        style={{ borderLeft: `3px solid ${lev.color}` }}
                      >
                        {kpi.label}
                      </td>
                      {visibleMonths.map((mo) => {
                        const val = matrix[kpi.key]?.[mo.idx] ?? null;
                        const isCurrent = mo.idx === currentMonthIdx;
                        const isExpanded = !!expandedMonths[mo.idx];
                        const weeks = monthWeeks[mo.idx] || [];
                        const cells: JSX.Element[] = [];
                        if (isExpanded && weeks.length) {
                          weeks.forEach((wk) => {
                            const wval = weeklyMatrix[kpi.key]?.[mo.idx]?.[wk] ?? null;
                            cells.push(
                              <td
                                key={`${mo.idx}-w${wk}`}
                                className={`px-1.5 py-1.5 text-center text-[11px] tabular-nums border-l border-border/10 ${
                                  wk === currentWeek ? 'bg-[#E8FF4C]/15 dark:bg-[#E8FF4C]/10 font-medium' : ''
                                } ${wval == null ? 'text-muted-foreground/40' : 'text-foreground'}`}
                              >
                                {fmt(wval, kpi.format)}
                              </td>
                            );
                          });
                        }
                        cells.push(
                          <NoteableCell
                            key={`${mo.idx}-total`}
                            levier={lev.id}
                            kpiName={kpi.key}
                            week={`M${mo.idx}`}
                            notesMap={cellNotesMap}
                            levierColor={lev.color}
                            className={`px-2 py-1.5 text-center text-[12px] tabular-nums border-l ${
                              isExpanded && weeks.length ? 'border-border/30 bg-black/[0.03] dark:bg-white/[0.03] font-bold' : 'border-border/10'
                            } ${
                              isCurrent ? 'bg-[#E8FF4C]/10 dark:bg-[#E8FF4C]/5 font-medium' : ''
                            } ${val == null ? 'text-muted-foreground/40' : 'text-foreground'}`}
                          >
                            {fmt(val, kpi.format)}
                          </NoteableCell>
                        );
                        return cells;
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs font-['Roboto'] text-muted-foreground pt-2">
        {LEVIERS.map((l) => (
          <div key={l.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3" style={{ background: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
        <div className="ml-auto inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-[#E8FF4C]/40" />
          <span>Mois en cours</span>
        </div>
      </div>
    </div>
  );
}
