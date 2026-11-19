-- Ranking provisório: integrar votos no save + recálculo em lote com gabarito provisório

CREATE OR REPLACE FUNCTION public.update_consolidated_data_and_recalculate(
  p_user_id uuid,
  p_ranking_id text,
  p_concurso_id uuid,
  p_updated_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_selected_booklet_id text;
  v_ranking_data jsonb;
  v_old_data jsonb;
  v_old_answers jsonb;
  v_new_answers jsonb;
  v_gabarito_status text;
  v_vote_result jsonb := jsonb_build_object('leader_changed', false);
BEGIN
  SELECT consolidated_data
  INTO v_old_data
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  v_old_answers := COALESCE(
    v_old_data->'rankings'->p_ranking_id->'user_data'->'answers',
    '{}'::jsonb
  );

  UPDATE user_rankings
  SET consolidated_data = p_updated_data
  WHERE user_id = p_user_id;

  SELECT consolidated_data->'rankings'->p_ranking_id->>'selected_booklet_id'
  INTO v_selected_booklet_id
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_selected_booklet_id IS NULL THEN
    v_ranking_data := p_updated_data->'rankings'->p_ranking_id;
    v_selected_booklet_id := v_ranking_data->>'selected_booklet_id';
  END IF;

  v_new_answers := COALESCE(
    p_updated_data->'rankings'->p_ranking_id->'user_data'->'answers',
    '{}'::jsonb
  );

  SELECT gabarito_status
  INTO v_gabarito_status
  FROM concursos
  WHERE id = p_concurso_id;

  IF COALESCE(v_gabarito_status, 'consensus') = 'consensus'
     AND v_selected_booklet_id IS NOT NULL THEN
    v_vote_result := sync_consensus_votes_for_booklet(
      p_concurso_id,
      v_selected_booklet_id,
      v_old_answers,
      v_new_answers
    );

    IF COALESCE((v_vote_result->>'leader_changed')::boolean, false) THEN
      PERFORM rebuild_provisional_gabarito(p_concurso_id);
      UPDATE concursos
      SET recalc_pending_at = COALESCE(recalc_pending_at, now()),
          provisional_version = provisional_version + 1,
          updated_at = now()
      WHERE id = p_concurso_id;
    END IF;
  END IF;

  IF v_selected_booklet_id IS NOT NULL THEN
    PERFORM calculate_user_score_realtime(
      p_ranking_id,
      p_user_id,
      p_concurso_id,
      v_selected_booklet_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'leader_changed', COALESCE((v_vote_result->>'leader_changed')::boolean, false)
  );
END;
$function$;

COMMENT ON FUNCTION public.update_consolidated_data_and_recalculate IS
  'Atualiza consolidated_data, sincroniza votos de consenso e recalcula pontuação do usuário.';

-- Permite recálculo em lote quando só existe gabarito provisório (modo consenso)
CREATE OR REPLACE FUNCTION public.recalculate_all_scores_with_weights(p_concurso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_ranking_record record;
  v_ranking_key text;
  v_updated_count integer := 0;
  v_start_time timestamp;
  v_end_time timestamp;
  v_execution_time integer;
  v_gabarito_source jsonb;
  v_gabarito_status text;
  v_concurso_exists boolean := false;
BEGIN
  v_start_time := clock_timestamp();
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS(
    SELECT 1
    FROM concursos
    WHERE id = p_concurso_id
      AND (
        (official_answers IS NOT NULL AND official_answers <> '{}'::jsonb)
        OR (
          COALESCE(gabarito_status, 'consensus') = 'consensus'
          AND provisional_answers IS NOT NULL
          AND provisional_answers <> '{}'::jsonb
        )
      )
  ) INTO v_concurso_exists;

  IF NOT v_concurso_exists THEN
    PERFORM set_config('row_security', 'on', true);
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Concurso not found or no gabarito available (official or provisional)',
      'updatedCount', 0,
      'executionTimeMs', 0
    );
  END IF;

  SELECT
    gabarito_status,
    CASE
      WHEN COALESCE(gabarito_status, 'consensus') = 'consensus'
        AND provisional_answers IS NOT NULL
        AND provisional_answers <> '{}'::jsonb
      THEN provisional_answers
      ELSE official_answers
    END
  INTO v_gabarito_status, v_gabarito_source
  FROM concursos
  WHERE id = p_concurso_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'score_calculation_logs'
  ) THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (
      NULL,
      'batch_recalculation_start',
      jsonb_build_object(
        'concurso_id', p_concurso_id,
        'gabarito_status', COALESCE(v_gabarito_status, 'consensus'),
        'available_booklets', (
          SELECT array_agg(key)
          FROM jsonb_object_keys(v_gabarito_source) AS key
        ),
        'timestamp', now()
      )
    );
  END IF;

  FOR v_user_ranking_record IN
    SELECT user_id, consolidated_data
    FROM user_rankings
    WHERE consolidated_data IS NOT NULL
  LOOP
    IF v_user_ranking_record.consolidated_data ? 'rankings' THEN
      FOR v_ranking_key IN
        SELECT key
        FROM jsonb_object_keys(v_user_ranking_record.consolidated_data->'rankings') AS key
      LOOP
        IF (v_user_ranking_record.consolidated_data->'rankings'->v_ranking_key->>'concurso_id')::uuid = p_concurso_id THEN
          PERFORM calculate_user_score_realtime(
            v_ranking_key,
            v_user_ranking_record.user_id,
            p_concurso_id,
            v_user_ranking_record.consolidated_data->'rankings'->v_ranking_key->>'selected_booklet_id'
          );
          v_updated_count := v_updated_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_end_time := clock_timestamp();
  v_execution_time := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'score_calculation_logs'
  ) THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (
      NULL,
      'batch_recalculation_complete',
      jsonb_build_object(
        'concurso_id', p_concurso_id,
        'updated_count', v_updated_count,
        'execution_time_ms', v_execution_time,
        'timestamp', now()
      )
    );
  END IF;

  PERFORM set_config('row_security', 'on', true);

  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'executionTimeMs', v_execution_time
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'score_calculation_logs'
    ) THEN
      INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
      VALUES (
        NULL,
        'batch_recalculation_error',
        jsonb_build_object(
          'concurso_id', p_concurso_id,
          'error', SQLERRM,
          'error_detail', SQLSTATE,
          'timestamp', now()
        )
      );
    END IF;
    RAISE;
END;
$function$;

COMMENT ON FUNCTION public.recalculate_all_scores_with_weights IS
  'Recalcula todos os participantes usando gabarito oficial ou provisório conforme gabarito_status.';
