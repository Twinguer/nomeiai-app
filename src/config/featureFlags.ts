import { devLog, sanitizeForLog } from '@/utils/productionLogger';
/**
 * Feature Flags para Migração de Segurança
 * Permite controle granular da migração de lógica frontend para backend
 */

export interface FeatureFlags {
  // Cálculos de pontuação
  useBackendScoring: boolean;
  
  // Validações
  useBackendValidation: boolean;
  
  // Operações de ranking
  useBackendRanking: boolean;
  
  // Nova estrutura de rankings
  useNewRankingStructure: boolean;
  
  // Logging e monitoramento
  enableSecurityLogging: boolean;
  
  // Modo de desenvolvimento
  enableDevMode: boolean;
}

// Configuração baseada no ambiente
const getDefaultFlags = (): FeatureFlags => {
  return {
    // SEMPRE usar backend - frontend não faz cálculos
    useBackendScoring: true,
    useBackendValidation: true,
    useBackendRanking: true,
    
    // Nova estrutura de rankings (PERMANENTEMENTE ATIVA)
    useNewRankingStructure: true,
    
    // Logging sempre habilitado
    enableSecurityLogging: true,
    
    // Modo dev desabilitado
    enableDevMode: false,
  };
};

// Feature flags globais
export const featureFlags: FeatureFlags = getDefaultFlags();

// Função para atualizar flags em runtime (para testes)
export const updateFeatureFlags = (updates: Partial<FeatureFlags>) => {
  Object.assign(featureFlags, updates);
};

// Função para verificar se uma feature está habilitada
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature];
};

// Função simplificada para nova estrutura (sempre true)
export const useNewRankingStructure = (): boolean => true;

// Função para logging de uso de features (silenciosa em produção)
export const logFeatureUsage = (feature: keyof FeatureFlags, context?: string) => {
  // Log silencioso - apenas para monitoramento interno
  if (featureFlags.enableSecurityLogging && process.env.NODE_ENV === 'development') {
    devLog.log(`[FEATURE_FLAG] ${feature} used${context ? ` in ${context}` : ''}`);
  }
};

// Configurações específicas por usuário (para testes graduais)
export const getUserFeatureFlags = (userId?: string): Partial<FeatureFlags> => {
  // Aqui você pode implementar lógica para habilitar features para usuários específicos
  // Por exemplo, beta testers podem ter features habilitadas antes
  
  if (!userId) return {};
  
  // Exemplo: habilitar para usuários específicos
  const betaTesters = [
    '34d22725-d158-4d75-9089-efd049a1fb98', // Exemplo de ID
  ];
  
  if (betaTesters.includes(userId)) {
    return {
      useBackendScoring: true,
      useBackendValidation: true,
    };
  }
  
  return {};
};
