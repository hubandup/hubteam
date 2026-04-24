import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FEED_URL = 'https://www.google.com/alerts/feeds/12045769950068591508/6452944568939543208';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

interface AlertEntry {
  title: string;
  link: string;
  published: string | null;
  summary: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '\"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function extractGoogleAlertLink(rawLink: string): string {
  // Google Alerts wraps URLs in https://www.google.com/url?...&url=REAL_URL&...
  try {
    const u = new URL(rawLink);
    const inner = u.searchParams.get('url');
    return inner || rawLink;
  } catch {
    return rawLink;
  }
}

function parseAtomFeed(xml: string): AlertEntry[] {
  const entries: AlertEntry[] = [];
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null) {
    const block = m[1];
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
    const publishedMatch = block.match(/<published[^>]*>([\s\S]*?)<\/published>/);
    const summaryMatch = block.match(/<content[^>]*>([\s\S]*?)<\/content>/) || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);

    entries.push({
      title: titleMatch ? stripTags(titleMatch[1]) : '',
      link: linkMatch ? extractGoogleAlertLink(linkMatch[1]) : '',
      published: publishedMatch ? publishedMatch[1].trim() : null,
      summary: summaryMatch ? stripTags(summaryMatch[1]).slice(0, 500) : '',
    });
  }
  return entries;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const CRON_SECRET = Deno.env.get('CRON_SECRET');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const cronHeader = req.headers.get('x-cron-secret');
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1';

    // Auth (any logged-in user can read)
    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    }

    // Check cache
    const { data: cached } = await admin
      .from('google_alerts_cache')
      .select('*')
      .eq('feed_url', FEED_URL)
      .maybeSingle();

    if (!force && cached && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS && cached.fetch_status === 'success') {
        return new Response(JSON.stringify({
          cached: true, fetched_at: cached.fetched_at, entries: cached.entries || [],
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Fetch RSS
    let entries: AlertEntry[] = [];
    let status = 'success';
    let errorMsg: string | null = null;
    try {
      const resp = await fetch(FEED_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HubAndUpBot/1.0)' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      entries = parseAtomFeed(xml);
    } catch (e) {
      status = 'error';
      errorMsg = (e as Error).message;
      // Keep previous entries on failure
      entries = (cached?.entries as AlertEntry[]) || [];
    }

    await admin.from('google_alerts_cache').upsert({
      feed_url: FEED_URL,
      entries: entries as any,
      fetched_at: new Date().toISOString(),
      fetch_status: status,
      fetch_error: errorMsg,
    }, { onConflict: 'feed_url' });

    return new Response(JSON.stringify({
      cached: false, fetched_at: new Date().toISOString(), entries, status, error: errorMsg,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('fetch-google-alerts error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
