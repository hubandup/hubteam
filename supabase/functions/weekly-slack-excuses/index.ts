import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SLACK_CHANNEL = '#hubteam_sales';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const HUBANDUP_BASE = 'https://www.hubandup.com';
const HUBANDUP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// ----- Firecrawl helpers -----
async function firecrawlScrape(url: string): Promise<{ markdown: string; title?: string } | null> {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      console.warn(`[firecrawl] scrape failed ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    const markdown: string = data?.data?.markdown ?? data?.markdown ?? '';
    const title: string | undefined = data?.data?.metadata?.title ?? data?.metadata?.title;
    if (!markdown) return null;
    return { markdown: markdown.slice(0, 8000), title };
  } catch (e) {
    console.warn('[firecrawl] error', url, e);
    return null;
  }
}

async function firecrawlMap(url: string, limit = 25): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/map', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, limit }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rawLinks: any[] = data?.links ?? data?.data?.links ?? [];
    const links: string[] = rawLinks
      .map((l) => (typeof l === 'string' ? l : l?.url ?? l?.href ?? ''))
      .filter((l) => typeof l === 'string' && l.length > 0);
    return links;
  } catch {
    return [];
  }
}

// ----- Hub & Up cache -----
async function getHubAndUpContext(supabase: any): Promise<string> {
  const cutoff = new Date(Date.now() - HUBANDUP_CACHE_TTL_MS).toISOString();
  const { data: fresh } = await supabase
    .from('hubandup_site_cache')
    .select('url, title, content')
    .gte('scraped_at', cutoff);

  if (fresh && fresh.length > 0) {
    console.log(`[hubandup-cache] using ${fresh.length} cached pages`);
    return fresh.map((p: any) => `# ${p.title ?? p.url}\n${p.content}`).join('\n\n---\n\n');
  }

  console.log('[hubandup-cache] cache stale, refreshing…');
  // Map then scrape up to 8 most relevant pages
  let urls = await firecrawlMap(HUBANDUP_BASE, 30);
  urls = urls
    .map((u: unknown) => (typeof u === 'string' ? u : ''))
    .filter((u) => u.length > 0);

  if (urls.length === 0) urls = [HUBANDUP_BASE];
  // Prefer key pages
  const priority = urls
    .filter((u) => typeof u === 'string' && u.startsWith(HUBANDUP_BASE))
    .sort((a, b) => a.length - b.length)
    .slice(0, 8);

  const results: { url: string; title?: string; content: string }[] = [];
  for (const u of priority) {
    const scraped = await firecrawlScrape(u);
    if (scraped?.markdown) {
      results.push({ url: u, title: scraped.title, content: scraped.markdown });
    }
  }

  if (results.length > 0) {
    // Wipe & repopulate
    await supabase.from('hubandup_site_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('hubandup_site_cache').insert(results);
  }

  return results.map((p) => `# ${p.title ?? p.url}\n${p.content}`).join('\n\n---\n\n');
}

// ----- Per-target processing -----
type TargetData = {
  client_id: string;
  client_company: string;
  tracking_id: string;
  notes: string[];
  scraped_urls: { url: string; label: string | null; content: string }[];
  client_info: Record<string, any>;
  projects: Record<string, any>[];
};

async function loadTargets(supabase: any): Promise<TargetData[]> {
  const { data: targets } = await supabase
    .from('client_targets')
    .select('client_id, clients!inner(*, activity_sectors(name), client_statuses(name), client_sources(name))');

  if (!targets) return [];

  const out: TargetData[] = [];
  for (const t of targets as any[]) {
    const client_id = t.client_id;
    const clientFull = t.clients;
    const client_company = clientFull.company;

    const { data: tracking } = await supabase
      .from('commercial_tracking')
      .select('id, status')
      .eq('client_id', client_id)
      .maybeSingle();

    if (!tracking) continue;

    const { data: notes } = await supabase
      .from('commercial_notes')
      .select('content, created_at')
      .eq('tracking_id', tracking.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: urls } = await supabase
      .from('commercial_scrape_urls')
      .select('url, label')
      .eq('tracking_id', tracking.id);

    // Projets associés
    const { data: projectLinks } = await supabase
      .from('project_clients')
      .select('project_id, projects(*)')
      .eq('client_id', client_id);
    const projects = (projectLinks ?? [])
      .map((pl: any) => pl.projects)
      .filter(Boolean);

    const noteContents = (notes ?? []).map((n: any) => n.content as string);
    const scrapedUrls: { url: string; label: string | null; content: string }[] = [];

    for (const u of (urls ?? []) as any[]) {
      const scraped = await firecrawlScrape(u.url);
      if (scraped?.markdown) {
        scrapedUrls.push({ url: u.url, label: u.label, content: scraped.markdown });
      }
    }

    if (noteContents.length === 0 && scrapedUrls.length === 0) {
      console.log(`[targets] skip ${client_company} (no notes & no scraped URLs)`);
      continue;
    }

    // Construire un objet "client_info" allégé/lisible
    const client_info = {
      company: clientFull.company,
      contact: [clientFull.first_name, clientFull.last_name].filter(Boolean).join(' '),
      email: clientFull.email,
      phone: clientFull.phone,
      address: clientFull.address,
      kanban_stage: clientFull.kanban_stage,
      action: clientFull.action,
      follow_up_date: clientFull.follow_up_date,
      last_contact: clientFull.last_contact,
      revenue_current_year: clientFull.revenue_current_year,
      revenue_total: clientFull.revenue,
      activity_sector: clientFull.activity_sectors?.name,
      status: clientFull.client_statuses?.name,
      source: clientFull.client_sources?.name,
      commercial_status: tracking.status,
    };

    out.push({
      client_id,
      client_company,
      tracking_id: tracking.id,
      notes: noteContents,
      scraped_urls: scrapedUrls,
      client_info,
      projects,
    });
  }
  return out;
}

// ----- AI generation -----
async function generateRelanceIdeas(target: TargetData, hubandupContext: string): Promise<string[]> {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

  const notesBlock = target.notes.length
    ? target.notes.map((n, i) => `CR ${i + 1}:\n${n.slice(0, 2000)}`).join('\n\n')
    : '(aucun compte rendu)';

  const urlsBlock = target.scraped_urls.length
    ? target.scraped_urls
        .map((u) => `Source: ${u.label ?? u.url} (${u.url})\n${u.content.slice(0, 3000)}`)
        .join('\n\n---\n\n')
    : '(aucune URL scrapée)';

  const clientInfoBlock = JSON.stringify(target.client_info, null, 2);

  const projectsBlock = target.projects.length
    ? target.projects
        .map((p, i) => {
          const lines = [
            `Projet ${i + 1}: ${p.name ?? '(sans nom)'}`,
            p.status ? `  Statut: ${p.status}` : null,
            p.start_date || p.end_date ? `  Période: ${p.start_date ?? '?'} → ${p.end_date ?? '?'}` : null,
            p.archived ? '  (archivé)' : null,
            p.description ? `  Description: ${String(p.description).slice(0, 600)}` : null,
          ].filter(Boolean);
          return lines.join('\n');
        })
        .join('\n\n')
    : '(aucun projet associé)';

  const prompt = `Tu es un consultant senior chez Hub & Up, agence de communication. Génère 3 idées de relance commerciale ULTRA-CIBLÉES pour le client "${target.client_company}".

## Fiche client (informations générales)
${clientInfoBlock}

## Projets associés
${projectsBlock}

## Derniers comptes rendus de Suivi Commercial
${notesBlock}

## Veille (URLs surveillées)
${urlsBlock}

## Offre Hub & Up (extraits du site)
${hubandupContext.slice(0, 6000)}

## Règles de sortie
- Exactement 3 idées de relance, une par ligne
- Chaque idée fait 1 phrase concrète (max 30 mots)
- Doit faire le lien explicite entre un signal client (fiche, projet, CR ou veille) et une expertise Hub & Up
- Pas de numérotation, pas de tirets, pas de guillemets
- Pas d'introduction ni conclusion
- Ton professionnel, actionnable, en français`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Tu génères des idées de relance commerciale précises, sourcées et actionnables.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI Gateway error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? '';
  return raw
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*\d.\)]+/, '').replace(/^["«»“”]/, '').replace(/["«»“”]$/, '').trim())
    .filter((l) => l.length > 10)
    .slice(0, 3);
}

