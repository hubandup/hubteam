import { supabase } from '@/integrations/supabase/client';

/**
 * Transfert unique des données CRM de HubTeam vers le projet "Project Hub".
 *
 * Project Hub possède sa propre base : on ne peut pas y écrire directement.
 * On génère donc un dossier compressé (JSON + logos) qu'un écran d'import,
 * côté Project Hub, lit pour créer les fiches, contacts et commentaires.
 *
 * Schéma cible (Project Hub) :
 *  - crm_stages   : { label, sort_order }
 *  - crm_contacts : { sector, company, first_name, last_name, job_title, email,
 *                     phone, stage_label, fiscal_revenue, next_step, next_step_date }
 *  - crm_comments : { contact_ref, body, created_at }
 */

export const PROJECT_HUB_TRANSFER_VERSION = 1;

export interface HubTransferContact {
  ref: string;
  sector: string | null;
  company: string;
  first_name: string;
  last_name: string;
  job_title: string;
  email: string;
  phone: string;
  stage_label: string | null;
  fiscal_revenue: number;
  next_step: string;
  next_step_date: string | null;
  is_primary: boolean;
  logo_file: string | null;
  source_client_id: string;
}

export interface HubTransferComment {
  contact_ref: string;
  body: string;
  created_at: string | null;
  author_name: string;
  origin: string;
}

export interface HubTransferPayload {
  version: number;
  generated_at: string;
  source: string;
  stages: { label: string; sort_order: number }[];
  contacts: HubTransferContact[];
  comments: HubTransferComment[];
}

const iso = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const dateOnly = (value?: string | null) => {
  const s = iso(value);
  return s ? s.slice(0, 10) : null;
};

const clientLabel = (c: any) =>
  c.company || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.id;

const sanitizeFileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'logo';

