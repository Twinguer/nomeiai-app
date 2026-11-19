-- ============================================================================
-- MIGRATION: Enforçar Validações no Backend
-- DATA: 2025-01-20
-- OBJETIVO: Garantir que todas as validações críticas sejam feitas no backend,
--           não apenas no frontend, para prevenir bypass de regras de negócio
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO RPC PARA PARTICIPAR DE RANKING COM VALIDAÇÃO
-- ============================================================================
-- Esta função valida limites ANTES de permitir participação
-- Aceita ranking_data opcional para manter estrutura completa do frontend
CREATE OR REPLACE FUNCTION public.participate_in_ranking(
  p_concurso_id UUID,
  p_reservation_type TEXT DEFAULT 'Ampla Concorrência',
  p_selected_booklet_id TEXT DEFAULT NULL,
  p_ranking_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_rankings_id UUID;
  v_existing_data JSONB;
  v_limits_check JSON;
  v_ranking_key TEXT;
  v_new_ranking_data JSONB;
BEGIN
  -- Verificar autenticação
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- Verificar se o concurso existe
  IF NOT EXISTS (SELECT 1 FROM concursos WHERE id = p_concurso_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ranking não encontrado'
    );
  END IF;

  -- VALIDAÇÃO CRÍTICA: Verificar limites de participação usando função backend
  SELECT public.check_free_user_ranking_limits(v_user_id, p_concurso_id)
  INTO v_limits_check;

  IF v_limits_check->>'allowed' = 'false' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_limits_check->>'message', 'Limite de participação atingido'),
      'requires_upgrade', (v_limits_check->>'reason' = 'max_participations_reached')
    );
  END IF;

  -- Verificar se já está participando
  SELECT id, consolidated_data
  INTO v_user_rankings_id, v_existing_data
  FROM user_rankings
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Verificar se já participa deste ranking
  IF v_existing_data IS NOT NULL 
     AND v_existing_data ? 'rankings' 
     AND v_existing_data->'rankings' IS NOT NULL THEN
    FOR v_ranking_key IN SELECT jsonb_object_keys(v_existing_data->'rankings')
    LOOP
      IF (v_existing_data->'rankings'->v_ranking_key->>'concurso_id')::UUID = p_concurso_id THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Você já está participando deste ranking'
        );
      END IF;
    END LOOP;
  END IF;

  -- Usar ranking_data fornecido ou criar estrutura básica
  IF p_ranking_data IS NOT NULL THEN
    v_new_ranking_data := p_ranking_data;
    -- Garantir que concurso_id está correto
    v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['concurso_id'], to_jsonb(p_concurso_id));
    -- Garantir que selected_booklet_id está correto
    IF p_selected_booklet_id IS NOT NULL THEN
      v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['selected_booklet_id'], to_jsonb(p_selected_booklet_id));
    END IF;
    -- Garantir que reservation_type está em user_data
    IF v_new_ranking_data->'user_data' IS NOT NULL THEN
      v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['user_data', 'reservation_type'], to_jsonb(p_reservation_type));
    END IF;
    -- Extrair ranking_key do ranking_data se fornecido, senão gerar novo
    IF v_new_ranking_data ? 'ranking_key' THEN
      v_ranking_key := v_new_ranking_data->>'ranking_key';
      v_new_ranking_data := v_new_ranking_data - 'ranking_key';
    ELSE
      v_ranking_key := gen_random_uuid()::TEXT;
    END IF;
  ELSE
    -- Criar estrutura básica se não fornecida
    v_ranking_key := gen_random_uuid()::TEXT;
    v_new_ranking_data := jsonb_build_object(
      'concurso_id', p_concurso_id,
      'reservation_type', p_reservation_type,
      'selected_booklet_id', COALESCE(p_selected_booklet_id, 'default'),
      'user_data', jsonb_build_object(
        'reservation_type', p_reservation_type,
        'selected_booklet_id', COALESCE(p_selected_booklet_id, 'default'),
        'edit_count', 0,
        'created_at', now()
      ),
      'created_at', now()
    );
  END IF;

  -- Inicializar ou atualizar consolidated_data
  IF v_existing_data IS NULL THEN
    v_existing_data := jsonb_build_object(
      'rankings', jsonb_build_object(v_ranking_key, v_new_ranking_data),
      'metadata', jsonb_build_object(
        'total_rankings', 1,
        'last_updated', now()
      )
    );
    
    -- Criar novo registro
    INSERT INTO user_rankings (user_id, consolidated_data)
    VALUES (v_user_id, v_existing_data)
    RETURNING id INTO v_user_rankings_id;
  ELSE
    -- Atualizar registro existente
    IF v_existing_data->'rankings' IS NULL THEN
      v_existing_data := jsonb_set(v_existing_data, ARRAY['rankings'], '{}'::jsonb);
    END IF;
    
    v_existing_data := jsonb_set(
      v_existing_data,
      ARRAY['rankings', v_ranking_key],
      v_new_ranking_data
    );
    
    -- Atualizar metadata
    v_existing_data := jsonb_set(
      v_existing_data,
      ARRAY['metadata', 'total_rankings'],
      to_jsonb((COALESCE((v_existing_data->'metadata'->>'total_rankings')::INTEGER, 0) + 1))
    );
    
    v_existing_data := jsonb_set(
      v_existing_data,
      ARRAY['metadata', 'last_updated'],
      to_jsonb(now())
    );
    
    UPDATE user_rankings
    SET consolidated_data = v_existing_data,
        updated_at = now()
    WHERE id = v_user_rankings_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_rankings_id', v_user_rankings_id,
    'ranking_key', v_ranking_key
  );
