import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const SUB_TABS = ['SEA', 'SMA', 'TikTok'] as const;
type SubTab = typeof SUB_TABS[number];

const CHANNEL_MAP: Record<SubTab, string> = { SEA: 'sea', SMA: 'sma', TikTok: 'tiktok' };

const SEA_KPIS = ['roas', 'cpc', 'ctr', 'impressions', 'conversions', 'budget_ratio'];
const SMA_KPIS = ['reach', 'completion', 'traffic', 'cpm', 'cpv', 'cpc', 'conversion_rate', 'roas'];
const TIKTOK_KPIS = ['reach', 'completion', 'engagement_rate', 'cpv', 'cpc', 'roas'];

const KPI_LABELS: Record<string, string> = {
  roas: 'ROAS', cpc: 'CPC', ctr: 'CTR', impressions: 'Impressions', conversions: 'Conversions',
  budget_ratio: 'Budget dépensé / alloué', reach: 'Reach 3s', completion: 'Complétion vidéo',
  traffic: 'Traffic qualifié', cpm: 'CPM', cpv: 'CPV', conversion_rate: 'Taux conversion',
  engagement_rate: 'Engagement rate', followers_evol: 'Évol. followers',
};

function getCondColor(actual: number | null, objective: number | null) {
  if (!actual || !objective) return '';
  const ratio = actual / objective;
  if (ratio >= 1) return 'border-[#22c55e]';
  if (ratio >= 0.8) return 'border-black';
  return 'border-[#ef4444]';
}

function formatVal(val: number | null | undefined, kpi: string): string {
  if (val == null) return '—';
  if (['ctr', 'engagement_rate', 'conversion_rate', 'completion'].includes(kpi)) return `${(val * 100).toFixed(1)}%`;
  if (['roas'].includes(kpi)) return val.toFixed(2);
  if (['cpc', 'cpm', 'cpv'].includes(kpi)) return `€${val.toFixed(2)}`;
  if (['impressions', 'reach', 'conversions', 'traffic'].includes(kpi)) {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toFixed(0);
  }
  return String(val);
}

