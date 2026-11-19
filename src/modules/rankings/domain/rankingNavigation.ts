import type { NavigateFunction } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { UrlObfuscationService } from '@/services/urlObfuscation';
import { showProRequiredToast } from '@/utils/planRestrictions';
import { devLog } from '@/utils/productionLogger';
import {
  canOpenClassificationFromList,
  isParticipatingInConcurso,
} from '@/modules/rankings/domain/rankingAccess';

export type RankingNavigationContext = {
  user: { id: string } | null;
  isPro: boolean;
  navigate: NavigateFunction;
};

async function navigateToSecureRanking(navigate: NavigateFunction, concursoId: string): Promise<void> {
  const url = await UrlObfuscationService.generateSecureRankingUrl(concursoId);
  navigate(url);
}

async function navigateToSecureParticipate(
  navigate: NavigateFunction,
  concursoId: string,
  query = '',
): Promise<void> {
  const token = await UrlObfuscationService.generateConcursoToken(concursoId);
  navigate(`/concurso/participar/${token}${query}`);
}

async function navigateToSecureCargos(navigate: NavigateFunction, concursoId: string): Promise<void> {
  const url = await UrlObfuscationService.generateSecureCargosUrl(concursoId);
  navigate(url);
}

export async function openRankingAfterCreate(
  navigate: NavigateFunction,
  concursoId: string,
): Promise<void> {
  try {
    await navigateToSecureRanking(navigate, concursoId);
  } catch (error) {
    devLog.error('[rankingNavigation] Erro ao abrir classificação após criação:', error);
    navigate('/pre-classificacao');
  }
}

export async function openRankingFromProfile(
  navigate: NavigateFunction,
  concursoId: string,
): Promise<void> {
  await openSecureRankingWithFallback(navigate, concursoId);
}

export async function openRankingFromList(
  { user, isPro, navigate }: RankingNavigationContext,
  concursoId: string,
): Promise<void> {
  try {
    const { data: concursoMeta, error: metaError } = await supabase
      .from('concursos')
      .select('is_general_card, is_showcase, created_by_user_id')
      .eq('id', concursoId)
      .maybeSingle();

    if (metaError) {
      devLog.error('[rankingNavigation] Erro ao buscar metadados do concurso:', metaError);
    }

    if (concursoMeta?.is_general_card === true) {
      try {
        await navigateToSecureCargos(navigate, concursoId);
      } catch {
        navigate(`/pre-classificacao/${concursoId}/cargos`);
      }
      return;
    }

    if (concursoMeta?.is_showcase === true) {
      await navigateToSecureRanking(navigate, concursoId);
      return;
    }

    if (!user) {
      navigate('/auth', { state: { from: '/pre-classificacao' } });
      return;
    }

    let isParticipating = false;
    if (!isPro && concursoMeta?.created_by_user_id !== user.id) {
      const { data: userRankingData, error: participationError } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (participationError) {
        devLog.error('[rankingNavigation] Erro ao verificar participação:', participationError);
        await navigateToSecureRanking(navigate, concursoId);
        return;
      }

      isParticipating = isParticipatingInConcurso(userRankingData?.consolidated_data, concursoId);
    }

    const isCreator = concursoMeta?.created_by_user_id === user.id;

    if (
      canOpenClassificationFromList({
        user,
        isPro,
        isShowcase: concursoMeta?.is_showcase === true,
        isCreator,
        isParticipating,
      })
    ) {
      await navigateToSecureRanking(navigate, concursoId);
      return;
    }

    const { data: limitsCheck, error: limitsError } = await supabase.rpc(
      'check_free_user_ranking_limits',
      {
        p_user_id: user.id,
        p_concurso_id: concursoId,
      },
    );

    if (limitsError) {
      devLog.error('[rankingNavigation] Erro ao verificar limites:', limitsError);
      await navigateToSecureParticipate(navigate, concursoId);
      return;
    }

    if (limitsCheck?.allowed) {
      await navigateToSecureParticipate(navigate, concursoId);
      return;
    }

    showProRequiredToast(navigate, 'Visualizar Rankings que Você Não Participa');
  } catch (error) {
    devLog.error('[rankingNavigation] Erro inesperado ao abrir ranking:', error);
    try {
      await navigateToSecureRanking(navigate, concursoId);
    } catch {
      navigate('/pre-classificacao');
    }
  }
}

export async function openSecureRankingWithFallback(
  navigate: NavigateFunction,
  concursoId: string,
): Promise<void> {
  try {
    await navigateToSecureRanking(navigate, concursoId);
  } catch (error) {
    devLog.error('[rankingNavigation] Erro ao gerar URL segura:', error);
    if (import.meta.env.PROD && (error as Error)?.message?.includes('não configurada')) {
      return;
    }
    navigate('/pre-classificacao');
  }
}
