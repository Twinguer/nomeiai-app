-- ============================================================================
-- MIGRATION: Adicionar Modo Vitrine (Showcase) aos Rankings
-- DATA: 2025-01-20
-- OBJETIVO: Permitir que rankings sejam usados como vitrine/demonstração
--           - Visualização pública permitida
--           - Novos cadastros bloqueados
-- ============================================================================

-- 1. Adicionar campo is_showcase na tabela concursos
ALTER TABLE concursos 
ADD COLUMN IF NOT EXISTS is_showcase BOOLEAN DEFAULT false;

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN concursos.is_showcase IS 
'Indica se o ranking está em modo vitrine. Rankings em vitrine podem ser visualizados por qualquer usuário, mas novos cadastros são bloqueados.';

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_concursos_is_showcase 
ON concursos(is_showcase) 
WHERE is_showcase = true;

-- 4. Atualizar função participate_in_ranking para bloquear vitrines
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
  v_is_showcase BOOLEAN := false;
  v_parent_id UUID := NULL;
  v_parent_is_showcase BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- Verificar se o concurso existe e se está em modo vitrine
  SELECT is_showcase, parent_concurso_id INTO v_is_showcase, v_parent_id
  FROM concursos
  WHERE id = p_concurso_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ranking não encontrado'
    );
  END IF;

  -- ✅ Verificar se o próprio ranking está em modo vitrine
  IF v_is_showcase THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este ranking está em modo vitrine. Novos cadastros não são permitidos.',
      'is_showcase', true
    );
  END IF;

  -- ✅ Verificar se o card geral (parent) está em modo vitrine
  IF v_parent_id IS NOT NULL THEN
    SELECT is_showcase INTO v_parent_is_showcase
    FROM concursos
    WHERE id = v_parent_id;

    IF v_parent_is_showcase THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Este ranking está em modo vitrine. Novos cadastros não são permitidos.',
        'is_showcase', true
      );
    END IF;
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
    IF v_new_ranking_data->'user_data' IS NOT NULL THEN
      v_new_ranking_data := jsonb_set(v_new_ranking_data, ARRAY['user_data', 'reservation_type'], to_jsonb(p_reservation_type));
    END IF;
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

COMMENT ON FUNCTION public.participate_in_ranking(UUID, TEXT, TEXT, JSONB) IS 
'Participa de um ranking com validação de limites no backend. Bloqueia participação em rankings em modo vitrine (is_showcase = true).';

-- 5. Exemplo de uso: Marcar ranking "Nomeia Aí" como vitrine
-- Execute manualmente após identificar o ID do ranking:
-- UPDATE concursos SET is_showcase = true WHERE titulo ILIKE '%Nomeia Aí%' OR titulo ILIKE '%nomeia%';
