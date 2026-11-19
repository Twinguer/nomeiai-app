
import { supabase } from '@/integrations/supabase/client';
import { ConsolidatedAnswerKey } from './types';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const getConsolidatedAnswerKey = async (concursoId: string): Promise<ConsolidatedAnswerKey | null> => {
  try {
    // Debug logs removed for security
    
    const { data, error } = await supabase
      .from('concursos')
      .select('official_answers')
      .eq('id', concursoId)
      .single();

    if (error) {
      devLog.error('[getConsolidatedAnswerKey] Error fetching consolidated answer key:', error);
      return null;
    }

    if (!data?.official_answers) {
      return null;
    }

    const officialAnswers = data.official_answers;
    
    // Validar estrutura dos dados
    if (!officialAnswers || typeof officialAnswers !== 'object') {
      devLog.warn('[getConsolidatedAnswerKey] Invalid official answers structure, initializing empty booklets');
      return {
        booklets: {},
        metadata: {
          version: '1.0',
          last_updated: new Date().toISOString()
        }
      };
    }

    // Debug logs removed for security
    return { booklets: officialAnswers } as ConsolidatedAnswerKey;
  } catch (error) {
    devLog.error('[getConsolidatedAnswerKey] Exception:', error);
    return null;
  }
};

export const getBookletAnswers = async (concursoId: string, bookletId: string) => {
  try {
    const consolidatedData = await getConsolidatedAnswerKey(concursoId);
    
    if (!consolidatedData?.booklets?.[bookletId]) {
      devLog.log('[getBookletAnswers] No answers found for booklet:', bookletId);
      return {};
    }

    const booklet = consolidatedData.booklets[bookletId] as any;
    const answers = (booklet?.answers || booklet?.questions || {}) as Record<string, any>;
    devLog.log('[getBookletAnswers] Found', Object.keys(answers).length, 'answers for booklet:', bookletId);
    return answers;
  } catch (error) {
    devLog.error('[getBookletAnswers] Error:', error);
    return {};
  }
};
