/**
 * Hook para usar o Migration Manager
 * Fornece interface reativa para o sistema de migração
 */

import { useState, useEffect, useCallback } from 'react';
import { migrationManager, type MigrationStatus, type MigrationConfig } from '@/services/migrationManager';

export interface UseMigrationReturn {
  // Status da migração
  status: MigrationStatus | null;
  isLoading: boolean;
  error: string | null;
  
  // Ações
  startMigration: () => Promise<void>;
  pauseMigration: () => Promise<void>;
  resumeMigration: () => Promise<void>;
  rollbackMigration: () => Promise<void>;
  saveConfig: (config: Partial<MigrationConfig>) => Promise<void>;
  
  // Utilitários
  refreshStatus: () => Promise<void>;
  shouldUseBackend: (userId: string) => boolean;
  
  // Histórico
  history: Array<{ timestamp: number; action: string; details: any }>;
}

export const useMigration = (): UseMigrationReturn => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const currentStatus = migrationManager.getStatus();
      setStatus(currentStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar status');
    }
  }, []);

  const startMigration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await migrationManager.startMigration();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar migração');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const pauseMigration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await migrationManager.pauseMigration();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pausar migração');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const resumeMigration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await migrationManager.resumeMigration();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao retomar migração');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const rollbackMigration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await migrationManager.rollbackMigration();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar rollback');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const saveConfig = useCallback(async (config: Partial<MigrationConfig>) => {
    try {
      setIsLoading(true);
      setError(null);
      await migrationManager.saveConfig(config);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const shouldUseBackend = useCallback((userId: string) => {
    return migrationManager.shouldUseBackend(userId);
  }, []);

  // Carregar status inicial
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Atualizar status periodicamente
  useEffect(() => {
    const interval = setInterval(refreshStatus, 10000); // A cada 10 segundos
    return () => clearInterval(interval);
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    startMigration,
    pauseMigration,
    resumeMigration,
    rollbackMigration,
    saveConfig,
    refreshStatus,
    shouldUseBackend,
    history: migrationManager.getHistory(),
  };
};
