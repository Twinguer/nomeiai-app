// Hook para usar o serviço de ofuscação de ciclos de estudo
// ✅ CORREÇÃO: Arquivo separado para evitar conflito com importações estáticas/dinâmicas mistas
export const useSecureStudyCycleUrls = () => {
  const generateSecureUrl = async (cycleId: string, userId: string, action: 'view' | 'edit' | 'session' | 'cronograma' | 'timer' | 'estatisticas' = 'view') => {
    const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
    return await StudyCycleUrlObfuscationService.generateSecureStudyCycleUrl(cycleId, userId, action);
  };
  
  const validateToken = async (token: string, userId: string) => {
    const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
    return await StudyCycleUrlObfuscationService.validateStudyCycleToken(token, userId);
  };
  
  const generateCronogramaUrl = async (cycleId: string, userId: string) => {
    const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
    return await StudyCycleUrlObfuscationService.generateSecureCronogramaUrl(cycleId, userId);
  };
  
  const generateTimerUrl = async (cycleId: string, userId: string) => {
    const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
    return await StudyCycleUrlObfuscationService.generateSecureTimerUrl(cycleId, userId);
  };
  
  const generateEstatisticasUrl = async (cycleId: string, userId: string) => {
    const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
    return await StudyCycleUrlObfuscationService.generateSecureEstatisticasUrl(cycleId, userId);
  };
  
  const generateSessaoUrl = async (cycleId: string, userId: string) => {
    const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
    return await StudyCycleUrlObfuscationService.generateSecureSessaoUrl(cycleId, userId);
  };
  
  return {
    generateSecureUrl,
    validateToken,
    generateCronogramaUrl,
    generateTimerUrl,
    generateEstatisticasUrl,
    generateSessaoUrl
  };
};

