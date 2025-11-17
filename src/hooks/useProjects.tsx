import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

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
  project_clients?: Array<{
    clients: {
      company: string;
      logo_url: string | null;
    };
  }>;
}

async function fetchProjects(isClient: boolean, userId: string | null) {
  if (isClient && userId) {
    // For clients, only show their own projects
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profileData) {
      return [];
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('email', profileData.email)
      .single();

    if (!clientData) {
      return [];
    }

    const { data, error } = await supabase
      .from('project_clients')
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
      .eq('client_id', clientData.id)
      .eq('projects.archived', false)
      .order('projects(created_at)', { ascending: false });

    if (error) throw error;
    
    return (data?.map(pc => pc.projects).filter(Boolean) || []) as Project[];
  } else {
    // For admin/team, show all projects
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_clients (
          clients (
            company,
            logo_url
          )
        )
      `)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Project[];
  }
}

async function fetchArchivedProjects(isClient: boolean, userId: string | null) {
  if (isClient && userId) {
    // For clients, only show their own archived projects
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profileData) {
      return [];
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('email', profileData.email)
      .single();

    if (!clientData) {
      return [];
    }

    const { data, error } = await supabase
      .from('project_clients')
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
      .eq('client_id', clientData.id)
      .eq('projects.archived', true)
      .order('projects(created_at)', { ascending: false });

    if (error) throw error;
    
    return (data?.map(pc => pc.projects).filter(Boolean) || []) as Project[];
  } else {
    // For admin/team, show all archived projects
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_clients (
          clients (
            company,
            logo_url
          )
        )
      `)
      .eq('archived', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Project[];
  }
}

export function useProjects() {
  const { user } = useAuth();
  const { isClient } = useUserRole();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects', isClient, user?.id],
    queryFn: () => fetchProjects(isClient, user?.id || null),
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
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['archived-projects'] });
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

export function useArchivedProjects() {
  const { user } = useAuth();
  const { isClient } = useUserRole();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['archived-projects', isClient, user?.id],
    queryFn: () => fetchArchivedProjects(isClient, user?.id || null),
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return query;
}
