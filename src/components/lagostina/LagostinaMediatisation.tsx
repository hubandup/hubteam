import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { LagostinaSubTabs } from './LagostinaSubTabs';
import { NoteableCell, useCellNotes } from './CellNotePopover';

// Theme-aware chart accent: dark=hsl(var(--brand-yellow)), light=hsl(var(--brand-ink))
function getChartAccent(): string {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'hsl(var(--brand-yellow))';
  return 'hsl(var(--brand-ink))';
}

const SUB_TABS = ['SEA', 'META', 'TikTok'] as const;
type SubTab = typeof SUB_TABS[number];

const CHANNEL_MAP: Record<SubTab, string> = { SEA: 'sea', META: 'sma', TikTok: 'tiktok' };

// Map DB kpi_names to display keys
const SEA_KPIS = ['roas', 'cpc_moyen', 'ctr', 'impressions', 'conversions', 'budget_ratio'];
const SMA_KPIS = ['reach_3s_views', 'completion_video', 'traffic_qualifie_visites_site', 'cpm_reach_attentif', 'cpvisite', 'cpc', 'conversion_rate', 'roas'];
const TIKTOK_KPIS = ['impressions', 'spend', 'cpm', 'ctr', 'cpc', 'conversions', 'cpa', 'cvr', 'completion', 'roas'];

const KPI_LABELS: Record<string, string> = {
  roas: 'ROAS', cpc_moyen: 'CPC', cpc: 'CPC', ctr: 'CTR', impressions: 'Impressions', conversions: 'Conversions',
  budget_ratio: 'Budget dépensé / alloué', reach_3s_views: 'Reach 3s', 'reach_(3s_views)': 'Reach 3s', reach: 'Reach',
  completion_video: 'Complétion vidéo', 'complétion_vidéo': 'Complétion vidéo', completion: 'Complétion vidéo',
  traffic_qualifie_visites_site: 'Traffic qualifié', 'traffic_qualifié_(visites_site)': 'Traffic qualifié', traffic: 'Traffic qualifié',
  cpm_reach_attentif: 'CPM', cpm: 'CPM', cpvisite: 'CPVisite', cpv: 'CPV',
  conversion_rate: 'Taux conversion', engagement_rate: 'Engagement rate',
  followers_evol: 'Évol. followers', taux_de_conversion: 'Taux conversion',
  'coût_/_conversion': 'Coût / conversion', cout_conversion: 'Coût / conversion',
  'budget_dépensé': 'Budget dépensé', budget_depense: 'Budget dépensé',
  'budget_alloué': 'Budget alloué', budget_alloue: 'Budget alloue',
  spend: 'Dépense', cpa: 'CPA', cvr: 'CVR', clicks: 'Clics',
};

// KPIs where values are already in percentage (don't multiply by 100)
const ALREADY_PERCENT_KPIS = ['ctr', 'cvr', 'engagement_rate', 'conversion_rate', 'completion', 'completion_video', 'complétion_vidéo', 'taux_de_conversion'];

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
  if (['impressions', 'reach', 'reach_3s_views', 'reach_(3s_views)', 'conversions', 'traffic', 'traffic_qualifie_visites_site', 'traffic_qualifié_(visites_site)', 'clics'].includes(kpi)) {
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
  contentStyle: { background: 'hsl(var(--brand-ink))', border: '1px solid currentColor', borderRadius: 0, fontSize: 12, fontFamily: 'Roboto' },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
};

interface KpiData {
  kpi_name: string;
  weeks: { week: string; actual: number | null; objective: number | null; budget_spent?: number | null; budget_allocated?: number | null }[];
  latestActual: number | null;
  latestObjective: number | null;
  trend: 'up' | 'down' | null;
}

type MediaKpiRow = {
  channel: string;
  kpi_name: string;
  week: string;
  actual: number | null;
  objective: number | null;
  budget_spent?: number | null;
  budget_allocated?: number | null;
};

type TopKeywordRow = {
  id: string;
  keyword: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  cpc: number | null;
  conversions: number | null;
  roas: number | null;
};

type CellNotesMap = Parameters<typeof NoteableCell>[0]['notesMap'];

