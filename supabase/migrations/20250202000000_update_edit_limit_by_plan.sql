-- Migration: Atualizar limite de edições baseado no plano do usuário
-- Descrição: Modifica funções RPC para verificar limite de edições baseado no plano (Free=5, Pro=ilimitado)
-- Impacto: Nenhuma mudança em dados existentes, apenas lógica de validação
-- Data: 2025-02-02

-- ============================================
-- 1. CRIAR FUNÇÃO AUXILIAR
-- ============================================
-- Esta função consulta a tabela user_subscriptions (já existe) 
-- para determinar o limite de edições baseado no plano do usuário

CREATE OR REPLACE FUNCTION get_user_edit_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Buscar assinatura do usuário na tabela user_subscriptions
  SELECT plan, is_active INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- Retornar limite baseado no plano
  -- Se não encontrar assinatura ou não estiver ativa, assume Free (5 edições)
  IF v_subscription IS NULL OR NOT v_subscription.is_active THEN
    RETURN 5; -- Free = 5 edições
  END IF;

  IF v_subscription.plan = 'pro' THEN
    RETURN 999999; -- Pro = praticamente ilimitado (999.999 edições)
  ELSE
    RETURN 5; -- Free = 5 edições
  END IF;
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION get_user_edit_limit IS 
  'Retorna o limite de edições permitidas baseado no plano do usuário. Free=5, Pro=999999 (ilimitado)';

-- ============================================
-- 2. ATUALIZAR save_user_answers_consolidated_by_concurso
-- ============================================
-- Substitui a verificação hardcoded ">= 5" por verificação baseada no plano

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
    v_max_edits INTEGER; -- NOVO: variável para armazenar limite
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
    
    -- NOVO: Obter limite de edições baseado no plano do usuário
    v_max_edits := get_user_edit_limit(v_user_id);
    
    -- ALTERADO: Verificar limite usando variável ao invés de hardcoded
    IF p_current_edit_count >= v_max_edits THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Limite de %s edição(ões) atingido', v_max_edits)
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

-- ============================================
-- 3. ATUALIZAR save_user_answers_with_booklet
-- ============================================

CREATE OR REPLACE FUNCTION public.save_user_answers_with_booklet(
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
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_existing_record_id INTEGER;
    v_max_edits INTEGER; -- NOVO: variável para armazenar limite
BEGIN
    -- SECURITY: Verify user owns this ranking
    SELECT user_id INTO v_user_id
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access');
    END IF;

    -- Log security check
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'save_answers_attempt', jsonb_build_object(
        'ranking_id', p_ranking_id,
        'authorized', true
    ));

    -- NOVO: Obter limite de edições baseado no plano do usuário
    v_max_edits := get_user_edit_limit(v_user_id);
    
    -- ALTERADO: Verificar limite usando variável ao invés de hardcoded
    IF p_current_edit_count >= v_max_edits THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Limite de %s edição(ões) atingido', v_max_edits)
        );
    END IF;
    
    SELECT id, answers_data INTO v_existing_record_id, v_existing_data
    FROM user_answers
    WHERE user_ranking_id = p_ranking_id
    AND question_number IS NULL;
    
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'booklets', '{}',
            'subjective_scores', jsonb_build_object(
                'discursive', 0,
                'case_study_1', 0,
                'case_study_2', 0,
                'case_study_3', 0
            ),
            'selected_booklet', '',
            'total_edit_count', 0,
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '2.0'
            )
        );
    END IF;
    
    FOR v_answer IN
        SELECT 
            (elem->>'questionNumber')::integer as question_number,
            elem->>'answer' as answer
        FROM jsonb_array_elements(p_answers) as elem
        WHERE elem->>'questionNumber' IS NOT NULL AND elem->>'answer' IS NOT NULL
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
    v_consolidated_data := v_existing_data;
    
    IF v_consolidated_data->'booklets' IS NULL THEN
        v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['booklets'], '{}');
    END IF;
    
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['booklets', p_booklet_id],
        jsonb_build_object(
            'answers', v_booklet_answers,
            'metadata', jsonb_build_object(
                'completed_at', now(),
                'answer_count', v_answers_saved
            )
        )
    );
    
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['subjective_scores'], 
        jsonb_build_object(
            'discursive', p_discursive_score,
            'case_study_1', p_case_study_1_score,
            'case_study_2', p_case_study_2_score,
            'case_study_3', p_case_study_3_score
        )
    );
    
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['selected_booklet'], to_jsonb(p_booklet_id));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['total_edit_count'], to_jsonb(p_current_edit_count + 1));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    
    IF v_existing_record_id IS NOT NULL THEN
        UPDATE user_answers 
        SET 
            answers_data = v_consolidated_data,
            answer_format = 'CONSOLIDATED',
            updated_at = now()
        WHERE id = v_existing_record_id;
    ELSE
        INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
        VALUES (p_ranking_id, v_consolidated_data, 'CONSOLIDATED', now())
        RETURNING id INTO v_existing_record_id;
    END IF;
    
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

