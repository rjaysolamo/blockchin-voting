import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { UserRole } from '@/@types';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { effectiveRole, isEffectiveAuthenticated, isLoading } = useEffectiveRole();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isEffectiveAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !effectiveRole) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && effectiveRole && !allowedRoles.includes(effectiveRole)) {
    // Redirect to appropriate dashboard based on role
    let redirectPath = '/student/dashboard';
    switch (effectiveRole) {
      case 'admin':
        redirectPath = '/admin/dashboard';
        break;
      case 'candidate':
        redirectPath = '/candidate/dashboard';
        break;
      case 'staff':
        redirectPath = '/staff/dashboard';
        break;
      default:
        redirectPath = '/student/dashboard';
    }
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