const chartTooltipStyle = {
  contentStyle: { background: '#0f1422', border: '1px solid #E8FF4C', borderRadius: 0, fontSize: 12, fontFamily: 'Roboto' },
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
    const kpiRows = rows.filter((r: any) => r.kpi_name === kpi).sort((a: any, b: any) => a.week.localeCompare(b.week));
    const weeks = kpiRows.map((r: any) => ({ week: r.week, actual: r.actual, objective: r.objective }));
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
  return (
    <div className={`bg-white border border-border/30 border-l-[3px] ${cond || 'border-black'} p-4 flex flex-col gap-1`}>
      <div className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider">{KPI_LABELS[data.kpi_name] || data.kpi_name}</div>
      <div className="text-foreground text-xl font-bold font-['Instrument_Sans']">{formatVal(data.latestActual, data.kpi_name)}</div>
      {data.latestObjective != null && (
        <div className="text-muted-foreground text-[10px] font-['Roboto']">Obj: {formatVal(data.latestObjective, data.kpi_name)}</div>
      )}
      {data.trend && (
        <div className={`flex items-center gap-1 text-[10px] ${data.trend === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {data.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {data.trend === 'up' ? 'Hausse' : 'Baisse'} w/w
        </div>
      )}
      {data.weeks.length > 1 && (
        <div className="h-8 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeks}>
              <Line type="monotone" dataKey="actual" stroke="#E8FF4C" strokeWidth={1.5} dot={false} />
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      {roasData && roasData.weeks.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-border/30 p-4">
            <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Évolution ROAS</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={roasData.weeks}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'Roboto' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'Roboto' }} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="actual" stroke="#E8FF4C" strokeWidth={2} dot={false} name="Actuals" />
                <Line type="monotone" dataKey="objective" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Objectifs" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border border-border/30 p-4 flex items-center justify-center">
            <div className="text-muted-foreground text-sm font-['Roboto']">Top keywords — données non disponibles</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelStep({ label, value, color, ratio }: { label: string; value: string; color: string; ratio?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="text-muted-foreground text-[10px] font-['Roboto'] uppercase tracking-wider">{label}</div>
      <div className="w-full py-6 flex items-center justify-center" style={{ background: color }}>
        <span className="text-black text-lg font-bold font-['Instrument_Sans']">{value}</span>
      </div>
      {ratio && <div className="text-muted-foreground text-[10px] font-['Roboto']">→ {ratio}</div>}
    </div>
  );
}

function SMATab({ rows }: { rows: any[] }) {
  const kpis = buildKpiData(rows, SMA_KPIS);
  const reach = kpis.find((k) => k.kpi_name === 'reach')?.latestActual;
  const traffic = kpis.find((k) => k.kpi_name === 'traffic')?.latestActual;
  const conversions = kpis.find((k) => k.kpi_name === 'conversion_rate')?.latestActual;

  const awarenessToConsid = reach && traffic ? `${((traffic / reach) * 100).toFixed(1)}%` : undefined;
  const considToPurchase = traffic && conversions ? `${(conversions * 100).toFixed(1)}%` : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      <div className="bg-white border border-border/30 p-6">
        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-4">Funnel SMA</h3>
        <div className="flex gap-2 items-end">
          <FunnelStep label="Awareness" value={formatVal(reach, 'reach')} color="#E8FF4C" ratio={awarenessToConsid} />
          <FunnelStep label="Considération" value={formatVal(traffic, 'traffic')} color="#38bdf8" ratio={considToPurchase} />
          <FunnelStep label="Purchase" value={conversions != null ? `${(conversions * 100).toFixed(1)}%` : '—'} color="#22c55e" />
        </div>
      </div>
      {kpis[0]?.weeks.length > 1 && (
        <div className="bg-white border border-border/30 p-4 overflow-x-auto">
          <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Détail par semaine</h3>
          <table className="w-full text-[11px] font-['Roboto']">
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
                  <td className="py-2 px-2 text-foreground" rowSpan={1}>{KPI_LABELS[k.kpi_name]}</td>
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
  const followersData = rows
    .filter((r: any) => r.kpi_name === 'followers_evol')
    .sort((a: any, b: any) => a.week.localeCompare(b.week))
    .map((r: any) => ({ week: r.week, value: r.actual }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => <KpiCard key={k.kpi_name} data={k} />)}
      </div>
      {followersData.length > 1 && (
        <div className="bg-white border border-border/30 p-4">
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
      <div className="bg-white border border-border/30 p-4">
        <h3 className="text-foreground text-sm font-['Instrument_Sans'] font-bold mb-3">Top Creatives</h3>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 p-3">
              <div className="aspect-video bg-white flex items-center justify-center mb-2">
                <span className="text-muted-foreground text-xs font-['Roboto']">Creative #{i}</span>
              </div>
              <div className="text-muted-foreground text-[10px] font-['Roboto']">Données non disponibles</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LagostinaMediatisation() {
  const [subTab, setSubTab] = useState<SubTab>('SEA');

  const { data: mediaKpis, isLoading } = useQuery({
    queryKey: ['lagostina-media-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lagostina_media_kpis').select('*');
      if (error) throw error;
      return data;
    },
  });

  const channelRows = (mediaKpis || []).filter((r) => r.channel === CHANNEL_MAP[subTab]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-white border border-border/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-0 border-b border-border/40">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-['Roboto'] border-b-2 transition-colors ${
              subTab === t ? 'text-black font-semibold border-black font-medium' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {channelRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Clock className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground font-['Roboto'] text-sm">Données non disponibles — en attente d'import</p>
        </div>
      ) : (
        <>
          {subTab === 'SEA' && <SEATab rows={channelRows} />}
          {subTab === 'SMA' && <SMATab rows={channelRows} />}
          {subTab === 'TikTok' && <TikTokTab rows={channelRows} />}
        </>
      )}
    </div>
  );
}
