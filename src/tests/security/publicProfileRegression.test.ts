import { describe, expect, it } from 'vitest';
import { mapPublicProfileRpcResponse } from '@/modules/profile/domain/publicProfileMapper';
import { parseProfilePrivacySettings } from '@/utils/profilePrivacySettings';

/**
 * Matriz de regressão — regras de negócio preservadas pelos ajustes de segurança:
 *
 * | Fluxo                         | RPC/Policy                              | Deve continuar funcionando        |
 * |-------------------------------|-----------------------------------------|-----------------------------------|
 * | Vitrine de ranking            | get_rankings_for_concurso               | Qualquer um vê classificação      |
 * | Free participante             | get_rankings_for_concurso               | Vê classificação do concurso      |
 * | Pro                           | get_rankings_for_concurso               | Vê rankings do concurso           |
 * | Perfil público — toggles ON   | get_public_user_profile_secure          | Campos liberados aparecem         |
 * | Perfil público — toggles OFF  | get_public_user_profile_secure          | Campos ocultos (null no client)   |
 * | Grupos públicos no perfil     | get_user_public_groups                  | Sempre visíveis (privacy=public)  |
 * | Meus grupos (perfil próprio)  | get_user_groups (auth.uid = p_user_id)  | Todos os grupos do usuário        |
 * | Coach — estudos do aluno      | user_study_v2 RLS + check_coach_* RPC  | Inalterado                        |
 * | Admin edita ranking           | has_role + created_by_user_id           | Admin/criador editam              |
 */
describe('publicProfileRegression', () => {
  it('mapeia perfil com showPublicAboutInfo=true', () => {
    const mapped = mapPublicProfileRpcResponse({
      id: 'u1',
      name: 'Ana',
      privacy: {
        showPublicRankings: true,
        showPublicStudyStats: false,
        showPublicRankingPosition: true,
        showPublicAboutInfo: true,
      },
      estado: 'SP',
      rotina_estudos: '2h por dia',
      profile_text: 'Foco total',
    });

    expect(mapped.estado).toBe('SP');
    expect(mapped.rotina_estudos).toBe('2h por dia');
    expect(mapped.privacy.showPublicAboutInfo).toBe(true);
  });

  it('oculta campos de sobre mim quando RPC não envia (toggle off)', () => {
    const mapped = mapPublicProfileRpcResponse({
      id: 'u1',
      name: 'Ana',
      privacy: {
        showPublicRankings: false,
        showPublicStudyStats: false,
        showPublicRankingPosition: false,
        showPublicAboutInfo: false,
      },
      profile_text: 'Só a frase',
    });

    expect(mapped.estado).toBeNull();
    expect(mapped.rotina_estudos).toBeNull();
    expect(mapped.concursos_aprovados).toBeNull();
    expect(mapped.profile_text).toBe('Só a frase');
  });

  it('parseProfilePrivacySettings alinha com flags do RPC', () => {
    const privacy = parseProfilePrivacySettings({
      showPublicRankings: true,
      showPublicAboutInfo: false,
    });

    expect(privacy.showPublicRankings).toBe(true);
    expect(privacy.showPublicAboutInfo).toBe(false);
    expect(privacy.showPublicStudyStats).toBe(false);
  });
});
