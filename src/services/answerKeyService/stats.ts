
import { AnswerKeyCompleteness, AnswerKeyStats } from './types';
import { getConsolidatedAnswerKey } from './core';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const checkAnswerKeyCompleteness = async (
  concursoId: string, 
  bookletIds: string[], 
  expectedQuestions: number
): Promise<AnswerKeyCompleteness> => {
  try {
    devLog.log('[answerKeyService] Checking answer key completeness using consolidated structure');
    
    const consolidatedData = await getConsolidatedAnswerKey(concursoId);
    
    if (!consolidatedData?.booklets) {
      devLog.log('[answerKeyService] No consolidated booklets data found');
      return {
        allComplete: false,
        details: bookletIds.map(id => ({
          bookletId: id,
          bookletName: `Caderno ${id}`,
          completed: 0,
          total: expectedQuestions,
          isComplete: false
        }))
      };
    }

    const details = bookletIds.map(bookletId => {
      const booklet = consolidatedData.booklets[bookletId];
      const completed = booklet?.answers ? Object.keys(booklet.answers).length : 0;
      const isComplete = completed >= expectedQuestions;

      devLog.log(`[answerKeyService] Booklet ${bookletId}: ${completed}/${expectedQuestions} questions (complete: ${isComplete})`);

      return {
        bookletId,
        bookletName: booklet?.metadata?.booklet_name || `Caderno ${bookletId}`,
        completed,
        total: expectedQuestions,
        isComplete
      };
    });

    const allComplete = details.every(detail => detail.isComplete);

    devLog.log(`[answerKeyService] Answer key completeness check result: ${allComplete ? 'ALL COMPLETE' : 'INCOMPLETE'}`);

    return {
      allComplete,
      details
    };
  } catch (error) {
    devLog.error('[answerKeyService] Error checking completeness:', error);
    return {
      allComplete: false,
      details: bookletIds.map(id => ({
        bookletId: id,
        bookletName: `Caderno ${id}`,
        completed: 0,
        total: expectedQuestions,
        isComplete: false
      }))
    };
  }
};

export const getAnswerKeyStats = async (concursoId: string): Promise<AnswerKeyStats> => {
  try {
    devLog.log('[answerKeyService] Getting answer key stats using consolidated structure');
    
    const consolidatedData = await getConsolidatedAnswerKey(concursoId);
    
    if (!consolidatedData?.booklets) {
      devLog.log('[answerKeyService] No consolidated booklets data found for stats');
      return {
        totalBooklets: 0,
        totalAnswers: 0,
        lastUpdated: null
      };
    }

    const booklets = consolidatedData.booklets;
    const totalBooklets = Object.keys(booklets).length;
    let totalAnswers = 0;

    Object.values(booklets).forEach((booklet: any) => {
      if (booklet.answers) {
        totalAnswers += Object.keys(booklet.answers).length;
      }
    });

    devLog.log(`[answerKeyService] Stats: ${totalBooklets} booklets, ${totalAnswers} total answers`);

    return {
      totalBooklets,
      totalAnswers,
      lastUpdated: consolidatedData.metadata?.last_updated || null
    };
  } catch (error) {
    devLog.error('[answerKeyService] Error getting stats:', error);
    return {
      totalBooklets: 0,
      totalAnswers: 0,
      lastUpdated: null
    };
  }
};
