import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, AlertTriangle } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, AreaChart, Area,
  Legend,
} from 'recharts';
import { LagostinaSubTabs } from './LagostinaSubTabs';
import { ClientBudgetChart } from '@/components/home/ClientBudgetChart';
import { NoteableCell, useCellNotes } from './CellNotePopover';

function getChartAccent(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'hsl(var(--brand-yellow))';
  return 'hsl(var(--brand-ink))';
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const LEVIER_COLORS: Record<string, string> = {
  digital: '#6366f1', tv: '#38bdf8', influence: '#a78bfa', rp: '#f87171',
  crm: '#34d399', social: '#fb923c', sea: '#e879f9', affiliation: 'hsl(var(--muted-foreground))',
  promo_shopper: '#fbbf24', media: '#0ea5e9', event: '#f59e0b', seo: '#10b981',
  tiktok: '#ec4899', print: '#8b5cf6', ooh: '#14b8a6', sampling: '#f43f5e',
  content: '#84cc16', partnerships: '#d946ef', programmatique: '#06b6d4',
};

const FALLBACK_PALETTE = [
  '#6366f1', '#38bdf8', '#a78bfa', '#f87171', '#34d399', '#fb923c',
  '#e879f9', '#fbbf24', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6',
];

function getLevierColor(levier: string, index: number): string {
  return LEVIER_COLORS[levier] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 border border-black dark:border-white px-3 py-2 font-['Instrument Sans'] text-xs">
      <p className="text-foreground font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString('fr-FR')}€
        </p>
      ))}
    </div>
  );
}

const SUB_TABS = [
  { id: 'global', label: 'Vue globale' },
  { id: 'repartition', label: 'Répartition & Burn rate' },
  { id: 'detail', label: 'Détail mensuel' },
];

