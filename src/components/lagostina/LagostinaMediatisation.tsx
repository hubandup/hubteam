import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { LagostinaSubTabs } from './LagostinaSubTabs';

// Theme-aware chart accent: dark=#E8FF4C, light=#0f1422
function getChartAccent(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return '#E8FF4C';
  return '#0f1422';
}

const SUB_TABS = ['SEA', 'META', 'TikTok'] as const;
type SubTab = typeof SUB_TABS[number];

const CHANNEL_MAP: Record<SubTab, string> = { SEA: 'sea', META: 'sma', TikTok: 'tiktok' };

// Map DB kpi_names to display keys
const SEA_KPIS = ['roas', 'cpc_moyen', 'ctr', 'impressions', 'conversions', 'budget_ratio'];
const SMA_KPIS = ['reach_(3s_views)', 'complétion_vidéo', 'traffic_qualifié_(visites_site)', 'cpm_reach_attentif', 'cpvisite', 'cpc', 'conversion_rate', 'roas'];
const TIKTOK_KPIS = ['reach', 'completion', 'engagement_rate', 'cpv', 'cpc', 'roas'];

const KPI_LABELS: Record<string, string> = {
  roas: 'ROAS', cpc_moyen: 'CPC', cpc: 'CPC', ctr: 'CTR', impressions: 'Impressions', conversions: 'Conversions',
  budget_ratio: 'Budget dépensé / alloué', 'reach_(3s_views)': 'Reach 3s', reach: 'Reach 3s',
  'complétion_vidéo': 'Complétion vidéo', completion: 'Complétion vidéo',
  'traffic_qualifié_(visites_site)': 'Traffic qualifié', traffic: 'Traffic qualifié',
  'cpm_reach_attentif': 'CPM', cpm: 'CPM', cpvisite: 'CPVisite', cpv: 'CPV',
  conversion_rate: 'Taux conversion', engagement_rate: 'Engagement rate',
  followers_evol: 'Évol. followers', taux_de_conversion: 'Taux conversion',
  'coût_/_conversion': 'Coût / conversion',
  'budget_dépensé': 'Budget dépensé', 'budget_alloué': 'Budget alloué',
};

// KPIs where values are already in percentage (don't multiply by 100)
const ALREADY_PERCENT_KPIS = ['ctr', 'engagement_rate', 'conversion_rate', 'completion', 'complétion_vidéo', 'taux_de_conversion'];

function getCondColor(actual: number | null, objective: number | null) {
  if (!actual || !objective) return '';
  const ratio = actual / objective;
  if (ratio >= 1) return 'border-[#22c55e]';
  if (ratio >= 0.8) return 'border-foreground';
  return 'border-[#ef4444]';
}

function formatVal(val: number | null | undefined, kpi: string): string {
  if (val == null) return '—';
  // Bug 1 fix: values are already in percentage, just append %
  if (ALREADY_PERCENT_KPIS.includes(kpi)) return `${val.toFixed(1)}%`;
  if (['roas'].includes(kpi)) return val.toFixed(2);
  if (['cpc_moyen', 'cpc', 'cpm', 'cpm_reach_attentif', 'cpv', 'cpvisite', 'coût_/_conversion'].includes(kpi)) return `€${val.toFixed(2)}`;
  if (['impressions', 'reach', 'reach_(3s_views)', 'conversions', 'traffic', 'traffic_qualifié_(visites_site)', 'clics'].includes(kpi)) {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toFixed(0);
  }
  return String(val);
}

function sortWeeksNumerically(weeks: { week: string; actual: number | null; objective: number | null }[]) {
  return [...weeks].sort((a, b) => {
    const numA = parseInt(a.week.replace(/\D/g, ''), 10);
    const numB = parseInt(b.week.replace(/\D/g, ''), 10);
    return numA - numB;
  });
}

const chartTooltipStyle = {
  contentStyle: { background: '#0f1422', border: '1px solid currentColor', borderRadius: 0, fontSize: 12, fontFamily: 'Roboto' },
  labelStyle: { color: '#9ca3af' },
};

interface KpiData {
  kpi_name: string;
  weeks: { week: string; actual: number | null; objective: number | null }[];
  latestActual: number | null;
  latestObjective: number | null;
  trend: 'up' | 'down' | null;
}

