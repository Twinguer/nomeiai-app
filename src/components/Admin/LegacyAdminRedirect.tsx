import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { mapLegacyAdminPath } from '@/config/adminRoutes';
import NotFound from '@/pages/NotFound';

const LegacyAdminRedirect: React.FC = () => {
  const { pathname } = useLocation();
  const target = mapLegacyAdminPath(pathname);

  if (!target) {
    return <NotFound />;
  }

  return <Navigate to={target} replace />;
};

export default LegacyAdminRedirect;
