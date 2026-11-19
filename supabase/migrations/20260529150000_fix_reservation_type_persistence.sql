-- Garante persistência de reservation_type na participação e na troca de cota

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
  v_existing_data JSONB;
  v_limits_check JSON;
  v_ranking_key TEXT;
  v_new_ranking_data JSONB;
  v_created_new BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não autenticado'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM concursos WHERE id = p_concurso_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ranking não encontrado'
    );
  END IF;

  SELECT public.check_free_user_ranking_limits(v_user_id, p_concurso_id)
  INTO v_limits_check;

  IF v_limits_check->>'allowed' = 'false' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_limits_check->>'message', 'Limite de participação atingido'),
      'requires_upgrade', (v_limits_check->>'reason' = 'max_participations_reached')
    );
  END IF;

  SELECT consolidated_data
  INTO v_existing_data
  FROM user_rankings
  WHERE user_id = v_user_id;

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

  IF p_ranking_data IS NOT NULL THEN
    v_new_ranking_data := p_ranking_data;
    v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['concurso_id'], to_jsonb(p_concurso_id));
    IF p_selected_booklet_id IS NOT NULL THEN
      v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['selected_booklet_id'], to_jsonb(p_selected_booklet_id));
    END IF;
    IF v_new_ranking_data->'user_data' IS NULL OR jsonb_typeof(v_new_ranking_data->'user_data') <> 'object' THEN
      v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['user_data'], '{}'::jsonb);
    END IF;
    v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['user_data', 'reservation_type'], to_jsonb(p_reservation_type));
    v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['reservation_type'], to_jsonb(p_reservation_type));
    IF v_new_ranking_data ? 'ranking_key' THEN
      v_ranking_key := v_new_ranking_data->>'ranking_key';
      v_new_ranking_data := v_new_ranking_data - 'ranking_key';
    ELSE
      v_ranking_key := gen_random_uuid()::TEXT;
    END IF;
  ELSE
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

  IF v_existing_data IS NULL THEN
    v_existing_data := jsonb_build_object(
      'rankings', jsonb_build_object(v_ranking_key, v_new_ranking_data),
      'metadata', jsonb_build_object(
        'total_rankings', 1,
        'last_updated', now()
      )
    );

    INSERT INTO user_rankings (user_id, consolidated_data)
    VALUES (v_user_id, v_existing_data)
    ON CONFLICT (user_id) DO UPDATE
      SET consolidated_data = excluded.consolidated_data;
    v_created_new := true;
  ELSE
    IF v_existing_data->'rankings' IS NULL THEN
      v_existing_data := jsonb_set(v_existing_data, ARRAY['rankings'], '{}'::jsonb);
    END IF;

    v_existing_data := jsonb_set(
      v_existing_data,
      ARRAY['rankings', v_ranking_key],
      v_new_ranking_data
    );

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
    SET consolidated_data = v_existing_data
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'ranking_key', v_ranking_key,
    'created_new_record', v_created_new
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ranking_reservation_type(
  p_user_id UUID,
  p_ranking_key TEXT,
  p_new_reservation_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consolidated JSONB;
  v_ranking JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  IF p_ranking_key IS NULL OR btrim(p_ranking_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ranking inválido');
  END IF;

  IF p_new_reservation_type IS NULL OR btrim(p_new_reservation_type) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de reserva inválido');
  END IF;

  SELECT consolidated_data
  INTO v_consolidated
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_consolidated IS NULL OR NOT (v_consolidated ? 'rankings') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
  END IF;

  v_ranking := v_consolidated->'rankings'->p_ranking_key;
  IF v_ranking IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
  END IF;

  IF v_ranking->'user_data' IS NULL OR jsonb_typeof(v_ranking->'user_data') <> 'object' THEN
    v_consolidated := jsonb_set(v_consolidated, ARRAY['rankings', p_ranking_key, 'user_data'], '{}'::jsonb);
  END IF;

  v_consolidated := jsonb_set(
    v_consolidated,
    ARRAY['rankings', p_ranking_key, 'user_data', 'reservation_type'],
    to_jsonb(p_new_reservation_type)
  );
  v_consolidated := jsonb_set(
    v_consolidated,
    ARRAY['rankings', p_ranking_key, 'reservation_type'],
    to_jsonb(p_new_reservation_type)
  );
  v_consolidated := jsonb_set(
    v_consolidated,
    ARRAY['metadata', 'last_updated'],
    to_jsonb(now())
  );

  UPDATE user_rankings
  SET consolidated_data = v_consolidated
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'reservation_type', p_new_reservation_type);
END;
$$;

COMMENT ON FUNCTION public.update_ranking_reservation_type IS
  'Atualiza reservation_type de um ranking existente em consolidated_data.';
