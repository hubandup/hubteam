import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  tracking_id: string;
  tone?: 'friendly' | 'formal' | 'direct';
  recipient_email?: string;
  recipient_name?: string;
  recipient_role?: string; // e.g. "Contact principal", "Contact additionnel", "Personnalisé"
  action_key?: string; // ex: 'propose_slot', 'send_quote', 'schedule_call', 'custom'
  action_label?: string; // libellé humain de l'action à proposer
  save?: boolean; // persist to history (default true)
}

/** Strip markdown leftovers (>, **, ##, ---, leading bullets) and convert to safe HTML. */
function markdownLikeToPlainText(s: string): string {
  return s
    .replace(/^\s*>+\s?/gm, '')           // blockquote markers
    .replace(/^\s*#{1,6}\s+/gm, '')        // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')           // italics
    .replace(/_([^_]+)_/g, '$1')           // underscore italics
    .replace(/`([^`]+)`/g, '$1')           // inline code
    .replace(/^---+$/gm, '')               // hr
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(text: string): string {
  const cleaned = markdownLikeToPlainText(text);
  // Group into paragraphs separated by blank lines, single \n => <br>
  const paragraphs = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paragraphs
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
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
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', callerId).maybeSingle();
    if (!roleRow || !['admin', 'team'].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body.tracking_id) {
      return new Response(JSON.stringify({ error: 'tracking_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const { data: tracking, error: trErr } = await admin
      .from('commercial_tracking')
      .select('id, client_id, status, clients(company, first_name, last_name, email)')
      .eq('id', body.tracking_id)
      .maybeSingle();
    if (trErr || !tracking) throw trErr || new Error('Tracking not found');

    const clientRow: any = (tracking as any).clients || {};

    const { data: urls } = await admin
      .from('commercial_scrape_urls')
      .select('url, label, last_scrape_summary, last_scrape_content, last_scraped_at, last_scrape_status')
      .eq('tracking_id', body.tracking_id);

    const validScrapes = (urls || []).filter(u => u.last_scrape_status === 'success' && (u.last_scrape_summary || u.last_scrape_content));

    if (validScrapes.length === 0) {
      return new Response(JSON.stringify({
        error: 'no_scraped_content',
        message: "Aucun contenu scrapé disponible. Lancez d'abord le scraping des URLs.",
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
    }

    const { data: notes } = await admin
      .from('commercial_notes').select('content, created_at').eq('tracking_id', body.tracking_id)
      .order('created_at', { ascending: false }).limit(3);
    const { data: meetings } = await admin
      .from('commercial_meetings').select('label, meeting_type, meeting_date').eq('tracking_id', body.tracking_id)
      .order('meeting_date', { ascending: false }).limit(3);

    // Récupérer les 3 derniers comptes rendus client (meeting_notes)
    const { data: meetingNotes } = await admin
      .from('meeting_notes')
      .select('title, content, meeting_date, created_at')
      .eq('client_id', tracking.client_id)
      .order('meeting_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(3);

    const tone = body.tone || 'friendly';
    const toneInstructions: Record<string, string> = {
      friendly: 'chaleureux, naturel, sincère, sans flagornerie',
      formal: 'professionnel, soigné, respectueux',
      direct: 'concis, droit au but, mais cordial',
    };

    // Recipient resolution
    const mainContactName = `${clientRow.first_name || ''} ${clientRow.last_name || ''}`.trim();
    const recipientEmail = (body.recipient_email || clientRow.email || '').trim();
    const recipientName = (body.recipient_name || mainContactName || '').trim();
    const recipientFirstName = recipientName.split(' ')[0] || '';
    const isMainContact =
      !!recipientEmail && clientRow.email && recipientEmail.toLowerCase() === String(clientRow.email).toLowerCase();
    const recipientRole =
      body.recipient_role || (isMainContact ? 'Contact principal' : 'Contact additionnel');

    const sourcesText = validScrapes.map((u, i) => {
      const b = (u.last_scrape_summary || u.last_scrape_content || '').slice(0, 2500);
      return `### Source ${i + 1}: ${u.label || u.url}\nURL: ${u.url}\n\n${b}`;
    }).join('\n\n---\n\n');

    const contextNotes = (notes && notes.length > 0)
      ? `\n\nDernières notes internes (Suivi commercial):\n${notes.map(n => `- ${n.content?.slice(0, 200)}`).join('\n')}`
      : '';
    const contextMeetings = (meetings && meetings.length > 0)
      ? `\n\nDerniers RDV planifiés:\n${meetings.map(m => `- ${m.label || m.meeting_type}${m.meeting_date ? ` (${m.meeting_date})` : ''}`).join('\n')}`
      : '';
    const contextMeetingNotes = (meetingNotes && meetingNotes.length > 0)
      ? `\n\nDerniers comptes rendus client (3 plus récents) :\n${meetingNotes.map(m => {
          const date = m.meeting_date || m.created_at?.slice(0, 10) || '';
          const title = m.title ? ` — ${m.title}` : '';
          const content = (m.content || '').replace(/\s+/g, ' ').slice(0, 600);
          return `• [${date}]${title}\n  ${content}`;
        }).join('\n')}`
      : '';

    const actionLabel = (body.action_label || '').trim() || 'Proposer un créneau de rendez-vous';
    const actionKey = (body.action_key || '').trim();

    // Préfixe d'objet déterministe selon l'action choisie (utilisé en fallback ou imposé au modèle)
    const SUBJECT_PREFIXES: Record<string, string> = {
      propose_slot: 'Proposition de créneau',
      send_quote: 'Devis',
      schedule_call: 'Proposition de call',
      share_case_study: 'Cas client à partager',
      invite_event: 'Invitation événement HUB+UP',
      ask_feedback: 'Votre retour',
      just_hello: 'Petit coucou',
      custom: '',
    };
    const subjectPrefix = SUBJECT_PREFIXES[actionKey] ?? '';

    const systemPrompt = `Tu es un expert en développement commercial B2B pour HUB+UP (agence de communication). Tu génères une "excuse de relance" personnalisée pour un destinataire précis, en t'appuyant sur des actualités fraîches scrappées.

Règles:
- Identifie 1 à 3 angles concrets tirés du contenu fourni (URLs scrappées en priorité, mais EXPLOITE AUSSI les 3 derniers comptes rendus client et notes internes : sujets évoqués, points en suspens, engagements pris, prochaines étapes mentionnées).
- Si un compte rendu mentionne un suivi ou un point à reprendre, utilise-le comme accroche naturelle ("Suite à notre échange du …").
- Adapte le message au destinataire indiqué (rôle/relation : ${recipientRole}). Si c'est le contact principal habituel, ton plus familier ; sinon, présentation brève.
- OBJECTIF / CALL-TO-ACTION (obligatoire) : l'email DOIT se conclure par une proposition claire correspondant à : « ${actionLabel} ». Formule-la naturellement dans la dernière phrase ou l'avant-dernière, avec une question ouverte ou une proposition concrète (créneau, lien, pièce jointe à venir, etc.).
- OBJET DE L'EMAIL (obligatoire) : il DOIT mentionner explicitement l'action proposée.${subjectPrefix ? ` Commence l'objet par « ${subjectPrefix} » suivi d'un complément personnalisé court (ex: "${subjectPrefix} — [contexte/société/angle]"). Format attendu : "${subjectPrefix} — …". Maximum 60 caractères.` : ` L'action est « ${actionLabel} » : reformule-la en début d'objet de manière naturelle, puis ajoute un complément contextuel court. Maximum 60 caractères.`}
- Ton : ${toneInstructions[tone]}. En français. Pas d'emoji. Pas de formules creuses ("j'espère que vous allez bien"). Signature "L'équipe HUB+UP".
- Email court : 80–130 mots dans le corps.

Tu DOIS répondre UNIQUEMENT avec un JSON valide UTF-8 (pas de markdown, pas de \`\`\`), strictement avec cette forme :
{
  "angles": [
    { "title": "string court", "description": "1 phrase", "source": "URL ou nom de source" }
  ],
  "subject": "Objet d'email mentionnant l'action proposée",
  "body_plain": "Corps de l'email en texte brut, paragraphes séparés par une ligne vide. Inclure la salutation, le call-to-action correspondant à l'action demandée, et la signature 'L'équipe HUB+UP'."
}`;

    const userPrompt = `Prospect / Client : ${clientRow.company || 'N/A'}
Contact principal : ${mainContactName || 'N/A'}
Statut commercial : ${tracking.status}

Destinataire choisi pour ce message :
- Nom : ${recipientName || 'N/A'}
- Email : ${recipientEmail || 'N/A'}
- Rôle : ${recipientRole}
- Prénom à utiliser dans la salutation : ${recipientFirstName || recipientName || ''}

ACTION À PROPOSER (call-to-action obligatoire de l'email) : ${actionLabel}
${contextNotes}${contextMeetings}${contextMeetingNotes}

Contenus scrappés récemment :

${sourcesText}

Génère le JSON.`;

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
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'rate_limited', message: 'Trop de requêtes, réessayez dans un instant.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'payment_required', message: 'Crédits Lovable AI épuisés.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      const t = await aiRes.text();
      console.error('AI gateway error', aiRes.status, t);
      return new Response(JSON.stringify({ error: 'ai_error', message: 'Erreur du modèle IA.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content || '';

    let parsed: { angles?: Array<{ title?: string; description?: string; source?: string }>; subject?: string; body_plain?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // try to extract a JSON object
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
      }
    }

    let subject = (parsed.subject || '').trim();
    const companyHint = clientRow.company || mainContactName || 'votre actualité';

    // Garantit que l'objet mentionne explicitement l'action choisie
    const ensureActionInSubject = (s: string): string => {
      const stripped = s.replace(/\s+/g, ' ').trim();
      const lower = stripped.toLowerCase();
      const expected = (subjectPrefix || actionLabel).trim();
      const expectedLower = expected.toLowerCase();
      if (!stripped) {
        return expected ? `${expected} — ${companyHint}` : `À propos de ${companyHint}`;
      }
      if (expectedLower && lower.includes(expectedLower.split(' ')[0])) {
        return stripped.slice(0, 80);
      }
      // Préfixe l'objet généré avec l'intention de l'action
      return `${expected} — ${stripped}`.slice(0, 80);
    };
    subject = ensureActionInSubject(subject);
    const bodyPlain = (parsed.body_plain || markdownLikeToPlainText(raw)).trim();
    const bodyHtml = plainTextToHtml(bodyPlain);
    const angles = Array.isArray(parsed.angles) ? parsed.angles.slice(0, 5).map(a => ({
      title: String(a.title || '').slice(0, 200),
      description: String(a.description || '').slice(0, 500),
      source: String(a.source || '').slice(0, 300),
    })) : [];

    // Structured sources used for generation: URLs scrappées + notes internes + comptes rendus client
    const sources = {
      urls: validScrapes.map(u => ({
        url: u.url,
        label: u.label || null,
        last_scraped_at: u.last_scraped_at || null,
      })),
      internal_notes: (notes || []).map(n => ({
        content: (n.content || '').slice(0, 500),
        created_at: n.created_at || null,
      })),
      meeting_notes: (meetingNotes || []).map(m => ({
        title: m.title || null,
        meeting_date: m.meeting_date || null,
        created_at: m.created_at || null,
        excerpt: (m.content || '').replace(/\s+/g, ' ').slice(0, 400),
      })),
      meetings: (meetings || []).map(m => ({
        label: m.label || null,
        meeting_type: m.meeting_type || null,
        meeting_date: m.meeting_date || null,
      })),
    };

    // Persist to history (unless explicitly disabled)
    let saved_id: string | null = null;
    if (body.save !== false) {
      const { data: inserted, error: insErr } = await admin
        .from('commercial_followup_suggestions')
        .insert({
          tracking_id: body.tracking_id,
          client_id: tracking.client_id,
          created_by: callerId,
          tone,
          recipient_email: recipientEmail || null,
          recipient_name: recipientName || null,
          subject,
          body_html: bodyHtml,
          angles,
          sources,
          raw_model_output: raw,
          action_key: body.action_key || null,
          action_label: actionLabel,
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('Failed to save suggestion', insErr);
      } else {
        saved_id = inserted.id;
      }
    }

    return new Response(JSON.stringify({
      id: saved_id,
      subject,
      body_html: bodyHtml,
      body_plain: bodyPlain,
      angles,
      sources,
      sources_count: validScrapes.length,
      recipient: { email: recipientEmail, name: recipientName, role: recipientRole },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e) {
    console.error('suggest-followup error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