function buildKpiData(rows: any[], kpis: string[]): KpiData[] {
  return kpis.map((kpi) => {
    // Special case: budget_ratio is computed from budget_dépensé / budget_alloué
    if (kpi === 'budget_ratio') {
      const spentRows = rows.filter((r: any) => r.kpi_name === 'budget_dépensé');
      const allocRows = rows.filter((r: any) => r.kpi_name === 'budget_alloué');
      const allWeeks = [...new Set(spentRows.map((r: any) => r.week))];
      const weeks = sortWeeksNumerically(allWeeks.map((w) => {
        const spent = spentRows.find((r: any) => r.week === w)?.actual ?? null;
        const alloc = allocRows.find((r: any) => r.week === w)?.actual ?? null;
        const ratio = spent != null && alloc != null && alloc > 0 ? spent / alloc : null;
        return { week: w, actual: ratio != null ? Math.round(ratio * 100) : null, objective: 100 };
      }));
      const actuals = weeks.filter((w) => w.actual != null);
      const latest = actuals.length ? actuals[actuals.length - 1] : null;
      const prev = actuals.length > 1 ? actuals[actuals.length - 2] : null;
      let trend: 'up' | 'down' | null = null;
      if (latest && prev && latest.actual != null && prev.actual != null) {
        trend = latest.actual >= prev.actual ? 'up' : 'down';
      }
      return { kpi_name: kpi, weeks, latestActual: latest?.actual ?? null, latestObjective: 100, trend };
    }

    const kpiRows = rows.filter((r: any) => r.kpi_name === kpi);
    const weeks = sortWeeksNumerically(kpiRows.map((r: any) => ({ week: r.week, actual: r.actual, objective: r.objective })));
    const actuals = weeks.filter((w) => w.actual != null);
    const latest = actuals.length ? actuals[actuals.length - 1] : null;
    const prev = actuals.length > 1 ? actuals[actuals.length - 2] : null;
    let trend: 'up' | 'down' | null = null;
    if (latest && prev && latest.actual != null && prev.actual != null) {
      trend = latest.actual >= prev.actual ? 'up' : 'down';
    }
    return { kpi_name: kpi, weeks, latestActual: latest?.actual ?? null, latestObjective: latest?.objective ?? null, trend };
  });
}

