import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppSkeleton } from '@/components/AppSkeleton';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading || (!role && user)) {
    return <AppSkeleton />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect clients away from restricted pages
  if (role === 'client' && (location.pathname === '/crm' || location.pathname === '/feed')) {
    return <Navigate to="/" replace />;
  }

  // Redirect agencies away from /prospection and /activity pages
  if (role === 'agency' && (location.pathname === '/prospection' || location.pathname === '/activity')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
