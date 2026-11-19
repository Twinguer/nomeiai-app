import { supabase } from '../client';

interface BatchRecalculationResult {
  success: boolean;
  updatedCount?: number;
  error?: string;
  details?: any;
}

export const recalculateAllUserScores = async (concursoId: string): Promise<BatchRecalculationResult> => {
  try {
    // Verificar se o concursoId é válido
    if (!concursoId) {
      return { success: false, error: 'ID do concurso inválido' };
    }

    // ✅ CORREÇÃO: Usar função wrapper recalc_concurso_scores_public que resolve ambiguidade de tipos
    // Esta função aceita UUID e chama internamente recalculate_all_scores_with_weights
    const { data, error } = await supabase.rpc('recalc_concurso_scores_public', {
      p_concurso_id: concursoId
    });

    if (error) {
      return { success: false, error: `Erro ao recalcular pontuações: ${error.message}` };
    }

    if (!data) {
      return { success: false, error: 'Nenhum dado retornado da função PostgreSQL' };
    }

    // Verificar se data é um objeto válido (pode ser jsonb ou json)
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Nenhum dado retornado da função PostgreSQL' };
    }

    // A função recalc_concurso_scores_public retorna um objeto JSON com success e updatedCount
    const result = data as any;
    
    if (result.success === false || !result.success) {
      return { success: false, error: result.error || result.message || 'Erro desconhecido na função PostgreSQL' };
    }

    return {
      success: true,
      updatedCount: result.updatedCount || 0,
      details: {
        executionTimeMs: result.executionTimeMs || 0,
        message: `Recálculo concluído em ${result.executionTimeMs || 0}ms`
      }
    };

  } catch (error) {
    return { 
      success: false, 
      error: String(error)
    };
  }
};
