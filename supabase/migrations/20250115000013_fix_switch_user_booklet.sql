-- Corrigir função switch_user_booklet para usar a estrutura JSONB atual
CREATE OR REPLACE FUNCTION public.switch_user_booklet(p_ranking_id uuid, p_booklet_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_concurso_id UUID;
    v_exam_booklets JSONB;
    v_booklet_exists BOOLEAN := false;
BEGIN
    -- Log início
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_start', jsonb_build_object(
        'new_booklet_id', p_booklet_id,
        'timestamp', now()
    ));

    -- Obter informações do usuário e concurso  
    SELECT user_id, concurso_id INTO v_user_id, v_concurso_id
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
        'new_booklet', p_booklet_id,
        'timestamp', now()
    ));
    
    -- Buscar cadernos do concurso na estrutura JSONB
    SELECT exam_booklets INTO v_exam_booklets
    FROM concursos
    WHERE id = v_concurso_id;
    
    IF v_exam_booklets IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cadernos do concurso não encontrados');
    END IF;
    
    -- Verificar se o caderno existe
    SELECT EXISTS(
        SELECT 1 
        FROM jsonb_array_elements(v_exam_booklets) AS booklet
        WHERE booklet->>'id' = p_booklet_id
    ) INTO v_booklet_exists;
    
    IF NOT v_booklet_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Caderno não encontrado');
    END IF;
    
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
    
    -- Log sucesso
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_success', jsonb_build_object(
        'new_booklet_id', p_booklet_id,
        'timestamp', now()
    ));
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Caderno alterado com sucesso',
        'booklet_id', p_booklet_id
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log erro
        INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
        VALUES (p_ranking_id, 'switch_booklet_error', jsonb_build_object(
            'error', SQLERRM,
            'timestamp', now()
        ));
        
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;




















