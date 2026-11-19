-- ============================================================================
-- MIGRATION: Corrigir cálculo de participantes para cards gerais e cargos
-- DATA: 2025-12-19
-- OBJETIVO: 
--   1. Corrigir função count_concurso_participants para usar consolidated_data
--   2. Criar trigger para atualizar total_participants quando usuário participa/sai
--   3. Garantir que trigger do card geral seja acionada quando card filho é atualizado
-- ============================================================================

-- 1. Corrigir função count_concurso_participants para usar consolidated_data
CREATE OR REPLACE FUNCTION public.count_concurso_participants(concurso_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Contar usuários que têm este concurso_id em seu consolidated_data->rankings
  SELECT COUNT(DISTINCT ur.user_id) INTO v_count
  FROM user_rankings ur
  WHERE ur.consolidated_data IS NOT NULL
    AND ur.consolidated_data != '{}'::jsonb
    AND ur.consolidated_data ? 'rankings'
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
      WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = concurso_id
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 2. Função para atualizar total_participants de um concurso específico
CREATE OR REPLACE FUNCTION update_concurso_participant_count(p_concurso_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar participantes usando a função corrigida
  SELECT count_concurso_participants(p_concurso_id) INTO v_count;
  
  -- Atualizar total_participants na tabela concursos
  UPDATE concursos
  SET total_participants = v_count
  WHERE id = p_concurso_id;
END;
$$;

-- 3. Função trigger para atualizar total_participants quando consolidated_data muda
CREATE OR REPLACE FUNCTION trigger_update_participant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_concurso_ids UUID[];
  v_new_concurso_ids UUID[];
  v_concurso_id UUID;
BEGIN
  -- Tratar DELETE: quando um registro é deletado, atualizar todos os concursos que estavam no OLD
  IF TG_OP = 'DELETE' THEN
    IF OLD.consolidated_data IS NOT NULL 
       AND OLD.consolidated_data != '{}'::jsonb
       AND OLD.consolidated_data ? 'rankings' THEN
      SELECT ARRAY_AGG(DISTINCT (value->>'concurso_id')::uuid)
      INTO v_old_concurso_ids
      FROM jsonb_each(OLD.consolidated_data->'rankings')
      WHERE value->>'concurso_id' IS NOT NULL;
      
      -- Atualizar contadores para todos os concursos que estavam no registro deletado
      IF v_old_concurso_ids IS NOT NULL THEN
        FOREACH v_concurso_id IN ARRAY v_old_concurso_ids
        LOOP
          PERFORM update_concurso_participant_count(v_concurso_id);
        END LOOP;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  -- Tratar INSERT/UPDATE: comparar OLD e NEW
  -- Extrair concurso_ids do OLD (quando existe)
  IF OLD.consolidated_data IS NOT NULL 
     AND OLD.consolidated_data != '{}'::jsonb
     AND OLD.consolidated_data ? 'rankings' THEN
    SELECT ARRAY_AGG(DISTINCT (value->>'concurso_id')::uuid)
    INTO v_old_concurso_ids
    FROM jsonb_each(OLD.consolidated_data->'rankings')
    WHERE value->>'concurso_id' IS NOT NULL;
  END IF;
  
  -- Extrair concurso_ids do NEW (quando existe)
  IF NEW.consolidated_data IS NOT NULL 
     AND NEW.consolidated_data != '{}'::jsonb
     AND NEW.consolidated_data ? 'rankings' THEN
    SELECT ARRAY_AGG(DISTINCT (value->>'concurso_id')::uuid)
    INTO v_new_concurso_ids
    FROM jsonb_each(NEW.consolidated_data->'rankings')
    WHERE value->>'concurso_id' IS NOT NULL;
  END IF;
  
  -- Atualizar contadores para concursos que foram removidos (estavam no OLD mas não no NEW)
  IF v_old_concurso_ids IS NOT NULL THEN
    FOREACH v_concurso_id IN ARRAY v_old_concurso_ids
    LOOP
      -- Só atualizar se não estiver mais no NEW
      IF v_new_concurso_ids IS NULL OR NOT (v_concurso_id = ANY(v_new_concurso_ids)) THEN
        PERFORM update_concurso_participant_count(v_concurso_id);
      END IF;
    END LOOP;
  END IF;
  
  -- Atualizar contadores para concursos que foram adicionados ou modificados (estão no NEW)
  IF v_new_concurso_ids IS NOT NULL THEN
    FOREACH v_concurso_id IN ARRAY v_new_concurso_ids
    LOOP
      PERFORM update_concurso_participant_count(v_concurso_id);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar trigger na tabela user_rankings
DROP TRIGGER IF EXISTS trigger_update_participant_count_on_user_rankings ON user_rankings;

CREATE TRIGGER trigger_update_participant_count_on_user_rankings
  AFTER INSERT OR UPDATE OF consolidated_data OR DELETE ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_participant_count();

-- 5. Função para recalcular todos os total_participants (útil para migração/correção)
CREATE OR REPLACE FUNCTION recalculate_all_participant_counts()
RETURNS TABLE(concurso_id UUID, participant_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_concurso RECORD;
BEGIN
  -- Para cada concurso, recalcular total_participants
  FOR v_concurso IN 
    SELECT id FROM concursos
  LOOP
    PERFORM update_concurso_participant_count(v_concurso.id);
    
    -- Retornar o resultado
    RETURN QUERY
    SELECT v_concurso.id, (SELECT total_participants FROM concursos WHERE id = v_concurso.id);
  END LOOP;
END;
$$;

-- 6. Comentários
COMMENT ON FUNCTION count_concurso_participants IS 'Conta participantes de um concurso usando consolidated_data';
COMMENT ON FUNCTION update_concurso_participant_count IS 'Atualiza total_participants de um concurso específico';
COMMENT ON FUNCTION trigger_update_participant_count IS 'Trigger que atualiza total_participants quando consolidated_data muda';
COMMENT ON FUNCTION recalculate_all_participant_counts IS 'Recalcula todos os total_participants (útil para migração)';
