import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// Hardcoded tab names — the sheet has a fixed structure shared with the user.
const TAB_MONTHLY = 'Synthèse mensuelle';
const TAB_KEYWORDS = 'Top Keywords';
const TAB_CAMPAIGNS = 'Export Ads';

type Row = (string | number | null)[];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const raw = String(v).trim();
  if (!raw) return null;
  // Remove spaces, currency, %
  let s = raw.replace(/[\s\u202f\u00a0€$%]/g, '');
  // If has both comma and dot, assume dot is thousands → remove dots, comma is decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function periodToMonth(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}`;
  const m2 = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, '0')}`;
  const months: Record<string, string> = {
    janvier: '01', janv: '01', jan: '01',
    fevrier: '02', fev: '02', feb: '02',
    mars: '03', mar: '03',
    avril: '04', avr: '04', apr: '04',
    mai: '05', may: '05',
    juin: '06', jun: '06',
    juillet: '07', juil: '07', jul: '07',
    aout: '08', aug: '08',
    septembre: '09', sept: '09', sep: '09',
    octobre: '10', oct: '10',
    novembre: '11', nov: '11',
    decembre: '12', dec: '12',
  };
  const m3 = norm(s).match(/^([a-z]+)\s+(\d{4})$/);
  if (m3 && months[m3[1]]) return `${m3[2]}-${months[m3[1]]}`;
  return null;
}

function parseDate(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // YYYY-MM-DD
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
  // DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return null;
}

async function fetchTab(spreadsheetId: string, tab: string): Promise<Row[]> {
  const range = `${tab}!A1:Z2000`;
  const url = `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': SHEETS_API_KEY!,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sheets ${res.status} on "${tab}": ${txt.slice(0, 300)}`);
  }
  const j = await res.json();
  return (j.values || []) as Row[];
}

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

const METRIC_ROW_KEY: Record<string, string> = {
  impressions: 'impressions',
  clics: 'clicks', clicks: 'clicks',
  ctr: 'ctr', 'taux de clics': 'ctr',
  cpc: 'cpc', 'cpc moyen': 'cpc', 'cpc moy.': 'cpc',
  cout: 'cost', cost: 'cost',
  'budget depense': 'cost',
  budget: 'budget',
  'budget alloue': 'budget',
  conversions: 'conversions', 'conv.': 'conversions',
  'valeur conv.': 'conv_value', 'valeur des conv.': 'conv_value',
  roas: 'roas',
};

async function syncMonthly(admin: any, spreadsheetId: string) {
  const values = await fetchTab(spreadsheetId, TAB_MONTHLY);
  if (values.length < 2) return { inserted: 0 };

  const headers = values[0].map((h) => String(h ?? ''));
  // De-duplicate columns: keep first occurrence of each "YYYY-MM"
  const periodCols: { col: number; week: string }[] = [];
  const seen = new Set<string>();
  for (let c = 1; c < headers.length; c++) {
    const w = periodToMonth(headers[c]);
    if (w && !seen.has(w)) {
      periodCols.push({ col: c, week: w });
      seen.add(w);
    }
  }
  if (periodCols.length === 0) throw new Error('No period columns found in Synthèse mensuelle');

  const perPeriod: Record<string, Record<string, number | null>> = {};
  for (const { week } of periodCols) perPeriod[week] = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.length === 0) continue;
    const metricRaw = norm(String(row[0] ?? '')).replace(/\s*\([^)]*\)\s*/g, '').trim();
    const key = METRIC_ROW_KEY[metricRaw];
    if (!key) continue;
    for (const { col, week } of periodCols) {
      const v = parseNum(row[col]);
      if (v != null) perPeriod[week][key] = v;
    }
  }

  const rowsToInsert: any[] = [];
  for (const week of Object.keys(perPeriod)) {
    const m = perPeriod[week];
    const impressions = m.impressions ?? null;
    const clicks = m.clicks ?? null;
    let ctr = m.ctr ?? null;
    let cpc = m.cpc ?? null;
    const cost = m.cost ?? null;
    const budget = m.budget ?? null;
    const conversions = m.conversions ?? null;
    const convValue = m.conv_value ?? null;
    let roas = m.roas ?? null;
    if (ctr == null && impressions && clicks) ctr = (clicks / impressions) * 100;
    if (cpc == null && clicks && cost) cpc = cost / clicks;
    if (roas == null && cost && convValue) roas = convValue / cost;

    const channel = 'sea';
    const push = (kpi_name: string, actual: number | null) => {
      if (actual == null) return;
      rowsToInsert.push({ channel, kpi_name, week, actual });
    };
    push('impressions', impressions);
    push('conversions', conversions);
    push('ctr', ctr);
    push('cpc_moyen', cpc);
    push('roas', roas);
    if (cost != null || budget != null) {
      const ratio = budget && cost ? cost / budget : null;
      rowsToInsert.push({
        channel, kpi_name: 'budget_ratio', week,
        actual: ratio, budget_spent: cost, budget_allocated: budget,
      });
    }
  }

  // Preserve objectives across the wipe-and-reinsert
  const { data: existing } = await admin
    .from('lagostina_media_kpis')
    .select('kpi_name, week, objective')
    .eq('channel', 'sea');
  const objMap = new Map<string, number | null>();
  for (const e of existing || []) objMap.set(`${e.kpi_name}::${e.week}`, e.objective);
  for (const r of rowsToInsert) {
    const key = `${r.kpi_name}::${r.week}`;
    if (objMap.has(key)) r.objective = objMap.get(key);
  }

  await admin.from('lagostina_media_kpis').delete().eq('channel', 'sea');
  if (rowsToInsert.length > 0) {
    const { error } = await admin.from('lagostina_media_kpis').insert(rowsToInsert);
    if (error) throw new Error(`media_kpis insert: ${error.message}`);
  }
  return { inserted: rowsToInsert.length };
}

