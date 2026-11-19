-- ============================================================================
-- MIGRATION: Permitir visualização de rankings em modo vitrine
-- DATA: 2025-01-20
-- OBJETIVO: Atualizar get_rankings_for_concurso para permitir visualização
--           de rankings em modo vitrine por qualquer usuário
-- ============================================================================

CREATE OR REPLACE FUNCTION get_rankings_for_concurso(
  p_concurso_id UUID,
  p_reservation_type TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  consolidated_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_pro BOOLEAN;
  v_participates BOOLEAN;
  v_is_showcase BOOLEAN := false;
  v_parent_id UUID := NULL;
  v_parent_is_showcase BOOLEAN := false;
BEGIN
  -- ✅ CRÍTICO: Desabilitar RLS temporariamente para garantir acesso aos dados
  -- A função usa SECURITY DEFINER, então precisa desabilitar RLS para ver todos os registros
  PERFORM set_config('row_security', 'off', true);  -- true = LOCAL (apenas esta transação)

  -- Obter ID do usuário atual
  v_user_id := auth.uid();

  -- ✅ Verificar se o ranking está em modo vitrine (próprio ou parent)
  SELECT is_showcase, parent_concurso_id INTO v_is_showcase, v_parent_id
  FROM concursos
  WHERE id = p_concurso_id;

  -- ✅ Se tiver parent, verificar se o parent está em modo vitrine
  IF v_parent_id IS NOT NULL THEN
    SELECT is_showcase INTO v_parent_is_showcase
    FROM concursos
    WHERE id = v_parent_id;
  END IF;

  -- ✅ Se o ranking ou o parent estiver em modo vitrine, permitir visualização para TODOS (incluindo não autenticados)
  IF v_is_showcase OR v_parent_is_showcase THEN
    RETURN QUERY
    SELECT 
      ur.user_id,
      ur.consolidated_data
    FROM user_rankings ur
    WHERE ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings'
      AND EXISTS (
        SELECT 1
        FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
        WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
          -- ✅ CORREÇÃO: Filtrar por reservation_type se fornecido
          AND (
            p_reservation_type IS NULL 
            OR p_reservation_type = ''
            OR (ur.consolidated_data->'rankings'->ranking_key->'user_data'->>'reservation_type') = p_reservation_type
          )
      )
    OFFSET p_offset
    LIMIT p_limit;
    
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Se não autenticado e não for vitrine, retornar vazio
  -- (vitrine já foi tratado acima e permite visualização mesmo sem autenticação)
  IF v_user_id IS NULL THEN
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Verificar se é Pro
  v_is_pro := is_user_pro(v_user_id);

  -- Se for Pro, retornar todos os rankings do concurso
  IF v_is_pro THEN
    RETURN QUERY
    SELECT 
      ur.user_id,
      ur.consolidated_data
    FROM user_rankings ur
    WHERE ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings'
      AND EXISTS (
        SELECT 1
        FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
        WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
          -- ✅ CORREÇÃO: Filtrar por reservation_type se fornecido
          AND (
            p_reservation_type IS NULL 
            OR p_reservation_type = ''
            OR (ur.consolidated_data->'rankings'->ranking_key->'user_data'->>'reservation_type') = p_reservation_type
          )
      )
    OFFSET p_offset
    LIMIT p_limit;
    
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Se for Free, verificar se participa
  v_participates := user_participates_in_concurso(v_user_id, p_concurso_id);

  -- Se não participa, retornar vazio
  IF NOT v_participates THEN
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Se participa, retornar todos os rankings do concurso (para ver a classificação completa)
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.consolidated_data
  FROM user_rankings ur
  WHERE ur.consolidated_data IS NOT NULL
    AND ur.consolidated_data != '{}'::jsonb
    AND ur.consolidated_data ? 'rankings'
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
      WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
        -- ✅ CORREÇÃO: Filtrar por reservation_type se fornecido
        AND (
          p_reservation_type IS NULL 
          OR p_reservation_type = ''
          OR (ur.consolidated_data->'rankings'->ranking_key->'user_data'->>'reservation_type') = p_reservation_type
        )
    )
  OFFSET p_offset
  LIMIT p_limit;
  
  -- Reabilitar RLS antes de retornar
  PERFORM set_config('row_security', 'on', true);
  
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ CRÍTICO: Reabilitar RLS mesmo em caso de erro
    PERFORM set_config('row_security', 'on', true);
    RAISE;
END;
$$;

COMMENT ON FUNCTION get_rankings_for_concurso IS 
'Retorna rankings de um concurso com verificação segura de subscription no backend.
Rankings em modo vitrine: podem ser visualizados por qualquer usuário (autenticado ou não).
Pro: vê todos os rankings do concurso.
Free autenticado: vê rankings do concurso apenas se participa (exceto vitrine).
Não autenticado: não vê nada (exceto vitrine).
Usa SECURITY DEFINER para garantir acesso aos dados mesmo com RLS restritiva.';
