import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const TARGET_URLS = [
  'https://www.hubandup.com/',
  'https://www.hubandup.com/a-propos',
  'https://www.hubandup.com/news',
];

const SUMMARY_PROMPT = `Résume en français le contenu de cette page du site Hub & Up de manière structurée pour servir de contexte à un agent commercial. Extrait :
- Le positionnement et la proposition de valeur (en 2-3 phrases)
- Les offres ou services phares mentionnés (liste courte)
- Les chiffres clés, faits notables, nouveautés (liste)
- Le ton et le vocabulaire distinctif (1 phrase)

Ne rajoute AUCUNE information qui ne soit pas explicitement dans la page. Format : texte structuré, 200 mots maximum.`;

async function firecrawlScrape(apiKey: string, url: string): Promise<{ markdown?: string; error?: string }> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor: 2000 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error || data?.message || `HTTP ${res.status}` };
    const markdown = data.markdown ?? data.data?.markdown;
    if (!markdown) return { error: 'Aucun contenu extrait' };
    return { markdown };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function geminiSummarize(apiKey: string, content: string): Promise<{ summary?: string; error?: string }> {
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: content.slice(0, 30000) },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error?.message || `HTTP ${res.status}` };
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return { error: 'Réponse Gemini vide' };
    return { summary };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');

    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const cronHeader = req.headers.get('x-cron-secret');
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const { data: roleRow } = await admin
        .from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      if (!roleRow || roleRow.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
      }
    }

    const results: any[] = [];
    for (const url of TARGET_URLS) {
      const scrape = await firecrawlScrape(FIRECRAWL_API_KEY, url);
      if (scrape.error || !scrape.markdown) {
        await admin.from('hubandup_context_cache').upsert({
          source_url: url,
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: 'error',
          last_scrape_error: scrape.error || 'Unknown',
        }, { onConflict: 'source_url' });
        results.push({ url, ok: false, error: scrape.error });
        continue;
      }
      const summary = await geminiSummarize(LOVABLE_API_KEY, scrape.markdown);
      if (summary.error || !summary.summary) {
        await admin.from('hubandup_context_cache').upsert({
          source_url: url,
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: 'error',
          last_scrape_error: summary.error || 'Gemini empty',
        }, { onConflict: 'source_url' });
        results.push({ url, ok: false, error: summary.error });
        continue;
      }
      await admin.from('hubandup_context_cache').upsert({
        source_url: url,
        summary: summary.summary,
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: 'success',
        last_scrape_error: null,
      }, { onConflict: 'source_url' });
      results.push({ url, ok: true });
    }

    return new Response(JSON.stringify({ scraped: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('scrape-hubandup-site error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