function buildKpiData(rows: MediaKpiRow[], kpis: string[]): KpiData[] {
  return kpis.map((kpi) => {
    // Special case: budget_ratio can arrive as a dedicated row with budget_spent/budget_allocated,
    // or be computed from legacy separate budget rows.
    if (kpi === 'budget_ratio') {
      const ratioRows = rows.filter((r) => r.kpi_name === 'budget_ratio');
      if (ratioRows.length > 0) {
        const weeks = sortWeeksNumerically(ratioRows.map((r) => {
          const rawRatio = r.actual != null ? Number(r.actual) : null;
          const actual = rawRatio == null ? null : Math.round(rawRatio <= 1 ? rawRatio * 100 : rawRatio);
          return {
            week: r.week,
            actual,
            objective: 100,
            budget_spent: r.budget_spent,
            budget_allocated: r.budget_allocated,
          };
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

      const spentRows = rows.filter((r) => r.kpi_name === 'budget_dépensé' || r.kpi_name === 'budget_depense');
      const allocRows = rows.filter((r) => r.kpi_name === 'budget_alloué' || r.kpi_name === 'budget_alloue');
      const allWeeks = [...new Set(spentRows.map((r) => r.week))];
      const weeks = sortWeeksNumerically(allWeeks.map((w) => {
        const spent = spentRows.find((r) => r.week === w)?.actual ?? null;
        const alloc = allocRows.find((r) => r.week === w)?.actual ?? null;
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

    const kpiRows = rows.filter((r) => r.kpi_name === kpi);
    const weeks = sortWeeksNumerically(kpiRows.map((r) => ({ week: r.week, actual: r.actual, objective: r.objective })));
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
  const latestWeek = data.weeks.filter((w) => w.actual != null).at(-1);
  const formatFn = data.kpi_name === 'budget_ratio'
    ? (v: number | null | undefined) => v != null ? `${v}%` : '—'
    : (v: number | null | undefined) => formatVal(v, data.kpi_name);

  return (
    <div className={`bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 border-l-[3px] ${cond || 'border-foreground'} p-4 flex flex-col gap-1`}>
      <div className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">{KPI_LABELS[data.kpi_name] || data.kpi_name}</div>
      <div className="text-foreground text-xl font-bold font-['Instrument_Sans']">{formatFn(data.latestActual)}</div>
      {data.latestObjective != null && (
        <div className="text-muted-foreground text-xs font-['Roboto']">Obj: {formatFn(data.latestObjective)}</div>
      )}
      {data.kpi_name === 'budget_ratio' && latestWeek?.budget_spent != null && latestWeek?.budget_allocated != null && (
        <div className="text-muted-foreground text-xs font-['Roboto']">
          €{Number(latestWeek.budget_spent).toLocaleString('fr-FR')} / €{Number(latestWeek.budget_allocated).toLocaleString('fr-FR')}
        </div>
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

type CampaignRow = {
  id: string;
  date: string;
  campaign: string;
  roas: number | null;
  cpc: number | null;
  ctr: number | null;
  impressions: number | null;
  conversions: number | null;
  budget_spent: number | null;
  budget_allocated: number | null;
};

function SEATab({ rows }: { rows: MediaKpiRow[] }) {
  const kpis = buildKpiData(rows, SEA_KPIS);
  const roasData = kpis.find((k) => k.kpi_name === 'roas');

  const { data: topKeywords } = useQuery({
    queryKey: ['lagostina-top-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_top_keywords').select('*').order('clicks', { ascending: false }).limit(20);
      if (error) throw error;
      return data as TopKeywordRow[];
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ['lagostina-sea-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_sea_campaigns')
        .select('*')
        .order('date', { ascending: false })
        .order('budget_spent', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as CampaignRow[];
    },
  });

  // Aggregate "Campagnes en cours" = latest date row per campaign
  const currentCampaigns = useMemo(() => {
    const list = campaigns || [];
    if (list.length === 0) return [];
    const latestDate = list.reduce((m, r) => (r.date > m ? r.date : m), list[0].date);
    return list.filter((r) => r.date === latestDate).sort((a, b) => (b.budget_spent ?? 0) - (a.budget_spent ?? 0));
  }, [campaigns]);

  const hasKeywords = (topKeywords || []).length > 0;
  const hasCampaigns = currentCampaigns.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roasData && roasData.weeks.length > 1 && (
          <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-4">
            <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Évolution ROAS</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={roasData.weeks}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'Roboto' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'Roboto' }} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="actual" stroke={getChartAccent()} strokeWidth={2} dot={false} name="Actuals" />
                <Line type="monotone" dataKey="objective" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Objectifs" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-4">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Top Keywords SEA</h3>
          {!hasKeywords ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground text-sm font-['Roboto']">Données non disponibles</span>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
              <table className="w-full text-[12px] font-['Roboto']">
                <thead className="sticky top-0 bg-card dark:bg-[hsl(var(--brand-ink))]">
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
                  {(topKeywords || []).map((kw) => (
                    <tr key={kw.id} className="border-b border-border/20 hover:bg-muted dark:hover:bg-[#141928]">
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

      <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold">Campagnes en cours</h3>
          {hasCampaigns && (
            <span className="text-muted-foreground text-xs font-['Roboto']">
              {new Date(currentCampaigns[0].date).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
        {!hasCampaigns ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground text-sm font-['Roboto']">Données non disponibles</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-['Roboto']">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-1.5 px-2 text-muted-foreground uppercase">Campagne</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Impr.</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">CTR</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">CPC</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Conv.</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">ROAS</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Dépensé</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground uppercase">Alloué/j</th>
                </tr>
              </thead>
              <tbody>
                {currentCampaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-muted dark:hover:bg-[#141928]">
                    <td className="py-1.5 px-2 text-foreground truncate max-w-[260px]" title={c.campaign}>{c.campaign}</td>
                    <td className="py-1.5 px-2 text-right text-foreground">{c.impressions != null ? c.impressions.toLocaleString('fr-FR') : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-foreground">{c.ctr != null ? `${Number(c.ctr).toFixed(1)}%` : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-foreground">{c.cpc != null ? `€${Number(c.cpc).toFixed(2)}` : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-foreground">{c.conversions != null ? Number(c.conversions).toFixed(1) : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-foreground font-bold">{c.roas != null ? Number(c.roas).toFixed(2) : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-foreground">{c.budget_spent != null ? `€${Number(c.budget_spent).toFixed(2)}` : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{c.budget_allocated != null ? `€${Number(c.budget_allocated).toFixed(0)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, color, ratio, widthPercent }: { label: string; value: string; color: string; ratio?: string; widthPercent: number }) {
  const isDark = color === getChartAccent() || color.toLowerCase().includes('0f1422');
  return (
    <div className="flex flex-col items-center gap-2" style={{ width: `${widthPercent}%` }}>
      <div className="text-muted-foreground text-xs font-['Roboto'] uppercase tracking-wider">{label}</div>
      <div className="w-full py-6 flex items-center justify-center rounded-sm" style={{ background: color }}>
        <span className={`text-lg font-bold font-['Instrument_Sans'] ${isDark ? 'text-background' : 'text-foreground'}`}>{value}</span>
      </div>
      <div className="text-muted-foreground text-xs font-['Roboto'] h-4">{ratio ? `→ ${ratio}` : '\u00A0'}</div>
    </div>
  );
}

function SMATab({ rows }: { rows: MediaKpiRow[] }) {
  const kpis = buildKpiData(rows, SMA_KPIS);
  const { data: cellNotesData } = useCellNotes();
  const notesMap = cellNotesData as CellNotesMap;
  const reach = kpis.find((k) => k.kpi_name === 'reach_3s_views')?.latestActual;
  const traffic = kpis.find((k) => k.kpi_name === 'traffic_qualifie_visites_site')?.latestActual;
  const conversions = kpis.find((k) => k.kpi_name === 'conversion_rate')?.latestActual;

  const awarenessToConsid = reach && traffic ? `${((traffic / reach) * 100).toFixed(1)}%` : undefined;
  const considToPurchase = traffic && conversions ? `${conversions.toFixed(1)}%` : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-6">
        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Funnel SMA</h3>
        <div className="flex items-end justify-center gap-0">
          <FunnelStep label="Awareness" value={formatVal(reach, 'reach_3s_views')} color={getChartAccent()} ratio={awarenessToConsid} widthPercent={100} />
          <FunnelStep label="Considération" value={formatVal(traffic, 'traffic_qualifie_visites_site')} color="#38bdf8" ratio={considToPurchase} widthPercent={66} />
          <FunnelStep label="Purchase" value={conversions != null ? `${conversions.toFixed(1)}%` : '—'} color="#22c55e" widthPercent={40} />
        </div>
      </div>
      {kpis[0]?.weeks.length > 1 && (
        <div className="bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 p-4 overflow-x-auto">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Détail par semaine</h3>
          <table className="w-full text-[12px] font-['Roboto'] border-collapse">
            <thead className="sticky top-0 bg-card dark:bg-[hsl(var(--brand-ink))] z-10">
              <tr>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/40">KPI</th>
                {kpis[0].weeks.map((w) => (
                  <th key={w.week} className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/40 min-w-[80px]">{w.week}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpis.map((k, idx) => {
                const obj = k.weeks[k.weeks.length - 1]?.objective;
                return (
                  <tr key={k.kpi_name} className={`border-b border-border/20 transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="py-2.5 px-3 text-foreground font-medium whitespace-nowrap">{KPI_LABELS[k.kpi_name] || k.kpi_name}</td>
                    {k.weeks.map((w) => (
                      <NoteableCell
                        key={w.week}
                        levier="sma"
                        kpiName={k.kpi_name}
                        week={w.week}
                        notesMap={notesMap}
                        levierColor="#38bdf8"
                        className="py-2.5 px-2 text-center text-foreground tabular-nums"
                      >
                        <span className={w.actual != null && obj != null ? (w.actual >= obj ? 'text-[#22c55e]' : w.actual >= obj * 0.8 ? '' : 'text-[#ef4444]') : ''}>
                          {formatVal(w.actual, k.kpi_name)}
                        </span>
                      </NoteableCell>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TikTokTab({ rows }: { rows: MediaKpiRow[] }) {
  const kpis = buildKpiData(rows, TIKTOK_KPIS);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
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
          <div key={i} className="h-20 bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 animate-pulse" />
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
            {tab === 'META' && <SMATab rows={rows} />}
            {tab === 'TikTok' && <TikTokTab rows={rows} />}
          </>
        );
      }}
    </LagostinaSubTabs>
  );
}
