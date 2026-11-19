import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export class OnlineStatusService {
  private static instance: OnlineStatusService;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isOnline = false;

  private constructor() {}

  public static getInstance(): OnlineStatusService {
    if (!OnlineStatusService.instance) {
      OnlineStatusService.instance = new OnlineStatusService();
    }
    return OnlineStatusService.instance;
  }

  /**
   * Marca o usuário como online e inicia o heartbeat
   */
  public async setUserOnline(userId: string): Promise<void> {
    try {
      // Atualizar apenas is_online
      const { error } = await supabase
        .from('users_profiles')
        .update({ 
          is_online: true 
        })
        .eq('id', userId);

      if (error) {
        devLog.error('Error setting user online:', error);
        return;
      }

      this.isOnline = true;
      this.startHeartbeat(userId);
      
      // devLog.log('User marked as online:', userId);
    } catch (error) {
      devLog.error('Error in setUserOnline:', error);
    }
  }

  /**
   * Marca o usuário como offline
   */
  public async setUserOffline(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({ 
          is_online: false
        })
        .eq('id', userId);

      if (error) {
        devLog.error('Error setting user offline:', error);
        return;
      }

      this.isOnline = false;
      this.stopHeartbeat();
      
      // devLog.log('User marked as offline:', userId);
    } catch (error) {
      devLog.error('Error in setUserOffline:', error);
    }
  }

  /**
   * Inicia o heartbeat para manter o usuário online
   */
  private startHeartbeat(userId: string): void {
    // Limpar heartbeat anterior se existir
    this.stopHeartbeat();

    // Atualizar a cada 2 minutos para manter o status online
    this.heartbeatInterval = setInterval(async () => {
      if (this.isOnline) {
        try {
          const { error } = await supabase
            .from('users_profiles')
            .update({ 
              is_online: true 
            })
            .eq('id', userId);

          if (error) {
            devLog.error('Heartbeat error:', error);
          }
        } catch (error) {
          devLog.error('Heartbeat error:', error);
        }
      }
    }, 2 * 60 * 1000); // 2 minutos
  }

  /**
   * Para o heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Verifica se o usuário está online
   */
  public isUserOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Limpa o status online (para logout)
   */
  public cleanup(): void {
    this.stopHeartbeat();
    this.isOnline = false;
  }
}

// Exportar instância singleton
export const onlineStatusService = OnlineStatusService.getInstance();
