import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

type Row = (string | number | null)[];

const HEADER_ALIASES: Record<string, string[]> = {
  period: ['mois', 'month', 'période', 'periode', 'date', 'segment'],
  impressions: ['impressions', 'impr.', 'impr'],
  clicks: ['clics', 'clicks', 'clic'],
  ctr: ['ctr', 'taux de clics'],
  cpc: ['cpc moy.', 'cpc moyen', 'cpc', 'avg. cpc', 'coût par clic'],
  cost: ['coût', 'cost', 'cout', 'depense', 'dépense', 'spend', 'budget dépensé', 'budget depense'],
  budget: ['budget', 'budget alloué', 'budget alloue', 'budget journalier'],
  conversions: ['conversions', 'conv.', 'conv'],
  conv_value: ['valeur conv.', 'valeur des conv.', 'conv. value', 'conversion value', 'valeur de conversion'],
  roas: ['roas', 'retour sur dépenses publicitaires'],
};

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[\s\u202f\u00a0€$%]/g, '').replace(/\./g, '').replace(',', '.');
  // try also dot decimal fallback if comma-thousands
  const n = Number(s);
  if (!isNaN(n)) return n;
  const n2 = Number(String(v).replace(/[\s\u202f\u00a0€$%,]/g, ''));
  return isNaN(n2) ? null : n2;
}

function mapHeaders(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  const normalized = headers.map((h) => norm(String(h || '')));
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const i = normalized.indexOf(norm(alias));
      if (i >= 0) { idx[key] = i; break; }
    }
  }
  return idx;
}

