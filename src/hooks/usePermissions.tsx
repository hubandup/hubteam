import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppModule = 
  | 'dashboard' 
  | 'crm' 
  | 'agencies' 
  | 'projects' 
  | 'tasks' 
  | 'feed'
  | 'prospection'
  | 'notes'
  | 'settings' 
  | 'settings_profile'
  | 'settings_security'
  | 'settings_notifications'
  | 'settings_users'
  | 'settings_permissions'
  | 'settings_data'
  | 'settings_design'
  | 'settings_faq'
  | 'faq' 
  | 'messages';
export type PermissionAction = 'read' | 'create' | 'update' | 'delete';
export type PermissionScope = 'all' | 'limited' | 'own';

interface Permission {
  module: AppModule;
  action: PermissionAction;
  scope?: PermissionScope;
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
        .select('module, action, scope')
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

  const hasPermission = (module: AppModule, action: PermissionAction, scope?: PermissionScope): boolean => {
    return permissions.some(p => {
      const moduleMatch = p.module === module;
      const actionMatch = p.action === action;
      const scopeMatch = !scope || !p.scope || p.scope === scope || p.scope === 'all';
      return moduleMatch && actionMatch && scopeMatch;
    });
  };

  const canRead = (module: AppModule, scope?: PermissionScope): boolean => hasPermission(module, 'read', scope);
  const canCreate = (module: AppModule, scope?: PermissionScope): boolean => hasPermission(module, 'create', scope);
  const canUpdate = (module: AppModule, scope?: PermissionScope): boolean => hasPermission(module, 'update', scope);
  const canDelete = (module: AppModule, scope?: PermissionScope): boolean => hasPermission(module, 'delete', scope);

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