-- ============================================
-- 4. ATUALIZAR save_user_answers_v3
-- ============================================
-- Adiciona verificação de limite de edições (não tinha antes)

CREATE OR REPLACE FUNCTION save_user_answers_v3(
    p_ranking_id TEXT,
    p_concurso_id UUID,
    p_booklet_id TEXT,
    p_answers JSONB,
    p_subjective_scores JSONB DEFAULT '{}'::jsonb,
    p_current_edit_count INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_consolidated_data JSONB;
    v_ranking_data JSONB;
    v_updated_ranking_data JSONB;
    v_updated_consolidated_data JSONB;
    v_edit_count INTEGER;
    v_result JSONB;
    v_max_edits INTEGER; -- NOVO: variável para armazenar limite
BEGIN
    -- Log início
    RAISE NOTICE 'Starting save_user_answers_v3 for ranking %', p_ranking_id;
    
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- NOVO: Obter limite de edições baseado no plano do usuário
    v_max_edits := get_user_edit_limit(v_user_id);
    
    -- NOVO: Verificar limite de edições antes de continuar
    IF p_current_edit_count >= v_max_edits THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Limite de %s edição(ões) atingido', v_max_edits)
        );
    END IF;
    
    -- Try to find existing user_rankings record with consolidated_data
    -- Use LIMIT 1 to handle multiple records gracefully
    SELECT consolidated_data
    INTO v_consolidated_data
    FROM user_rankings 
    WHERE user_id = v_user_id
    AND consolidated_data IS NOT NULL
    AND consolidated_data != '{}'::jsonb
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no existing record found, return error (don't create new structure)
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User ranking data not found');
    END IF;
    
    -- Get specific ranking data from existing structure
    v_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
    IF v_ranking_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking not found in consolidated data');
    END IF;
    
    -- Get current edit count and increment
    v_edit_count := COALESCE((v_ranking_data->'user_data'->>'edit_count')::INTEGER, 0) + 1;
    
    -- Update ranking data with new answers and scores
    v_updated_ranking_data := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_ranking_data,
                ARRAY['user_data', 'answers'],
                p_answers
            ),
            ARRAY['user_data', 'subjective_scores'],
            p_subjective_scores
        ),
        ARRAY['user_data', 'edit_count'],
        to_jsonb(v_edit_count)
    );
    
    -- Update last_updated timestamp
    v_updated_ranking_data := jsonb_set(
        v_updated_ranking_data,
        ARRAY['control_metadata', 'last_updated'],
        to_jsonb(NOW())
    );
    
    -- Update selected_booklet_id
    v_updated_ranking_data := jsonb_set(
        v_updated_ranking_data,
        ARRAY['selected_booklet_id'],
        to_jsonb(p_booklet_id)
    );
    
    -- Update consolidated data
    v_updated_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['rankings', p_ranking_id],
        v_updated_ranking_data
    );
    
    -- Update user_rankings table
    UPDATE user_rankings
    SET 
        consolidated_data = v_updated_consolidated_data,
        updated_at = NOW()
    WHERE user_id = v_user_id;
    
    -- Calculate score using the updated function
    PERFORM calculate_user_score_realtime(
        p_ranking_id,
        v_user_id,
        p_concurso_id,
        p_booklet_id
    );
    
    -- Prepare result
    v_result := jsonb_build_object(
        'success', true,
        'edit_count', v_edit_count,
        'answers_saved', jsonb_object_keys(p_answers),
        'answers_count', jsonb_object_keys(p_answers)::integer,
        'message', 'Respostas salvas com sucesso'
    );
    
    RAISE NOTICE 'Successfully saved answers for ranking %', p_ranking_id;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in save_user_answers_v3: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao salvar respostas'
        );
END;
$$;

COMMENT ON FUNCTION save_user_answers_v3 IS 'Salva respostas na estrutura JSONB consolidada por usuário (v3 - com verificação de limite de edições baseada no plano)';

