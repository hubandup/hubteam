/**
 * Helpers to route project navigation through the parent client fiche
 * (as requested in the UI reorganisation plan). Never mutates data —
 * only builds the URL.
 */

export type SubTab = 'tasks' | 'notes';

export interface ProjectLike {
  id: string;
  project_clients?: Array<{ clients?: { id?: string | null } | null }> | null;
}

/**
 * Build a URL that opens a project inside its parent client's page.
 * Falls back to the legacy `/project/:id` when no client is linked.
 */
export function buildProjectNavPath(
  project: ProjectLike | null | undefined,
  subtab: SubTab = 'tasks',
): string {
  if (!project?.id) return '/projects';
  const clientId = project.project_clients?.[0]?.clients?.id;
  if (!clientId) return `/project/${project.id}`;
  return `/client/${clientId}?tab=projects&project=${project.id}&subtab=${subtab}`;
}

/**
 * Build a URL to open a specific project in the embedded view,
 * given the client id explicitly (used from ClientTasksTab / ClientProjectsTab).
 */
export function buildEmbeddedProjectPath(
  clientId: string,
  projectId: string,
  subtab: SubTab = 'tasks',
): string {
  return `/client/${clientId}?tab=projects&project=${projectId}&subtab=${subtab}`;
}
