-- ============================================
-- ADICIONAR ÍNDICES FALTANTES PARA FOREIGN KEYS
-- Melhora performance de JOINs e operações de DELETE
-- Data: 2025-12-02
-- ============================================

-- Índice para study_groups.target_concurso_id
CREATE INDEX IF NOT EXISTS idx_study_groups_target_concurso_id 
ON public.study_groups(target_concurso_id)
WHERE target_concurso_id IS NOT NULL;

COMMENT ON INDEX idx_study_groups_target_concurso_id IS 
'Índice para foreign key target_concurso_id em study_groups. Melhora performance de queries que filtram por concurso.';

-- Índice para study_groups.created_by (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'study_groups' 
    AND indexname LIKE '%created_by%'
  ) THEN
    CREATE INDEX idx_study_groups_created_by 
    ON public.study_groups(created_by)
    WHERE created_by IS NOT NULL;
    
    COMMENT ON INDEX idx_study_groups_created_by IS 
    'Índice para coluna created_by em study_groups. Melhora performance de queries que filtram por criador.';
  END IF;
END $$;

-- Índice para study_group_members.invited_by (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'study_group_members' 
    AND indexname LIKE '%invited_by%'
  ) THEN
    CREATE INDEX idx_study_group_members_invited_by 
    ON public.study_group_members(invited_by)
    WHERE invited_by IS NOT NULL;
    
    COMMENT ON INDEX idx_study_group_members_invited_by IS 
    'Índice para coluna invited_by em study_group_members. Melhora performance de queries que filtram por quem convidou.';
  END IF;
END $$;

-- Verificar e criar índices para outras tabelas mencionadas nos advisors
-- coach_access_logs.student_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'coach_access_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'coach_access_logs' 
    AND indexname LIKE '%student_id%'
  ) THEN
    CREATE INDEX idx_coach_access_logs_student_id 
    ON public.coach_access_logs(student_id)
    WHERE student_id IS NOT NULL;
    
    COMMENT ON INDEX idx_coach_access_logs_student_id IS 
    'Índice para foreign key student_id em coach_access_logs.';
  END IF;
END $$;

-- security_logs.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'security_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'security_logs' 
    AND indexname LIKE '%user_id%'
  ) THEN
    CREATE INDEX idx_security_logs_user_id 
    ON public.security_logs(user_id)
    WHERE user_id IS NOT NULL;
    
    COMMENT ON INDEX idx_security_logs_user_id IS 
    'Índice para foreign key user_id em security_logs.';
  END IF;
END $$;

-- vouchers.created_by
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'vouchers'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'vouchers' 
    AND indexname LIKE '%created_by%'
  ) THEN
    CREATE INDEX idx_vouchers_created_by 
    ON public.vouchers(created_by)
    WHERE created_by IS NOT NULL;
    
    COMMENT ON INDEX idx_vouchers_created_by IS 
    'Índice para foreign key created_by em vouchers.';
  END IF;
END $$;

-- Índices compostos para queries frequentes
-- audit_logs: user_id + created_at (para queries de histórico do usuário)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
ON public.audit_logs(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_audit_logs_user_created IS 
'Índice composto para queries de histórico de auditoria por usuário ordenado por data.';

-- score_calculation_logs: user_ranking_id + created_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'score_calculation_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'score_calculation_logs' 
    AND indexname = 'idx_score_calculation_logs_ranking_created'
  ) THEN
    CREATE INDEX idx_score_calculation_logs_ranking_created 
    ON public.score_calculation_logs(user_ranking_id, created_at DESC)
    WHERE user_ranking_id IS NOT NULL;
    
    COMMENT ON INDEX idx_score_calculation_logs_ranking_created IS 
    'Índice composto para queries de logs de cálculo de score por ranking ordenado por data.';
  END IF;
END $$;