function periodToWeek(raw: unknown): string {
  if (raw == null) return 'TOTAL';
  const s = String(raw).trim();
  if (!s || /total/i.test(s)) return 'TOTAL';
  // YYYY-MM
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}`;
  // MM/YYYY or MM-YYYY
  const m2 = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, '0')}`;
  // "avril 2025"
  const months: Record<string, string> = {
    janvier: '01', janv: '01', january: '01', jan: '01',
    fevrier: '02', fev: '02', february: '02', feb: '02',
    mars: '03', march: '03', mar: '03',
    avril: '04', avr: '04', april: '04', apr: '04',
    mai: '05', may: '05',
    juin: '06', june: '06', jun: '06',
    juillet: '07', juil: '07', july: '07', jul: '07',
    aout: '08', août: '08', august: '08', aug: '08',
    septembre: '09', sept: '09', september: '09', sep: '09',
    octobre: '10', oct: '10', october: '10',
    novembre: '11', nov: '11', november: '11',
    decembre: '12', dec: '12', december: '12',
  };
  const m3 = norm(s).match(/^([a-zûéè]+)\s+(\d{4})$/);
  if (m3 && months[m3[1]]) return `${m3[2]}-${months[m3[1]]}`;
  return s; // fallback raw
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

    const { data: cfg, error: cfgErr } = await admin
      .from('lagostina_google_ads_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cfgErr || !cfg) {
      return new Response(JSON.stringify({ error: 'No Google Ads config found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const range = `${cfg.sheet_name}!${cfg.cell_range}`;
    const url = `${GATEWAY_URL}/spreadsheets/${cfg.spreadsheet_id}/values/${range}`;

    const gRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SHEETS_API_KEY,
      },
    });
    if (!gRes.ok) {
      const txt = await gRes.text();
      await admin.from('lagostina_google_ads_config').update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_sync_error: `Sheets ${gRes.status}: ${txt.slice(0, 500)}`,
      }).eq('id', cfg.id);
      return new Response(JSON.stringify({ error: 'Sheets fetch failed', detail: txt }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const payload = await gRes.json();
    const values: Row[] = payload.values || [];
    if (values.length < 2) {
      return new Response(JSON.stringify({ error: 'Sheet is empty or no data rows' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = values[0].map((h) => String(h ?? ''));
    const idx = mapHeaders(headers);

    // Debug mode: return raw sheet structure
    const url2 = new URL(req.url);
    if (url2.searchParams.get('debug') === '1') {
      const metricLabels = values.slice(1).map((r) => String(r?.[0] ?? ''));
      return new Response(JSON.stringify({ headers, metricLabels, sampleRows: values.slice(0, 8) }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Detect pivoted layout: metrics in rows, periods in columns.
    const periodCols: { col: number; week: string }[] = [];
    if (idx.period == null) {
      for (let c = 1; c < headers.length; c++) {
        const w = periodToWeek(headers[c]);
        if (w && (w === 'TOTAL' || /^\d{4}-\d{2}$/.test(w))) {
          periodCols.push({ col: c, week: w });
        }
      }
    }

    const METRIC_ROW_KEY: Record<string, string> = {
      impressions: 'impressions', 'impr.': 'impressions', impr: 'impressions',
      clics: 'clicks', clicks: 'clicks', clic: 'clicks',
      ctr: 'ctr', 'taux de clics': 'ctr',
      cpc: 'cpc', 'cpc moy.': 'cpc', 'cpc moyen': 'cpc', 'coût par clic': 'cpc', 'cout par clic': 'cpc',
      cout: 'cost', 'coût': 'cost', cost: 'cost', depense: 'cost', 'dépense': 'cost',
      'budget dépensé': 'cost', 'budget depense': 'cost',
      budget: 'budget', 'budget alloué': 'budget', 'budget alloue': 'budget',
      conversions: 'conversions', 'conv.': 'conversions', conv: 'conversions',
      'valeur conv.': 'conv_value', 'valeur des conv.': 'conv_value',
      'conversion value': 'conv_value', 'valeur de conversion': 'conv_value',
      roas: 'roas',
    };

    const rowsToInsert: any[] = [];
    let parsed = 0;

    const buildRows = (week: string, m: Record<string, number | null>) => {
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
    };

    if (idx.period == null && periodCols.length > 0) {
      // PIVOTED layout: rows = metrics, cols = periods
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
      for (const week of Object.keys(perPeriod)) {
        buildRows(week, perPeriod[week]);
        parsed++;
      }
    } else {
      if (idx.period == null) {
        return new Response(JSON.stringify({ error: 'Period column not found', headers }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        if (!row || row.length === 0) continue;
        const week = periodToWeek(row[idx.period]);
        if (!week) continue;
        const m: Record<string, number | null> = {
          impressions: idx.impressions != null ? parseNum(row[idx.impressions]) : null,
          clicks: idx.clicks != null ? parseNum(row[idx.clicks]) : null,
          ctr: idx.ctr != null ? parseNum(row[idx.ctr]) : null,
          cpc: idx.cpc != null ? parseNum(row[idx.cpc]) : null,
          cost: idx.cost != null ? parseNum(row[idx.cost]) : null,
          budget: idx.budget != null ? parseNum(row[idx.budget]) : null,
          conversions: idx.conversions != null ? parseNum(row[idx.conversions]) : null,
          conv_value: idx.conv_value != null ? parseNum(row[idx.conv_value]) : null,
          roas: idx.roas != null ? parseNum(row[idx.roas]) : null,
        };
        buildRows(week, m);
        parsed++;
      }
    }

    // Wipe previous SEA rows (channel='sea') and re-insert, but preserve objectives
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
      const { error: insErr } = await admin.from('lagostina_media_kpis').insert(rowsToInsert);
      if (insErr) {
        await admin.from('lagostina_google_ads_config').update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: 'error',
          last_sync_error: insErr.message,
        }).eq('id', cfg.id);
        return new Response(JSON.stringify({ error: 'Insert failed', detail: insErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    await admin.from('lagostina_google_ads_config').update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_error: null,
    }).eq('id', cfg.id);

    return new Response(JSON.stringify({
      success: true, rows_parsed: parsed, kpis_inserted: rowsToInsert.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
