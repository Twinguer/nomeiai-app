import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { devLog } from '@/utils/productionLogger';

const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;

interface PresenceContextValue {
  onlineUserIds: Set<string>;
  isOnline: (userId?: string | null) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set<string>(),
  isOnline: () => false,
});

function extractUserIdsFromPresence(state: Record<string, unknown>): Set<string> {
  const userIds = new Set<string>();

  Object.keys(state).forEach((key) => {
    if (!key || key === 'viewer') return;

    userIds.add(key);

    const presences = state[key];
    if (Array.isArray(presences)) {
      presences.forEach((presence) => {
        if (
          presence &&
          typeof presence === 'object' &&
          'user_id' in presence &&
          typeof (presence as { user_id?: unknown }).user_id === 'string'
        ) {
          userIds.add((presence as { user_id: string }).user_id);
        }
      });
    }
  });

  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_LOGS !== 'false') {
    devLog.info('Presence state extraído', {
      totalKeys: Object.keys(state).length,
      userIdsCount: userIds.size,
      userIds: Array.from(userIds),
    });
  }

  return userIds;
}

export const PresenceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('xuovcuefnullpmpktrzd')) {
      devLog.warn('Supabase não configurado corretamente. Pulando configuração de WebSocket.');
      return;
    }

    if (isLoading) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    const userId = user?.id ?? null;
    activeUserIdRef.current = userId;

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const updateOnlineUsers = () => {
      if (!isMounted || !channel) return;
      const state = channel.presenceState();
      setOnlineUserIds(extractUserIdsFromPresence(state));
    };

    const trackPresence = async () => {
      if (!channel || !activeUserIdRef.current) return;

      try {
        await channel.track({
          user_id: activeUserIdRef.current,
          online_at: new Date().toISOString(),
        });
        updateOnlineUsers();
      } catch (error) {
        devLog.error('Error tracking presence:', error);
      }
    };

    const untrackPresence = async () => {
      if (!channel) return;

      try {
        await channel.untrack();
        updateOnlineUsers();
      } catch (error) {
        devLog.error('Error untracking presence:', error);
      }
    };

    const setup = async () => {
      try {
        channel = supabase.channel('online_users', {
          config: {
            presence: { key: userId || 'viewer' },
          },
        });

        channel
          .on('presence', { event: 'sync' }, updateOnlineUsers)
          .on('presence', { event: 'join' }, updateOnlineUsers)
          .on('presence', { event: 'leave' }, updateOnlineUsers)
          .subscribe(async (status) => {
            if (!isMounted || status !== 'SUBSCRIBED') return;

            if (activeUserIdRef.current) {
              await trackPresence();

              clearHeartbeat();
              heartbeatIntervalRef.current = setInterval(() => {
                void trackPresence();
              }, PRESENCE_HEARTBEAT_INTERVAL_MS);
            } else {
              updateOnlineUsers();
            }
          });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Failed to fetch') || message.includes('ERR_NAME_NOT_RESOLVED')) {
          devLog.warn('Erro de conexão WebSocket. Verifique a configuração do Supabase.');
          return;
        }
        devLog.error('Error setting up presence channel:', error);
      }
    };

    const handlePageHide = () => {
      void untrackPresence();
    };

    void setup();
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      isMounted = false;
      window.removeEventListener('pagehide', handlePageHide);
      clearHeartbeat();

      if (channel) {
        void channel.untrack().finally(() => {
          supabase.removeChannel(channel!);
        });
      }
    };
  }, [user?.id, isLoading]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      onlineUserIds,
      isOnline: (userId?: string | null) => !!userId && onlineUserIds.has(userId),
    }),
    [onlineUserIds]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => useContext(PresenceContext);
