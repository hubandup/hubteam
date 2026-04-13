import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, Plus, Minus } from 'lucide-react';
import { LagostinaSubTabs } from './LagostinaSubTabs';
import { NoteableCell, useCellNotes } from './CellNotePopover';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// Theme-aware chart accent: dark=#E8FF4C, light=#0f1422
function getChartAccent(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return '#E8FF4C';
  return '#0f1422';
}

type Scorecard = {
  id: string;
  priority: string;
  levier: string;
  kpi_name: string;
  week: string;
  month: string | null;
  actual: number | null;
  objective: number | null;
};

// ── FRAMEWORK RECC STRUCTURE ──
const HIDDEN_LEVIERS = ['crm', 'promo_shopper', 'digital_(display_+_vol)', 'event_(optional)'];

const isHiddenLevier = (levier: string) =>
  HIDDEN_LEVIERS.some((h) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm(levier) === norm(h) || norm(levier).includes(norm(h));
  });

// Labels for known leviers
const LEVIER_LABELS: Record<string, string> = {
  media: 'Media',
  influence: 'Influence',
  social_media: 'Social Media',
  seo: 'SEO',
  crm: 'CRM',
  promo_shopper: 'Promo Shopper',
  'event_(optional)': 'Event',
  'media_(affiliation)': 'Media Affiliation',
  'media_(one_video_+_social)': 'Media One Video + Social',
  'media_(sea)': 'Media SEA',
  'media_(social_-_plateforme)': 'Media Social Plateforme',
  'media_(vol)': 'Media VOL',
};

function getLevierLabel(levier: string): string {
  return LEVIER_LABELS[levier] || levier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const LEVIER_COLORS: Record<string, string> = {
  media: '#6366f1',
  event: '#38bdf8',
  influence: '#a78bfa',
  social_media: '#f472b6',
  crm: '#fb923c',
  seo: '#34d399',
  promo_shopper: '#fbbf24',
};

function getCondColor(actual: number | null, objective: number | null): string {
  if (actual == null || objective == null || objective === 0) return '';
  const ratio = actual / objective;
  if (ratio >= 1) return 'bg-[#22c55e]/20 text-[#22c55e]';
  if (ratio >= 0.8) return 'bg-black/20 dark:bg-white/20 text-black dark:text-white font-semibold';
  return 'bg-[#ef4444]/20 text-[#ef4444]';
}

function formatNum(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n % 1 !== 0) return n.toFixed(2);
  return String(n);
}

// ── STATUS LOGIC ──
function getCompletion(actual: number | null, objective: number | null): number | null {
  if (actual == null || objective == null || objective === 0) return null;
  return (actual / objective) * 100;
}

function getStatus(
  actual: number | null,
  objective: number | null,
  weekIndex: number,
  totalWeeks: number
): { label: string; color: string } {
  if (actual == null) return { label: 'À faire', color: 'bg-muted text-muted-foreground' };
  if (objective == null) return { label: 'En cours', color: 'bg-[#22c55e]/20 text-[#22c55e]' };
  const completion = (actual / objective) * 100;
  // Expected progress based on position in timeline
  const expectedProgress = totalWeeks > 0 ? ((weekIndex + 1) / totalWeeks) * 100 : 100;
  if (completion < expectedProgress * 0.7) {
    return { label: 'En retard', color: 'bg-[#ef4444]/20 text-[#ef4444]' };
  }
  return { label: 'En cours', color: 'bg-[#22c55e]/20 text-[#22c55e]' };
}

// ── SPARKLINE ──
function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return <span className="text-muted-foreground/40">—</span>;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-16 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={getChartAccent()} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── CUSTOM TOOLTIP ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#0f1422] border border-border/30 border border-black dark:border-white px-3 py-2 font-['Roboto'] text-xs">
      <p className="text-foreground font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatNum(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── GAUGE ──
