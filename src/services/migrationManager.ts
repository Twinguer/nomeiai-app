/**
 * Gerenciador de Migração Gradual
 * Controla a migração de usuários do frontend para backend de forma segura
 */

import { featureFlags, updateFeatureFlags } from '@/config/featureFlags';
import { securityMonitor } from './securityMonitor';
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export interface MigrationConfig {
  // Configuração de migração
  enabled: boolean;
  strategy: 'percentage' | 'beta_users' | 'gradual_rollout';
  
  // Configuração por percentual
  percentage?: number; // 0-100
  
  // Configuração por usuários beta
  betaUserIds?: string[];
  
  // Configuração de rollout gradual
  rolloutConfig?: {
    startPercentage: number;
    incrementPercentage: number;
    incrementInterval: number; // em horas
    maxPercentage: number;
  };
  
  // Configuração de rollback
  rollbackConfig?: {
    errorThreshold: number; // % de erros para ativar rollback
    performanceThreshold: number; // tempo médio em ms
    autoRollback: boolean;
  };
  
  // Configuração de monitoramento
  monitoringConfig?: {
    checkInterval: number; // em minutos
    alertThresholds: {
      errorRate: number; // %
      responseTime: number; // ms
      discrepancyRate: number; // %
    };
  };
}

export interface MigrationStatus {
  config: MigrationConfig;
  currentPercentage: number;
  migratedUsers: number;
  totalUsers: number;
  errorRate: number;
  averageResponseTime: number;
  discrepancyRate: number;
  lastCheck: number;
  status: 'idle' | 'migrating' | 'paused' | 'rollback' | 'completed' | 'error';
  alerts: number;
}

class MigrationManager {
  private config: MigrationConfig = {
    enabled: false,
    strategy: 'percentage',
    percentage: 0,
    rollbackConfig: {
      errorThreshold: 5, // 5% de erro
      performanceThreshold: 1000, // 1 segundo
      autoRollback: true,
    },
    monitoringConfig: {
      checkInterval: 5, // 5 minutos
      alertThresholds: {
        errorRate: 3, // 3%
        responseTime: 500, // 500ms
        discrepancyRate: 1, // 1%
      },
    },
  };
  
