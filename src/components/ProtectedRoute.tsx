import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Si aucun rôle n'est trouvé après le chargement, rediriger vers auth
  if (!role && !roleLoading) {
    console.error('No role found for user:', user.id);
    return <Navigate to="/auth" replace />;
  }

  // Redirect clients away from /crm page
  if (role === 'client' && location.pathname === '/crm') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
