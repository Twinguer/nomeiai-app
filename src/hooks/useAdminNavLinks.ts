import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSecureAdminUrls } from '@/services/adminUrlObfuscation';
import { adminResourcePath, type AdminResource } from '@/config/adminRoutes';

const DEFAULT_LINKS: Record<AdminResource, string> = {
  dashboard: adminResourcePath('dashboard'),
  concursos: adminResourcePath('concursos'),
  usuarios: adminResourcePath('usuarios'),
  vouchers: adminResourcePath('vouchers'),
};

export function useAdminNavLinks() {
  const { user } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
  const { generateSecureUrl } = useSecureAdminUrls();
  const [links, setLinks] = useState(DEFAULT_LINKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdminLoading) {
      return;
    }

    if (!user?.id || !isAdmin) {
      setLinks(DEFAULT_LINKS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadLinks = async () => {
      setLoading(true);
      try {
        const [dashboard, concursos, usuarios, vouchers] = await Promise.all([
          generateSecureUrl(user.id, 'dashboard'),
          generateSecureUrl(user.id, 'concursos'),
          generateSecureUrl(user.id, 'usuarios'),
          generateSecureUrl(user.id, 'vouchers'),
        ]);

        if (!cancelled) {
          setLinks({ dashboard, concursos, usuarios, vouchers });
        }
      } catch {
        if (!cancelled) {
          setLinks(DEFAULT_LINKS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadLinks();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin, isAdminLoading, generateSecureUrl]);

  return { links, loading: loading || isAdminLoading };
}
