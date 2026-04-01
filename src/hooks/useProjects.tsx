import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  date_brief: string | null;
  date_prise_en_main: string | null;
  date_concertation_agences: string | null;
  date_montage_reco: string | null;
  date_restitution: string | null;
  project_clients?: Array<{
    clients: {
      company: string;
      logo_url: string | null;
    };
  }>;
  tasks_total?: number;
  tasks_completed?: number;
}

function mergeProjectsById(projects: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const p of projects) {
    if (!p?.id) continue;
    if (!map.has(p.id)) map.set(p.id, p);
  }
  return Array.from(map.values());
}

async function addTaskCounts(projects: Project[]): Promise<Project[]> {
  if (projects.length === 0) return projects;

  const projectIds = projects.map(p => p.id);
  
  // Fetch all tasks for these projects in one query
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('project_id, status')
    .in('project_id', projectIds);

  if (error) {
    console.error('Error fetching task counts:', error);
    return projects;
  }

  // Group tasks by project
  const taskCountsByProject = new Map<string, { total: number; completed: number }>();
  
  for (const task of tasks || []) {
    const current = taskCountsByProject.get(task.project_id) || { total: 0, completed: 0 };
    current.total++;
    if (task.status === 'done') {
      current.completed++;
    }
    taskCountsByProject.set(task.project_id, current);
  }

  // Add counts to projects
  return projects.map(project => ({
    ...project,
    tasks_total: taskCountsByProject.get(project.id)?.total || 0,
    tasks_completed: taskCountsByProject.get(project.id)?.completed || 0,
  }));
}

async function fetchProjects(userId: string | null) {
  if (!userId) return [];

  // Path 1: Projects where user is a profile member in project_team_members
  const { data: teamRows, error: teamError } = await supabase
    .from('project_team_members')
    .select(`
      projects!inner (
        *,
        project_clients (
          clients (
            company,
            logo_url
          )
        )
      )
    `)
    .eq('member_type', 'profile')
    .eq('member_id', userId)
    .eq('projects.archived', false);

  if (teamError) throw teamError;

  const teamProjects = (teamRows?.map((r: any) => r.projects).filter(Boolean) || []) as Project[];

  // Path 2: Projects where user's agency is linked via project_agencies
  let agencyProjects: Project[] = [];
  const { data: agencyMemberships } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', userId);

  if (agencyMemberships && agencyMemberships.length > 0) {
    const agencyIds = agencyMemberships.map(am => am.agency_id);

    const { data: agencyProjectRows, error: agencyError } = await supabase
      .from('project_agencies')
      .select(`
        projects!inner (
          *,
          project_clients (
            clients (
              company,
              logo_url
            )
          )
        )
      `)
      .in('agency_id', agencyIds)
      .eq('projects.archived', false);

    if (!agencyError) {
      agencyProjects = (agencyProjectRows?.map((r: any) => r.projects).filter(Boolean) || []) as Project[];
    }
  }

  // Merge and deduplicate
  const allProjects = mergeProjectsById([...teamProjects, ...agencyProjects]);
  allProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return await addTaskCounts(allProjects);
}

async function fetchArchivedProjects(userId: string | null) {
  if (!userId) return [];

  // Path 1: Archived projects where user is a profile member
  const { data: teamRows, error: teamError } = await supabase
    .from('project_team_members')
    .select(`
      projects!inner (
        *,
        project_clients (
          clients (
            company,
            logo_url
          )
        )
      )
    `)
    .eq('member_type', 'profile')
    .eq('member_id', userId)
    .eq('projects.archived', true);

  if (teamError) throw teamError;

  const teamProjects = (teamRows?.map((r: any) => r.projects).filter(Boolean) || []) as Project[];

  // Path 2: Archived projects where user's agency is linked
  let agencyProjects: Project[] = [];
  const { data: agencyMemberships } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', userId);

  if (agencyMemberships && agencyMemberships.length > 0) {
    const agencyIds = agencyMemberships.map(am => am.agency_id);

    const { data: agencyProjectRows, error: agencyError } = await supabase
      .from('project_agencies')
      .select(`
        projects!inner (
          *,
          project_clients (
            clients (
              company,
              logo_url
            )
          )
        )
      `)
      .in('agency_id', agencyIds)
      .eq('projects.archived', true);

    if (!agencyError) {
      agencyProjects = (agencyProjectRows?.map((r: any) => r.projects).filter(Boolean) || []) as Project[];
    }
  }

  // Merge and deduplicate
  const allProjects = mergeProjectsById([...teamProjects, ...agencyProjects]);
  allProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return await addTaskCounts(allProjects);
}

export function useProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: () => fetchProjects(user?.id || null),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' });
          queryClient.refetchQueries({ queryKey: ['archived-projects'], type: 'active' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_team_members',
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' });
          queryClient.refetchQueries({ queryKey: ['archived-projects'], type: 'active' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_clients',
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' });
          queryClient.refetchQueries({ queryKey: ['archived-projects'], type: 'active' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_agencies',
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' });
          queryClient.refetchQueries({ queryKey: ['archived-projects'], type: 'active' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' });
          queryClient.refetchQueries({ queryKey: ['archived-projects'], type: 'active' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return query;
}

export function useArchivedProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['archived-projects', user?.id],
    queryFn: () => fetchArchivedProjects(user?.id || null),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('archived-projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_team_members',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_agencies',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return query;
}
