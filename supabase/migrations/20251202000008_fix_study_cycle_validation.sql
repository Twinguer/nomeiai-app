-- Migration: Corrigir validação de study_cycle em generate_secure_token
-- Objetivo: Remover validação incorreta que procura cycleId na tabela user_study_v2
-- Data: 2025-12-04
--
-- PROBLEMA: A validação estava procurando cycleId em user_study_v2.id, mas:
-- - cycleId é um UUID do ciclo dentro do JSONB study_cycles
-- - user_study_v2.id é o ID da linha da tabela, não do ciclo
-- - Os ciclos estão armazenados em user_study_v2.study_cycles (JSONB)
--
-- SOLUÇÃO: Remover validação para study_cycle, pois:
-- - O frontend já valida antes de chamar a função
-- - A validação real acontece na resolução do token (resolve_secure_token)
-- - Não podemos validar eficientemente um ciclo dentro de JSONB sem userId

CREATE OR REPLACE FUNCTION generate_secure_token(
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_expires_in_minutes integer default 1440 -- 24 horas padrão
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_expires_at timestamptz;
  v_token_id uuid;
BEGIN
  -- Validar entrada
  IF p_entity_type IS NULL OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_type e entity_id são obrigatórios';
  END IF;
  
  -- ✅ ATUALIZADO: Incluir 'study_document' na lista de tipos válidos
  IF p_entity_type NOT IN ('user', 'concurso', 'community', 'study_cycle', 'admin', 'edit', 'study_document') THEN
    RAISE EXCEPTION 'entity_type inválido: %', p_entity_type;
  END IF;
  
  -- Validar que a entidade existe
  CASE p_entity_type
    WHEN 'user' THEN
      IF NOT EXISTS (SELECT 1 FROM users_profiles WHERE id = p_entity_id) THEN
        RAISE EXCEPTION 'Usuário não encontrado: %', p_entity_id;
      END IF;
    WHEN 'concurso' THEN
      IF NOT EXISTS (SELECT 1 FROM concursos WHERE id = p_entity_id) THEN
        RAISE EXCEPTION 'Concurso não encontrado: %', p_entity_id;
      END IF;
    WHEN 'study_cycle' THEN
      -- ✅ CORRIGIDO: Remover validação incorreta
      -- Os ciclos estão em user_study_v2.study_cycles (JSONB), não podemos validar aqui
      -- A validação real acontece na resolução do token (resolve_secure_token)
      -- O frontend já valida antes de chamar esta função
      NULL; -- Não validar aqui, deixar para a resolução do token
    WHEN 'study_document' THEN
      -- Para study_document, validar que o user_id existe (entity_id é o user_id)
      IF NOT EXISTS (SELECT 1 FROM users_profiles WHERE id = p_entity_id) THEN
        RAISE EXCEPTION 'Usuário não encontrado para documento de estudo: %', p_entity_id;
      END IF;
    ELSE
      -- Para outros tipos, apenas validar que não é null
      NULL;
  END CASE;
  
  -- Gerar hash único
  LOOP
    v_token_hash := generate_token_hash();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM secure_url_tokens WHERE token_hash = v_token_hash);
  END LOOP;
  
  -- Calcular expiração
  v_expires_at := NOW() + (p_expires_in_minutes || ' minutes')::interval;
  
  -- Inserir token
  INSERT INTO secure_url_tokens (
    token_hash,
    entity_type,
    entity_id,
    metadata,
    expires_at
  ) VALUES (
    v_token_hash,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb),
    v_expires_at
  ) RETURNING id INTO v_token_id;
  
  RETURN v_token_hash;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao gerar token: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION generate_secure_token(text, uuid, jsonb, integer) IS 
  'Gera um token seguro no backend. Retorna hash do token que pode ser usado em URLs. Suporta tipos: user, concurso, community, study_cycle, admin, edit, study_document. Para study_cycle, a validação acontece na resolução do token.';

