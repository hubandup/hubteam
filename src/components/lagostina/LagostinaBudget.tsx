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

function getChartAccent(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return '#E8FF4C';
  return '#0f1422';
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const LEVIER_COLORS: Record<string, string> = {
  digital: '#6366f1', tv: '#38bdf8', influence: '#a78bfa', rp: '#f87171',
  crm: '#34d399', social: '#fb923c', sea: '#e879f9', affiliation: '#94a3b8',
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
    <div className="bg-white dark:bg-[#0f1422] border border-border/30 border border-black dark:border-white px-3 py-2 font-['Roboto'] text-xs">
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

export function LagostinaBudget() {
  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['lagostina-budget'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_budget').select('*');
      if (error) throw error;
      return data;
    },
  });

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
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  if (!budgetData?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-muted-foreground" />
        <p className="text-foreground font-['Instrument_Sans'] text-lg font-bold">Données Budget non disponibles</p>
        <p className="text-muted-foreground font-['Roboto'] text-sm">Importez un fichier Budget depuis l'admin</p>
      </div>
    );
  }

  return (
    <LagostinaSubTabs tabs={SUB_TABS}>
      {(activeTab) => (
        <>
          {activeTab === 'global' && (
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">Budget consommé</p>
                  <p className="text-foreground text-2xl font-bold font-['Instrument_Sans']">
                    {totalEngaged >= 1000 ? `€${(totalEngaged / 1000).toFixed(0)}K` : `€${totalEngaged}`}
                    <span className="text-muted-foreground text-base font-normal"> / {totalPlanned >= 1000 ? `€${(totalPlanned / 1000).toFixed(0)}K` : `€${totalPlanned}`}</span>
                    <span className="text-muted-foreground text-sm font-normal ml-2">— {pct.toFixed(0)}%</span>
                  </p>
                </div>
                {isOverBudget && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ef4444]/20 text-[#ef4444] text-xs font-['Roboto'] font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Dépassement prévisionnel
                  </div>
                )}
              </div>
              <div className="w-full h-3 bg-gray-200">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: pct >= 100 ? '#ef4444' : pct >= yearProgress ? `linear-gradient(90deg, #22c55e, #fbbf24, #ef4444)` : `linear-gradient(90deg, #22c55e, #fbbf24)`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground text-xs font-['Roboto']">0%</span>
                <span className="text-muted-foreground text-xs font-['Roboto']">Progression année : {yearProgress.toFixed(0)}%</span>
                <span className="text-muted-foreground text-xs font-['Roboto']">100%</span>
              </div>
             </div>
              <ClientBudgetChart />
           )}

          {activeTab === 'repartition' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
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
                            <div className="bg-white dark:bg-[#0f1422] border border-border/30 border border-black dark:border-white px-3 py-2 font-['Roboto'] text-xs">
                              <p className="text-foreground">{payload[0].name}: {Number(payload[0].value).toLocaleString('fr-FR')}€</p>
                            </div>
                          );
                        }}
                      />
                      <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-muted-foreground text-xs font-['Roboto']">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
                <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Burn rate cumulé</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={burnRateData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="planned" name="Prévu" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                      <Area type="monotone" dataKey="engaged" name="Engagé" stroke={getChartAccent()} strokeWidth={2} fill={getChartAccent()} fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {projectionText && (
                  <p className="text-muted-foreground text-xs font-['Roboto'] mt-2 text-center">{projectionText}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="bg-white dark:bg-[#0f1422] border border-border/30 overflow-x-auto">
              <table className="w-full text-sm font-['Roboto']">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider sticky left-0 bg-white dark:bg-[#0f1422] border border-border/30 z-10 min-w-[120px]">Levier</th>
                    <th className="text-left px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[60px]">Type</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-center px-2 py-2 text-muted-foreground font-medium uppercase tracking-wider min-w-[60px]">{m}</th>
                    ))}
                    <th className="text-center px-2 py-2 text-black dark:text-white font-semibold font-bold uppercase tracking-wider min-w-[70px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leviers.map((levier) => {
                    const rows = ['planned', 'engaged', 'invoiced', 'remaining'] as const;
                    const labels = { planned: 'Prévu', engaged: 'Engagé', invoiced: 'Facturé', remaining: 'Reste' };
                    return rows.map((type, ti) => {
                      const total = MONTHS.reduce((s, m) => s + getMonthVal(levier, m, type), 0);
                      return (
                        <tr key={`${levier}-${type}`} className={`${ti === 3 ? 'border-b-2 border-foreground/20' : 'border-b border-border/10'} hover:bg-gray-50 dark:hover:bg-[#141928]`}>
                          {ti === 0 && (
                            <td
                              rowSpan={4}
                              className="px-3 py-2 text-foreground font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-white dark:bg-[#0f1422] border border-border/30 z-10 border-l-2 capitalize"
                              style={{ borderLeftColor: getLevierColor(levier, leviers.indexOf(levier)) }}
                            >
                              {levier}
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-muted-foreground text-xs">{labels[type]}</td>
                          {MONTHS.map((m) => {
                            const val = getMonthVal(levier, m, type);
                            const isOver = type === 'engaged' && val > getMonthVal(levier, m, 'planned') && getMonthVal(levier, m, 'planned') > 0;
                            return (
                              <td key={m} className={`px-2 py-1.5 text-center text-[13px] ${isOver ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'text-foreground'}`}>
                                {val > 0 ? val.toLocaleString('fr-FR') : '—'}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center text-[13px] text-foreground font-medium">
                            {total > 0 ? total.toLocaleString('fr-FR') : '—'}
                          </td>
                        </tr>
                      );
                    });
                  })}
                  <tr className="border-t-2 border-black/30 bg-white/[0.02]">
                    <td className="px-3 py-2 text-black dark:text-white font-semibold font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-white dark:bg-[#0f1422] border border-border/30 z-10">TOTAL</td>
                    <td className="px-2 py-1.5 text-muted-foreground text-xs">Engagé</td>
                    {MONTHS.map((m) => {
                      const total = leviers.reduce((s, l) => s + getMonthVal(l, m, 'engaged'), 0);
                      return (
                        <td key={m} className="px-2 py-1.5 text-center text-[13px] text-black dark:text-white font-semibold font-medium">
                          {total > 0 ? total.toLocaleString('fr-FR') : '—'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center text-[13px] text-black dark:text-white font-semibold font-bold">
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