  private status: MigrationStatus = {
    config: this.config,
    currentPercentage: 0,
    migratedUsers: 0,
    totalUsers: 0,
    errorRate: 0,
    averageResponseTime: 0,
    discrepancyRate: 0,
    lastCheck: Date.now(),
    status: 'idle',
    alerts: 0,
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private migrationHistory: Array<{
    timestamp: number;
    action: string;
    details: any;
  }> = [];

  /**
   * Inicializa o gerenciador de migração
   */
  async initialize(): Promise<void> {
    // Carregar configuração do backend
    await this.loadConfig();
    
    // Iniciar monitoramento se habilitado
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Carrega configuração do backend
   */
  private async loadConfig(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('migration_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // Tabela não existe
        return;
      }

      if (data) {
        this.config = { ...this.config, ...data.config };
        this.status.config = this.config;
      }
    } catch (error) {
      // Erro silencioso - usar configuração padrão
    }
  }

  /**
   * Salva configuração no backend
   */
  async saveConfig(config: Partial<MigrationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.status.config = this.config;

    try {
      await supabase
        .from('migration_config')
        .upsert({
          id: 'default',
          config: this.config,
          updated_at: new Date().toISOString(),
        });
      
      this.logMigrationAction('config_updated', { config: this.config });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Inicia a migração gradual
   */
  async startMigration(): Promise<void> {
    if (this.status.status === 'migrating') {
      throw new Error('Migração já está em andamento');
    }

    this.status.status = 'migrating';
    this.logMigrationAction('migration_started', { config: this.config });

    // Aplicar migração baseada na estratégia
    switch (this.config.strategy) {
      case 'percentage':
        await this.migrateByPercentage();
        break;
      case 'beta_users':
        await this.migrateBetaUsers();
        break;
      case 'gradual_rollout':
        await this.startGradualRollout();
        break;
    }

    // Iniciar monitoramento
    this.startMonitoring();
  }

  /**
   * Migra por percentual de usuários
   */
  private async migrateByPercentage(): Promise<void> {
    const percentage = this.config.percentage || 0;
    
    if (percentage <= 0) {
      return;
    }

    // Atualizar feature flags para usar backend
    updateFeatureFlags({
      useBackendScoring: true,
      useBackendValidation: true,
    });

    this.status.currentPercentage = percentage;
    this.logMigrationAction('percentage_migration', { percentage });
  }

  /**
   * Migra usuários beta
   */
  private async migrateBetaUsers(): Promise<void> {
    const betaUserIds = this.config.betaUserIds || [];
    
    if (betaUserIds.length === 0) {
      return;
    }

    // Atualizar feature flags para usuários beta
    updateFeatureFlags({
      useBackendScoring: true,
      useBackendValidation: true,
    });

    this.status.migratedUsers = betaUserIds.length;
    this.logMigrationAction('beta_migration', { userIds: betaUserIds });
  }

  /**
   * Inicia rollout gradual
   */
  private async startGradualRollout(): Promise<void> {
    const rolloutConfig = this.config.rolloutConfig;
    if (!rolloutConfig) {
      throw new Error('Configuração de rollout gradual não encontrada');
    }

    this.status.currentPercentage = rolloutConfig.startPercentage;
    this.logMigrationAction('gradual_rollout_started', { config: rolloutConfig });

    // Agendar incrementos
    const interval = setInterval(async () => {
      if (this.status.status !== 'migrating') {
        clearInterval(interval);
        return;
      }

      const newPercentage = Math.min(
        this.status.currentPercentage + rolloutConfig.incrementPercentage,
        rolloutConfig.maxPercentage
      );

      if (newPercentage >= rolloutConfig.maxPercentage) {
        this.status.status = 'completed';
        clearInterval(interval);
        this.logMigrationAction('gradual_rollout_completed', { finalPercentage: newPercentage });
      } else {
        this.status.currentPercentage = newPercentage;
        this.logMigrationAction('gradual_rollout_increment', { newPercentage });
      }
    }, rolloutConfig.incrementInterval * 60 * 60 * 1000); // Converter horas para ms
  }

  /**
   * Pausa a migração
   */
  async pauseMigration(): Promise<void> {
    if (this.status.status !== 'migrating') {
      throw new Error('Nenhuma migração em andamento para pausar');
    }

    this.status.status = 'paused';
    this.logMigrationAction('migration_paused', {});
  }

  /**
   * Retoma a migração
   */
  async resumeMigration(): Promise<void> {
    if (this.status.status !== 'paused') {
      throw new Error('Nenhuma migração pausada para retomar');
    }

    this.status.status = 'migrating';
    this.logMigrationAction('migration_resumed', {});
  }

  /**
   * Executa rollback
   */
  async rollbackMigration(): Promise<void> {
    devLog.log('🔄 Executando rollback...');
    
    this.status.status = 'rollback';
    
    // Reverter para frontend
    updateFeatureFlags({
      useBackendScoring: false,
      useBackendValidation: false,
    });

    this.status.currentPercentage = 0;
    this.logMigrationAction('rollback_executed', {});
  }

  /**
   * Inicia monitoramento
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    const interval = this.config.monitoringConfig?.checkInterval || 5;
    this.monitoringInterval = setInterval(() => {
      this.checkMigrationHealth();
    }, interval * 60 * 1000); // Converter minutos para ms

    devLog.log(`📊 Monitoramento iniciado (verificação a cada ${interval} minutos)`);
  }

  /**
   * Para o monitoramento
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    devLog.log('📊 Monitoramento parado');
  }

  /**
   * Verifica a saúde da migração
   */
  private async checkMigrationHealth(): Promise<void> {
    try {
      const metrics = securityMonitor.getMetrics();
      const alerts = securityMonitor.getUnresolvedAlerts();
      
      // Atualizar status
      this.status.errorRate = (metrics.errors / metrics.totalCalculations) * 100;
      this.status.averageResponseTime = metrics.averageResponseTime;
      this.status.discrepancyRate = (metrics.discrepancies / metrics.totalCalculations) * 100;
      this.status.alerts = alerts.length;
      this.status.lastCheck = Date.now();

      // Verificar se precisa de rollback automático
      if (this.config.rollbackConfig?.autoRollback) {
        await this.checkRollbackConditions();
      }

      // Log da verificação
      this.logMigrationAction('health_check', {
        errorRate: this.status.errorRate,
        responseTime: this.status.averageResponseTime,
        discrepancyRate: this.status.discrepancyRate,
        alerts: this.status.alerts,
      });

    } catch (error) {
      devLog.error('Erro na verificação de saúde:', error);
      this.logMigrationAction('health_check_error', { error: error.message });
    }
  }

  /**
   * Verifica condições para rollback
   */
  private async checkRollbackConditions(): Promise<void> {
    const rollbackConfig = this.config.rollbackConfig;
    if (!rollbackConfig) return;

    const shouldRollback = 
      this.status.errorRate > rollbackConfig.errorThreshold ||
      this.status.averageResponseTime > rollbackConfig.performanceThreshold;

    if (shouldRollback) {
      devLog.warn('⚠️ Condições de rollback detectadas, executando rollback automático...');
      await this.rollbackMigration();
    }
  }

  /**
   * Obtém status atual da migração
   */
  getStatus(): MigrationStatus {
    return { ...this.status };
  }

  /**
   * Obtém histórico de migração
   */
  getHistory(): Array<{ timestamp: number; action: string; details: any }> {
    return [...this.migrationHistory];
  }

  /**
   * Verifica se um usuário deve usar backend
   */
  shouldUseBackend(userId: string): boolean {
    if (!this.config.enabled) return false;

    switch (this.config.strategy) {
      case 'percentage':
        // Implementar lógica de hash consistente para percentual
        return this.isUserInPercentage(userId, this.status.currentPercentage);
      
      case 'beta_users':
        return this.config.betaUserIds?.includes(userId) || false;
      
      case 'gradual_rollout':
        return this.isUserInPercentage(userId, this.status.currentPercentage);
      
      default:
        return false;
    }
  }

  /**
   * Verifica se usuário está no percentual de migração
   */
  private isUserInPercentage(userId: string, percentage: number): boolean {
    // Usar hash consistente baseado no userId
    const hash = this.hashString(userId);
    const userPercentage = (hash % 100) + 1; // 1-100
    return userPercentage <= percentage;
  }

  /**
   * Gera hash consistente para string
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Log de ação de migração
   */
  private logMigrationAction(action: string, details: any): void {
    const entry = {
      timestamp: Date.now(),
      action,
      details,
    };
    
    this.migrationHistory.push(entry);
    
    // Manter apenas últimos 1000 logs
    if (this.migrationHistory.length > 1000) {
      this.migrationHistory = this.migrationHistory.slice(-1000);
    }
  }

  /**
   * Limpa dados de migração
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    this.status.status = 'idle';
    this.migrationHistory = [];
    devLog.log('🧹 Dados de migração limpos');
  }
}

// Instância singleton
export const migrationManager = new MigrationManager();

// Inicializar automaticamente
if (typeof window !== 'undefined') {
  migrationManager.initialize().catch(console.error);
}
