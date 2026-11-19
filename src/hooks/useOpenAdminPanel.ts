import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdminUrlObfuscationService } from '@/services/adminUrlObfuscation';
import { adminResourcePath } from '@/config/adminRoutes';
import { useToast } from '@/components/ui/use-toast';
import { devLog } from '@/utils/productionLogger';

export function useOpenAdminPanel() {
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpening, setIsOpening] = useState(false);

  const openAdminPanel = useCallback(async () => {
    if (!user?.id || !isAdmin || isOpening || isMobile) {
      return;
    }

    setIsOpening(true);
    try {
      const url = await AdminUrlObfuscationService.generateSecureDashboardUrl(user.id);
      navigate(url);
    } catch (error) {
      devLog.error('Failed to open admin panel', error);
      toast({
        title: 'Não foi possível abrir o painel',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      navigate(adminResourcePath('dashboard'));
    } finally {
      setIsOpening(false);
    }
  }, [user?.id, isAdmin, isOpening, isMobile, navigate, toast]);

  return {
    openAdminPanel,
    isOpening,
    canOpenAdminPanel: isAdmin && !!user?.id && !isMobile,
  };
}
