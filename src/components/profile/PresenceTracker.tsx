import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const PresenceTracker: React.FC = () => {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase.channel('online_users', {
        config: {
          presence: { key: user.id },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          // no-op: other components will read presence
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel!.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
};
