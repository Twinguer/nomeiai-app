-- Ranking provisório: debounce de recálculo global + projeção de nota de corte (ampla)

CREATE OR REPLACE FUNCTION public.process_consensus_recalc_pending(
  p_debounce_seconds integer DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_concurso record;
  v_processed integer := 0;
  v_recalc_result jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  FOR v_concurso IN
    SELECT id
    FROM concursos
    WHERE recalc_pending_at IS NOT NULL
      AND recalc_pending_at <= now() - make_interval(secs => GREATEST(p_debounce_seconds, 1))
      AND COALESCE(gabarito_status, 'consensus') = 'consensus'
    ORDER BY recalc_pending_at ASC
    LIMIT 10
  LOOP
    SELECT recalculate_all_scores_with_weights(v_concurso.id)
    INTO v_recalc_result;

    UPDATE concursos
    SET recalc_pending_at = NULL,
        updated_at = now()
    WHERE id = v_concurso.id;

    v_processed := v_processed + 1;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'concurso_id', v_concurso.id,
        'recalc', v_recalc_result
      )
    );
  END LOOP;

  PERFORM set_config('row_security', 'on', true);

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'results', v_results
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_cutoff_projection(p_concurso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_vagas integer;
  v_gabarito_status text;
  v_cutoff numeric;
  v_total_ampla integer;
BEGIN
  SELECT COALESCE(vagas, 0)::integer, COALESCE(gabarito_status, 'consensus')
  INTO v_vagas, v_gabarito_status
  FROM concursos
  WHERE id = p_concurso_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Concurso não encontrado');
  END IF;

  IF v_vagas <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Vagas não informadas no edital',
      'gabarito_status', v_gabarito_status,
      'is_provisional', v_gabarito_status = 'consensus'
    );
  END IF;

  SELECT score
  INTO v_cutoff
  FROM (
    SELECT
      (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score')::numeric AS score,
      ROW_NUMBER() OVER (
        ORDER BY
          (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score')::numeric DESC NULLS LAST,
          COALESCE(
            (ur.consolidated_data->'rankings'->rk.key->'control_metadata'->>'created_at')::timestamptz,
            (ur.consolidated_data->'rankings'->rk.key->>'created_at')::timestamptz,
            ur.created_at
          ) ASC
      ) AS rn
    FROM user_rankings ur
    CROSS JOIN LATERAL jsonb_object_keys(ur.consolidated_data->'rankings') AS rk(key)
    WHERE ur.consolidated_data->'rankings'->rk.key->>'concurso_id' = p_concurso_id::text
      AND COALESCE(ur.consolidated_data->'rankings'->rk.key->'user_data'->>'status', 'classificado') = 'classificado'
      AND normalize_reservation_type(
        ur.consolidated_data->'rankings'->rk.key->'user_data'->>'reservation_type'
      ) = 'Ampla Concorrência'
      AND (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score') IS NOT NULL
  ) ranked
  WHERE rn = v_vagas;

  SELECT COUNT(*)::integer
  INTO v_total_ampla
  FROM user_rankings ur
  CROSS JOIN LATERAL jsonb_object_keys(ur.consolidated_data->'rankings') AS rk(key)
  WHERE ur.consolidated_data->'rankings'->rk.key->>'concurso_id' = p_concurso_id::text
    AND COALESCE(ur.consolidated_data->'rankings'->rk.key->'user_data'->>'status', 'classificado') = 'classificado'
    AND normalize_reservation_type(
      ur.consolidated_data->'rankings'->rk.key->'user_data'->>'reservation_type'
    ) = 'Ampla Concorrência'
    AND (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score') IS NOT NULL;

  IF v_total_ampla < v_vagas THEN
    SELECT (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score')::numeric
    INTO v_cutoff
    FROM user_rankings ur
    CROSS JOIN LATERAL jsonb_object_keys(ur.consolidated_data->'rankings') AS rk(key)
    WHERE ur.consolidated_data->'rankings'->rk.key->>'concurso_id' = p_concurso_id::text
      AND COALESCE(ur.consolidated_data->'rankings'->rk.key->'user_data'->>'status', 'classificado') = 'classificado'
      AND normalize_reservation_type(
        ur.consolidated_data->'rankings'->rk.key->'user_data'->>'reservation_type'
      ) = 'Ampla Concorrência'
      AND (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score') IS NOT NULL
    ORDER BY
      (ur.consolidated_data->'rankings'->rk.key->'user_data'->>'score')::numeric DESC NULLS LAST,
      COALESCE(
        (ur.consolidated_data->'rankings'->rk.key->'control_metadata'->>'created_at')::timestamptz,
        (ur.consolidated_data->'rankings'->rk.key->>'created_at')::timestamptz,
        ur.created_at
      ) ASC
    OFFSET GREATEST(v_total_ampla - 1, 0)
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cutoff_score', v_cutoff,
    'vagas', v_vagas,
    'classified_ampla_count', v_total_ampla,
    'gabarito_status', v_gabarito_status,
    'is_provisional', v_gabarito_status = 'consensus',
    'has_enough_candidates', v_total_ampla >= v_vagas
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_consensus_recalc_pending(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cutoff_projection(uuid) TO authenticated;

COMMENT ON FUNCTION public.process_consensus_recalc_pending IS
  'Processa recálculos globais pendentes após debounce (padrão 45s) no modo consenso.';
COMMENT ON FUNCTION public.get_cutoff_projection IS
  'Projeta nota de corte na ampla concorrência com base nos classificados atuais.';
