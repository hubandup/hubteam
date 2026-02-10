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
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[useUserRole] Error fetching role:', error);
          setRole(null);
        } else if (data?.role) {
          setRole(data.role as UserRole);
        } else {
          // Try direct query as fallback
          const { data: fallbackData } = await supabase
            .rpc('has_role', { _user_id: user.id, _role: 'admin' });
          
          if (fallbackData === true) {
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