END;
$$;

COMMENT ON FUNCTION public.participate_in_ranking(UUID, TEXT, TEXT, JSONB) IS 
'Participa de um ranking com validação de limites no backend. Valida limites de usuários Free antes de permitir participação. Aceita ranking_data opcional para manter estrutura completa do frontend.';

-- ============================================================================
-- 2. ATUALIZAR save_user_answers_consolidated_by_concurso PARA USAR check_free_user_edit_limits
-- ============================================================================
-- Garantir que a validação de edições use a função centralizada
CREATE OR REPLACE FUNCTION public.save_user_answers_consolidated_by_concurso(
    p_ranking_id uuid, 
    p_concurso_id uuid, 
    p_booklet_id text, 
    p_answers jsonb, 
    p_discursive_score numeric DEFAULT 0, 
    p_case_study_1_score numeric DEFAULT 0, 
    p_case_study_2_score numeric DEFAULT 0, 
    p_case_study_3_score numeric DEFAULT 0, 
    p_current_edit_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_existing_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_total_users INTEGER;
    v_edit_limits_check JSON;
BEGIN
    -- SECURITY: Verify user owns this ranking
    SELECT ur.user_id, up.name 
    INTO v_user_id, v_user_name
    FROM user_rankings ur
    LEFT JOIN users_profiles up ON up.id = ur.user_id
    WHERE ur.id = p_ranking_id;
    
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access');
    END IF;

    -- Log security check
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'save_consolidated_answers_attempt', jsonb_build_object(
        'ranking_id', p_ranking_id,
        'concurso_id', p_concurso_id,
        'authorized', true
    ));
    
    -- VALIDAÇÃO CRÍTICA: Verificar limite de edições usando função backend
    SELECT public.check_free_user_edit_limits(
      v_user_id,
      p_ranking_id::TEXT,
      p_current_edit_count
    ) INTO v_edit_limits_check;

    IF v_edit_limits_check->>'allowed' = 'false' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', COALESCE(
              v_edit_limits_check->>'message',
              format('Limite de %s edição(ões) atingido', v_edit_limits_check->>'max_allowed')
            ),
            'requires_upgrade', (v_edit_limits_check->>'reason' = 'max_edits_reached')
        );
    END IF;
    
    SELECT consolidated_data INTO v_existing_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = p_concurso_id;
    
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'concurso_id', p_concurso_id,
            'users', '{}',
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '3.0',
                'total_users', 0
            )
        );
    END IF;
    
    IF v_existing_data->'users' IS NULL OR jsonb_typeof(v_existing_data->'users') = 'string' THEN
        v_existing_data := jsonb_set(v_existing_data, ARRAY['users'], '{}');
    END IF;
    
    FOR v_answer IN
        SELECT 
            key::integer as question_number,
            value::text as answer
        FROM jsonb_each_text(p_answers)
        WHERE key ~ '^[0-9]+$' AND value IS NOT NULL AND value != ''
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
    v_existing_data := jsonb_set(
        v_existing_data,
        ARRAY['users', v_user_id::text],
        jsonb_build_object(
            'ranking_id', p_ranking_id,
            'user_name', COALESCE(v_user_name, 'Usuário'),
            'booklets', jsonb_build_object(
                p_booklet_id, jsonb_build_object(
                    'answers', v_booklet_answers,
                    'metadata', jsonb_build_object(
                        'completed_at', now(),
                        'answer_count', v_answers_saved
                    )
                )
            ),
            'subjective_scores', jsonb_build_object(
                'discursive', p_discursive_score,
                'case_study_1', p_case_study_1_score,
                'case_study_2', p_case_study_2_score,
                'case_study_3', p_case_study_3_score
            ),
            'selected_booklet', p_booklet_id,
            'edit_count', p_current_edit_count + 1,
            'last_updated', now()
        )
    );
    
    SELECT COUNT(*) INTO v_total_users
    FROM jsonb_object_keys(v_existing_data->'users') AS user_key;
    
    v_existing_data := jsonb_set(v_existing_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    v_existing_data := jsonb_set(v_existing_data, ARRAY['metadata', 'total_users'], to_jsonb(v_total_users));
    
    INSERT INTO consolidated_answers_by_concurso (concurso_id, consolidated_data, updated_at)
    VALUES (p_concurso_id, v_existing_data, now())
    ON CONFLICT (concurso_id)
    DO UPDATE SET
        consolidated_data = EXCLUDED.consolidated_data,
        updated_at = EXCLUDED.updated_at;
    
    UPDATE user_rankings
    SET 
        edit_count = p_current_edit_count + 1,
        discursive_score = p_discursive_score,
        case_study_1_score = p_case_study_1_score,
        case_study_2_score = p_case_study_2_score,
        case_study_3_score = p_case_study_3_score,
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'saved_answers', v_booklet_answers
    );
