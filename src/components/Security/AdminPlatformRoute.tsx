import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface AdminPlatformRouteProps {
  children: React.ReactNode;
}

export const AdminPlatformRoute: React.FC<AdminPlatformRouteProps> = ({ children }) => {
  const { isAdmin, isLoading, user } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
