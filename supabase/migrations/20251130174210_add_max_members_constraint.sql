-- ============================================================================
-- MIGRATION: Adicionar constraint para limitar max_members entre 1 e 1000
-- DATA: 2025-11-30
-- OBJETIVO: Garantir que o número máximo de membros esteja entre 1 e 1000
-- ============================================================================

-- Adicionar constraint para limitar max_members a no máximo 1000 e mínimo 1
ALTER TABLE study_groups 
ADD CONSTRAINT check_max_members_limit 
CHECK (max_members IS NULL OR (max_members >= 1 AND max_members <= 1000));

-- Comentário explicativo
COMMENT ON CONSTRAINT check_max_members_limit ON study_groups IS 
'Limita o número máximo de membros entre 1 e 1000. O usuário pode escolher qualquer valor neste intervalo.';

