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
  address_form?: 'vous' | 'tu'; // forme d'adresse : vouvoiement (par défaut) ou tutoiement
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
      .select('id, client_id, status, created_by, clients(company, first_name, last_name, email)')
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
      .from('commercial_notes').select('content, created_at, created_by').eq('tracking_id', body.tracking_id)
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

    // Projets liés
    const { data: projects } = await admin
      .from('projects')
      .select('name, status, start_date, end_date, description')
      .eq('client_id', tracking.client_id)
      .order('updated_at', { ascending: false })
      .limit(5);

    // Cache Hub & Up (site)
    const { data: hubCache } = await admin
      .from('hubandup_context_cache')
      .select('source_url, summary, last_scraped_at, last_scrape_status')
      .eq('last_scrape_status', 'success');

    // Détection feeds Google Alerts parmi les URLs du client (heuristique)
    const isGoogleAlertsFeed = (u: string) =>
      /google\.[a-z.]+\/alerts\/feeds?\//i.test(u) || /alerts\.google\.[a-z.]+/i.test(u);
    const feedUrls = (urls || []).map(u => u.url).filter(isGoogleAlertsFeed);

    let googleAlerts: any[] = [];
    if (feedUrls.length > 0) {
      const { data: gaRows } = await admin
        .from('google_alerts_cache')
        .select('feed_url, entries, fetched_at, fetch_status')
        .in('feed_url', feedUrls);
      googleAlerts = gaRows || [];
    }

    // Configuration Calendly (app_config)
    const { data: cfgRows } = await admin
      .from('app_config')
      .select('key, value')
      .in('key', ['calendly_charles_email', 'calendly_charles_url', 'calendly_amandine_email', 'calendly_amandine_url']);
    const cfg: Record<string, string> = {};
    for (const r of (cfgRows || [])) cfg[r.key] = r.value || '';

    // Helper: choisit l'attribution Calendly (Charles vs Amandine)
    // Stratégie : on cherche l'auteur principal (created_by du tracking, ou de la dernière note),
    // puis on compare son email Auth aux emails Calendly configurés.
    const pickCalendlyAttribution = async (): Promise<{ owner: 'charles'|'amandine'|null; email: string; url: string }> => {
      const ownerId =
        (tracking as any).created_by ||
        (notes && notes[0]?.created_by) ||
        null;
      let ownerEmail = '';
      if (ownerId) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(ownerId);
          ownerEmail = (u?.user?.email || '').toLowerCase();
        } catch { /* noop */ }
      }
      const charlesEmail = (cfg.calendly_charles_email || '').toLowerCase();
      const amandineEmail = (cfg.calendly_amandine_email || '').toLowerCase();
      if (ownerEmail && ownerEmail === amandineEmail) {
        return { owner: 'amandine', email: cfg.calendly_amandine_email, url: cfg.calendly_amandine_url };
      }
      if (ownerEmail && ownerEmail === charlesEmail) {
        return { owner: 'charles', email: cfg.calendly_charles_email, url: cfg.calendly_charles_url };
      }
      // Fallback : Charles si configuré
      if (cfg.calendly_charles_url) {
        return { owner: 'charles', email: cfg.calendly_charles_email, url: cfg.calendly_charles_url };
      }
      return { owner: null, email: '', url: '' };
    };
    const calendly = await pickCalendlyAttribution();


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

    const contextProjects = (projects && projects.length > 0)
      ? `\n\nProjets liés à ce client (5 plus récents) :\n${projects.map((p: any) => {
          const desc = (p.description || '').replace(/\s+/g, ' ').slice(0, 200);
          const dates = [p.start_date, p.end_date].filter(Boolean).join(' → ');
          return `• ${p.name}${p.status ? ` [${p.status}]` : ''}${dates ? ` (${dates})` : ''}${desc ? `\n  ${desc}` : ''}`;
        }).join('\n')}`
      : '';

    const contextHubAndUp = (hubCache && hubCache.length > 0)
      ? `\n\nContexte HUB+UP (résumé du site, mis à jour le ${(hubCache[0] as any).last_scraped_at?.slice(0, 10) || 'N/A'}) :\n${hubCache.map((h: any) => {
          const sum = (h.summary || '').replace(/\s+/g, ' ').slice(0, 1500);
          return `### ${h.source_url}\n${sum}`;
        }).join('\n\n')}`
      : '';

    const allAlertEntries: Array<{ title: string; link?: string; published?: string; summary?: string; feed_url: string }> = [];
    for (const ga of googleAlerts) {
      const entries = Array.isArray(ga.entries) ? ga.entries : [];
      for (const e of entries.slice(0, 5)) {
        allAlertEntries.push({
          title: String(e.title || '').slice(0, 200),
          link: e.link || e.url || '',
          published: e.published || e.updated || '',
          summary: String(e.summary || e.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 400),
          feed_url: ga.feed_url,
        });
      }
    }
    const contextGoogleAlerts = allAlertEntries.length > 0
      ? `\n\nDernières Google Alerts pour ce client (${allAlertEntries.length} entrées) :\n${allAlertEntries.map(e => `• ${e.published ? `[${String(e.published).slice(0, 10)}] ` : ''}${e.title}${e.summary ? `\n  ${e.summary}` : ''}${e.link ? `\n  ${e.link}` : ''}`).join('\n')}`
      : '';

    const actionLabel = (body.action_label || '').trim() || 'Proposer un créneau de rendez-vous';
    const actionKey = (body.action_key || '').trim();

    // Préfixes d'objet déterministes selon l'action choisie
    const SUBJECT_PREFIXES: Record<string, string> = {
      propose_slot: 'Proposition de créneau',
      send_quote: 'Devis',
      schedule_call: 'Proposition de call',
      share_case_study: 'Cas client à partager',
      invite_event: 'Invitation événement HUB+UP',
      ask_feedback: 'Votre retour',
      just_hello: 'Petites nouvelles',
      custom: '',
    };
    const subjectPrefix = SUBJECT_PREFIXES[actionKey] ?? '';

    // Instruction call-to-action spécifique selon l'action choisie
    const isJustHello = actionKey === 'just_hello';
    const ctaRule = isJustHello
      ? `- INTENTION DU MESSAGE : c'est un message de prise de nouvelles, sans rendez-vous ni demande commerciale. INTERDICTIONS STRICTES : n'utilise JAMAIS le mot "coucou", n'écris JAMAIS qu'il n'y a "pas d'objectif commercial" / "sans intention commerciale" / "juste pour prendre des nouvelles" ou toute formulation équivalente (c'est implicite, le destinataire le comprendra). Le message reste sobre, élégant et personnel : appuie-toi sur un angle concret (actu, échange passé) et termine par une formule ouverte légère ("Au plaisir d'échanger bientôt", "Tenez-moi au courant si ça résonne de votre côté", etc.) — sans demander explicitement de RDV ni de réponse formelle.`
      : `- OBJECTIF / CALL-TO-ACTION (obligatoire) : l'email DOIT se conclure par une proposition claire correspondant à : « ${actionLabel} ». Formule-la naturellement dans la dernière phrase ou l'avant-dernière, avec une question ouverte ou une proposition concrète (créneau, lien, pièce jointe à venir, etc.).`;

    const subjectRule = isJustHello
      ? `- OBJET DE L'EMAIL : sobre et personnel, sans aucun mot du registre "coucou", "salut", "petit mot". Format suggéré : "${subjectPrefix} — [contexte court]" (≤ 60 caractères).`
      : (subjectPrefix
          ? `- OBJET DE L'EMAIL (obligatoire) : il DOIT mentionner explicitement l'action proposée. Commence l'objet par « ${subjectPrefix} » suivi d'un complément personnalisé court (ex: "${subjectPrefix} — [contexte/société/angle]"). Maximum 60 caractères.`
          : `- OBJET DE L'EMAIL (obligatoire) : il DOIT mentionner explicitement l'action « ${actionLabel} » reformulée naturellement en début d'objet, suivi d'un complément contextuel court. Maximum 60 caractères.`);

    const addressForm: 'vous' | 'tu' = body.address_form === 'tu' ? 'tu' : 'vous';
    const addressRule = addressForm === 'tu'
      ? `- ADRESSE (obligatoire) : tutoiement à la 2ème personne du singulier. Utilise « tu », « ton/ta/tes », conjugaisons à la 2e pers. sing. (« peux-tu », « dis-moi », « tiens-moi au courant »). Salutation : « Bonjour [Prénom], » (jamais « Salut »). Aucun « vous » de politesse, jamais.`
      : `- ADRESSE (obligatoire) : vouvoiement à la 2ème personne du pluriel. Utilise « vous », « votre/vos », conjugaisons à la 2e pers. plur. (« pouvez-vous », « dites-moi », « tenez-moi au courant »). Salutation : « Bonjour [Prénom], ». Aucun tutoiement.`;

    // Bloc Calendly conditionnel : si une action de proposition de RDV/call est demandée ET qu'un lien Calendly est disponible
    const wantsBookingLink = ['propose_slot', 'schedule_call'].includes(actionKey);
    const calendlyRule = (wantsBookingLink && calendly.url)
      ? `- LIEN CALENDLY (obligatoire pour cette action) : intègre EXPLICITEMENT le lien Calendly suivant attribué à l'expéditeur (${calendly.owner === 'amandine' ? 'Amandine' : 'Charles'}) : ${calendly.url}\n  Présente-le naturellement dans la dernière phrase du corps (ex : "Voici mon agenda si vous souhaitez réserver un créneau directement : ${calendly.url}"). N'invente AUCUN autre lien Calendly.`
      : `- LIEN CALENDLY : n'inclus AUCUN lien Calendly dans cet email (l'action choisie ne le requiert pas, ou aucun lien n'est configuré).`;

    const systemPrompt = `Tu es un expert en développement commercial B2B pour HUB+UP (agence de communication). Tu génères une "excuse de relance" personnalisée pour un destinataire précis, en t'appuyant sur plusieurs sources de contexte fraîches : actualités scrappées du client, comptes rendus internes, projets en cours, contexte HUB+UP (résumé du site officiel) et Google Alerts liées au client.

Hiérarchie des sources (du + important au - important pour construire l'angle de relance) :
1. Comptes rendus client récents (suivi promis, point en suspens, prochaine étape) — accroche idéale.
2. URLs scrapées récemment (actualité de l'entreprise, prises de parole, recrutements, levée).
3. Google Alerts (actu externe sur l'entreprise / le secteur).
4. Notes internes (suivi commercial) et derniers RDV planifiés.
5. Projets liés (sujets sur lesquels HUB+UP a déjà travaillé pour ce client).
6. Contexte HUB+UP (rappel discret de notre positionnement / actu récente, à n'utiliser QUE si pertinent pour ouvrir une porte — jamais de listing d'expertises).

Règles:
- Identifie 1 à 3 angles concrets en respectant la hiérarchie ci-dessus. Cite la source réelle dans le champ "source" des angles.
- Si un compte rendu mentionne un suivi ou un point à reprendre, utilise-le en priorité comme accroche naturelle ("Suite à notre échange du …").
- Adapte le message au destinataire indiqué (rôle/relation : ${recipientRole}). Si c'est le contact principal habituel, ton plus familier ; sinon, présentation brève.
${addressRule}
${ctaRule}
${subjectRule}
${calendlyRule}
- Ton : ${toneInstructions[tone]}. En français. Pas d'emoji. Pas de formules creuses ("j'espère que vous allez bien").
- Email court : 80–130 mots dans le corps.
- RÈGLE IMPORTANTE — AUCUNE SIGNATURE : ne termine JAMAIS le message par une signature. Pas de "L'équipe Hub & Up", pas de "L'équipe HUB+UP", pas de "Cordialement, [prénom]", pas de "Bien à vous", pas de "Bonne journée, [prénom]", pas de nom propre en fin de message. Le message doit s'arrêter NET après la dernière phrase utile (appel à l'action, proposition de créneau, lien Calendly, formule ouverte). La signature personnelle de l'expéditeur sera ajoutée automatiquement par son client mail lors de l'envoi.
- TON PERSONNEL : écris à la 1ère personne du singulier (je/moi/mon), JAMAIS au collectif (nous/notre/l'équipe). C'est un message individuel envoyé par une personne, pas par une agence.

Tu DOIS répondre UNIQUEMENT avec un JSON valide UTF-8 (pas de markdown, pas de \`\`\`), strictement avec cette forme :
{
  "angles": [
    { "title": "string court", "description": "1 phrase", "source": "URL ou nom de source réellement utilisée" }
  ],
  "subject": "Objet d'email${isJustHello ? ' sobre et personnel' : ' mentionnant l\'action proposée'}",
  "body_plain": "Corps de l'email en texte brut, paragraphes séparés par une ligne vide. Inclure la salutation et${isJustHello ? ' un angle concret puis une formule ouverte légère' : ' le call-to-action correspondant à l\'action demandée'}. AUCUNE SIGNATURE en fin de message — le texte se termine sur la dernière phrase utile, c'est tout."
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
${wantsBookingLink && calendly.url ? `LIEN CALENDLY À INTÉGRER : ${calendly.url} (attribué à ${calendly.owner === 'amandine' ? 'Amandine' : 'Charles'})` : ''}
${contextNotes}${contextMeetings}${contextMeetingNotes}${contextProjects}${contextGoogleAlerts}${contextHubAndUp}

Contenus scrappés récemment (URLs veille du client) :

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
    let bodyPlain = (parsed.body_plain || markdownLikeToPlainText(raw)).trim();
    const companyHint = clientRow.company || mainContactName || 'votre actualité';

    // Garantit que l'objet mentionne explicitement l'action choisie
    const ensureActionInSubject = (s: string): string => {
      const stripped = s.replace(/\s+/g, ' ').trim();
      const expected = (subjectPrefix || actionLabel).trim();
      const expectedFirstWord = expected.split(' ')[0]?.toLowerCase() || '';
      if (!stripped) return expected ? `${expected} — ${companyHint}` : `À propos de ${companyHint}`;
      if (expectedFirstWord && stripped.toLowerCase().includes(expectedFirstWord)) return stripped.slice(0, 80);
      return `${expected} — ${stripped}`.slice(0, 80);
    };
    subject = ensureActionInSubject(subject);

    // Pour "just_hello" : retire le mot "coucou" et toute mention d'absence d'intention commerciale
    if (isJustHello) {
      const stripJustHelloLeaks = (txt: string): string => {
        let out = txt;
        // Mot "coucou" sous toutes ses formes
        out = out.replace(/\b(petit\s+)?coucou\b[\s,!.…—-]*/gi, '');
        // Phrases qui révèlent l'absence d'intention commerciale
        out = out.replace(/[^.!?\n]*\b(sans (?:aucune? )?(?:intention|objectif|but|arrière[- ]pensée)[^.!?\n]*?(?:commercial[e]?|de vente|de relance)[^.!?\n]*[.!?…])/gi, '');
        out = out.replace(/[^.!?\n]*\b(?:juste|simplement)\s+(?:pour\s+)?(?:prendre\s+(?:de\s+vos\s+)?nouvelles|vous\s+saluer|un\s+petit\s+mot|dire\s+bonjour)[^.!?\n]*[.!?…]/gi, '');
        out = out.replace(/[^.!?\n]*\bpas\s+d['’]\s*(?:objectif|intention|arrière[- ]pensée)[^.!?\n]*[.!?…]/gi, '');
        // Nettoyage espaces / lignes vides excessives
        out = out.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        // Si le message commence par une virgule/tiret orphelin après salutation, on rétablit
        out = out.replace(/^(Bonjour [^,\n]+),?\s*[—-]?\s*/i, '$1,\n\n');
        return out;
      };
      bodyPlain = stripJustHelloLeaks(bodyPlain);
      subject = subject.replace(/\bcoucou\b/gi, 'Quelques nouvelles').replace(/\s{2,}/g, ' ').trim();
    }

    // Safety net : strip any closing signature the model may still emit
    const stripClosingSignature = (txt: string): string => {
      let out = txt;
      // Remove common closing salutations + optional name/team line that follows
      const patterns = [
        /\n+\s*(?:cordialement|bien (?:à|a) (?:vous|toi)|sincèrement|à très vite|à bientôt|au plaisir|belle journée|bonne journée|bonne soirée|amicalement|chaleureusement)[^\n]*(?:\n+[^\n]*)?\s*$/i,
        /\n+\s*(?:l['’]\s*équipe\s+)?hub\s*(?:&|et|\+)\s*up[^\n]*\s*$/i,
        /\n+\s*l['’]\s*équipe[^\n]*\s*$/i,
      ];
      for (const re of patterns) {
        out = out.replace(re, '');
      }
      return out.trim();
    };
    bodyPlain = stripClosingSignature(bodyPlain);

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
