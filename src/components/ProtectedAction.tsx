import { ReactNode } from 'react';
import { usePermissions, AppModule, PermissionAction } from '@/hooks/usePermissions';

interface ProtectedActionProps {
  module: AppModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @example
 * <ProtectedAction module="crm" action="create">
 *   <Button>Ajouter un client</Button>
 * </ProtectedAction>
 */
export function ProtectedAction({ module, action, children, fallback = null }: ProtectedActionProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
