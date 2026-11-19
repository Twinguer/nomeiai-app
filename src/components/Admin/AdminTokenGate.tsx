import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AdminUrlObfuscationService } from '@/services/adminUrlObfuscation';
import type { AdminResource } from '@/config/adminRoutes';
import { devLog } from '@/utils/productionLogger';

interface AdminTokenGateProps {
  resource: AdminResource;
}

const AdminTokenGate: React.FC<AdminTokenGateProps> = ({ resource }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    AdminUrlObfuscationService.generateSecureAdminUrl(user.id, resource)
      .then((url) => {
        if (!cancelled) {
          navigate(url, { replace: true });
        }
      })
      .catch((error) => {
        devLog.error('Failed to generate admin URL:', error);
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, resource, navigate]);

  if (failed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Não foi possível abrir esta área. Tente novamente.
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

export default AdminTokenGate;