function GaugeChart({ value, target }: { value: number; target: number }) {
  const pct = Math.min(value / (target * 2), 1);
  const angle = -90 + pct * 180;
  const isGood = value <= target;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#d1d5db" className="dark:stroke-[#1e293b]" strokeWidth="16" strokeLinecap="butt" />
        <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#22c55e" strokeWidth="16" strokeLinecap="butt" />
        <path d="M 100 20 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="16" strokeLinecap="butt" />
        <line
          x1="100" y1="100"
          x2={100 + 60 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 60 * Math.sin((angle * Math.PI) / 180)}
          stroke="white" strokeWidth="2"
        />
        <circle cx="100" cy="100" r="4" fill="white" />
      </svg>
      <div className={`text-lg font-bold font-['Instrument_Sans'] ${isGood ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        {value.toFixed(2)}€
      </div>
      <div className="text-muted-foreground text-xs font-['Roboto']">Target: {target}€</div>
    </div>
  );
}

// ── MAIN COMPONENT ──
export function ScorecardRECC({ learningsButton, learningsPanel }: { learningsButton?: React.ReactNode; learningsPanel?: React.ReactNode }) {
  const [showPastWeeks, setShowPastWeeks] = useState(false);
  const { data: cellNotesMap } = useCellNotes();

  const { data: scorecards, isLoading } = useQuery({
    queryKey: ['lagostina-scorecards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_scorecards')
        .select('*')
        .order('week');
      if (error) throw error;
      return data as Scorecard[];
    },
  });

  // Derive weeks/months
  const { weeks, monthGroups } = useMemo(() => {
    if (!scorecards?.length) return { weeks: [], monthGroups: [] as { month: string; weeks: string[] }[] };
    const weekSet = new Set<string>();
    const weekMonth = new Map<string, string>();
    scorecards.forEach((s) => {
      weekSet.add(s.week);
      if (s.month) weekMonth.set(s.week, s.month);
    });
    const sortedWeeks = [...weekSet].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''));
      const nb = parseInt(b.replace(/\D/g, ''));
      return na - nb;
    });
    const groups: { month: string; weeks: string[] }[] = [];
    let current = '';
    sortedWeeks.forEach((w) => {
      const m = weekMonth.get(w) || current;
      if (m !== current) {
        groups.push({ month: m, weeks: [w] });
        current = m;
      } else if (groups.length) {
        groups[groups.length - 1].weeks.push(w);
      } else {
        groups.push({ month: m || '?', weeks: [w] });
        current = m;
      }
    });
    return { weeks: sortedWeeks, monthGroups: groups };
  }, [scorecards]);

  // Current week number (ISO)
  const currentWeekNum = useMemo(() => {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
    return Math.ceil((days + jan1.getDay() + 1) / 7);
  }, []);

  // Split weeks into past (before current) and current+future
  const { pastWeeks, currentAndFutureWeeks, visibleWeeks, visibleMonthGroups } = useMemo(() => {
    const getNum = (w: string) => parseInt(w.replace(/\D/g, ''));
    const past = weeks.filter((w) => getNum(w) < currentWeekNum);
    const currentFuture = weeks.filter((w) => getNum(w) >= currentWeekNum);
    // If no current/future weeks exist, show at least the last week
    const baseFuture = currentFuture.length > 0 ? currentFuture : weeks.length > 0 ? [weeks[weeks.length - 1]] : [];

    const visible = showPastWeeks ? [...past, ...baseFuture] : baseFuture;
    const visibleSet = new Set(visible);
    const filteredGroups = monthGroups
      .map((mg) => ({ ...mg, weeks: mg.weeks.filter((w) => visibleSet.has(w)) }))
      .filter((mg) => mg.weeks.length > 0);
    return { pastWeeks: past, currentAndFutureWeeks: baseFuture, visibleWeeks: visible, visibleMonthGroups: filteredGroups };
  }, [weeks, monthGroups, showPastWeeks, currentWeekNum]);

  const lookup = useMemo(() => {
    const map = new Map<string, Scorecard>();
    scorecards?.forEach((s) => {
      map.set(`${s.levier}|${s.kpi_name}|${s.week}`, s);
    });
    return map;
  }, [scorecards]);

  // ── Dynamic structures from actual data ──
  const { syntheseGroups, parLevierGroups, allLevierKpis } = useMemo(() => {
    if (!scorecards?.length) return { syntheseGroups: [], parLevierGroups: [], allLevierKpis: [] };

    // Group by levier
    const levierMap = new Map<string, Set<string>>();
    scorecards.forEach((s) => {
      if (!levierMap.has(s.levier)) levierMap.set(s.levier, new Set());
      levierMap.get(s.levier)!.add(s.kpi_name);
    });

    // Synthèse: prio_1 leviers, excluding hidden
    const prio1Leviers = [...new Set(scorecards.filter(s => s.priority === 'prio_1' && !isHiddenLevier(s.levier)).map(s => s.levier))];
    const synthese = prio1Leviers.map((lev) => ({
      levier: lev,
      label: getLevierLabel(lev),
      kpis: [...(levierMap.get(lev) || [])],
    }));

    // Par levier: prio_2 leviers (full funnel detail)
    const prio2Leviers = [...new Set(scorecards.filter(s => s.priority !== 'prio_1').map(s => s.levier))];
    const parLevier = prio2Leviers.map((lev) => ({
      levier: lev,
      label: getLevierLabel(lev),
      kpis: [...(levierMap.get(lev) || [])],
    }));

    // All leviers with KPIs for full detail
    const allLevKpis = [...levierMap.entries()]
      .filter(([lev]) => !isHiddenLevier(lev))
      .map(([lev, kpis]) => ({
        levier: lev,
        label: getLevierLabel(lev),
        kpis: [...kpis],
      }));

    return { syntheseGroups: synthese, parLevierGroups: parLevier, allLevierKpis: allLevKpis };
  }, [scorecards]);

  const getVal = (levier: string, kpi: string, week: string) => lookup.get(`${levier}|${kpi}|${week}`);

  // Charts data
  const reachChartData = useMemo(() => {
    return weeks.map((w) => {
      const reachEntries = scorecards?.filter(
        (s) => s.week === w && (s.kpi_name.toLowerCase().includes('reach') || s.kpi_name.toLowerCase().includes('potentiel'))
      ) || [];
      return {
        week: w,
        actual: reachEntries.reduce((sum, s) => sum + (Number(s.actual) || 0), 0) || null,
        objective: reachEntries.reduce((sum, s) => sum + (Number(s.objective) || 0), 0) || null,
      };
    });
  }, [scorecards, weeks]);

  const budgetByLevier = useMemo(() => {
    if (!scorecards?.length) return [];
    const leviers = [...new Set(scorecards.map((s) => s.levier))].filter((l) => !isHiddenLevier(l));
    return leviers.map((l) => ({
      levier: l,
      total: scorecards.filter((s) => s.levier === l).reduce((sum, s) => sum + (Number(s.actual) || 0), 0),
    })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [scorecards]);

  const roasChartData = useMemo(() => {
    return weeks.map((w) => {
      const entries = scorecards?.filter((s) => s.week === w && s.kpi_name.toLowerCase().includes('roas')) || [];
      const vals = entries.filter((e) => e.actual != null).map((e) => Number(e.actual));
      return { week: w, roas: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    });
  }, [scorecards, weeks]);

  const cpvData = useMemo(() => {
    const entries = scorecards?.filter((s) => s.kpi_name.toLowerCase().includes('cpv')) || [];
    const vals = entries.filter((e) => e.actual != null);
    return vals.length ? vals.reduce((sum, e) => sum + Number(e.actual), 0) / vals.length : 0;
  }, [scorecards]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!scorecards?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données Scorecard non disponibles</p>
        <p className="text-muted-foreground font-['Roboto'] text-sm">Importez un fichier Scorecard depuis l'admin</p>
      </div>
    );
  }

  const scorecardSubTabs = [
    { id: 'synthese', label: 'Synthèse' },
    { id: 'par_levier', label: 'Par levier' },
    { id: 'full_detail', label: 'Full détail' },
  ];

  return (
    <LagostinaSubTabs tabs={scorecardSubTabs} defaultTab="synthese" rightAction={learningsButton} belowTabs={learningsPanel}>
      {(tab) => (
        <>
      {/* SYNTHÈSE */}
      {tab === 'synthese' && (
        <>
          <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
            <table className="w-full text-sm font-['Roboto']">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider sticky left-0 bg-white dark:bg-[#0f1422] border border-border/30 z-10 min-w-[120px]">Levier</th>
                  
                  <th className="text-left px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[140px]">KPI</th>
                  <th className="text-center px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[70px]">Objectif</th>
                  {pastWeeks.length > 0 && (
                    <th className="text-center px-1 py-2">
                      <button
                        onClick={() => setShowPastWeeks(!showPastWeeks)}
                        className="inline-flex items-center justify-center w-6 h-6 bg-black text-white dark:bg-[#E8FF4C] dark:text-black transition-colors"
                        title={showPastWeeks ? 'Masquer les mois précédents' : 'Mois précédents'}
                      >
                        {showPastWeeks ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </button>
                    </th>
                  )}
                  {visibleMonthGroups.map((mg) => (
                    <th key={mg.month} colSpan={mg.weeks.length} className="text-center px-1 py-2 text-black dark:text-white font-semibold font-bold uppercase tracking-wider border-l border-border/20">
                      {mg.month}
                    </th>
                  ))}
                  <th className="text-center px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[80px]">Complétion</th>
                  <th className="text-center px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[80px]">Statut</th>
                  <th className="text-center px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[80px]">Trend</th>
                </tr>
                <tr className="border-b border-border/20">
                  <th colSpan={3} className="sticky left-0 bg-white dark:bg-[#0f1422] border border-border/30 z-10" />
                  {pastWeeks.length > 0 && <th />}
                  {visibleWeeks.map((w) => (
                    <th key={w} className="text-center px-1 py-1 text-muted-foreground/60 text-xs">{w}</th>
                  ))}
                  <th />
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {syntheseGroups.map((group) => (
                  group.kpis.map((kpiName, ki) => {
                    const actualVals = weeks.map((w) => getVal(group.levier, kpiName, w)?.actual ?? null);
                    const objVals = weeks.map((w) => getVal(group.levier, kpiName, w)?.objective ?? null);
                    const sparkData = actualVals.filter((v): v is number => v != null);

                    const latestObj = [...objVals].reverse().find((v) => v != null) ?? null;
                    const latestActual = [...actualVals].reverse().find((v) => v != null) ?? null;
                    const latestActualIdx = actualVals.lastIndexOf(latestActual);
                    const completion = getCompletion(latestActual, latestObj);
                    const status = getStatus(latestActual, latestObj, latestActualIdx >= 0 ? latestActualIdx : 0, weeks.length);

                    return (
                      <tr key={`${group.levier}-${kpiName}`} className="border-b border-border/20 hover:bg-gray-50 dark:bg-[#141928]">
                        {ki === 0 && (
                          <td
                            rowSpan={group.kpis.length}
                            className="px-3 py-2 text-foreground font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-white dark:bg-[#0f1422] border border-border/30 z-10 border-l-2"
                            style={{ borderLeftColor: LEVIER_COLORS[group.levier] || '#E8FF4C' }}
                          >
                            {group.label}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-foreground text-xs">{kpiName}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground text-xs">
                          {formatNum(latestObj)}
                        </td>
                        {pastWeeks.length > 0 && <td />}
                        {visibleWeeks.map((w) => {
                          const wi = weeks.indexOf(w);
                          const val = actualVals[wi];
                          const obj = objVals[wi];
                          const color = getCondColor(val, obj);
                          return (
                            <NoteableCell key={w} levier={group.levier} kpiName={kpiName} week={w} notesMap={cellNotesMap} levierColor={LEVIER_COLORS[group.levier]} className={`px-1 py-1.5 text-center text-[13px] ${color}`}>
                              {formatNum(val)}
                            </NoteableCell>
                          );
                        })}
                        <td className="px-2 py-1.5 text-center text-xs font-medium">
                          {completion != null ? `${completion.toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Sparkline data={sparkData} />
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts 2x2 grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reach Actuals vs Objectifs */}
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Reach — Actuals vs Objectifs</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reachChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="actual" name="Actuals" stroke={getChartAccent()} strokeWidth={2} dot={{ fill: getChartAccent(), r: 3 }} />
                    <Line type="monotone" dataKey="objective" name="Objectifs" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Budget par levier */}
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Répartition par levier</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetByLevier} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 60 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis dataKey="levier" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total">
                      {budgetByLevier.map((entry) => (
                        <Cell key={entry.levier} fill={LEVIER_COLORS[entry.levier] || '#E8FF4C'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ROAS Evolution */}
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Évolution ROAS</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={roasChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="roasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={getChartAccent()} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={getChartAccent()} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="roas" name="ROAS" stroke="white" strokeWidth={2} fill="url(#roasGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CPV Gauge */}
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
              <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">CPV vs Target</h3>
              <div className="flex items-center justify-center h-48">
                <GaugeChart value={cpvData} target={1} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* PAR LEVIER */}
      {tab === 'par_levier' && (
        <div className="space-y-6">
          {PAR_LEVIER_STRUCTURE.map((block) => {
            const matchingData = scorecards?.filter((s) =>
              s.levier.toLowerCase().includes(block.levier.replace('media_', '').replace('_', ' ')) ||
              s.levier === block.levier
            ) || [];
            const kpiNames = [...new Set(matchingData.map((s) => s.kpi_name))];

            return (
              <div key={block.levier} className="bg-white dark:bg-[#0f1422] border border-border/30">
                <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                  <div className="w-2 h-2 bg-black" />
                  <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">{block.label}</h3>
                </div>
                {kpiNames.length === 0 ? (
                  <div className="p-4 text-muted-foreground text-xs font-['Roboto']">Aucune donnée pour ce levier</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-['Roboto']">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[160px]">KPI</th>
                          <th className="text-center px-2 py-2 text-muted-foreground font-medium min-w-[70px]">Objectif</th>
                          {pastWeeks.length > 0 && (
                            <th className="text-center px-1 py-2">
                              <button
                                onClick={() => setShowPastWeeks(!showPastWeeks)}
                                className="inline-flex items-center justify-center w-6 h-6 bg-black text-white dark:bg-[#E8FF4C] dark:text-black transition-colors"
                                title={showPastWeeks ? 'Masquer les mois précédents' : 'Mois précédents'}
                              >
                                {showPastWeeks ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              </button>
                            </th>
                          )}
                          {visibleWeeks.map((w) => (
                            <th key={w} className="text-center px-1 py-2 text-muted-foreground/60 text-xs">{w}</th>
                          ))}
                          <th className="text-center px-2 py-2 text-muted-foreground font-medium min-w-[80px]">Complétion</th>
                          <th className="text-center px-2 py-2 text-muted-foreground font-medium min-w-[80px]">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiNames.map((kn) => {
                          const actualVals = weeks.map((w) => {
                            const entry = matchingData.find((s) => s.kpi_name === kn && s.week === w);
                            return entry?.actual ?? null;
                          });
                          const objVals = weeks.map((w) => {
                            const entry = matchingData.find((s) => s.kpi_name === kn && s.week === w);
                            return entry?.objective ?? null;
                          });
                          const latestObj = [...objVals].reverse().find((v) => v != null) ?? null;
                          const latestActual = [...actualVals].reverse().find((v) => v != null) ?? null;
                          const latestActualIdx = actualVals.lastIndexOf(latestActual);
                          const completion = getCompletion(latestActual, latestObj);
                          const status = getStatus(latestActual, latestObj, latestActualIdx >= 0 ? latestActualIdx : 0, weeks.length);

                          return (
                            <tr key={kn} className="border-b border-border/20">
                              <td className="px-3 py-1.5 text-foreground">{kn}</td>
                              <td className="px-2 py-1.5 text-center text-muted-foreground text-xs">{formatNum(latestObj)}</td>
                              {pastWeeks.length > 0 && <td />}
                              {visibleWeeks.map((w) => {
                                const wi = weeks.indexOf(w);
                                return (
                                <NoteableCell key={w} levier={block.levier} kpiName={kn} week={w} notesMap={cellNotesMap} levierColor={LEVIER_COLORS[block.levier]} className={`px-1 py-1.5 text-center text-[13px] ${getCondColor(actualVals[wi], objVals[wi])}`}>
                                  {formatNum(actualVals[wi])}
                                </NoteableCell>
                                );
                              })}
                              <td className="px-2 py-1.5 text-center text-xs font-medium">
                                {completion != null ? `${completion.toFixed(0)}%` : '—'}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`inline-block px-2 py-0.5 text-[11px] font-medium ${status.color}`}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FULL DÉTAIL */}
      {tab === 'full_detail' && (
        <div className="space-y-6">
          {FULL_DETAIL_SECTIONS.map((section) => (
            <div key={section.section} className="bg-white dark:bg-[#0f1422] border border-border/30">
              <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                <div className="w-2 h-2 bg-black" />
                <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">{section.section}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-['Roboto']">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[160px]">KPI</th>
                      {pastWeeks.length > 0 && (
                        <th className="text-center px-1 py-2">
                          <button
                            onClick={() => setShowPastWeeks(!showPastWeeks)}
                            className="inline-flex items-center justify-center w-6 h-6 bg-black text-white dark:bg-[#E8FF4C] dark:text-black transition-colors"
                            title={showPastWeeks ? 'Masquer les mois précédents' : 'Mois précédents'}
                          >
                            {showPastWeeks ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </button>
                        </th>
                      )}
                      {visibleWeeks.map((w) => (
                        <th key={w} className="text-center px-1 py-2 text-muted-foreground/60 text-xs">{w}</th>
                      ))}
                      {visibleMonthGroups.map((mg) => (
                        <th key={mg.month} className="text-center px-2 py-2 text-black dark:text-white font-semibold text-xs font-bold border-l border-border/40">{mg.month}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.kpis.map((kpiName) => {
                      const matching = scorecards?.filter((s) =>
                        s.kpi_name.toLowerCase().includes(kpiName.toLowerCase().replace('evol w/w ', ''))
                      ) || [];
                      
                      const weeklyVals = weeks.map((w) => {
                        const entry = matching.find((s) => s.week === w);
                        return entry?.actual ?? null;
                      });

                      // Monthly aggregates
                      const monthlyVals = visibleMonthGroups.map((mg) => {
                        const monthEntries = matching.filter((s) => mg.weeks.includes(s.week) && s.actual != null);
                        if (!monthEntries.length) return null;
                        return monthEntries.reduce((sum, e) => sum + Number(e.actual), 0) / monthEntries.length;
                      });

                      const isEvol = kpiName.toLowerCase().includes('evol');

                      return (
                        <tr key={kpiName} className="border-b border-border/20 hover:bg-gray-50 dark:bg-[#141928]">
                          <td className="px-3 py-1.5 text-foreground">{kpiName}</td>
                          {pastWeeks.length > 0 && <td />}
                          {visibleWeeks.map((w) => {
                            const i = weeks.indexOf(w);
                            const v = weeklyVals[i];
                            let cls = '';
                            if (isEvol && v != null) {
                              cls = v >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
                            }
                            return (
                              <NoteableCell key={w} levier={`detail_${section.section}`} kpiName={kpiName} week={w} notesMap={cellNotesMap} levierColor={LEVIER_COLORS[section.section]} className={`px-1 py-1.5 text-center text-[13px] ${cls || 'text-foreground'}`}>
                                {v != null ? (isEvol ? `${v >= 0 ? '↑' : '↓'}${Math.abs(v).toFixed(1)}%` : formatNum(v)) : '—'}
                              </NoteableCell>
                            );
                          })}
                          {monthlyVals.map((v, i) => (
                            <td key={i} className="px-2 py-1.5 text-center text-[13px] text-black dark:text-white font-semibold font-medium border-l border-border/40">
                              {formatNum(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Influence & Social Media sections */}
          {['influence', 'social_media'].map((lev) => {
            const data = scorecards?.filter((s) => s.levier === lev) || [];
            const kpiNames = [...new Set(data.map((s) => s.kpi_name))];
            if (!kpiNames.length) return null;
            return (
              <div key={lev} className="bg-white dark:bg-[#0f1422] border border-border/30">
                <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                  <div className="w-2 h-2" style={{ backgroundColor: LEVIER_COLORS[lev] || '#E8FF4C' }} />
                  <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">
                    {lev === 'influence' ? 'Influence' : 'Social Media'}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-['Roboto']">
                    <thead>
                      <tr className="border-b border-border/20">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[160px]">KPI</th>
                        {pastWeeks.length > 0 && (
                          <th className="text-center px-1 py-2">
                            <button
                              onClick={() => setShowPastWeeks(!showPastWeeks)}
                              className="inline-flex items-center justify-center w-6 h-6 bg-black text-white dark:bg-[#E8FF4C] dark:text-black transition-colors"
                              title={showPastWeeks ? 'Masquer les mois précédents' : 'Mois précédents'}
                            >
                              {showPastWeeks ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </button>
                          </th>
                        )}
                        {visibleWeeks.map((w) => (
                          <th key={w} className="text-center px-1 py-2 text-muted-foreground/60 text-xs">{w}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kpiNames.map((kn) => (
                        <tr key={kn} className="border-b border-border/20">
                          <td className="px-3 py-1.5 text-foreground">{kn}</td>
                          {pastWeeks.length > 0 && <td />}
                          {visibleWeeks.map((w) => {
                            const entry = data.find((s) => s.kpi_name === kn && s.week === w);
                            return (
                              <NoteableCell key={w} levier={lev} kpiName={kn} week={w} notesMap={cellNotesMap} levierColor={LEVIER_COLORS[lev]} className="px-1 py-1.5 text-center text-[13px] text-foreground">
                                {formatNum(entry?.actual ?? null)}
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
          })}
        </div>
      )}
        </>
      )}
    </LagostinaSubTabs>
  );
}
