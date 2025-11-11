import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppModule = 'dashboard' | 'crm' | 'agencies' | 'projects' | 'tasks' | 'settings' | 'faq' | 'messages';
export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

interface Permission {
  module: AppModule;
  action: PermissionAction;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    fetchPermissions();
  }, [user]);

  const fetchPermissions = async () => {
    if (!user) return;

    try {
      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!roleData) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Get permissions for this role
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('role_permissions')
        .select('module, action')
        .eq('role', roleData.role);

      if (permissionsError) throw permissionsError;

      setPermissions(permissionsData || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (module: AppModule, action: PermissionAction): boolean => {
    return permissions.some(p => p.module === module && p.action === action);
  };

  const canRead = (module: AppModule): boolean => hasPermission(module, 'read');
  const canCreate = (module: AppModule): boolean => hasPermission(module, 'create');
  const canUpdate = (module: AppModule): boolean => hasPermission(module, 'update');
  const canDelete = (module: AppModule): boolean => hasPermission(module, 'delete');

  return {
    permissions,
    loading,
    hasPermission,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    refetch: fetchPermissions,
  };
}
