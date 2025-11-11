import { ReactNode } from 'react';
import { usePermissions, AppModule, PermissionAction, PermissionScope } from '@/hooks/usePermissions';

interface ProtectedActionProps {
  module: AppModule;
  action: PermissionAction;
  scope?: PermissionScope;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @example
 * <ProtectedAction module="crm" action="create" scope="all">
 *   <Button>Ajouter un client</Button>
 * </ProtectedAction>
 */
export function ProtectedAction({ module, action, scope, children, fallback = null }: ProtectedActionProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(module, action, scope)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
