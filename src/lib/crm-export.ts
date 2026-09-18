import { supabase } from '@/integrations/supabase/client';
import type { ExportSheet } from '@/components/exports/ExportButton';

const fmt = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
};

const fmtDateTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString('fr-FR');
};

/**
 * Charge toutes les données associées aux clients exportés
 * (comptes rendus, notes commerciales, réunions, contacts, projets).
 */
export async function buildCrmExportSheets(clients: any[]): Promise<ExportSheet[]> {
  const clientIds = clients.map((c) => c.id).filter(Boolean);
  const nameById = new Map<string, string>(
    clients.map((c) => [c.id, c.company || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]),
  );

  if (clientIds.length === 0) return [];

  const [
    meetingNotesRes,
    contactsRes,
    trackingRes,
    projectLinksRes,
  ] = await Promise.all([
    supabase
      .from('meeting_notes')
      .select('client_id, title, content, meeting_date, is_private, attachment_url, created_at, user_id')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_contacts')
      .select('client_id, first_name, last_name, email, title, created_at')
      .in('client_id', clientIds),
    supabase
      .from('commercial_tracking')
      .select('id, client_id, status')
      .in('client_id', clientIds),
    supabase
      .from('project_clients')
      .select('client_id, projects(*)')
      .in('client_id', clientIds),
  ]);

  const trackings = trackingRes.data || [];
  const clientIdByTracking = new Map<string, string>(trackings.map((t: any) => [t.id, t.client_id]));
  const trackingIds = trackings.map((t: any) => t.id);

  const [commercialNotesRes, commercialMeetingsRes, commercialContactsRes] = trackingIds.length
    ? await Promise.all([
        supabase
          .from('commercial_notes')
          .select('tracking_id, title, content, meeting_date, is_private, attachment_url, created_at, author_id')
          .in('tracking_id', trackingIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('commercial_meetings')
          .select('tracking_id, label, meeting_type, meeting_date, source_type, created_at')
          .in('tracking_id', trackingIds),
        supabase
          .from('commercial_contacts')
          .select('*')
          .in('tracking_id', trackingIds),
      ])
    : [{ data: [] } as any, { data: [] } as any, { data: [] } as any];

  // Projets liés aux clients : notes de projet et commentaires de tâches
  const projectIds = Array.from(
    new Set((projectLinksRes.data || []).map((pl: any) => pl.projects?.id).filter(Boolean)),
  );
  const clientIdByProject = new Map<string, string>(
    (projectLinksRes.data || [])
      .filter((pl: any) => pl.projects)
      .map((pl: any) => [pl.projects.id, pl.client_id]),
  );

  const [projectNotesRes, tasksRes, taskCommentsRes] = projectIds.length
    ? await Promise.all([
        supabase
          .from('project_notes')
          .select('project_id, content, is_private, created_by, created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('tasks')
          .select('id, project_id, title, status, priority, end_date, assigned_to, created_at')
          .in('project_id', projectIds),
        supabase
          .from('task_comments')
          .select('task_id, project_id, user_id, content, attachment_url, created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
      ])
    : [{ data: [] } as any, { data: [] } as any, { data: [] } as any];

  const taskById = new Map<string, any>((tasksRes.data || []).map((t: any) => [t.id, t]));

  // Auteurs (comptes rendus, notes commerciales, notes projet, commentaires)
  const authorIds = Array.from(
    new Set(
      [
        ...(meetingNotesRes.data || []).map((n: any) => n.user_id),
        ...(commercialNotesRes.data || []).map((n: any) => n.author_id),
        ...(projectNotesRes.data || []).map((n: any) => n.created_by),
        ...(taskCommentsRes.data || []).map((c: any) => c.user_id),
        ...(tasksRes.data || []).map((t: any) => t.assigned_to),
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

  const sheets: ExportSheet[] = [
    {
      name: 'Comptes rendus',
      rows: (meetingNotesRes.data || []).map((n: any) => ({
        Client: nameById.get(n.client_id) ?? '',
        Titre: n.title ?? '',
        'Date de réunion': fmt(n.meeting_date),
        Auteur: authorById.get(n.user_id) ?? '',
        Contenu: n.content ?? '',
        Privé: n.is_private ? 'Oui' : 'Non',
        'Pièce jointe': n.attachment_url ?? '',
        'Créé le': fmtDateTime(n.created_at),
      })),
    },
    {
      name: 'Notes commerciales',
      rows: (commercialNotesRes.data || []).map((n: any) => ({
        Client: nameById.get(clientIdByTracking.get(n.tracking_id) || '') ?? '',
        Titre: n.title ?? '',
        'Date de réunion': fmt(n.meeting_date),
        Contenu: n.content ?? '',
        Privé: n.is_private ? 'Oui' : 'Non',
        'Pièce jointe': n.attachment_url ?? '',
        'Créé le': fmtDateTime(n.created_at),
      })),
    },
    {
      name: 'Réunions',
      rows: (commercialMeetingsRes.data || []).map((m: any) => ({
        Client: nameById.get(clientIdByTracking.get(m.tracking_id) || '') ?? '',
        Libellé: m.label ?? '',
        Type: m.meeting_type ?? '',
        Date: fmt(m.meeting_date),
        Source: m.source_type ?? '',
        'Créé le': fmtDateTime(m.created_at),
      })),
    },
    {
      name: 'Contacts',
      rows: [
        ...(contactsRes.data || []).map((c: any) => ({
          Client: nameById.get(c.client_id) ?? '',
          Prénom: c.first_name ?? '',
          Nom: c.last_name ?? '',
          Email: c.email ?? '',
          Fonction: c.title ?? '',
          Origine: 'Fiche client',
        })),
        ...((commercialContactsRes.data || []).map((c: any) => ({
          Client: nameById.get(clientIdByTracking.get(c.tracking_id) || '') ?? '',
          Prénom: c.first_name ?? '',
          Nom: c.last_name ?? '',
          Email: c.email ?? '',
          Fonction: c.role ?? c.title ?? '',
          Origine: 'Suivi commercial',
        }))),
      ],
    },
    {
      name: 'Projets',
      rows: (projectLinksRes.data || [])
        .filter((pl: any) => pl.projects)
        .map((pl: any) => ({
          Client: nameById.get(pl.client_id) ?? '',
          Projet: pl.projects.name ?? '',
          Statut: pl.projects.status ?? '',
          Archivé: pl.projects.archived ? 'Oui' : 'Non',
          'Date de début': fmt(pl.projects.start_date),
          'Date de fin': fmt(pl.projects.end_date),
          Budget: pl.projects.budget ?? '',
        })),
    },
    {
      name: 'Suivi commercial',
      rows: trackings.map((t: any) => ({
        Client: nameById.get(t.client_id) ?? '',
        Statut: t.status ?? '',
      })),
    },
  ];

  return sheets;
}
