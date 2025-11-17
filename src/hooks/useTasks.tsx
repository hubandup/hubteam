import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  assigned_to: string | null;
  project_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  projects?: {
    id: string;
    name: string;
    project_clients?: Array<{
      clients: {
        company: string;
        first_name: string;
        last_name: string;
      };
    }>;
  };
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      projects (
        id,
        name,
        project_clients (
          clients (
            company,
            first_name,
            last_name
          )
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch assigned user profiles separately
  const assignedUserIds = [...new Set((data || []).map(t => t.assigned_to).filter(Boolean))];
  
  let profilesMap: Record<string, any> = {};
  if (assignedUserIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', assignedUserIds);

    profilesMap = (profilesData || []).reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {} as Record<string, any>);
  }

  return (data || []).map(task => ({
    ...task,
    profiles: task.assigned_to ? profilesMap[task.assigned_to] : null,
  })) as Task[];
}

export function useTasks() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });

  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
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
