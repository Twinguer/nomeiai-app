-- =====================================================
-- MIGRATION: Atualizar função save_user_answers_consolidated_by_concurso para usar subject_scores
-- OBJETIVO: Adicionar suporte ao campo subject_scores JSONB
-- DATA: 2025-01-15
-- =====================================================

-- Atualizar função para aceitar e usar subject_scores
CREATE OR REPLACE FUNCTION public.save_user_answers_consolidated_by_concurso(
    p_ranking_id uuid,
    p_concurso_id uuid,
    p_booklet_id text,
    p_answers jsonb,
    p_subject_scores jsonb DEFAULT '{}'::jsonb,
    p_discursive_score numeric DEFAULT 0,
    p_case_study_1_score numeric DEFAULT 0,
    p_case_study_2_score numeric DEFAULT 0,
    p_case_study_3_score numeric DEFAULT 0,
    p_current_edit_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_user_id uuid;
    v_concurso_data record;
    v_consolidated_data jsonb;
    v_user_data jsonb;
    v_answers_data jsonb;
    v_subjective_scores jsonb;
    v_metadata jsonb;
    v_edit_count integer;
    v_total_score numeric := 0;
    v_result jsonb;
BEGIN
    -- Log início
    RAISE NOTICE 'Starting save_user_answers_consolidated_by_concurso for ranking %', p_ranking_id;
    
    -- Obter dados do usuário e concurso
    SELECT 
        ur.user_id,
        c.discursive_weight,
        c.case_study_1_weight,
        c.case_study_2_weight,
        c.case_study_3_weight,
        ur.edit_count
    INTO v_user_id, v_concurso_data, v_edit_count
    FROM user_rankings ur
    JOIN concursos c ON c.id = ur.concurso_id
    WHERE ur.id = p_ranking_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
    END IF;
    
    -- Incrementar contador de edições
    v_edit_count := COALESCE(v_edit_count, 0) + 1;
    
    -- Preparar dados de respostas
    v_answers_data := jsonb_build_object(
        'answers', p_answers,
        'metadata', jsonb_build_object(
            'booklet_id', p_booklet_id,
            'saved_at', now(),
            'edit_count', v_edit_count
        )
    );
    
    -- Preparar pontuações subjetivas (usar subject_scores se disponível, senão usar campos individuais)
    v_subjective_scores := jsonb_build_object(
        'discursive', COALESCE((p_subject_scores->>'discursive')::numeric, p_discursive_score),
        'case_study_1', COALESCE((p_subject_scores->>'case_study_1')::numeric, p_case_study_1_score),
        'case_study_2', COALESCE((p_subject_scores->>'case_study_2')::numeric, p_case_study_2_score),
        'case_study_3', COALESCE((p_subject_scores->>'case_study_3')::numeric, p_case_study_3_score),
        'other_subjective', COALESCE((p_subject_scores->>'other_subjective')::numeric, 0)
    );
    
    -- Adicionar disciplinas customizadas do subject_scores
    IF p_subject_scores IS NOT NULL AND p_subject_scores != '{}'::jsonb THEN
        FOR key, value IN SELECT * FROM jsonb_each(p_subject_scores)
        LOOP
            IF key NOT IN ('discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective') THEN
                v_subjective_scores := jsonb_set(v_subjective_scores, ARRAY[key], value);
            END IF;
        END LOOP;
    END IF;
    
    -- Preparar dados do usuário
    v_user_data := jsonb_build_object(
        'user_id', v_user_id,
        'answers', v_answers_data,
        'subjective_scores', v_subjective_scores,
        'metadata', jsonb_build_object(
            'last_updated', now(),
            'edit_count', v_edit_count,
            'version', '2.0'
        )
    );
    
    -- Buscar dados consolidados existentes
    SELECT consolidated_data INTO v_consolidated_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir, criar estrutura inicial
    IF v_consolidated_data IS NULL THEN
        v_consolidated_data := jsonb_build_object(
            'concurso_id', p_concurso_id,
            'users', jsonb_build_object(),
            'metadata', jsonb_build_object(
                'created_at', now(),
                'last_updated', now(),
                'total_users', 0
            )
        );
    END IF;
    
    -- Atualizar dados do usuário específico
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_user_id::text],
        v_user_data
    );
    
    -- Atualizar metadados
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Salvar dados consolidados
    INSERT INTO consolidated_answers_by_concurso (concurso_id, consolidated_data)
    VALUES (p_concurso_id, v_consolidated_data)
    ON CONFLICT (concurso_id) 
    DO UPDATE SET 
        consolidated_data = v_consolidated_data,
        updated_at = now();
    
    -- Atualizar user_rankings com pontuações individuais e subject_scores
    UPDATE user_rankings
    SET 
        discursive_score = COALESCE((p_subject_scores->>'discursive')::numeric, p_discursive_score),
        case_study_1_score = COALESCE((p_subject_scores->>'case_study_1')::numeric, p_case_study_1_score),
        case_study_2_score = COALESCE((p_subject_scores->>'case_study_2')::numeric, p_case_study_2_score),
        case_study_3_score = COALESCE((p_subject_scores->>'case_study_3')::numeric, p_case_study_3_score),
        subject_scores = p_subject_scores,
        edit_count = v_edit_count,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    -- Calcular pontuação total usando a função existente
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    -- Buscar pontuação total calculada
    SELECT score INTO v_total_score
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    -- Preparar resultado
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Respostas salvas com sucesso',
        'edit_count', v_edit_count,
        'booklet_key', p_booklet_id,
        'answers_saved', jsonb_array_length(jsonb_object_keys(p_answers)),
        'total_score', v_total_score,
        'subject_scores', v_subjective_scores,
        'saved_answers', p_answers
    );
    
    RAISE NOTICE 'Successfully saved answers for ranking % with total score %', p_ranking_id, v_total_score;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in save_user_answers_consolidated_by_concurso: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao salvar respostas'
        );
END;
$function$;
