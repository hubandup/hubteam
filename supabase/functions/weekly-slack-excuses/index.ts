import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SLACK_CHANNEL = '#hubteam_sales';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

async function generateExcuses(): Promise<string[]> {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

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
- Style punchy, écrit à la première personne ("je", "j'ai", "mon")`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Tu es un humoriste créatif spécialisé dans les excuses de bureau improbables et crédibles.' },
        { role: 'user', content: prompt },
      ],
      temperature: 1.1,
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
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
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

    console.log('[weekly-slack-excuses] generating excuses…');
    const excuses = await generateExcuses();
    console.log('[weekly-slack-excuses] excuses:', excuses);

    if (excuses.length === 0) {
      throw new Error('AI returned no excuses');
    }

    await postToSlack(excuses);
    console.log('[weekly-slack-excuses] posted to Slack ok');

    return new Response(
      JSON.stringify({ success: true, count: excuses.length, excuses }),
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
