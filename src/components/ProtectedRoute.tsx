import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';

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

  // Si aucun rôle n'est trouvé après le chargement, afficher un message d'erreur
  if (!role && !roleLoading && user) {
    console.error('[ProtectedRoute] No role found for user:', user.id);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <p className="text-destructive font-semibold">Erreur de rôle utilisateur</p>
          <p className="text-muted-foreground">Aucun rôle n'a été trouvé pour votre compte.</p>
          <p className="text-sm text-muted-foreground">Veuillez contacter l'administrateur.</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Rafraîchir la page
          </Button>
        </div>
      </div>
    );
  }

  // Redirect clients away from /crm page
  if (role === 'client' && location.pathname === '/crm') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
