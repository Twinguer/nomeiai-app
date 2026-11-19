import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { checkIsPlatformAdmin } from '@/utils/adminRole';

export const useAdminAuth = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const isPlatformAdmin = await checkIsPlatformAdmin();
      setIsAdmin(isPlatformAdmin);
      setIsLoading(false);
    };

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  return {
    isAdmin,
    isLoading: authLoading || isLoading,
    user,
  };
};
