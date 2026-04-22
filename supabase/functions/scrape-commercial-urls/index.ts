import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface Payload {
  url_id?: string;       // scrape a single URL (manual)
  tracking_id?: string;  // scrape all URLs of a tracking (manual)
  all?: boolean;         // cron mode: scrape all URLs project-wide (admin or cron only)
}

function isBlockedDomain(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes('linkedin.com')) return 'LinkedIn bloque le scraping automatisé. Consultez la page manuellement.';
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'Facebook bloque le scraping automatisé. Consultez la page manuellement.';
  if (lower.includes('instagram.com')) return 'Instagram bloque le scraping automatisé. Consultez la page manuellement.';
  return null;
}

async function firecrawlScrape(apiKey: string, url: string): Promise<{ markdown?: string; summary?: string; title?: string; error?: string }> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'summary'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.message || `Erreur HTTP ${res.status}`;
      return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
    const markdown = data.markdown ?? data.data?.markdown;
    const summary = data.summary ?? data.data?.summary;
    const title = data.metadata?.title ?? data.data?.metadata?.title;
    if (!markdown && !summary) {
      return { error: 'Aucun contenu extrait (page vide ou bloquée).' };
    }
    return { markdown, summary, title };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');

    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const cronHeader = req.headers.get('x-cron-secret');
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;

    let callerId: string | null = null;
    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      callerId = userData.user?.id || null;
      if (!callerId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const { data: roleRow } = await admin
        .from('user_roles').select('role').eq('user_id', callerId).maybeSingle();
      if (!roleRow || !['admin', 'team'].includes(roleRow.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
    }

    const body = (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as Payload;

    // Build target URL list
    let query = admin.from('commercial_scrape_urls').select('id, url, tracking_id');
    if (body.url_id) query = query.eq('id', body.url_id);
    else if (body.tracking_id) query = query.eq('tracking_id', body.tracking_id);
    else if (!isCron && !body.all) {
      return new Response(JSON.stringify({ error: 'url_id or tracking_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: urls, error: urlsErr } = await query;
    if (urlsErr) throw urlsErr;
    if (!urls || urls.length === 0) {
      return new Response(JSON.stringify({ scraped: 0, results: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];
    for (const u of urls) {
      const blocked = isBlockedDomain(u.url);
      const r = blocked ? { error: blocked } : await firecrawlScrape(FIRECRAWL_API_KEY, u.url);
      const summaryText = r.summary || (r.markdown ? r.markdown.slice(0, 800) : null);
      const update: any = {
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: r.error ? 'failed' : 'success',
        // Stocker la raison de l'échec pour l'afficher dans l'UI
        last_scrape_summary: r.error ? `⚠️ ${r.error}` : summaryText,
        last_scrape_content: r.error ? null : (r.markdown || null),
      };
      await admin.from('commercial_scrape_urls').update(update).eq('id', u.id);
      results.push({ id: u.id, url: u.url, ok: !r.error, error: r.error });
    }

    return new Response(
      JSON.stringify({ scraped: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('scrape-commercial-urls error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
