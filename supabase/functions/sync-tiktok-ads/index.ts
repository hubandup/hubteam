// Sync TikTok Ads → lagostina_media_kpis (channel='tiktok')
// Aggregates the last 90 days into monthly KPIs (week='YYYY-MM') matching the
// SEA / SMA pattern. KPIs produced: reach, completion, engagement_rate, cpv, cpc, roas.
//
// Auth:
//  - x-cron-secret header (CRON_SECRET) OR
//  - logged-in admin/team user via Bearer token
//
// Required secrets (set them once TikTok approves the app):
//  - TIKTOK_ACCESS_TOKEN   long-lived token from TikTok Business developer portal
//  - TIKTOK_ADVERTISER_ID  the Lagostina advertiser_id
//
// If either secret is missing the function logs a warning and returns 200 with skipped=true.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const TIKTOK_ACCESS_TOKEN = Deno.env.get('TIKTOK_ACCESS_TOKEN');
const TIKTOK_ADVERTISER_ID = Deno.env.get('TIKTOK_ADVERTISER_ID');

const TIKTOK_API = 'https://business-api.tiktok.com/open_api/v1.3';

async function authorize(req: Request): Promise<{ ok: boolean; reason?: string }> {
  const cron = req.headers.get('x-cron-secret');
  if (cron && CRON_SECRET && cron === CRON_SECRET) return { ok: true };
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { ok: false, reason: 'missing auth' };
  const token = auth.slice(7);
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return { ok: false, reason: 'invalid token' };
  const { data: roles } = await supa.from('user_roles').select('role').eq('user_id', user.id);
  const allowed = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'team');
  return allowed ? { ok: true } : { ok: false, reason: 'forbidden' };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchTikTokDaily(startDate: string, endDate: string) {
  const metrics = [
    'impressions',
    'reach',
    'clicks',
    'spend',
    'video_play_actions',
    'video_views_p100',
    'engagements',
    'conversion',
    'total_purchase_value',
  ];

  const params = new URLSearchParams({
    advertiser_id: TIKTOK_ADVERTISER_ID!,
    report_type: 'BASIC',
    data_level: 'AUCTION_ADVERTISER',
    dimensions: JSON.stringify(['stat_time_day']),
    metrics: JSON.stringify(metrics),
    start_date: startDate,
    end_date: endDate,
    page_size: '1000',
  });

  const url = `${TIKTOK_API}/report/integrated/get/?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      'Access-Token': TIKTOK_ACCESS_TOKEN!,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`TikTok API ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`TikTok API error ${json.code}: ${json.message}`);
  }
  return (json.data?.list ?? []) as any[];
}

function aggregateMonthly(daily: any[]) {
  // accumulate per YYYY-MM
  const buckets = new Map<string, {
    impressions: number; reach: number; clicks: number; spend: number;
    plays: number; completions: number; engagements: number;
    conversion: number; revenue: number;
  }>();

  for (const row of daily) {
    const m = row.metrics ?? {};
    const date: string = row.dimensions?.stat_time_day ?? '';
    if (!date) continue;
    const month = date.slice(0, 7); // YYYY-MM
    const cur = buckets.get(month) ?? {
      impressions: 0, reach: 0, clicks: 0, spend: 0,
      plays: 0, completions: 0, engagements: 0,
      conversion: 0, revenue: 0,
    };
    cur.impressions += Number(m.impressions ?? 0);
    cur.reach += Number(m.reach ?? 0);
    cur.clicks += Number(m.clicks ?? 0);
    cur.spend += Number(m.spend ?? 0);
    cur.plays += Number(m.video_play_actions ?? 0);
    cur.completions += Number(m.video_views_p100 ?? 0);
    cur.engagements += Number(m.engagements ?? 0);
    cur.conversion += Number(m.conversion ?? 0);
    cur.revenue += Number(m.total_purchase_value ?? 0);
    buckets.set(month, cur);
  }
  return buckets;
}

function buildKpiRows(monthly: ReturnType<typeof aggregateMonthly>) {
  const rows: any[] = [];
  for (const [week, m] of monthly) {
    const completion = m.plays > 0 ? (m.completions / m.plays) * 100 : null;
    const engagementRate = m.impressions > 0 ? (m.engagements / m.impressions) * 100 : null;
    const cpv = m.plays > 0 ? m.spend / m.plays : null;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : null;
    const roas = m.spend > 0 ? m.revenue / m.spend : null;

    const push = (kpi_name: string, actual: number | null) => {
      if (actual == null || !isFinite(actual)) return;
      rows.push({ channel: 'tiktok', kpi_name, week, actual });
    };
    push('reach', m.reach || null);
    push('completion', completion);
    push('engagement_rate', engagementRate);
    push('cpv', cpv);
    push('cpc', cpc);
    push('roas', roas);
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authz = await authorize(req);
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: authz.reason }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!TIKTOK_ACCESS_TOKEN || !TIKTOK_ADVERTISER_ID) {
      console.warn('TikTok secrets missing — skipping sync (waiting for app approval)');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'TIKTOK_ACCESS_TOKEN or TIKTOK_ADVERTISER_ID not configured',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Last 90 days window
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const daily = await fetchTikTokDaily(ymd(start), ymd(end));

    const monthly = aggregateMonthly(daily);
    const newRows = buildKpiRows(monthly);

    // Preserve objectives across the wipe-and-reinsert
    const { data: existing } = await admin
      .from('lagostina_media_kpis')
      .select('kpi_name, week, objective')
      .eq('channel', 'tiktok');
    const objMap = new Map<string, number | null>();
    for (const e of existing || []) objMap.set(`${e.kpi_name}::${e.week}`, e.objective);
    for (const r of newRows) {
      const k = `${r.kpi_name}::${r.week}`;
      if (objMap.has(k)) r.objective = objMap.get(k);
    }

    await admin.from('lagostina_media_kpis').delete().eq('channel', 'tiktok');
    if (newRows.length > 0) {
      const { error } = await admin.from('lagostina_media_kpis').insert(newRows);
      if (error) throw new Error(`insert: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      days_fetched: daily.length,
      months_aggregated: monthly.size,
      kpis_inserted: newRows.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('sync-tiktok-ads error', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
