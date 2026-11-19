import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/utils/secureLogger';

/**
 * Hook para registrar ações sensíveis no audit log
 */
export const useAuditLog = () => {
  const logAction = useCallback(async (
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return;
      }

      await supabase.rpc('log_sensitive_action', {
        p_user_id: user.id,
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_metadata: metadata || {}
      });
    } catch (error) {
      // Não quebra a aplicação se falhar o log
      logError('Failed to log audit action', { action, resourceType }, 'AUDIT');
    }
  }, []);

  return { logAction };
};
