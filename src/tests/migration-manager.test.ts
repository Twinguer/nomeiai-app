/**
 * Testes para Migration Manager
 * Valida o sistema de migração gradual
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrationManager, type MigrationConfig } from '@/services/migrationManager';

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: null,
          error: { code: 'PGRST116' }, // Tabela não existe
        })),
      })),
      upsert: vi.fn(() => ({
        data: null,
        error: null,
      })),
    })),
  },
}));

// Mock do securityMonitor
vi.mock('@/services/securityMonitor', () => ({
  securityMonitor: {
    getMetrics: vi.fn(() => ({
      totalCalculations: 100,
      frontendCalculations: 50,
      backendCalculations: 50,
      discrepancies: 2,
      errors: 1,
      averageResponseTime: 150,
    })),
    getUnresolvedAlerts: vi.fn(() => []),
  },
}));

describe('Migration Manager Tests', () => {
  beforeEach(async () => {
    // Limpar estado antes de cada teste
    await migrationManager.cleanup();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default config', async () => {
      await migrationManager.initialize();
      
      const status = migrationManager.getStatus();
      expect(status.status).toBe('idle');
      expect(status.config.enabled).toBe(false);
      expect(status.config.strategy).toBe('percentage');
    });

    it('should load config from backend', async () => {
      // Mock config do backend
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              config: {
                enabled: true,
                strategy: 'beta_users',
                betaUserIds: ['user1', 'user2'],
              },
            },
            error: null,
          })),
        })),
        upsert: vi.fn(() => ({ data: null, error: null })),
      } as any);

      await migrationManager.initialize();
      
      const status = migrationManager.getStatus();
      expect(status.config.enabled).toBe(true);
      expect(status.config.strategy).toBe('beta_users');
    });
  });

  describe('Configuration Management', () => {
    it('should save configuration', async () => {
      await migrationManager.initialize();
      
      const newConfig: Partial<MigrationConfig> = {
        enabled: true,
        strategy: 'percentage',
        percentage: 25,
      };

      await migrationManager.saveConfig(newConfig);
      
      const status = migrationManager.getStatus();
      expect(status.config.enabled).toBe(true);
      expect(status.config.percentage).toBe(25);
    });

    it('should handle save config errors', async () => {
      await migrationManager.initialize();
      
      // Mock erro no Supabase
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: { code: 'PGRST116' },
          })),
        })),
        upsert: vi.fn(() => {
          throw new Error('Database error');
        }),
      } as any);

      await expect(
        migrationManager.saveConfig({ enabled: true })
      ).rejects.toThrow('Database error');
    });
  });

  describe('Migration Strategies', () => {
    it('should migrate by percentage', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
      });

      await migrationManager.startMigration();
      
      const status = migrationManager.getStatus();
      expect(status.status).toBe('migrating');
      expect(status.currentPercentage).toBe(50);
    });

    it('should migrate beta users', async () => {
      await migrationManager.initialize();
      
      const betaUserIds = ['user1', 'user2', 'user3'];
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'beta_users',
        betaUserIds,
      });

      await migrationManager.startMigration();
      
      const status = migrationManager.getStatus();
      expect(status.status).toBe('migrating');
      expect(status.migratedUsers).toBe(3);
    });

    it('should start gradual rollout', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'gradual_rollout',
        rolloutConfig: {
          startPercentage: 10,
          incrementPercentage: 10,
          incrementInterval: 1, // 1 hora
          maxPercentage: 50,
        },
      });

      await migrationManager.startMigration();
      
      const status = migrationManager.getStatus();
      expect(status.status).toBe('migrating');
      expect(status.currentPercentage).toBe(10);
    });
  });

  describe('User Migration Logic', () => {
    it('should determine if user should use backend by percentage', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
      });

      await migrationManager.startMigration();
      
      // Testar com diferentes user IDs
      const user1 = 'user-1-test';
      const user2 = 'user-2-test';
      
      // Deve ser consistente para o mesmo usuário
      expect(migrationManager.shouldUseBackend(user1)).toBe(
        migrationManager.shouldUseBackend(user1)
      );
      
      // Deve ser consistente para o mesmo usuário
      expect(migrationManager.shouldUseBackend(user2)).toBe(
        migrationManager.shouldUseBackend(user2)
      );
    });

    it('should determine if user should use backend by beta list', async () => {
      await migrationManager.initialize();
      
      const betaUserIds = ['beta-user-1', 'beta-user-2'];
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'beta_users',
        betaUserIds,
      });

      await migrationManager.startMigration();
      
      expect(migrationManager.shouldUseBackend('beta-user-1')).toBe(true);
      expect(migrationManager.shouldUseBackend('beta-user-2')).toBe(true);
      expect(migrationManager.shouldUseBackend('regular-user')).toBe(false);
    });

    it('should return false when migration is disabled', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: false,
        strategy: 'percentage',
        percentage: 100,
      });

      expect(migrationManager.shouldUseBackend('any-user')).toBe(false);
    });
  });

  describe('Migration Control', () => {
    it('should pause and resume migration', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
      });

      await migrationManager.startMigration();
      expect(migrationManager.getStatus().status).toBe('migrating');

      await migrationManager.pauseMigration();
      expect(migrationManager.getStatus().status).toBe('paused');

      await migrationManager.resumeMigration();
      expect(migrationManager.getStatus().status).toBe('migrating');
    });

    it('should execute rollback', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
      });

      await migrationManager.startMigration();
      expect(migrationManager.getStatus().currentPercentage).toBe(50);

      await migrationManager.rollbackMigration();
      const status = migrationManager.getStatus();
      expect(status.status).toBe('rollback');
      expect(status.currentPercentage).toBe(0);
    });

    it('should prevent starting migration when already migrating', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
      });

      await migrationManager.startMigration();
      
      await expect(migrationManager.startMigration()).rejects.toThrow(
        'Migração já está em andamento'
      );
    });
  });

  describe('Health Monitoring', () => {
    it('should check migration health', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
        monitoringConfig: {
          checkInterval: 1,
          alertThresholds: {
            errorRate: 5,
            responseTime: 1000,
            discrepancyRate: 2,
          },
        },
      });

      await migrationManager.startMigration();
      
      // Simular verificação de saúde
      const status = migrationManager.getStatus();
      expect(status.errorRate).toBeGreaterThanOrEqual(0);
      expect(status.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should trigger auto-rollback on high error rate', async () => {
      await migrationManager.initialize();
      
      // Mock alta taxa de erro
      const { securityMonitor } = await import('@/services/securityMonitor');
      vi.mocked(securityMonitor.getMetrics).mockReturnValue({
        totalCalculations: 100,
        frontendCalculations: 50,
        backendCalculations: 50,
        discrepancies: 2,
        errors: 10, // 10% de erro
        averageResponseTime: 150,
      });

      await migrationManager.saveConfig({
        enabled: true,
        strategy: 'percentage',
        percentage: 50,
        rollbackConfig: {
          errorThreshold: 5, // 5% de erro
          performanceThreshold: 1000,
          autoRollback: true,
        },
      });

      await migrationManager.startMigration();
      
      // Simular verificação de saúde que deve triggerar rollback
      // Chamar diretamente o método de verificação de saúde
      await (migrationManager as any).checkMigrationHealth();
      
      const status = migrationManager.getStatus();
      expect(status.errorRate).toBe(10);
      expect(status.status).toBe('rollback'); // Deve ter feito rollback automático
    });
  });

  describe('History and Logging', () => {
    it('should log migration actions', async () => {
      await migrationManager.initialize();
      
      await migrationManager.saveConfig({ enabled: true });
      await migrationManager.startMigration();
      await migrationManager.pauseMigration();
      
      const history = migrationManager.getHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const actions = history.map(entry => entry.action);
      expect(actions).toContain('config_updated');
      expect(actions).toContain('migration_started');
      expect(actions).toContain('migration_paused');
    });

    it('should limit history size', async () => {
      await migrationManager.initialize();
      
      // Simular muitas ações para testar limite
      for (let i = 0; i < 1500; i++) {
        await migrationManager.saveConfig({ enabled: true });
      }
      
      const history = migrationManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });
});
