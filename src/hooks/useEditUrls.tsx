import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { EditUrlObfuscationService } from '@/services/editUrlObfuscation';

export const useEditUrls = () => {
  const { user } = useAuth();

  const generateEditUrl = useCallback(async (concursoId: string): Promise<string> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }
    return EditUrlObfuscationService.generateEditUrl(concursoId, user.id);
  }, [user]);

  const validateEditToken = useCallback(async (token: string): Promise<string | null> => {
    if (!user) {
      return null;
    }
    return EditUrlObfuscationService.validateEditToken(token, user.id);
  }, [user]);

  return {
    generateEditUrl,
    validateEditToken
  };
};
