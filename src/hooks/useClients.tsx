import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface Client {
  id: string;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  logo_url: string | null;
  active: boolean;
  status_id: string | null;
  source_id: string | null;
  activity_sector_id: string | null;
  kanban_stage: string;
  revenue: number | null;
  revenue_current_year: number | null;
  last_contact: string | null;
  follow_up_date: string | null;
  action: string | null;
  linkedin_connected: boolean;
  created_at: string;
  updated_at: string;
  project_clients?: Array<{
    project_id: string;
    projects?: {
      id: string;
      status: string;
    };
  }>;
  action_name?: string;
  action_color?: string;
  hasActiveProjects?: boolean;
}

async function fetchClients() {
  // Fetch clients with projects count
  const { data: clientsData, error: clientsError } = await supabase
    .from('clients')
    .select(`
      *,
      project_clients(
        project_id,
        projects(id, status)
      )
    `)
    .order('created_at', { ascending: false });

  if (clientsError) throw clientsError;

  const { data: statusesData, error: statusesError } = await supabase
    .from('client_statuses')
    .select('id, name, color');

  if (statusesError) throw statusesError;

  const statusById = (statusesData || []).reduce<Record<string, { name: string; color: string }>>((acc, s) => {
    acc[s.id] = { name: s.name, color: s.color };
    return acc;
  }, {});

  const withAction = (clientsData || []).map((c) => {
    const activeProjects = c.project_clients?.filter(
      (pc: any) => pc.projects?.status === 'active'
    ) || [];
    
    return {
      ...c,
      action_name: c.status_id ? statusById[c.status_id]?.name : undefined,
      action_color: c.status_id ? statusById[c.status_id]?.color : undefined,
      hasActiveProjects: activeProjects.length > 0,
    };
  });

  return withAction as Client[];
}

export function useClients() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  useEffect(() => {
    const channel = supabase
      .channel('clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Optimistically remove from cache immediately
            queryClient.setQueryData(['clients'], (old: Client[] | undefined) => {
              if (!old) return old;
              return old.filter(c => c.id !== (payload.old as any)?.id);
            });
          }
          queryClient.invalidateQueries({ queryKey: ['clients'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_statuses' },
        () => queryClient.invalidateQueries({ queryKey: ['clients'] })
      )
      // Liens projet-client : ajout/suppression d'association
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_clients' },
        () => queryClient.invalidateQueries({ queryKey: ['clients'] })
      )
      // Projets : changement de statut influe sur "hasActiveProjects"
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => queryClient.invalidateQueries({ queryKey: ['clients'] })
      )
      // Devis et factures : impactent les indicateurs de la card client
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['client-revenue'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['client-revenue'] });
        }
      )
      // Commentaires de tâches : maj des indicateurs d'activité
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
