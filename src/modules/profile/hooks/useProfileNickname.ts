import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  formatPublicNicknameHandle,
  normalizeNicknameInput,
  stripNicknamePrefix,
} from '@/utils/nicknameUtils';
import { devLog } from '@/utils/productionLogger';
import { profileService } from '../services/profileService';

type NicknameStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'saving'
  | 'success'
  | 'error';

export function useProfileNickname(
  userId: string | undefined,
  profileNickname: string | null | undefined,
  onProfileRefetch: () => Promise<unknown>
) {
  const { toast } = useToast();
  const [nickname, setNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const nicknameAutoRequestedRef = useRef(false);
  const lastServerNicknameRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const cleanNickname = stripNicknamePrefix(profileNickname);
    setNickname(cleanNickname);

    if (lastServerNicknameRef.current !== profileNickname) {
      lastServerNicknameRef.current = profileNickname;
      setNicknameInput(cleanNickname);
      setNicknameStatus('idle');
      setNicknameMessage('');
    }
  }, [profileNickname]);

  const sanitizeNicknameInput = useCallback((value: string) => {
    return normalizeNicknameInput(value);
  }, []);

  const handleNicknameInputChange = (value: string) => {
    setNicknameInput(sanitizeNicknameInput(value));
    setNicknameStatus('idle');
    setNicknameMessage('');
  };

  const nicknameDirty = nicknameInput !== nickname;
  const isNicknameBusy = nicknameStatus === 'checking' || nicknameStatus === 'saving';

  const verifyNicknameAvailability = useCallback(async () => {
    if (!userId) return;
    const normalized = sanitizeNicknameInput(nicknameInput);

    if (!normalized || normalized.length < 3) {
      setNicknameStatus('error');
      setNicknameMessage('Use pelo menos 3 caracteres (letras minúsculas, números, underscore ou ponto).');
      return;
    }

    setNicknameStatus('checking');
    setNicknameMessage('');

    try {
      const data = await profileService.validateNicknameAvailability(normalized, userId);
      if (data?.is_valid) {
        setNicknameStatus('available');
        setNicknameMessage('Nickname disponível!');
      } else {
        setNicknameStatus('unavailable');
        setNicknameMessage(data?.reason || 'Nickname indisponível.');
      }
    } catch (error: unknown) {
      devLog.error('Nickname validation error:', error);
      setNicknameStatus('error');
      setNicknameMessage(
        error instanceof Error ? error.message : 'Não foi possível validar o nickname.'
      );
    }
  }, [nicknameInput, sanitizeNicknameInput, userId]);

  const updateNickname = useCallback(
    async (normalizedNickname: string | null, silent = false) => {
      if (!userId) return;
      setNicknameStatus('saving');
      setNicknameMessage('');

      try {
        const data = await profileService.updateNickname(userId, normalizedNickname);
        if (!data?.success) {
          setNicknameStatus('error');
          setNicknameMessage(data?.error || 'Não foi possível atualizar o nickname.');
          if (!silent) {
            toast({
              title: 'Erro ao atualizar nickname',
              description: data?.error || 'Tente novamente em instantes.',
              variant: 'destructive',
            });
          }
          return;
        }

        const updated = data.nickname ?? '';
        setNickname(updated);
        setNicknameInput(updated);
        setNicknameStatus('success');
        setNicknameMessage(silent ? '' : 'Nickname atualizado com sucesso!');
        if (!silent) {
          toast({
            title: 'Nickname atualizado',
            description: `Seu novo nickname é ${formatPublicNicknameHandle(updated) ?? ''}`,
          });
        }

        await onProfileRefetch();
      } catch (error: unknown) {
        devLog.error('Nickname update error:', error);
        setNicknameStatus('error');
        const description =
          error instanceof Error ? error.message : 'Não foi possível atualizar o nickname.';
        setNicknameMessage(description);
        if (!silent) {
          toast({
            title: 'Erro ao atualizar nickname',
            description,
            variant: 'destructive',
          });
        }
      }
    },
    [onProfileRefetch, toast, userId]
  );

  const saveNickname = useCallback(async () => {
    const normalized = sanitizeNicknameInput(nicknameInput);
    if (!normalized || normalized.length < 3) {
      setNicknameStatus('error');
      setNicknameMessage('Use pelo menos 3 caracteres (letras minúsculas, números, underscore ou ponto).');
      return;
    }
    await updateNickname(normalized, false);
  }, [nicknameInput, sanitizeNicknameInput, updateNickname]);

  const generateNicknameAutomatically = useCallback(async () => {
    await updateNickname(null, false);
  }, [updateNickname]);

  useEffect(() => {
    if (!profileNickname && userId && !nicknameAutoRequestedRef.current) {
      nicknameAutoRequestedRef.current = true;
      updateNickname(null, true);
    }
  }, [profileNickname, updateNickname, userId]);

  return {
    nickname,
    nicknameInput,
    nicknameStatus,
    nicknameMessage,
    nicknameDirty,
    isNicknameBusy,
    handleNicknameInputChange,
    verifyNicknameAvailability,
    saveNickname,
    generateNicknameAutomatically,
    resetNicknameInput: () => {
      setNicknameInput(nickname);
      setNicknameStatus('idle');
      setNicknameMessage('');
    },
  };
}
