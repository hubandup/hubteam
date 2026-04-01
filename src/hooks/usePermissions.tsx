import { useQuery } from '@tanstack/react-query';
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

async function fetchPermissions(userId: string): Promise<Permission[]> {
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (roleError) throw roleError;
  if (!roleData) return [];

  const { data: permissionsData, error: permissionsError } = await supabase
    .from('role_permissions')
    .select('module, action, scope')
    .eq('role', roleData.role);

  if (permissionsError) throw permissionsError;
  return permissionsData || [];
}

export function usePermissions() {
  const { user } = useAuth();

  const { data: permissions = [], isLoading, refetch } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => fetchPermissions(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });

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
    loading: !!user && isLoading,
    hasPermission,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    refetch,
  };
}
