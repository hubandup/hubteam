import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SLACK_CHANNEL = '#hubteam_sales';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// Normalize for fuzzy comparison
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaccard similarity on word sets
function similarity(a: string, b: string): number {
  const wa = new Set(normalize(a).split(' ').filter((w) => w.length > 3));
  const wb = new Set(normalize(b).split(' ').filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return inter / union;
}

function isDuplicate(candidate: string, history: string[]): boolean {
  const norm = normalize(candidate);
  for (const h of history) {
    if (normalize(h) === norm) return true;
    if (similarity(candidate, h) >= 0.6) return true;
  }
  return false;
}

async function generateExcuses(recentExcuses: string[]): Promise<string[]> {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

  const avoidBlock = recentExcuses.length
    ? `\n\nIMPORTANT - À ÉVITER ABSOLUMENT (excuses déjà utilisées les semaines précédentes, ne reprends NI le thème NI la formulation) :\n${recentExcuses.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nGénère des excuses sur des thèmes COMPLÈTEMENT DIFFÉRENTS de ceux ci-dessus.`
    : '';

  const prompt = `Génère exactement 3 excuses originales en français pour expliquer un retard, un livrable manquant ou une absence dans une agence de communication.
Mélange les styles :
- Au moins 1 excuse complètement absurde et drôle (ex : "mon chat a mangé le brief")
- Au moins 1 excuse professionnelle plausible (ex : "réunion client prolongée")
- La 3ème : libre, ton décalé bienvenu

Règles :
- Chaque excuse fait UNE phrase courte (max 20 mots)
- Pas de numérotation, pas de tirets, pas de guillemets
- Une excuse par ligne
- Pas d'introduction ni conclusion
- Style punchy, écrit à la première personne ("je", "j'ai", "mon")${avoidBlock}`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Tu es un humoriste créatif spécialisé dans les excuses de bureau improbables et crédibles. Tu varies systématiquement les thèmes pour ne jamais te répéter.' },
        { role: 'user', content: prompt },
      ],
      temperature: 1.2,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI Gateway error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? '';
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*\d.\)]+/, '').replace(/^["«»"]/, '').replace(/["«»"]$/, '').trim())
    .filter((l) => l.length > 5);
  return lines.slice(0, 3);
}

async function postToSlack(excuses: string[]): Promise<void> {
  if (!SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN missing');

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎭 Les excuses de la semaine', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_${today} — à utiliser avec modération_` }],
    },
    { type: 'divider' },
    ...excuses.map((e, i) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${i + 1}.* ${e}` },
    })),
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🤖 Généré automatiquement par Hub Team' }],
    },
  ];

  const text = `🎭 Les excuses de la semaine :\n${excuses.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: SLACK_CHANNEL, text, blocks }),
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Slack error: ${json.error || 'unknown'}${json.error === 'channel_not_found' ? ' — invitez le bot dans #hubteam_sales' : ''}`);
  }
}

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

    // Load recent excuses (last 8 weeks ~ 24 excuses) for deduplication
    const cutoff = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows } = await supabase
      .from('slack_excuses_history')
      .select('excuse')
      .gte('posted_at', cutoff)
      .order('posted_at', { ascending: false })
      .limit(40);
    const history: string[] = (historyRows || []).map((r: any) => r.excuse);
    console.log(`[weekly-slack-excuses] ${history.length} recent excuses loaded for dedup`);

    // Generate with up to 3 attempts to filter out duplicates
    let finalExcuses: string[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    let pool: string[] = [];

    while (finalExcuses.length < 3 && attempts < maxAttempts) {
      attempts++;
      console.log(`[weekly-slack-excuses] generation attempt ${attempts}…`);
      const generated = await generateExcuses([...history, ...pool]);
      for (const e of generated) {
        if (finalExcuses.length >= 3) break;
        if (isDuplicate(e, [...history, ...finalExcuses])) {
          console.log(`[weekly-slack-excuses] duplicate skipped: ${e}`);
          continue;
        }
        finalExcuses.push(e);
      }
      pool = [...pool, ...generated];
    }

    if (finalExcuses.length === 0) {
      throw new Error('AI returned no usable (non-duplicate) excuses');
    }

    // Fallback: if <3 unique, accept generated even if similar (but never identical)
    if (finalExcuses.length < 3) {
      for (const e of pool) {
        if (finalExcuses.length >= 3) break;
        const norm = normalize(e);
        if (finalExcuses.some((f) => normalize(f) === norm)) continue;
        if (history.some((h) => normalize(h) === norm)) continue;
        finalExcuses.push(e);
      }
    }

    console.log('[weekly-slack-excuses] final excuses:', finalExcuses);

    await postToSlack(finalExcuses);
    console.log('[weekly-slack-excuses] posted to Slack ok');

    // Persist to history
    const { error: insertErr } = await supabase
      .from('slack_excuses_history')
      .insert(finalExcuses.map((e) => ({ excuse: e })));
    if (insertErr) console.error('[weekly-slack-excuses] history insert error', insertErr);

    return new Response(
      JSON.stringify({ success: true, count: finalExcuses.length, excuses: finalExcuses, attempts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[weekly-slack-excuses] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
