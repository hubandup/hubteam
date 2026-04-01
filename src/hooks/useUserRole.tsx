import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'team' | 'client' | 'agency';

async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[useUserRole] Error fetching role:', error);
    return null;
  }

  if (data?.role) {
    return data.role as UserRole;
  }

  // Fallback
  const { data: fallbackData } = await supabase
    .rpc('has_role', { _user_id: userId, _role: 'admin' });

  if (fallbackData === true) return 'admin';
  return null;
}

export function useUserRole() {
  const { user } = useAuth();

  const { data: role = null, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: () => fetchUserRole(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes — role rarely changes
    gcTime: 1000 * 60 * 60, // keep in cache 1 hour
  });

  return {
    role,
    loading: !!user && isLoading,
    isAdmin: role === 'admin',
    isTeam: role === 'team',
    isClient: role === 'client',
    isAgency: role === 'agency',
  };
}
