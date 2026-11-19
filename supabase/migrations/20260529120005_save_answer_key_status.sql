-- Gabarito oficial: atualiza gabarito_status (preliminary | final)

DROP FUNCTION IF EXISTS public.save_consolidated_answer_key(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_consolidated_answer_key(
  p_concurso_id uuid,
  p_booklet_id text,
  p_answers jsonb,
  p_gabarito_status text DEFAULT 'preliminary'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_data jsonb;
  v_consolidated_data jsonb;
  v_booklet_answers jsonb := '{}';
  v_question_key text;
  v_answer_data jsonb;
  v_answer_count integer := 0;
  v_recalc_result jsonb;
  v_new_status text;
BEGIN
  v_new_status := CASE
    WHEN lower(trim(COALESCE(p_gabarito_status, 'preliminary'))) IN ('final', 'definitivo', 'definitive')
      THEN 'final'
    ELSE 'preliminary'
  END;

  SELECT COALESCE(official_answers, '{}'::jsonb)
  INTO v_existing_data
  FROM concursos
  WHERE id = p_concurso_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concurso % not found', p_concurso_id;
  END IF;

  FOR v_question_key, v_answer_data IN SELECT * FROM jsonb_each(p_answers)
  LOOP
    v_booklet_answers := jsonb_set(v_booklet_answers, ARRAY[v_question_key], v_answer_data);
    v_answer_count := v_answer_count + 1;
  END LOOP;

  v_consolidated_data := jsonb_set(
    v_existing_data,
    ARRAY[p_booklet_id],
    jsonb_build_object(
      'answers', v_booklet_answers,
      'metadata', jsonb_build_object(
        'answer_count', v_answer_count,
        'last_updated', now(),
        'booklet_name', p_booklet_id
      )
    )
  );

  UPDATE concursos
  SET
    official_answers = v_consolidated_data,
    gabarito_status = v_new_status,
    recalc_pending_at = NULL,
    updated_at = now()
  WHERE id = p_concurso_id;

  BEGIN
    SET LOCAL statement_timeout = '60s';
    SELECT recalculate_all_scores_with_weights(p_concurso_id)
    INTO v_recalc_result;
    RESET statement_timeout;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error during automatic recalculation (non-fatal): %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Gabarito salvo com sucesso. Recálculo automático iniciado.',
    'booklet_id', p_booklet_id,
    'answers_saved', v_answer_count,
    'gabarito_status', v_new_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM,
      'booklet_id', p_booklet_id,
      'answers_saved', 0
    );
END;
$$;

COMMENT ON FUNCTION public.save_consolidated_answer_key(uuid, text, jsonb, text) IS
  'Salva gabarito oficial e define status preliminary ou final.';

-- Compatibilidade com chamadas antigas (3 parâmetros)
GRANT EXECUTE ON FUNCTION public.save_consolidated_answer_key(uuid, text, jsonb, text) TO authenticated;
