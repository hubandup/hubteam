import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  tracking_id: string;
  tone?: 'friendly' | 'formal' | 'direct';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', callerId).maybeSingle();
    if (!roleRow || !['admin', 'team'].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body.tracking_id) {
      return new Response(JSON.stringify({ error: 'tracking_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch tracking + client
    const { data: tracking, error: trErr } = await admin
      .from('commercial_tracking')
      .select('id, client_id, status, clients(company, first_name, last_name)')
      .eq('id', body.tracking_id)
      .maybeSingle();
    if (trErr || !tracking) throw trErr || new Error('Tracking not found');

    const clientRow: any = (tracking as any).clients || {};

    // Fetch scraped URLs
    const { data: urls } = await admin
      .from('commercial_scrape_urls')
      .select('url, label, last_scrape_summary, last_scrape_content, last_scraped_at, last_scrape_status')
      .eq('tracking_id', body.tracking_id);

    const validScrapes = (urls || []).filter(u => u.last_scrape_status === 'success' && (u.last_scrape_summary || u.last_scrape_content));

    if (validScrapes.length === 0) {
      return new Response(JSON.stringify({
        error: 'no_scraped_content',
        message: "Aucun contenu scrapé disponible. Lancez d'abord le scraping des URLs.",
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Optional: notes & last meetings for extra context
    const { data: notes } = await admin
      .from('commercial_notes').select('content, created_at').eq('tracking_id', body.tracking_id)
      .order('created_at', { ascending: false }).limit(3);
    const { data: meetings } = await admin
      .from('commercial_meetings').select('label, meeting_type, meeting_date').eq('tracking_id', body.tracking_id)
      .order('meeting_date', { ascending: false }).limit(3);

    const tone = body.tone || 'friendly';
    const toneInstructions: Record<string, string> = {
      friendly: 'chaleureux, naturel, sincère, sans flagornerie',
      formal: 'professionnel, soigné, respectueux',
      direct: 'concis, droit au but, mais cordial',
    };

    const sourcesText = validScrapes.map((u, i) => {
      const body = (u.last_scrape_summary || u.last_scrape_content || '').slice(0, 2500);
      return `### Source ${i + 1}: ${u.label || u.url}\nURL: ${u.url}\n\n${body}`;
    }).join('\n\n---\n\n');

    const contextNotes = (notes && notes.length > 0)
      ? `\n\nDernières notes internes:\n${notes.map(n => `- ${n.content?.slice(0, 200)}`).join('\n')}`
      : '';
    const contextMeetings = (meetings && meetings.length > 0)
      ? `\n\nDerniers RDV:\n${meetings.map(m => `- ${m.label || m.meeting_type}${m.meeting_date ? ` (${m.meeting_date})` : ''}`).join('\n')}`
      : '';

    const systemPrompt = `Tu es un expert en développement commercial B2B pour une agence de communication (HUB+UP). Ta mission : générer une "excuse de relance" pertinente et personnalisée pour reprendre contact avec un prospect/client, en t'appuyant sur des actualités fraîches scrappées de ses canaux publics (LinkedIn, site web, presse, etc.).

Règles strictes:
- Identifie 1 à 3 angles d'accroche concrets tirés EXCLUSIVEMENT du contenu fourni (nouveauté produit, recrutement, levée de fonds, partenariat, prise de parole, événement, lancement, etc.).
- Pour chaque angle: cite brièvement la source (ex: "vu sur LinkedIn", "annonce du …").
- Propose UN message de relance prêt à envoyer (email court, 80-130 mots), ton ${toneInstructions[tone]}, en français, sans formules creuses ("j'espère que vous allez bien"), sans emoji, signature "L'équipe HUB+UP".
- Si rien de pertinent n'est trouvé, dis-le honnêtement et suggère une accroche neutre alternative.

Format de sortie en Markdown strict:
## Angles de relance
- **Angle 1** : … _(source)_
- **Angle 2** : … _(source)_

## Message proposé
> Objet : …
>
> Bonjour {prenom},
> …`;

    const userPrompt = `**Prospect / Client**
- Société: ${clientRow.company || 'N/A'}
- Contact principal: ${clientRow.first_name || ''} ${clientRow.last_name || ''}
- Statut commercial actuel: ${tracking.status}${contextNotes}${contextMeetings}

**Contenus scrappés récemment**

${sourcesText}

Génère maintenant les angles + le message de relance.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'rate_limited', message: 'Trop de requêtes, réessayez dans un instant.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'payment_required', message: 'Crédits Lovable AI épuisés. Ajoutez des fonds dans Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await aiRes.text();
      console.error('AI gateway error', aiRes.status, t);
      return new Response(JSON.stringify({ error: 'ai_error', message: 'Erreur du modèle IA.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const suggestion = aiJson.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({
      suggestion,
      sources_count: validScrapes.length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('suggest-followup error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
