
-- Remover versões duplicadas da função save_user_answers_with_booklet
-- Manter apenas a versão que aceita booklet_id como text

-- Remover a versão que aceita booklet_id como uuid
DROP FUNCTION IF EXISTS public.save_user_answers_with_booklet(
    p_ranking_id uuid, 
    p_concurso_id uuid, 
    p_booklet_id uuid, 
    p_answers jsonb, 
    p_discursive_score numeric, 
    p_case_study_1_score numeric, 
    p_case_study_2_score numeric, 
    p_case_study_3_score numeric, 
    p_current_edit_count integer
);

-- Também remover qualquer versão old que possa existir
DROP FUNCTION IF EXISTS public.save_user_answers_with_booklet_old(
    p_ranking_id uuid, 
    p_concurso_id uuid, 
    p_booklet_id text, 
    p_answers jsonb, 
    p_discursive_score numeric, 
    p_case_study_1_score numeric, 
    p_case_study_2_score numeric, 
    p_case_study_3_score numeric, 
    p_current_edit_count integer
);

-- Log da operação
INSERT INTO score_calculation_logs (
    calculation_type,
    calculation_details
) VALUES (
    'function_cleanup',
    jsonb_build_object(
        'operation', 'removed_duplicate_functions',
        'function_name', 'save_user_answers_with_booklet',
        'reason', 'resolve_function_overload_conflict',
        'timestamp', now()
    )
);
