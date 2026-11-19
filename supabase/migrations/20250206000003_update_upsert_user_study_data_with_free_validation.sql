-- ============================================================================
-- MIGRATION: Atualizar upsert_user_study_data com validação de plano Free
-- DATA: 2025-02-06
-- OBJETIVO: Bloquear criação de ciclos para usuários Free
-- ============================================================================

-- Atualizar função upsert_user_study_data para validar plano antes de permitir criar ciclos
CREATE OR REPLACE FUNCTION upsert_user_study_data(
  user_uuid UUID,
  study_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_record_id UUID;
  result JSONB;
  new_metadata JSONB;
  current_user_id UUID := auth.uid();
  is_coach_student BOOLEAN := false;
  v_user_plan subscription_plan;
  v_new_cycles JSONB;
  v_existing_cycles JSONB;
  v_cycles_count INTEGER;
BEGIN
  -- Verificar se o usuário está modificando seus próprios dados
  IF current_user_id = user_uuid THEN
    -- OK: usuário modificando seus próprios dados
  ELSE
    -- Verificar se o usuário é um coach e o student_id faz parte da equipe
    SELECT EXISTS (
      SELECT 1 FROM coach_profiles cp
      WHERE cp.coach_id = current_user_id
      AND (
        SELECT COUNT(*) FROM jsonb_array_elements(cp.student_relationships)
        WHERE (value->>'student_id')::uuid = user_uuid
        AND (value->>'status')::text = 'active'
      ) > 0
    ) INTO is_coach_student;
    
    IF NOT is_coach_student THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Permissão negada: você não tem acesso a modificar os dados deste usuário'
      );
    END IF;
  END IF;

  -- VALIDAÇÃO: Verificar se está tentando adicionar/atualizar ciclos
  IF study_data ? 'study_cycles' THEN
    v_new_cycles := study_data->'study_cycles';
    
    -- Verificar plano do usuário (apenas se for o próprio usuário, não coach)
    IF current_user_id = user_uuid THEN
      v_user_plan := public.get_user_subscription_plan(user_uuid);
      IF v_user_plan IS NULL THEN
        v_user_plan := 'free'::subscription_plan;
      END IF;

      -- Free não pode criar ciclos
      IF v_user_plan = 'free' THEN
        -- Verificar se está tentando adicionar novos ciclos ou apenas atualizar existentes
        -- Usar SECURITY DEFINER para bypass RLS e poder ler os dados
        SELECT study_cycles INTO v_existing_cycles
        FROM user_study_v2
        WHERE user_id = user_uuid
        LIMIT 1;

        -- Normalizar para array vazio se NULL
        v_existing_cycles := COALESCE(v_existing_cycles, '[]'::jsonb);
        v_new_cycles := COALESCE(v_new_cycles, '[]'::jsonb);

        -- Se não existem ciclos e está tentando criar, bloquear
        IF jsonb_array_length(v_existing_cycles) = 0 THEN
          IF jsonb_array_length(v_new_cycles) > 0 THEN
            RAISE EXCEPTION 'Ciclos de estudos estão disponíveis apenas no plano Pro. Faça upgrade para criar ciclos de estudos.'
              USING ERRCODE = 'P0001',
                    HINT = 'Visite /planos para fazer upgrade para o plano Pro';
          END IF;
        ELSE
          -- Se já tem ciclos, verificar se está tentando adicionar mais
          v_cycles_count := jsonb_array_length(v_existing_cycles);
          IF jsonb_array_length(v_new_cycles) > v_cycles_count THEN
            RAISE EXCEPTION 'Ciclos de estudos estão disponíveis apenas no plano Pro. Faça upgrade para criar mais ciclos.'
              USING ERRCODE = 'P0001',
                    HINT = 'Visite /planos para fazer upgrade para o plano Pro';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Construir study_metadata a partir dos campos enviados
  new_metadata := jsonb_build_object(
    'study_plans', COALESCE(study_data->'study_plans', '[]'::jsonb),
    'study_subjects', COALESCE(study_data->'study_subjects', '[]'::jsonb),
    'study_goals', COALESCE(study_data->'study_goals', '[]'::jsonb),
    'study_goals_tracking', COALESCE(study_data->'study_goals_tracking', '{}'::jsonb),
    'study_progress', COALESCE(study_data->'study_progress', '[]'::jsonb),
    'study_reminders', COALESCE(study_data->'study_reminders', '[]'::jsonb),
    'spaced_repetition_queue', COALESCE(study_data->'spaced_repetition_queue', '[]'::jsonb),
    'user_study_days', COALESCE(study_data->'user_study_days', '[]'::jsonb),
    'study_contests', COALESCE(study_data->'study_contests', '[]'::jsonb)
  );

  -- Verificar se registro já existe
  SELECT id INTO existing_record_id
  FROM user_study_v2
  WHERE user_id = user_uuid
  LIMIT 1;
  
  IF existing_record_id IS NOT NULL THEN
    -- Atualizar registro existente
    UPDATE user_study_v2 SET
      study_sessions = COALESCE(study_data->'study_sessions', study_sessions),
      study_cycles = COALESCE(study_data->'study_cycles', study_cycles),
      study_statistics = COALESCE(study_data->'study_statistics', study_statistics),
      study_schedule = COALESCE(study_data->'study_schedule', study_schedule),
      study_metadata = study_metadata || new_metadata,
      last_activity_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = existing_record_id;
    
    result := jsonb_build_object('success', true, 'action', 'updated', 'id', existing_record_id);
  ELSE
    -- Criar novo registro
    INSERT INTO user_study_v2 (
      user_id,
      study_sessions,
      study_cycles,
      study_statistics,
      study_schedule,
      study_metadata,
      last_activity_date
    ) VALUES (
      user_uuid,
      COALESCE(study_data->'study_sessions', '[]'::jsonb),
      COALESCE(study_data->'study_cycles', '[]'::jsonb),
      COALESCE(study_data->'study_statistics', '{}'::jsonb),
      COALESCE(study_data->'study_schedule', '[]'::jsonb),
      new_metadata,
      CURRENT_DATE
    ) RETURNING id INTO existing_record_id;
    
    result := jsonb_build_object('success', true, 'action', 'created', 'id', existing_record_id);
  END IF;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION upsert_user_study_data(UUID, JSONB) IS 
  'Permite que usuários modifiquem seus próprios dados ou que coaches modifiquem dados de seus alunos ativos. Bloqueia criação de ciclos para usuários Free.';

