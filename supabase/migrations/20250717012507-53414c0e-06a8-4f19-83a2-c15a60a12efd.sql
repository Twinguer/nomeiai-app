-- Corrigir a função switch_user_booklet para usar a nova estrutura consolidada por concurso
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
BEGIN
    -- Obter informações do usuário e concurso
    SELECT user_id, concurso_id INTO v_user_id, v_concurso_id
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
    END IF;
    
    -- Buscar dados consolidados do concurso
    SELECT consolidated_data INTO v_consolidated_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = v_concurso_id;
    
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dados do concurso não encontrados');
    END IF;
    
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
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', p_booklet_id,
        'answers', COALESCE(v_booklet_answers, '{}'::jsonb),
        'message', 'Caderno alterado com sucesso'
    );
END;
$function$