/** Construit la charge utile + la liste des logos à joindre. */
export async function buildProjectHubTransfer(clients: any[]): Promise<{
  payload: HubTransferPayload;
  logos: { file: string; url: string }[];
}> {
  const clientIds = clients.map((c) => c.id).filter(Boolean);

  const [sectorsRes, statusesRes, contactsRes, notesRes, trackingRes] = await Promise.all([
    supabase.from('activity_sectors').select('id, name'),
    supabase.from('client_statuses').select('id, name'),
    clientIds.length
      ? supabase
          .from('client_contacts')
          .select('client_id, first_name, last_name, email, phone, title')
          .in('client_id', clientIds)
      : Promise.resolve({ data: [] as any[] } as any),
    clientIds.length
      ? supabase
          .from('meeting_notes')
          .select('client_id, title, content, meeting_date, created_at, user_id')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] } as any),
    clientIds.length
      ? supabase.from('commercial_tracking').select('id, client_id, status').in('client_id', clientIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const sectorById = new Map<string, string>((sectorsRes.data || []).map((s: any) => [s.id, s.name]));
  const statusById = new Map<string, string>((statusesRes.data || []).map((s: any) => [s.id, s.name]));

  const trackings = (trackingRes as any).data || [];
  const trackingIds = trackings.map((t: any) => t.id);
  const clientIdByTracking = new Map<string, string>(trackings.map((t: any) => [t.id, t.client_id]));

  const [commercialNotesRes, commercialMeetingsRes, commercialContactsRes] = trackingIds.length
    ? await Promise.all([
        supabase
          .from('commercial_notes')
          .select('tracking_id, title, content, meeting_date, created_at, author_id')
          .in('tracking_id', trackingIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('commercial_meetings')
          .select('tracking_id, label, meeting_type, meeting_date, created_at')
          .in('tracking_id', trackingIds),
        supabase.from('commercial_contacts').select('*').in('tracking_id', trackingIds),
      ])
    : [{ data: [] } as any, { data: [] } as any, { data: [] } as any];

  // Auteurs des comptes rendus / notes : conservés en texte côté Project Hub
  const authorIds = Array.from(
    new Set(
      [
        ...((notesRes as any).data || []).map((n: any) => n.user_id),
        ...((commercialNotesRes as any).data || []).map((n: any) => n.author_id),
      ].filter(Boolean),
    ),
  );
  const authorById = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', authorIds);
    (profiles || []).forEach((p: any) => {
      authorById.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '');
    });
  }

  // ---- Fiches -------------------------------------------------------------
  const contacts: HubTransferContact[] = [];
  const logos: { file: string; url: string }[] = [];
  const usedLogoNames = new Set<string>();
  const primaryRefByClient = new Map<string, string>();
  const stageLabels = new Map<string, number>();

  clients.forEach((c: any, index: number) => {
    const company = c.company || '';
    const stageLabel = statusById.get(c.status_id) || c.kanban_stage || null;
    if (stageLabel && !stageLabels.has(stageLabel)) stageLabels.set(stageLabel, stageLabels.size);

    let logoFile: string | null = null;
    if (c.logo_url) {
      const ext = (String(c.logo_url).split('?')[0].split('.').pop() || 'png').slice(0, 5);
      const base = sanitizeFileName(clientLabel(c));
      let name = `${base}.${ext}`;
      let i = 2;
      while (usedLogoNames.has(name)) name = `${base}-${i++}.${ext}`;
      usedLogoNames.add(name);
      logoFile = `logos/${name}`;
      logos.push({ file: name, url: String(c.logo_url) });
    }

    const ref = `client-${index + 1}`;
    primaryRefByClient.set(c.id, ref);

    contacts.push({
      ref,
      sector: sectorById.get(c.activity_sector_id) || null,
      company,
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      job_title: '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      stage_label: stageLabel,
      fiscal_revenue: Number(c.revenue_current_year ?? c.revenue ?? 0) || 0,
      next_step: c.action ?? '',
      next_step_date: dateOnly(c.follow_up_date),
      is_primary: true,
      logo_file: logoFile,
      source_client_id: c.id,
    });
  });

  // Contacts additionnels : même société, rattachés à la même fiche d'origine
  const pushSecondary = (clientId: string | undefined, raw: any, suffix: string) => {
    if (!clientId) return;
    const parent = clients.find((c: any) => c.id === clientId);
    if (!parent) return;
    const primaryRef = primaryRefByClient.get(clientId)!;
    contacts.push({
      ref: `${primaryRef}-${suffix}-${contacts.length}`,
      sector: sectorById.get(parent.activity_sector_id) || null,
      company: parent.company || '',
      first_name: raw.first_name ?? '',
      last_name: raw.last_name ?? '',
      job_title: raw.title ?? raw.role ?? '',
      email: raw.email ?? '',
      phone: raw.phone ?? '',
      stage_label: statusById.get(parent.status_id) || parent.kanban_stage || null,
      fiscal_revenue: 0,
      next_step: '',
      next_step_date: null,
      is_primary: false,
      logo_file: null,
      source_client_id: clientId,
    });
  };

  ((contactsRes as any).data || []).forEach((raw: any) => pushSecondary(raw.client_id, raw, 'contact'));
  ((commercialContactsRes as any).data || []).forEach((raw: any) =>
    pushSecondary(clientIdByTracking.get(raw.tracking_id), raw, 'suivi'),
  );

  // ---- Commentaires -------------------------------------------------------
  const comments: HubTransferComment[] = [];

  const addComment = (
    clientId: string | undefined,
    body: string,
    createdAt: string | null,
    authorName: string,
    origin: string,
  ) => {
    if (!clientId || !body.trim()) return;
    const ref = primaryRefByClient.get(clientId);
    if (!ref) return;
    comments.push({ contact_ref: ref, body: body.trim(), created_at: createdAt, author_name: authorName, origin });
  };

  ((notesRes as any).data || []).forEach((n: any) => {
    const author = authorById.get(n.user_id) || '';
    const header = [n.title, n.meeting_date ? new Date(n.meeting_date).toLocaleDateString('fr-FR') : null]
      .filter(Boolean)
      .join(' — ');
    const body = [author ? `${author} :` : null, header, n.content].filter(Boolean).join('\n');
    addComment(n.client_id, body, iso(n.created_at), author, 'Compte rendu');
  });

  ((commercialNotesRes as any).data || []).forEach((n: any) => {
    const author = authorById.get(n.author_id) || '';
    const header = [n.title, n.meeting_date ? new Date(n.meeting_date).toLocaleDateString('fr-FR') : null]
      .filter(Boolean)
      .join(' — ');
    const body = [author ? `${author} :` : null, header, n.content].filter(Boolean).join('\n');
    addComment(clientIdByTracking.get(n.tracking_id), body, iso(n.created_at), author, 'Note commerciale');
  });

  ((commercialMeetingsRes as any).data || []).forEach((m: any) => {
    const body = [
      'Réunion',
      [m.label, m.meeting_type].filter(Boolean).join(' — '),
      m.meeting_date ? new Date(m.meeting_date).toLocaleDateString('fr-FR') : null,
    ]
      .filter(Boolean)
      .join('\n');
    addComment(clientIdByTracking.get(m.tracking_id), body, iso(m.created_at), '', 'Réunion');
  });

  const payload: HubTransferPayload = {
    version: PROJECT_HUB_TRANSFER_VERSION,
    generated_at: new Date().toISOString(),
    source: 'HubTeam CRM',
    stages: Array.from(stageLabels.entries()).map(([label, sort_order]) => ({ label, sort_order })),
    contacts,
    comments,
  };

  return { payload, logos };
}

/** Génère et télécharge le dossier compressé à importer dans Project Hub. */
export async function downloadProjectHubTransfer(clients: any[]): Promise<void> {
  const { payload, logos } = await buildProjectHubTransfer(clients);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  zip.file('project-hub-crm.json', JSON.stringify(payload, null, 2));
  zip.file(
    'LISEZ-MOI.txt',
    [
      'Transfert CRM HubTeam → Project Hub',
      '',
      `Généré le ${new Date().toLocaleString('fr-FR')}`,
      `${payload.contacts.length} fiche(s), ${payload.comments.length} commentaire(s), ${logos.length} logo(s).`,
      '',
      'Contenu :',
      '- project-hub-crm.json : fiches (crm_contacts), commentaires (crm_comments), étapes (crm_stages)',
      '- logos/ : image de chaque société, référencée par le champ logo_file',
      '',
      'À importer depuis l\'écran d\'import du CRM de Project Hub.',
    ].join('\n'),
  );

  if (logos.length) {
    const folder = zip.folder('logos')!;
    await Promise.all(
      logos.map(async ({ file, url }) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          folder.file(file, await res.blob());
        } catch (e) {
          console.warn('Logo non téléchargé:', url, e);
        }
      }),
    );
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = `crm-vers-project-hub-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