async function syncTopKeywords(admin: any, spreadsheetId: string) {
  const values = await fetchTab(spreadsheetId, TAB_KEYWORDS);
  if (values.length < 2) return { inserted: 0 };

  const headers = values[0].map((h) => norm(String(h ?? '')).replace(/\s*\([^)]*\)\s*/g, '').trim());
  const idxOf = (...names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const cKeyword = idxOf('mot-cle', 'mot cle', 'keyword');
  const cImpressions = idxOf('impressions');
  const cClicks = idxOf('clics', 'clicks');
  const cCtr = idxOf('ctr');
  const cCpc = idxOf('cpc');
  const cConv = idxOf('conversions', 'conv.');
  const cCost = idxOf('budget depense', 'cout', 'cost');
  if (cKeyword < 0) throw new Error('Top Keywords: missing "Mot-clé" column');

  const rows: any[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || !row[cKeyword]) continue;
    const keyword = String(row[cKeyword]).trim();
    if (!keyword) continue;
    const clicks = cClicks >= 0 ? parseNum(row[cClicks]) : null;
    const cost = cCost >= 0 ? parseNum(row[cCost]) : null;
    const conv = cConv >= 0 ? parseNum(row[cConv]) : null;
    rows.push({
      keyword,
      impressions: cImpressions >= 0 ? parseNum(row[cImpressions]) : null,
      clicks: clicks != null ? Math.round(clicks) : null,
      ctr: cCtr >= 0 ? parseNum(row[cCtr]) : null,
      cpc: cCpc >= 0 ? parseNum(row[cCpc]) : null,
      conversions: conv != null ? Math.round(conv) : null,
      cost,
    });
  }

  await admin.from('lagostina_top_keywords').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (rows.length > 0) {
    const { error } = await admin.from('lagostina_top_keywords').insert(rows);
    if (error) throw new Error(`top_keywords insert: ${error.message}`);
  }
  return { inserted: rows.length };
}

async function syncCampaigns(admin: any, spreadsheetId: string) {
  const values = await fetchTab(spreadsheetId, TAB_CAMPAIGNS);
  if (values.length < 2) return { inserted: 0 };

  const headers = values[0].map((h) => norm(String(h ?? '')).replace(/\s*\([^)]*\)\s*/g, '').trim());
  const idxOf = (...names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const cDate = idxOf('date');
  const cCampaign = idxOf('campagne', 'campaign');
  const cRoas = idxOf('roas');
  const cCpc = idxOf('cpc');
  const cCtr = idxOf('ctr');
  const cImpr = idxOf('impressions');
  const cConv = idxOf('conversions');
  const cSpent = idxOf('budget depense', 'budget depense /j', 'budget depense/j');
  const cAlloc = idxOf('budget alloue', 'budget alloue /j', 'budget alloue/j');
  if (cDate < 0 || cCampaign < 0) throw new Error('Export Ads: missing Date or Campagne column');

  const rows: any[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.length === 0) continue;
    const date = parseDate(row[cDate]);
    const campaign = row[cCampaign] ? String(row[cCampaign]).trim() : '';
    if (!date || !campaign) continue;
    rows.push({
      date,
      campaign,
      roas: cRoas >= 0 ? parseNum(row[cRoas]) : null,
      cpc: cCpc >= 0 ? parseNum(row[cCpc]) : null,
      ctr: cCtr >= 0 ? parseNum(row[cCtr]) : null,
      impressions: cImpr >= 0 ? (parseNum(row[cImpr]) ?? null) : null,
      conversions: cConv >= 0 ? parseNum(row[cConv]) : null,
      budget_spent: cSpent >= 0 ? parseNum(row[cSpent]) : null,
      budget_allocated: cAlloc >= 0 ? parseNum(row[cAlloc]) : null,
    });
  }
  // ensure integer for impressions
  for (const r of rows) if (r.impressions != null) r.impressions = Math.round(r.impressions);

  await admin.from('lagostina_sea_campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (rows.length > 0) {
    // chunked insert to be safe
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin.from('lagostina_sea_campaigns').insert(chunk);
      if (error) throw new Error(`sea_campaigns insert: ${error.message}`);
    }
  }
  return { inserted: rows.length };
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
    if (!LOVABLE_API_KEY || !SHEETS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Google Sheets connector not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: cfg } = await admin
      .from('lagostina_google_ads_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ error: 'No Google Ads config found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, any> = {};
    try {
      results.monthly = await syncMonthly(admin, cfg.spreadsheet_id);
      results.keywords = await syncTopKeywords(admin, cfg.spreadsheet_id);
      results.campaigns = await syncCampaigns(admin, cfg.spreadsheet_id);
    } catch (e: any) {
      await admin.from('lagostina_google_ads_config').update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_sync_error: e.message?.slice(0, 500) || String(e),
      }).eq('id', cfg.id);
      return new Response(JSON.stringify({ error: e.message, partial: results }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('lagostina_google_ads_config').update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_error: null,
    }).eq('id', cfg.id);

    const total =
      (results.monthly?.inserted ?? 0) +
      (results.keywords?.inserted ?? 0) +
      (results.campaigns?.inserted ?? 0);

    return new Response(JSON.stringify({
      success: true,
      kpis_inserted: total,
      details: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