function KpiCard({ data }: { data: KpiData }) {
  const cond = getCondColor(data.latestActual, data.latestObjective);
  const formatFn = data.kpi_name === 'budget_ratio'
    ? (v: number | null | undefined) => v != null ? `${v}%` : '—'
    : (v: number | null | undefined) => formatVal(v, data.kpi_name);

  return (
    <div className={`bg-white dark:bg-[#0f1422] border border-border/30 border-l-[3px] ${cond || 'border-foreground'} p-4 flex flex-col gap-1`}>
      <div className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">{KPI_LABELS[data.kpi_name] || data.kpi_name}</div>
      <div className="text-foreground text-xl font-bold font-['Instrument_Sans']">{formatFn(data.latestActual)}</div>
      {data.latestObjective != null && (
        <div className="text-muted-foreground text-xs font-['Roboto']">Obj: {formatFn(data.latestObjective)}</div>
      )}
      {data.trend && (
        <div className={`flex items-center gap-1 text-xs ${data.trend === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {data.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {data.trend === 'up' ? 'Hausse' : 'Baisse'} w/w
        </div>
      )}
      {data.weeks.length > 1 && (
        <div className="h-8 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeks}>
              <Line type="monotone" dataKey="actual" stroke={getChartAccent()} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SEATab({ rows }: { rows: any[] }) {
  const kpis = buildKpiData(rows, SEA_KPIS);
  const roasData = kpis.find((k) => k.kpi_name === 'roas');

  const { data: topKeywords } = useQuery({
    queryKey: ['lagostina-top-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_top_keywords').select('*').order('clicks', { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const hasKeywords = (topKeywords || []).length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roasData && roasData.weeks.length > 1 && (
          <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
            <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Évolution ROAS</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={roasData.weeks}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'Roboto' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'Roboto' }} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="actual" stroke={getChartAccent()} strokeWidth={2} dot={false} name="Actuals" />
                <Line type="monotone" dataKey="objective" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Objectifs" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Top Keywords SEA</h3>
          {!hasKeywords ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground text-sm font-['Roboto']">Données non disponibles</span>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
              <table className="w-full text-[12px] font-['Roboto']">
                <thead className="sticky top-0 bg-white dark:bg-[#0f1422]">
                  <tr className="border-b border-border/40">
                    <th className="text-left py-1.5 px-2 text-muted-foreground uppercase">Keyword</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Clics</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Impr.</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">CTR</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">CPC</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Conv.</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {(topKeywords || []).map((kw: any) => (
                    <tr key={kw.id} className="border-b border-border/20 hover:bg-gray-50 dark:hover:bg-[#141928]">
                      <td className="py-1.5 px-2 text-foreground truncate max-w-[160px]" title={kw.keyword}>{kw.keyword}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{kw.clicks != null ? kw.clicks.toLocaleString('fr-FR') : '—'}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{kw.impressions != null ? kw.impressions.toLocaleString('fr-FR') : '—'}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{kw.ctr != null ? `${Number(kw.ctr).toFixed(1)}%` : '—'}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{kw.cpc != null ? `€${Number(kw.cpc).toFixed(2)}` : '—'}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{kw.conversions != null ? kw.conversions : '—'}</td>
                      <td className="py-1.5 px-2 text-right text-foreground font-bold">{kw.roas != null ? Number(kw.roas).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelStep({ label, value, color, ratio }: { label: string; value: string; color: string; ratio?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">{label}</div>
      <div className="w-full py-6 flex items-center justify-center" style={{ background: color }}>
        <span className="text-black text-lg font-bold font-['Instrument_Sans']">{value}</span>
      </div>
      {ratio && <div className="text-muted-foreground text-xs font-['Roboto']">→ {ratio}</div>}
    </div>
  );
}

function SMATab({ rows }: { rows: any[] }) {
  const kpis = buildKpiData(rows, SMA_KPIS);
  const reach = kpis.find((k) => k.kpi_name === 'reach_(3s_views)')?.latestActual;
  const traffic = kpis.find((k) => k.kpi_name === 'traffic_qualifié_(visites_site)')?.latestActual;
  const conversions = kpis.find((k) => k.kpi_name === 'conversion_rate')?.latestActual;

  const awarenessToConsid = reach && traffic ? `${((traffic / reach) * 100).toFixed(1)}%` : undefined;
  const considToPurchase = traffic && conversions ? `${conversions.toFixed(1)}%` : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-6">
        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Funnel SMA</h3>
        <div className="flex gap-2 items-end">
          <FunnelStep label="Awareness" value={formatVal(reach, 'reach_(3s_views)')} color={getChartAccent()} ratio={awarenessToConsid} />
          <FunnelStep label="Considération" value={formatVal(traffic, 'traffic_qualifié_(visites_site)')} color="#38bdf8" ratio={considToPurchase} />
          <FunnelStep label="Purchase" value={conversions != null ? `${conversions.toFixed(1)}%` : '—'} color="#22c55e" />
        </div>
      </div>
      {kpis[0]?.weeks.length > 1 && (
        <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4 overflow-x-auto">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Détail par semaine</h3>
          <table className="w-full text-[13px] font-['Roboto']">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 px-2 text-muted-foreground">KPI</th>
                <th className="text-left py-2 px-2 text-muted-foreground">Type</th>
                {kpis[0].weeks.map((w) => (
                  <th key={w.week} className="text-center py-2 px-1 text-muted-foreground">{w.week}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.kpi_name} className="border-b border-border/20">
                  <td className="py-2 px-2 text-foreground" rowSpan={1}>{KPI_LABELS[k.kpi_name] || k.kpi_name}</td>
                  <td className="py-2 px-2 text-muted-foreground">Act.</td>
                  {k.weeks.map((w) => (
                    <td key={w.week} className="py-2 px-1 text-center text-foreground">{formatVal(w.actual, k.kpi_name)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TikTokTab({ rows }: { rows: any[] }) {
  const kpis = buildKpiData(rows, TIKTOK_KPIS);
  const followersData = sortWeeksNumerically(
    rows
      .filter((r: any) => r.kpi_name === 'followers_evol')
      .map((r: any) => ({ week: r.week, actual: r.actual, objective: null }))
  ).map((r) => ({ week: r.week, value: r.actual }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      {followersData.length > 1 && (
        <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Évolution followers</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={followersData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'Roboto' }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'Roboto' }} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="value" name="Évol. %">
                {followersData.map((entry, i) => (
                  <Cell key={i} fill={(entry.value ?? 0) >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white dark:bg-[#0f1422] border border-border/30 p-4">
        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Top Creatives</h3>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 dark:bg-[#141928] p-3">
              <div className="aspect-video bg-white dark:bg-[#141928] flex items-center justify-center mb-2">
                <span className="text-muted-foreground text-xs font-['Roboto']">Creative #{i}</span>
              </div>
              <div className="text-muted-foreground text-xs font-['Roboto']">Données non disponibles</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LagostinaMediatisation({ learningsButton, learningsPanel }: { learningsButton?: React.ReactNode; learningsPanel?: React.ReactNode }) {
  const { data: mediaKpis, isLoading } = useQuery({
    queryKey: ['lagostina-media-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_media_kpis').select('*');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-white dark:bg-[#0f1422] border border-border/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const subTabItems = SUB_TABS.map((t) => ({ id: t, label: t }));

  return (
    <LagostinaSubTabs tabs={subTabItems} defaultTab="SEA" rightAction={learningsButton} belowTabs={learningsPanel}>
      {(tab) => {
        const rows = (mediaKpis || []).filter((r) => r.channel === CHANNEL_MAP[tab as SubTab]);
        return rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground font-['Roboto'] text-sm">Données non disponibles — en attente d'import</p>
          </div>
        ) : (
          <>
            {tab === 'SEA' && <SEATab rows={rows} />}
            {tab === 'SMA' && <SMATab rows={rows} />}
            {tab === 'TikTok' && <TikTokTab rows={rows} />}
          </>
        );
      }}
    </LagostinaSubTabs>
  );
}
