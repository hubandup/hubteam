import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface ActivityLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

async function fetchActivities() {
  const { data: activityData, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('action_type', 'INSERT')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const userIds = [...new Set(activityData?.map(a => a.user_id).filter(Boolean) || [])];

  let profilesMap: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', userIds);

    profilesMap = (profilesData || []).reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {} as Record<string, any>);
  }

  return (activityData || []).map(activity => ({
    ...activity,
    profiles: activity.user_id ? profilesMap[activity.user_id] : null,
  }));
}

export function useActivities() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
  });

  useEffect(() => {
    const channel = supabase
      .channel('activity-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_log',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
