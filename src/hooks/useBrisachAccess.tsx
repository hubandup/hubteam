import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export function useBrisachAccess() {
  const { user } = useAuth();
  const { role } = useUserRole();

  const { data: hasAccess = false, isLoading } = useQuery({
    queryKey: ['brisach-access', user?.id, role],
    queryFn: async () => {
      if (!user) return false;
      if (role === 'admin' || role === 'team') return true;

      const { data, error } = await supabase
        .from('brisach_access')
        .select('granted')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[useBrisachAccess]', error);
        return false;
      }

      return data?.granted === true;
    },
    enabled: !!user && !!role,
    staleTime: 1000 * 60 * 5,
  });

  return { hasAccess, isLoading };
}
