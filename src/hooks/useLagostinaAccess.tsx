import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export function useLagostinaAccess() {
  const { user } = useAuth();
  const { role } = useUserRole();

  const { data: hasAccess = false, isLoading } = useQuery({
    queryKey: ['lagostina-access', user?.id, role],
    queryFn: async () => {
      if (!user) return false;
      // Admins and team always have access
      if (role === 'admin' || role === 'team') return true;

      const { data, error } = await supabase
        .from('lagostina_access')
        .select('granted')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[useLagostinaAccess]', error);
        return false;
      }

      return data?.granted === true;
    },
    enabled: !!user && !!role,
    staleTime: 1000 * 60 * 5,
  });

  return { hasAccess, isLoading };
}
