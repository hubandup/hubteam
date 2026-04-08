import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database, AlertTriangle } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area,
  Legend,
} from 'recharts';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const LEVIER_COLORS: Record<string, string> = {
  digital: '#E8FF4C',
  tv: '#38bdf8',
  influence: '#a78bfa',
  rp: '#f87171',
  crm: '#34d399',
  social: '#fb923c',
  sea: '#e879f9',
  affiliation: '#94a3b8',
  promo_shopper: '#fbbf24',
  media: '#E8FF4C',
  event: '#38bdf8',
  seo: '#34d399',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1422] border border-[#E8FF4C] px-3 py-2 font-['Roboto'] text-xs">
      <p className="text-white font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString('fr-FR')}€
        </p>
      ))}
    </div>
  );
}

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

  // Year progress
  const now = new Date();
  const yearProgress = ((now.getMonth() + now.getDate() / 30) / 12) * 100;
  const isOverBudget = pct > yearProgress;

  // Donut data
  const donutData = useMemo(() => {
    if (!budgetData?.length) return [];
    const byLevier: Record<string, number> = {};
    budgetData.forEach((b) => {
      byLevier[b.levier] = (byLevier[b.levier] || 0) + (Number(b.engaged) || 0);
    });
    return Object.entries(byLevier)
      .map(([levier, value]) => ({ levier, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [budgetData]);

  // Monthly table
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

  // Burn rate chart
  const burnRateData = useMemo(() => {
    if (!budgetData?.length) return [];
    const monthlyEngaged: Record<string, number> = {};
    budgetData.forEach((b) => {
      monthlyEngaged[b.month] = (monthlyEngaged[b.month] || 0) + (Number(b.engaged) || 0);
    });
    let cumul = 0;
    const linearStep = totalPlanned / 12;
    return MONTHS.map((m, i) => {
      cumul += monthlyEngaged[m] || 0;
      return { month: m, engaged: cumul, planned: linearStep * (i + 1) };
    });
  }, [budgetData, totalPlanned]);

  // Budget exhaustion projection
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
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/5 animate-pulse" />)}
      </div>
    );
  }

  if (!budgetData?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-16 w-16 text-[#9ca3af]" />
        <p className="text-white font-['Instrument_Sans'] text-lg font-bold">Données Budget non disponibles</p>
        <p className="text-[#9ca3af] font-['Roboto'] text-sm">Importez un fichier Budget depuis l'admin</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global gauge */}
      <div className="bg-[#0f1422] p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[#9ca3af] text-xs font-['Roboto'] uppercase tracking-wider">Budget consommé</p>
            <p className="text-white text-2xl font-bold font-['Instrument_Sans']">
              {totalEngaged >= 1000 ? `€${(totalEngaged / 1000).toFixed(0)}K` : `€${totalEngaged}`}
              <span className="text-[#9ca3af] text-base font-normal"> / {totalPlanned >= 1000 ? `€${(totalPlanned / 1000).toFixed(0)}K` : `€${totalPlanned}`}</span>
              <span className="text-[#9ca3af] text-sm font-normal ml-2">— {pct.toFixed(0)}%</span>
            </p>
          </div>
          {isOverBudget && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ef4444]/20 text-[#ef4444] text-xs font-['Roboto'] font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Dépassement prévisionnel
            </div>
          )}
        </div>
        <div className="w-full h-3 bg-white/10">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: pct >= 100 ? '#ef4444' : pct >= yearProgress ? `linear-gradient(90deg, #22c55e, #E8FF4C, #ef4444)` : `linear-gradient(90deg, #22c55e, #E8FF4C)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[#9ca3af] text-[10px] font-['Roboto']">0%</span>
          <span className="text-[#9ca3af] text-[10px] font-['Roboto']">Progression année : {yearProgress.toFixed(0)}%</span>
          <span className="text-[#9ca3af] text-[10px] font-['Roboto']">100%</span>
        </div>
      </div>

      {/* Donut + Burn rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut */}
        <div className="bg-[#0f1422] p-4">
          <h3 className="text-white text-sm font-['Instrument_Sans'] font-bold mb-4">Répartition par levier</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="40%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="levier"
                  stroke="none"
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.levier} fill={LEVIER_COLORS[entry.levier] || '#E8FF4C'} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-[#0f1422] border border-[#E8FF4C] px-3 py-2 font-['Roboto'] text-xs">
                        <p className="text-white">{payload[0].name}: {Number(payload[0].value).toLocaleString('fr-FR')}€</p>
                      </div>
                    );
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value: string) => <span className="text-[#9ca3af] text-xs font-['Roboto']">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Burn rate */}
        <div className="bg-[#0f1422] p-4">
          <h3 className="text-white text-sm font-['Instrument_Sans'] font-bold mb-4">Burn rate cumulé</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnRateData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="planned" name="Prévu" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                <Area type="monotone" dataKey="engaged" name="Engagé" stroke="#E8FF4C" strokeWidth={2} fill="#E8FF4C" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {projectionText && (
            <p className="text-[#9ca3af] text-xs font-['Roboto'] mt-2 text-center">{projectionText}</p>
          )}
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-[#0f1422] overflow-x-auto">
        <table className="w-full text-xs font-['Roboto']">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-3 py-2 text-[#9ca3af] font-medium uppercase tracking-wider sticky left-0 bg-[#0f1422] z-10 min-w-[120px]">Levier</th>
              <th className="text-left px-2 py-2 text-[#9ca3af] font-medium uppercase tracking-wider min-w-[60px]">Type</th>
              {MONTHS.map((m) => (
                <th key={m} className="text-center px-2 py-2 text-[#9ca3af] font-medium uppercase tracking-wider min-w-[60px]">{m}</th>
              ))}
              <th className="text-center px-2 py-2 text-[#E8FF4C] font-bold uppercase tracking-wider min-w-[70px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {leviers.map((levier) => {
              const rows = ['planned', 'engaged', 'invoiced', 'remaining'] as const;
              const labels = { planned: 'Prévu', engaged: 'Engagé', invoiced: 'Facturé', remaining: 'Reste' };
              return rows.map((type, ti) => {
                const total = MONTHS.reduce((s, m) => s + getMonthVal(levier, m, type), 0);
                return (
                  <tr key={`${levier}-${type}`} className={`border-b ${ti === 3 ? 'border-white/10' : 'border-white/5'} hover:bg-white/[0.02]`}>
                    {ti === 0 && (
                      <td
                        rowSpan={4}
                        className="px-3 py-2 text-white font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-[#0f1422] z-10 border-l-2 capitalize"
                        style={{ borderLeftColor: LEVIER_COLORS[levier] || '#E8FF4C' }}
                      >
                        {levier}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-[#9ca3af] text-[10px]">{labels[type]}</td>
                    {MONTHS.map((m) => {
                      const val = getMonthVal(levier, m, type);
                      const isOver = type === 'engaged' && val > getMonthVal(levier, m, 'planned') && getMonthVal(levier, m, 'planned') > 0;
                      return (
                        <td key={m} className={`px-2 py-1.5 text-center text-[11px] ${isOver ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'text-white'}`}>
                          {val > 0 ? val.toLocaleString('fr-FR') : '—'}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center text-[11px] text-white font-medium">
                      {total > 0 ? total.toLocaleString('fr-FR') : '—'}
                    </td>
                  </tr>
                );
              });
            })}
            {/* Total row */}
            <tr className="border-t-2 border-[#E8FF4C]/30 bg-white/[0.02]">
              <td className="px-3 py-2 text-[#E8FF4C] font-['Instrument_Sans'] font-bold text-xs sticky left-0 bg-[#0f1422] z-10">TOTAL</td>
              <td className="px-2 py-1.5 text-[#9ca3af] text-[10px]">Engagé</td>
              {MONTHS.map((m) => {
                const total = leviers.reduce((s, l) => s + getMonthVal(l, m, 'engaged'), 0);
                return (
                  <td key={m} className="px-2 py-1.5 text-center text-[11px] text-[#E8FF4C] font-medium">
                    {total > 0 ? total.toLocaleString('fr-FR') : '—'}
                  </td>
                );
              })}
              <td className="px-2 py-1.5 text-center text-[11px] text-[#E8FF4C] font-bold">
                {totalEngaged.toLocaleString('fr-FR')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
