import { getTotalQuestions } from '@/hooks/useAnswerSheet/questionCountUtils';
import { supabase } from '@/integrations/supabase/client';
import type { Concurso } from '@/types/concursos';

export type AnswerKeyValidationResult =
  | { ok: true }
  | { ok: false; message: string };

type ConcursoWithAnswers = Pick<Concurso, 'disciplines' | 'exam_type'> & {
  exam_booklets?: Array<{ id: string; name: string }>;
  official_answers?: Record<string, { questions?: Record<string, unknown> }>;
};

/**
 * Valida completude do gabarito oficial por caderno (tipos de prova / questões).
 * Lógica pura — sem UI; CriarRanking exibe toast com a mensagem.
 */
export function validateOfficialAnswerKeyCompleteness(
  concursoData: ConcursoWithAnswers,
): AnswerKeyValidationResult {
  const booklets = concursoData?.exam_booklets || [];

  if (booklets.length === 0) {
    return { ok: false, message: 'Nenhum caderno configurado' };
  }

  if (!concursoData?.official_answers || Object.keys(concursoData.official_answers).length === 0) {
    return { ok: false, message: 'Gabarito oficial não encontrado' };
  }

  const totalQuestions = getTotalQuestions(concursoData as Concurso);

  for (const booklet of booklets) {
    const bookletAnswers = concursoData.official_answers[booklet.id];
    if (!bookletAnswers?.questions) {
      return {
        ok: false,
        message: `Caderno "${booklet.name}" não possui gabarito oficial`,
      };
    }

    const answerCount = Object.keys(bookletAnswers.questions).length;
    if (answerCount < totalQuestions) {
      return {
        ok: false,
        message: `Caderno "${booklet.name}" possui apenas ${answerCount} de ${totalQuestions} questões`,
      };
    }
  }

  return { ok: true };
}

/** Busca concurso e valida gabarito (fluxo CriarRanking). */
export async function fetchAndValidateOfficialAnswerKey(
  concursoId: string,
): Promise<AnswerKeyValidationResult> {
  const { data: concursoData, error } = await supabase
    .from('concursos')
    .select('*')
    .eq('id', concursoId)
    .single();

  if (error || !concursoData) {
    return { ok: false, message: 'Erro ao buscar dados do concurso' };
  }

  return validateOfficialAnswerKeyCompleteness(concursoData as Concurso);
}
