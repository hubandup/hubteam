import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'team' | 'client' | 'agency';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        console.log('[useUserRole] Fetching role for user:', user.id);
        console.log('[useUserRole] Auth session:', await supabase.auth.getSession());
        
        // Use maybeSingle() to avoid throwing on empty result
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[useUserRole] Query result - data:', data, 'error:', error);

        if (error) {
          console.error('[useUserRole] Error fetching role:', error);
          setRole(null);
        } else if (data?.role) {
          console.log('[useUserRole] Role fetched successfully:', data.role);
          setRole(data.role as UserRole);
        } else {
          console.warn('[useUserRole] No role found for user:', user.id);
          // Try direct query as fallback
          const { data: fallbackData, error: fallbackError } = await supabase
            .rpc('has_role', { _user_id: user.id, _role: 'admin' });
          
          console.log('[useUserRole] Fallback has_role check:', { fallbackData, fallbackError });
          
          if (fallbackData === true) {
            console.log('[useUserRole] Fallback found admin role');
            setRole('admin');
          } else {
            setRole(null);
          }
        }
      } catch (err) {
        console.error('[useUserRole] Unexpected error:', err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return { 
    role, 
    loading, 
    isAdmin: role === 'admin', 
    isTeam: role === 'team', 
    isClient: role === 'client',
    isAgency: role === 'agency'
  };
}
