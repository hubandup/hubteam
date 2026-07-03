// Centralized project-status vocabulary used across CRM filters and badges.
// Kept additive: mirrors the labels used in the Projects page.

export type ProjectStatusKey =
  | 'planning'
  | 'reco_in_progress'
  | 'active'
  | 'completed'
  | 'lost'
  | 'archived';

export type ClientProjectFilterKey = ProjectStatusKey | 'all' | 'none';

export const PROJECT_STATUS_LABELS: Record<ProjectStatusKey, string> = {
  planning: 'À faire',
  reco_in_progress: 'Reco',
  active: 'En cours',
  completed: 'Terminés',
  lost: 'Perdus',
  archived: 'Archivés',
};

// Tailwind classes for status badges (kept minimal, contrast-friendly).
export const PROJECT_STATUS_BADGE_CLASSES: Record<ProjectStatusKey, string> = {
  planning: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  reco_in_progress: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  lost: 'bg-red-500/10 text-red-600 border-red-500/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

export const PROJECT_STATUS_ORDER: ProjectStatusKey[] = [
  'planning',
  'reco_in_progress',
  'active',
  'completed',
  'lost',
  'archived',
];

/**
 * Derives the unique set of project statuses for a client from its
 * project_clients relation. Projects flagged `archived: true` are
 * reported as 'archived' regardless of their `status` column.
 */
export function computeClientProjectStatuses(
  projectClients?: Array<{
    projects?: { id: string; status: string | null; archived?: boolean | null } | null;
  }> | null,
): ProjectStatusKey[] {
  const set = new Set<ProjectStatusKey>();
  (projectClients || []).forEach((pc) => {
    const p = pc?.projects;
    if (!p) return;
    if (p.archived) {
      set.add('archived');
      return;
    }
    if (p.status && (PROJECT_STATUS_ORDER as string[]).includes(p.status)) {
      set.add(p.status as ProjectStatusKey);
    }
  });
  // Return in canonical order for stable badge ordering
  return PROJECT_STATUS_ORDER.filter((s) => set.has(s));
}