END;
$function$;

COMMENT ON FUNCTION public.save_user_answers_consolidated_by_concurso(uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, integer) IS 
'Salva respostas do usuário com validação de limites de edição no backend. Usa check_free_user_edit_limits para validar.';

-- ============================================================================
-- 3. GARANTIR QUE RLS POLICIES VALIDEM PLANOS
-- ============================================================================
-- As RLS policies já existem e validam planos, mas vamos garantir que estão corretas

-- Verificar se a policy de criação de grupos está ativa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'study_groups' 
    AND policyname = 'only_pro_users_can_create_groups'
  ) THEN
    CREATE POLICY "only_pro_users_can_create_groups"
    ON public.study_groups FOR INSERT
    WITH CHECK (
      auth.uid() = created_by
      AND (
        public.is_user_pro(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
    );
  END IF;
END $$;

-- ============================================================================
-- 4. GARANTIR QUE TRIGGERS VALIDEM LIMITES
-- ============================================================================
-- O trigger check_active_cycles_limit já existe e valida limites de ciclos
-- A função upsert_user_study_data já valida limites de ciclos
-- Não é necessário criar novos triggers

-- ============================================================================
-- RESUMO DAS VALIDAÇÕES IMPLEMENTADAS
-- ============================================================================
-- ✅ Participação em rankings: função RPC participate_in_ranking valida limites
-- ✅ Edição de respostas: save_user_answers_consolidated_by_concurso usa check_free_user_edit_limits
-- ✅ Criação de ciclos: trigger check_active_cycles_limit + função upsert_user_study_data
-- ✅ Criação de grupos: RLS policy only_pro_users_can_create_groups
-- ✅ Participação em grupos: função request_to_join_group valida plano
-- ✅ Visualização de rankings: RLS policies + função check_free_user_ranking_limits

