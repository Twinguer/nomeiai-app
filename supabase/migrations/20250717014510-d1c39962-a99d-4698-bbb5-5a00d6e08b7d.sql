-- Criar função para debug detalhado da troca de caderno
CREATE OR REPLACE FUNCTION public.switch_user_booklet(p_ranking_id uuid, p_booklet_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_concurso_id UUID;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB;
    v_previous_booklet TEXT;
BEGIN
    -- Log início
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_start', jsonb_build_object(
        'new_booklet_id', p_booklet_id,
        'timestamp', now()
    ));

    -- Obter informações do usuário e concurso  
    SELECT user_id, concurso_id, selected_booklet INTO v_user_id, v_concurso_id, v_previous_booklet
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
    END IF;
    
    -- Log dados do usuário
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_user_data', jsonb_build_object(
        'user_id', v_user_id,
        'concurso_id', v_concurso_id,
        'previous_booklet', v_previous_booklet,
        'new_booklet', p_booklet_id,
        'timestamp', now()
    ));
    
    -- Buscar dados consolidados do concurso
    SELECT consolidated_data INTO v_consolidated_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = v_concurso_id;
    
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dados do concurso não encontrados');
    END IF;
    
    -- Log dados encontrados
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_data_found', jsonb_build_object(
        'consolidated_data_exists', v_consolidated_data IS NOT NULL,
        'user_in_data', v_consolidated_data->'users' ? v_user_id::text,
        'available_booklets', jsonb_object_keys(COALESCE(v_consolidated_data->'users'->v_user_id::text->'booklets', '{}'::jsonb)),
        'timestamp', now()
    ));
    
    -- Atualizar o caderno selecionado do usuário específico
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_user_id::text, 'selected_booklet'],
        to_jsonb(p_booklet_id)
    );
    
    -- Atualizar timestamp
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_user_id::text, 'last_updated'],
        to_jsonb(now())
    );
    
    -- Salvar dados consolidados atualizados
    UPDATE consolidated_answers_by_concurso
    SET 
        consolidated_data = v_consolidated_data,
        updated_at = now()
    WHERE concurso_id = v_concurso_id;
    
    -- Atualizar selected_booklet no user_rankings
    UPDATE user_rankings
    SET 
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    -- Buscar respostas do caderno específico do usuário
    v_booklet_answers := v_consolidated_data->'users'->v_user_id::text->'booklets'->p_booklet_id->'answers';
    
    -- Log resultado final
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_result', jsonb_build_object(
        'success', true,
        'booklet_changed_from', v_previous_booklet,
        'booklet_changed_to', p_booklet_id,
        'answers_found', v_booklet_answers IS NOT NULL,
        'answers_count', CASE 
            WHEN v_booklet_answers IS NOT NULL 
            THEN jsonb_object_keys(v_booklet_answers) 
            ELSE '[]'::jsonb 
        END,
        'timestamp', now()
    ));
    
    -- Recalcular pontuação após mudança de caderno
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', p_booklet_id,
        'answers', COALESCE(v_booklet_answers, '{}'::jsonb),
        'message', 'Caderno alterado com sucesso'
    );
END;
$function$;