// ----- Slack -----
async function postTargetToSlack(target: TargetData, ideas: string[]): Promise<{ ok: true } | { ok: false; error: string; hint?: string }> {
  if (!SLACK_BOT_TOKEN) return { ok: false, error: 'SLACK_BOT_TOKEN missing' };

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🎯 Idées de relance — ${target.client_company}`, emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Basé sur ${target.notes.length} CR + ${target.scraped_urls.length} URL(s) surveillée(s) + fiche client & ${target.projects.length} projet(s)_` }],
    },
    { type: 'divider' },
    ...ideas.map((idea, i) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${i + 1}.* ${idea}` },
    })),
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🤖 Suggestions Hub Team' }],
    },
  ];

  const text = `🎯 Idées de relance — ${target.client_company}\n${ideas.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: SLACK_CHANNEL, text, blocks }),
  });

  const json = await res.json();
  if (!json.ok) {
    const code = json.error || 'unknown';
    const hints: Record<string, string> = {
      channel_not_found: `Le bot Slack n'a pas accès au canal ${SLACK_CHANNEL}. Invitez-le avec /invite @NomDuBot.`,
      not_in_channel: `Le bot Slack n'est pas membre du canal ${SLACK_CHANNEL}.`,
      invalid_auth: 'Token Slack invalide ou expiré.',
      missing_scope: "Le bot Slack n'a pas les permissions (chat:write requis).",
    };
    return { ok: false, error: code, hint: hints[code] || `Erreur Slack : ${code}` };
  }
  return { ok: true };
}

// ----- Main -----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth: cron secret OR authenticated admin/team
    const cronHeader = req.headers.get('x-cron-secret');
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const allowed = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'team');
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY missing — connectez Firecrawl.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[relances] loading targets…');
    const targets = await loadTargets(supabase);
    console.log(`[relances] ${targets.length} eligible target(s)`);

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Aucun client Target éligible (ni CR ni URL).', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hubandupContext = await getHubAndUpContext(supabase);
    console.log(`[relances] hubandup context: ${hubandupContext.length} chars`);

    const results: { client: string; status: 'sent' | 'error'; error?: string; ideas?: string[] }[] = [];

    for (const t of targets) {
      try {
        const ideas = await generateRelanceIdeas(t, hubandupContext);
        if (ideas.length === 0) {
          results.push({ client: t.client_company, status: 'error', error: 'AI returned no ideas' });
          continue;
        }
        const slackRes = await postTargetToSlack(t, ideas);
        if (slackRes.ok) {
          results.push({ client: t.client_company, status: 'sent', ideas });
        } else {
          results.push({ client: t.client_company, status: 'error', error: `${slackRes.error}${slackRes.hint ? ' — ' + slackRes.hint : ''}` });
        }
      } catch (e) {
        console.error(`[relances] error for ${t.client_company}`, e);
        results.push({ client: t.client_company, status: 'error', error: (e as Error).message });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    return new Response(
      JSON.stringify({ success: true, sent, total: targets.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[relances] fatal', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