export function LagostinaBudget({ learningsButton, learningsPanel }: { learningsButton?: React.ReactNode; learningsPanel?: React.ReactNode }) {
  const { data: cellNotesMap } = useCellNotes();

  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['lagostina-budget'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_budget').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: synthesisData } = useQuery({
    queryKey: ['lagostina-budget-synthesis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_budget_synthesis')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const synthesisTotals = useMemo(() => {
    const rows = synthesisData || [];
    return {
      s1Planned: rows.reduce((s, r) => s + Number(r.s1_planned || 0), 0),
      s1Spent: rows.reduce((s, r) => s + Number(r.s1_spent || 0), 0),
      s1Credit: rows.reduce((s, r) => s + Number(r.s1_credit || 0), 0),
      s2Budget: rows.reduce((s, r) => s + Number(r.s2_budget || 0), 0),
      totalYear: rows.reduce((s, r) => s + Number(r.total_year || 0), 0),
    };
  }, [synthesisData]);


  const totalPlanned = useMemo(() => budgetData?.reduce((s, b) => s + (Number(b.planned) || 0), 0) || 0, [budgetData]);
  const totalEngaged = useMemo(() => budgetData?.reduce((s, b) => s + (Number(b.engaged) || 0), 0) || 0, [budgetData]);
  const totalInvoiced = useMemo(() => budgetData?.reduce((s, b) => s + (Number(b.invoiced) || 0), 0) || 0, [budgetData]);
  const pct = totalPlanned > 0 ? (totalEngaged / totalPlanned) * 100 : 0;

  const now = new Date();
  const yearProgress = ((now.getMonth() + now.getDate() / 30) / 12) * 100;
  const isOverBudget = pct > yearProgress;

  const donutData = useMemo(() => {
    if (!budgetData?.length) return [];
    const byLevier: Record<string, number> = {};
    budgetData.forEach((b) => { byLevier[b.levier] = (byLevier[b.levier] || 0) + (Number(b.engaged) || 0); });
    return Object.entries(byLevier).map(([levier, value]) => ({ levier, value })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }, [budgetData]);

  const leviers = useMemo(() => {
    if (!budgetData?.length) return [];
    return [...new Set(budgetData.map((b) => b.levier))].sort();
  }, [budgetData]);

  // Détail mensuel : leviers exclus + renommage + ajout
  const HIDDEN_LEVIERS = ['crm', 'digital_(display_+_vol)', 'promo_shopper'];
  const LEVIER_LABEL_OVERRIDES: Record<string, string> = {
    social_media_ads: 'META',
  };
  const detailLeviers = useMemo(() => {
    const filtered = leviers.filter((l) => !HIDDEN_LEVIERS.includes(l));
    if (!filtered.includes('tiktok')) filtered.push('tiktok');
    return filtered;
  }, [leviers]);
  const getLevierLabel = (l: string) => LEVIER_LABEL_OVERRIDES[l] || l.replace(/_/g, ' ');

  const getMonthVal = (levier: string, month: string, field: 'planned' | 'engaged' | 'invoiced' | 'remaining') => {
    const entry = budgetData?.find((b) => b.levier === levier && b.month === month);
    if (!entry) return 0;
    if (field === 'remaining') return (Number(entry.planned) || 0) - (Number(entry.engaged) || 0);
    return Number(entry[field]) || 0;
  };

  const burnRateData = useMemo(() => {
    if (!budgetData?.length) return [];
    const monthlyEngaged: Record<string, number> = {};
    budgetData.forEach((b) => { monthlyEngaged[b.month] = (monthlyEngaged[b.month] || 0) + (Number(b.engaged) || 0); });
    let cumul = 0;
    const linearStep = totalPlanned / 12;
    return MONTHS.map((m, i) => { cumul += monthlyEngaged[m] || 0; return { month: m, engaged: cumul, planned: linearStep * (i + 1) }; });
  }, [budgetData, totalPlanned]);

  const projectionText = useMemo(() => {
    if (!burnRateData.length || totalEngaged === 0) return null;
    const monthsWithData = burnRateData.filter((d) => d.engaged > 0).length;
    if (monthsWithData === 0) return null;
    const avgBurn = totalEngaged / monthsWithData;
    const remaining = totalPlanned - totalEngaged;
    if (remaining <= 0) return "⚠️ Budget épuisé";
    const monthsLeft = remaining / avgBurn;
    const exhaustionMonth = Math.min(11, Math.floor(now.getMonth() + monthsLeft));
    if (exhaustionMonth >= 11) return "Budget suffisant jusqu'à fin de période";
    return `Au rythme actuel, budget épuisé en ${MONTHS[exhaustionMonth]}`;
  }, [burnRateData, totalEngaged, totalPlanned]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (!budgetData?.length && !synthesisData?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données Budget non disponibles</p>
        <p className="text-muted-foreground font-['Instrument Sans'] text-sm">Importez un fichier Budget depuis l'admin</p>
      </div>
    );
  }

  return (
    <LagostinaSubTabs tabs={SUB_TABS} rightAction={learningsButton} belowTabs={learningsPanel}>
      {(activeTab) => (
        <>
          {activeTab === 'global' && (() => {
            const rows = synthesisData || [];
            const globalPct = synthesisTotals.totalYear > 0
              ? (synthesisTotals.s1Spent / synthesisTotals.totalYear) * 100
              : 0;
            const s1Pct = synthesisTotals.s1Planned > 0
              ? (synthesisTotals.s1Spent / synthesisTotals.s1Planned) * 100
              : 0;
            const isOver = globalPct > yearProgress;
            const fmt = (v: number) =>
              v >= 1000 ? `€${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `€${v.toLocaleString('fr-FR')}`;

            return (
              <>
                {/* KPIs globaux — 2 colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Budget consommé année */}
                  <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-muted-foreground text-xs font-['Instrument Sans'] uppercase tracking-wider">Budget consommé (S1)</p>
                        <p className="text-foreground text-2xl font-bold font-['Instrument_Sans']">
                          {fmt(synthesisTotals.s1Spent)}
                          <span className="text-muted-foreground text-base font-normal"> / {fmt(synthesisTotals.totalYear)}</span>
                          <span className="text-muted-foreground text-sm font-normal ml-2">— {globalPct.toFixed(0)}%</span>
                        </p>
                      </div>
                      {isOver && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ef4444]/20 text-[#ef4444] text-xs font-['Instrument Sans'] font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Dépassement prévisionnel
                        </div>
                      )}
                    </div>
                    <div className="w-full h-3 bg-muted">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${Math.min(globalPct, 100)}%`,
                          background: globalPct >= 100 ? '#ef4444' : globalPct >= yearProgress ? `linear-gradient(90deg, #22c55e, #fbbf24, #ef4444)` : `linear-gradient(90deg, #22c55e, #fbbf24)`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground text-xs font-['Instrument Sans']">0%</span>
                      <span className="text-muted-foreground text-xs font-['Instrument Sans']">Progression année : {yearProgress.toFixed(0)}%</span>
                      <span className="text-muted-foreground text-xs font-['Instrument Sans']">100%</span>
                    </div>
                  </div>

                  {/* Synthèse semestrielle */}
                  <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-6">
                    <p className="text-muted-foreground text-xs font-['Instrument Sans'] uppercase tracking-wider mb-3">Synthèse semestrielle</p>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-muted-foreground text-[10px] font-['Instrument Sans'] uppercase tracking-wider">S1 Prévu</p>
                        <p className="text-foreground text-lg font-bold font-['Instrument_Sans']">{fmt(synthesisTotals.s1Planned)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-['Instrument Sans'] uppercase tracking-wider">S1 Dépensé</p>
                        <p className="text-foreground text-lg font-bold font-['Instrument_Sans']">
                          {fmt(synthesisTotals.s1Spent)}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({s1Pct.toFixed(0)}%)</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-['Instrument Sans'] uppercase tracking-wider">S1 Avoir</p>
                        <p className="text-foreground text-lg font-bold font-['Instrument_Sans']">{fmt(synthesisTotals.s1Credit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-['Instrument Sans'] uppercase tracking-wider">S2 Budget</p>
                        <p className="text-foreground text-lg font-bold font-['Instrument_Sans']">{fmt(synthesisTotals.s2Budget)}</p>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-muted flex overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${synthesisTotals.totalYear > 0 ? (synthesisTotals.s1Spent / synthesisTotals.totalYear) * 100 : 0}%`,
                          backgroundColor: 'hsl(var(--brand-ink))',
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${synthesisTotals.totalYear > 0 ? (synthesisTotals.s2Budget / synthesisTotals.totalYear) * 100 : 0}%`,
                          backgroundColor: 'hsl(var(--brand-yellow))',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground text-xs font-['Instrument Sans']">S1 dépensé</span>
                      <span className="text-muted-foreground text-xs font-['Instrument Sans']">S2 budget restant</span>
                    </div>
                  </div>
                </div>

                {/* Détail par levier — synthèse S1/S2 */}
                <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 overflow-x-auto">
                  <table className="w-full text-sm font-['Instrument Sans']">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs">Levier</th>
                        <th className="text-right px-3 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs">S1 Prévu</th>
                        <th className="text-right px-3 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs">S1 Dépensé</th>
                        <th className="text-right px-3 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs">S1 Avoir</th>
                        <th className="text-right px-3 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs">S2 Budget</th>
                        <th className="text-right px-3 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs">Total Année</th>
                        <th className="px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider text-xs w-32">% S1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const color = getLevierColor(r.levier.toLowerCase().replace(/[^a-z]/g, '_'), idx);
                        const pctS1 = Number(r.s1_planned) > 0
                          ? (Number(r.s1_spent) / Number(r.s1_planned)) * 100
                          : 0;
                        return (
                          <tr key={r.id} className="border-b border-border/10 hover:bg-muted/30">
                            <td className="px-4 py-3 text-foreground font-['Instrument_Sans'] font-bold text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-5" style={{ backgroundColor: color }} />
                                {r.levier}
                              </div>
                            </td>
                            <NoteableCell levier={r.levier} kpiName="S1 Prévu" week="synthese" notesMap={cellNotesMap} levierColor={color} className="px-3 py-3 text-right text-foreground tabular-nums">
                              {Number(r.s1_planned).toLocaleString('fr-FR')} €
                            </NoteableCell>
                            <NoteableCell levier={r.levier} kpiName="S1 Dépensé" week="synthese" notesMap={cellNotesMap} levierColor={color} className="px-3 py-3 text-right text-foreground tabular-nums font-medium">
                              {Number(r.s1_spent).toLocaleString('fr-FR')} €
                            </NoteableCell>
                            <NoteableCell levier={r.levier} kpiName="S1 Avoir" week="synthese" notesMap={cellNotesMap} levierColor={color} className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                              {r.s1_credit != null ? `${Number(r.s1_credit).toLocaleString('fr-FR')} €` : '—'}
                            </NoteableCell>
                            <NoteableCell levier={r.levier} kpiName="S2 Budget" week="synthese" notesMap={cellNotesMap} levierColor={color} className="px-3 py-3 text-right text-foreground tabular-nums">
                              {Number(r.s2_budget).toLocaleString('fr-FR')} €
                            </NoteableCell>
                            <NoteableCell levier={r.levier} kpiName="Total Année" week="synthese" notesMap={cellNotesMap} levierColor={color} className="px-3 py-3 text-right text-foreground tabular-nums font-semibold">
                              {Number(r.total_year).toLocaleString('fr-FR')} €
                            </NoteableCell>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted">
                                  <div className="h-full transition-all" style={{ width: `${Math.min(pctS1, 100)}%`, backgroundColor: pctS1 > 100 ? '#ef4444' : color }} />
                                </div>
                                <span className="text-muted-foreground text-[11px] tabular-nums w-9 text-right">{pctS1.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-foreground/20 bg-muted/20">
                        <td className="px-4 py-3 text-foreground font-['Instrument_Sans'] font-bold text-sm">TOTAL</td>
                        <td className="px-3 py-3 text-right text-foreground tabular-nums font-bold">{synthesisTotals.s1Planned.toLocaleString('fr-FR')} €</td>
                        <td className="px-3 py-3 text-right text-foreground tabular-nums font-bold">{synthesisTotals.s1Spent.toLocaleString('fr-FR')} €</td>
                        <td className="px-3 py-3 text-right text-foreground tabular-nums font-bold">{synthesisTotals.s1Credit.toLocaleString('fr-FR')} €</td>
                        <td className="px-3 py-3 text-right text-foreground tabular-nums font-bold">{synthesisTotals.s2Budget.toLocaleString('fr-FR')} €</td>
                        <td className="px-3 py-3 text-right text-foreground tabular-nums font-bold">{synthesisTotals.totalYear.toLocaleString('fr-FR')} €</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">{s1Pct.toFixed(0)}% S1</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}

          {activeTab === 'repartition' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-4">
                <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Répartition par levier</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="40%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" nameKey="levier" stroke="none">
                        {donutData.map((entry, index) => (
                          <Cell key={entry.levier} fill={getLevierColor(entry.levier, index)} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 border border-black dark:border-white px-3 py-2 font-['Instrument Sans'] text-xs">
                              <p className="text-foreground">{payload[0].name}: {Number(payload[0].value).toLocaleString('fr-FR')}€</p>
                            </div>
                          );
                        }}
                      />
                      <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-muted-foreground text-xs font-['Instrument Sans']">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-4">
                <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Burn rate cumulé</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={burnRateData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="planned" name="Prévu" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                      <Area type="monotone" dataKey="engaged" name="Engagé" stroke={getChartAccent()} strokeWidth={2} fill={getChartAccent()} fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {projectionText && (
                  <p className="text-muted-foreground text-xs font-['Instrument Sans'] mt-2 text-center">{projectionText}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 overflow-x-auto">
              <table className="w-full text-sm font-['Instrument Sans']">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider sticky left-0 bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 z-10 min-w-[120px]">Levier</th>
                    <th className="text-left px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[60px]">Type</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-center px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[60px]">{m}</th>
                    ))}
                    <th className="text-center px-2 py-2 text-foreground font-semibold font-bold uppercase tracking-wider min-w-[70px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLeviers.map((levier) => {
                    const rows = ['planned', 'engaged', 'invoiced', 'remaining'] as const;
                    const labels = { planned: 'Prévu', engaged: 'Engagé', invoiced: 'Facturé', remaining: 'Reste' };
                    return rows.map((type, ti) => {
                      const total = MONTHS.reduce((s, m) => s + getMonthVal(levier, m, type), 0);
                      return (
                        <tr key={`${levier}-${type}`} className={`${ti === 3 ? 'border-b-2 border-foreground/20' : 'border-b border-border/10'} hover:bg-muted dark:hover:bg-[#141928]`}>
                          {ti === 0 && (
                            <td
                              rowSpan={4}
                              className="px-3 py-2 text-foreground font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 z-10 border-l-2 capitalize"
                              style={{ borderLeftColor: getLevierColor(levier, detailLeviers.indexOf(levier)) }}
                            >
                              {getLevierLabel(levier)}
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-muted-foreground text-xs">{labels[type]}</td>
                          {MONTHS.map((m) => {
                            const val = getMonthVal(levier, m, type);
                            const isOver = type === 'engaged' && val > getMonthVal(levier, m, 'planned') && getMonthVal(levier, m, 'planned') > 0;
                            return (
                              <NoteableCell key={m} levier={`budget_${levier}`} kpiName={type} week={m} notesMap={cellNotesMap} levierColor={getLevierColor(levier, detailLeviers.indexOf(levier))} className={`px-2 py-1.5 text-center text-[13px] ${isOver ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'text-foreground'}`}>
                                {val > 0 ? val.toLocaleString('fr-FR') : '—'}
                              </NoteableCell>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center text-[13px] text-foreground font-medium">
                            {total > 0 ? total.toLocaleString('fr-FR') : '—'}
                          </td>
                        </tr>
                      );
                    });
                  })}
                  <tr className="border-t-2 border-black/30 bg-card/[0.02]">
                    <td className="px-3 py-2 text-foreground font-semibold font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 z-10">TOTAL</td>
                    <td className="px-2 py-1.5 text-muted-foreground text-xs">Engagé</td>
                    {MONTHS.map((m) => {
                      const total = detailLeviers.reduce((s, l) => s + getMonthVal(l, m, 'engaged'), 0);
                      return (
                        <td key={m} className="px-2 py-1.5 text-center text-[13px] text-foreground font-semibold font-medium">
                          {total > 0 ? total.toLocaleString('fr-FR') : '—'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center text-[13px] text-foreground font-semibold font-bold">
                      {totalEngaged.toLocaleString('fr-FR')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </LagostinaSubTabs>
  );
}
