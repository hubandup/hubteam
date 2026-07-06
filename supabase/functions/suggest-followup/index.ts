import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ModelChoice = 'gemini' | 'claude' | 'gpt5mini';

interface Payload {
  tracking_id: string;
  tone?: 'friendly' | 'formal' | 'direct';
  recipient_email?: string;
  recipient_name?: string;
  recipient_role?: string; // e.g. "Contact principal", "Contact additionnel", "Personnalisé"
  action_key?: string; // ex: 'propose_slot', 'send_quote', 'schedule_call', 'custom'
  action_label?: string; // libellé humain de l'action à proposer
  address_form?: 'vous' | 'tu'; // forme d'adresse : vouvoiement (par défaut) ou tutoiement
  model_id?: ModelChoice; // choix du modèle IA (défaut: claude)
  save?: boolean; // persist to history (default true)
}

/** Appel unifié aux modèles IA. Retourne le texte brut généré. */
async function callAI(
  modelChoice: ModelChoice,
  systemPrompt: string,
  userPrompt: string,
  opts: { anthropicKey?: string; lovableKey?: string },
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string; provider: 'anthropic' | 'lovable' }> {
  if (modelChoice === 'claude') {
    if (!opts.anthropicKey) return { ok: false, status: 500, body: 'ANTHROPIC_API_KEY missing', provider: 'anthropic' };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': opts.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) return { ok: false, status: r.status, body: await r.text(), provider: 'anthropic' };
    const j = await r.json();
    return { ok: true, text: j?.content?.[0]?.text || '' };
  }
  // Lovable AI Gateway (OpenAI-compatible)
  if (!opts.lovableKey) return { ok: false, status: 500, body: 'LOVABLE_API_KEY missing', provider: 'lovable' };
  const model = modelChoice === 'gemini' ? 'google/gemini-3-flash-preview' : 'openai/gpt-5-mini';
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Lovable-API-Key': opts.lovableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, body: await r.text(), provider: 'lovable' };
  const j = await r.json();
  return { ok: true, text: j?.choices?.[0]?.message?.content || '' };
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
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');


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
      .select('id, client_id, status, created_by, clients(id, company, first_name, last_name, email, phone, address, action, kanban_stage, follow_up_date, last_contact, main_contact_id, activity_sector_id, status_id, source_id, revenue, revenue_current_year)')
      .eq('id', body.tracking_id)
      .maybeSingle();
    if (trErr || !tracking) throw trErr || new Error('Tracking not found');

    const clientRow: any = (tracking as any).clients || {};

    // Interlocuteur Hub & Up : profil interne owner (main_contact_id pointe sur profiles)
    let hubAndUpOwner: any = null;
    if (clientRow.main_contact_id) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('first_name, last_name, role')
        .eq('id', clientRow.main_contact_id)
        .maybeSingle();
      hubAndUpOwner = ownerProfile || null;
    }

    // Libellés "humains" : secteur, statut, source
    const [sectorRes, statusRes, sourceRes] = await Promise.all([
      clientRow.activity_sector_id
        ? admin.from('activity_sectors').select('name').eq('id', clientRow.activity_sector_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      clientRow.status_id
        ? admin.from('client_statuses').select('name').eq('id', clientRow.status_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      clientRow.source_id
        ? admin.from('client_sources').select('name').eq('id', clientRow.source_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const sectorName = (sectorRes as any)?.data?.name || null;
    const statusName = (statusRes as any)?.data?.name || null;
    const sourceName = (sourceRes as any)?.data?.name || null;

    // Interlocuteurs (commercial_contacts) — tous les contacts liés au tracking
    const { data: interlocuteurs } = await admin
      .from('commercial_contacts')
      .select('first_name, last_name, email, job_title, phone')
      .eq('tracking_id', body.tracking_id)
      .order('display_order');

    const { data: urls } = await admin
      .from('commercial_scrape_urls')
      .select('url, label, last_scrape_summary, last_scrape_content, last_scraped_at, last_scrape_status')
      .eq('tracking_id', body.tracking_id);

    const validScrapes = (urls || []).filter(u => u.last_scrape_status === 'success' && (u.last_scrape_summary || u.last_scrape_content));

    const { data: notes } = await admin
      .from('commercial_notes').select('content, created_at, created_by').eq('tracking_id', body.tracking_id)
      .order('created_at', { ascending: false }).limit(5);

    // TOUTES les étapes de rendez-vous (avec ET sans date) pour donner le contexte complet
    const { data: meetings } = await admin
      .from('commercial_meetings').select('label, meeting_type, meeting_date, notes, created_at').eq('tracking_id', body.tracking_id)
      .order('meeting_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    // TOUS les comptes rendus client (cap à 10 plus récents pour rester dans le contexte LLM)
    const { data: meetingNotes } = await admin
      .from('meeting_notes')
      .select('title, content, meeting_date, created_at')
      .eq('client_id', tracking.client_id)
      .order('meeting_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(10);

    // Projets liés
    const { data: projects } = await admin
      .from('projects')
      .select('name, status, start_date, end_date, description')
      .eq('client_id', tracking.client_id)
      .order('updated_at', { ascending: false })
      .limit(10);

    // Historique des excuses déjà générées — pour ÉVITER les répétitions et varier les angles
    const { data: priorSuggestions } = await admin
      .from('commercial_followup_suggestions')
      .select('subject, angles, action_label, created_at')
      .eq('tracking_id', body.tracking_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Qualification du besoin (commercial_questionnaire)
    const { data: qualificationRows } = await admin
      .from('commercial_questionnaire')
      .select('question_label, answer, display_order')
      .eq('tracking_id', body.tracking_id)
      .order('display_order');
    const qualification = (qualificationRows || []).filter(
      (q: any) => (q.answer || '').toString().trim().length > 0,
    );

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
      ? `\n\nDernières notes internes (Suivi commercial):\n${notes.map(n => `- ${n.content?.slice(0, 300)}`).join('\n')}`
      : '';

    // Toutes les étapes de RDV (avec ou sans date) — utiles pour cerner où en est la relation
    const contextMeetings = (meetings && meetings.length > 0)
      ? `\n\nÉtapes de rendez-vous (suivi commercial) :\n${(meetings as any[]).map(m => {
          const date = m.meeting_date ? ` — ${m.meeting_date}` : ' — date non fixée';
          const note = m.notes ? `\n  ${String(m.notes).replace(/\s+/g, ' ').slice(0, 200)}` : '';
          return `• ${m.label || m.meeting_type}${date}${note}`;
        }).join('\n')}`
      : '';

    const contextMeetingNotes = (meetingNotes && meetingNotes.length > 0)
      ? `\n\nComptes rendus client (${meetingNotes.length} plus récents, du + récent au + ancien) :\n${meetingNotes.map(m => {
          const date = m.meeting_date || m.created_at?.slice(0, 10) || '';
          const title = m.title ? ` — ${m.title}` : '';
          const content = (m.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800);
          return `• [${date}]${title}\n  ${content}`;
        }).join('\n')}`
      : '';

    const contextProjects = (projects && projects.length > 0)
      ? `\n\nProjets liés à ce client :\n${projects.map((p: any) => {
          const desc = (p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 250);
          const dates = [p.start_date, p.end_date].filter(Boolean).join(' → ');
          return `• ${p.name}${p.status ? ` [${p.status}]` : ''}${dates ? ` (${dates})` : ''}${desc ? `\n  ${desc}` : ''}`;
        }).join('\n')}`
      : '';

    // Fiche client (Informations générales)
    const ficheLines: string[] = [];
    if (clientRow.company) ficheLines.push(`Société : ${clientRow.company}`);
    if (clientRow.kanban_stage) ficheLines.push(`Étape pipeline : ${clientRow.kanban_stage}`);
    if (statusName) ficheLines.push(`Statut : ${statusName}`);
    if (sectorName) ficheLines.push(`Secteur d'activité : ${sectorName}`);
    if (sourceName) ficheLines.push(`Source : ${sourceName}`);
    if (clientRow.address) ficheLines.push(`Adresse : ${clientRow.address}`);
    if (clientRow.phone) ficheLines.push(`Téléphone : ${clientRow.phone}`);
    if (clientRow.action) ficheLines.push(`Prochaine action interne : ${clientRow.action}`);
    if (clientRow.follow_up_date) ficheLines.push(`Date de relance prévue : ${clientRow.follow_up_date}`);
    if (clientRow.last_contact) ficheLines.push(`Dernier contact : ${clientRow.last_contact}`);
    const contextFiche = ficheLines.length > 0
      ? `\n\nFiche client (Informations générales) :\n${ficheLines.map(l => `• ${l}`).join('\n')}`
      : '';

    // Interlocuteur Hub & Up (référent interne côté agence)
    const contextHubOwner = hubAndUpOwner
      ? `\n\nInterlocuteur Hub & Up (référent interne) : ${[hubAndUpOwner.first_name, hubAndUpOwner.last_name].filter(Boolean).join(' ')}${hubAndUpOwner.role ? ` (${hubAndUpOwner.role})` : ''}`
      : '';

    // Interlocuteurs côté client (additionnels)
    const contextInterlocuteurs = (interlocuteurs && interlocuteurs.length > 0)
      ? `\n\nInterlocuteurs côté client :\n${(interlocuteurs as any[]).map(c => {
          const fn = `${c.first_name || ''} ${c.last_name || ''}`.trim();
          return `• ${fn || c.email || 'Contact'}${c.job_title ? ` — ${c.job_title}` : ''}${c.email ? ` <${c.email}>` : ''}`;
        }).join('\n')}`
      : '';

    // Historique des excuses déjà envoyées — pour ne pas se répéter
    const contextPriorSuggestions = (priorSuggestions && priorSuggestions.length > 0)
      ? `\n\nHistorique des excuses déjà générées (NE PAS REDIRE LA MÊME CHOSE — varier l'angle) :\n${(priorSuggestions as any[]).map(s => {
          const date = s.created_at?.slice(0, 10) || '';
          const angles = Array.isArray(s.angles)
            ? s.angles.map((a: any) => a.title).filter(Boolean).slice(0, 3).join(' / ')
            : '';
          return `• [${date}] "${s.subject || ''}"${s.action_label ? ` — action : ${s.action_label}` : ''}${angles ? ` — angles déjà utilisés : ${angles}` : ''}`;
        }).join('\n')}`
      : '';


    const contextQualification = (qualification && qualification.length > 0)
      ? `\n\nQualification du besoin (réponses du client recueillies en suivi commercial) :\n${qualification.map((q: any) => {
          const ans = String(q.answer || '').replace(/\s+/g, ' ').slice(0, 300);
          return `• ${q.question_label} → ${ans}`;
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
2. Qualification du besoin (réponses du client : taille, cibles, objectifs, agence habituelle, etc.) — utilise-les pour personnaliser l'angle, démontrer une compréhension fine du contexte client et calibrer la proposition de valeur. NE PAS recracher littéralement les réponses ; les exploiter de manière subtile.
3. URLs scrapées récemment (actualité de l'entreprise, prises de parole, recrutements, levée).
4. Google Alerts (actu externe sur l'entreprise / le secteur).
5. Notes internes (suivi commercial) et derniers RDV planifiés.
6. Projets liés (sujets sur lesquels HUB+UP a déjà travaillé pour ce client).
7. Contexte HUB+UP (rappel discret de notre positionnement / actu récente, à n'utiliser QUE si pertinent pour ouvrir une porte — jamais de listing d'expertises).

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
${contextFiche}${contextHubOwner}${contextInterlocuteurs}${contextNotes}${contextMeetings}${contextMeetingNotes}${contextQualification}${contextProjects}${contextGoogleAlerts}${contextHubAndUp}${contextPriorSuggestions}

Contenus scrappés récemment (URLs veille du client) :

${sourcesText}

Génère le JSON.`;

    const modelChoice: ModelChoice =
      body.model_id === 'gemini' || body.model_id === 'gpt5mini' ? body.model_id : 'claude';

    const fullUserPrompt = `${userPrompt}\n\nRéponds UNIQUEMENT avec le JSON demandé, sans markdown ni backticks.`;
    const aiCall = await callAI(modelChoice, systemPrompt, fullUserPrompt, {
      anthropicKey: ANTHROPIC_API_KEY,
      lovableKey: LOVABLE_API_KEY,
    });

    if (!aiCall.ok) {
      const providerLabel = aiCall.provider === 'anthropic' ? 'Anthropic' : 'Lovable AI';
      if (aiCall.status === 429 || aiCall.status === 529) {
        return new Response(JSON.stringify({ error: 'rate_limited', message: `${providerLabel} surchargé, réessayez dans un instant.` }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      if (aiCall.status === 401) {
        return new Response(JSON.stringify({ error: 'unauthorized', message: `Clé ${providerLabel} invalide ou manquante.` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      if (aiCall.status === 402 || aiCall.status === 403) {
        return new Response(JSON.stringify({ error: 'payment_required', message: `Crédits ${providerLabel} épuisés.` }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      console.error(`${providerLabel} error`, aiCall.status, aiCall.body);
      return new Response(JSON.stringify({ error: 'ai_error', message: 'Erreur du modèle IA.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const raw = aiCall.text;


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

    // Collapse double (or more) line breaks into a single line break
    bodyPlain = bodyPlain.replace(/\n{2,}/g, '\n').trim();

    const bodyHtml = plainTextToHtml(bodyPlain);
    const angles = Array.isArray(parsed.angles) ? parsed.angles.slice(0, 5).map(a => ({
      title: String(a.title || '').slice(0, 200),
      description: String(a.description || '').slice(0, 500),
      source: String(a.source || '').slice(0, 300),
    })) : [];

    // Structured sources used for generation
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
      projects: (projects || []).map((p: any) => ({
        name: p.name,
        status: p.status || null,
        start_date: p.start_date || null,
        end_date: p.end_date || null,
      })),
      qualification: qualification.map((q: any) => ({
        question: q.question_label,
        answer: String(q.answer || '').slice(0, 300),
      })),
      hubandup: (hubCache || []).map((h: any) => ({
        url: h.source_url,
        last_scraped_at: h.last_scraped_at || null,
      })),
      google_alerts: googleAlerts.map((g: any) => ({
        feed_url: g.feed_url,
        fetched_at: g.fetched_at || null,
        entries_count: Array.isArray(g.entries) ? g.entries.length : 0,
      })),
      calendly: calendly.url ? {
        owner: calendly.owner,
        email: calendly.email || null,
        url: calendly.url,
        used: ['propose_slot', 'schedule_call'].includes(actionKey),
      } : null,
      client_fiche: {
        company: clientRow.company || null,
        kanban_stage: clientRow.kanban_stage || null,
        status: statusName,
        sector: sectorName,
        source: sourceName,
        action: clientRow.action || null,
        follow_up_date: clientRow.follow_up_date || null,
        last_contact: clientRow.last_contact || null,
      },
      hub_owner: hubAndUpOwner ? {
        name: `${hubAndUpOwner.first_name || ''} ${hubAndUpOwner.last_name || ''}`.trim(),
        role: hubAndUpOwner.role || null,
      } : null,
      interlocuteurs: (interlocuteurs || []).map((c: any) => ({
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email || null,
        job_title: c.job_title || null,
      })),
      prior_suggestions_count: (priorSuggestions || []).length,
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
      model_used: modelChoice,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e) {
    console.error('suggest-followup error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
