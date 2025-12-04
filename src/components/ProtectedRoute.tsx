import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { PageLoader } from '@/components/PageLoader';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading || (!role && user)) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect clients away from /crm page
  if (role === 'client' && location.pathname === '/crm') {
    return <Navigate to="/" replace />;
  }

  // Redirect agencies away from /prospection and /activity pages
  if (role === 'agency' && (location.pathname === '/prospection' || location.pathname === '/activity')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
