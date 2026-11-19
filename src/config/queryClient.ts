import { QueryClient } from '@tanstack/react-query';

/**
 * Configuração centralizada do QueryClient
 * 
 * Esta configuração garante:
 * - Cache adequado para melhor performance
 * - Retry automático em caso de falhas temporárias
 * - StaleTime configurado para reduzir requisições desnecessárias
 * - Garbage collection automático de queries não utilizadas
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ PERFORMANCE: Dados considerados "frescos" por 30 segundos
      // Evita refetch desnecessário durante navegação rápida
      staleTime: 30 * 1000, // 30 segundos
      
      // ✅ PERFORMANCE: Cache mantido por 5 minutos
      // Permite reutilizar dados mesmo após stale
      gcTime: 5 * 60 * 1000, // 5 minutos (anteriormente cacheTime)
      
      // ✅ RESILIÊNCIA: Retry automático em caso de falhas de rede
      retry: 2, // Tentar até 2 vezes após falha inicial
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      
      // ✅ UX: Refetch em background quando janela ganha foco
      refetchOnWindowFocus: true,
      
      // ✅ UX: Refetch quando reconecta à internet
      refetchOnReconnect: true,
      
      // ✅ PERFORMANCE: Não refetch automaticamente em mount se dados estão frescos
      refetchOnMount: true, // Mas ainda refetch se dados estão stale
      
      // ✅ SEGURANÇA: Timeout para evitar queries travadas
      networkMode: 'online',
    },
    mutations: {
      // ✅ RESILIÊNCIA: Retry em mutações críticas
      retry: 1, // Tentar 1 vez em caso de falha de rede
      
      // ✅ UX: Mostrar loading durante mutações
      networkMode: 'online',
    },
  },
});

/**
 * Helper para invalidar queries relacionadas de forma otimizada
 */
export const invalidateRelatedQueries = {
  /**
   * Invalidar todas as queries relacionadas a um concurso
   */
  concurso: (concursoId: string) => {
    queryClient.invalidateQueries({ 
      queryKey: ['concurso', concursoId],
      exact: false // Invalida todas as queries que começam com ['concurso', concursoId]
    });
    queryClient.invalidateQueries({ queryKey: ['rankings', concursoId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['rankings-v2', concursoId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['rankings-v3', concursoId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['participant-count', concursoId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['participant-count-v2', concursoId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['user-participation', concursoId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['user-participation-v2', concursoId], exact: false });
  },
  
  /**
   * Invalidar todas as queries relacionadas a um usuário
   */
  user: (userId: string) => {
    queryClient.invalidateQueries({ queryKey: ['user', userId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['user-rankings', userId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId], exact: false });
    queryClient.invalidateQueries({ queryKey: ['public-profile', userId], exact: false });
  },
  
  /**
   * Invalidar todas as queries relacionadas a rankings
   */
  rankings: () => {
    queryClient.invalidateQueries({ queryKey: ['rankings'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['rankings-v2'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['rankings-v3'], exact: false });
  },
};

