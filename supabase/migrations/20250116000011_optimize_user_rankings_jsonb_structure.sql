-- ============================================================================
-- MIGRAÇÃO: OTIMIZAÇÃO DA ESTRUTURA JSONB USER_RANKINGS
-- ============================================================================
-- 
-- Esta migração otimiza a estrutura JSONB da tabela user_rankings para
-- atender perfeitamente às necessidades do sistema de rankings de concursos.
-- 
-- BENEFÍCIOS:
-- 1. Estrutura mais organizada e escalável
-- 2. Melhor performance em consultas
-- 3. Facilita manutenção e evolução
-- 4. Suporte completo às regras de negócio
-- 5. Auditoria e rastreabilidade aprimoradas
-- ============================================================================

-- ============================================================================
-- 1. BACKUP DOS DADOS EXISTENTES
-- ============================================================================

-- Criar tabela temporária para backup
CREATE TEMP TABLE user_rankings_backup AS
SELECT 
    user_id,
    consolidated_data,
    created_at,
    updated_at
FROM user_rankings;

-- ============================================================================
-- 2. ATUALIZAR ESTRUTURA EXISTENTE (MIGRAÇÃO GRADUAL)
-- ============================================================================

-- Função para migrar dados existentes para nova estrutura
CREATE OR REPLACE FUNCTION migrate_user_rankings_data()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    ranking_key TEXT;
    ranking_data JSONB;
    new_consolidated_data JSONB;
    rankings_count INTEGER;
BEGIN
    -- Iterar sobre todos os registros existentes
    FOR user_record IN 
        SELECT user_id, consolidated_data, created_at, updated_at 
        FROM user_rankings 
        WHERE consolidated_data IS NOT NULL
    LOOP
        -- Inicializar nova estrutura
        new_consolidated_data := jsonb_build_object(
            'rankings', jsonb_build_object(),
            'metadata', jsonb_build_object(
                'last_updated', user_record.updated_at,
                'version', '2.0',
                'total_rankings', 0,
                'user_id', user_record.user_id
            )
        );
        
        -- Migrar rankings existentes
        IF user_record.consolidated_data ? 'rankings' THEN
            -- Contar rankings
            SELECT jsonb_object_keys(user_record.consolidated_data->'rankings')::integer 
            INTO rankings_count;
            
            -- Copiar rankings existentes
            new_consolidated_data := jsonb_set(
                new_consolidated_data,
                ARRAY['rankings'],
                user_record.consolidated_data->'rankings'
            );
            
            -- Atualizar metadados
            new_consolidated_data := jsonb_set(
                new_consolidated_data,
                ARRAY['metadata', 'total_rankings'],
                to_jsonb(rankings_count)
            );
        END IF;
        
        -- Atualizar registro
        UPDATE user_rankings 
        SET consolidated_data = new_consolidated_data
        WHERE user_id = user_record.user_id;
        
        RAISE NOTICE 'Migrated user: %', user_record.user_id;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END;
$$;

-- Executar migração
SELECT migrate_user_rankings_data();

-- Limpar função temporária
DROP FUNCTION migrate_user_rankings_data();

-- ============================================================================
-- 3. CRIAR ÍNDICES OTIMIZADOS PARA PERFORMANCE
-- ============================================================================

-- Índice GIN para consultas rápidas no JSONB
CREATE INDEX IF NOT EXISTS idx_user_rankings_consolidated_data_gin 
ON user_rankings USING GIN (consolidated_data);

-- Índice para consultas por concurso_id dentro do JSONB
CREATE INDEX IF NOT EXISTS idx_user_rankings_concurso_id 
ON user_rankings USING GIN ((consolidated_data->'rankings'));

-- Índice para consultas por status
CREATE INDEX IF NOT EXISTS idx_user_rankings_status 
ON user_rankings USING GIN ((consolidated_data->'rankings'->'*'->'status'));

-- Índice para consultas por reservation_type
CREATE INDEX IF NOT EXISTS idx_user_rankings_reservation_type 
ON user_rankings USING GIN ((consolidated_data->'rankings'->'*'->'reservation_type'));

-- ============================================================================
-- 4. CRIAR FUNÇÕES AUXILIARES PARA CONSULTAS OTIMIZADAS
-- ============================================================================

-- Função para buscar ranking específico de um usuário em um concurso
CREATE OR REPLACE FUNCTION get_user_ranking_by_concurso(
    p_user_id UUID,
    p_concurso_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    ranking_key TEXT;
    ranking_data JSONB;
BEGIN
    -- Buscar dados consolidados do usuário
    SELECT consolidated_data INTO result
    FROM user_rankings
    WHERE user_id = p_user_id
    LIMIT 1;
    
    IF result IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Procurar ranking específico do concurso
    FOR ranking_key IN 
        SELECT jsonb_object_keys(result->'rankings')
    LOOP
        ranking_data := result->'rankings'->ranking_key;
        
        IF (ranking_data->>'concurso_id')::UUID = p_concurso_id THEN
            RETURN ranking_data;
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$;

-- Função para buscar todos os rankings de um concurso
CREATE OR REPLACE FUNCTION get_concurso_rankings(
    p_concurso_id UUID
)
RETURNS TABLE (
    user_id UUID,
    ranking_id TEXT,
    ranking_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ur.user_id,
        ranking_key::TEXT as ranking_id,
        ranking_data
    FROM user_rankings ur,
    LATERAL jsonb_each(ur.consolidated_data->'rankings') AS rankings(ranking_key, ranking_data)
    WHERE (ranking_data->>'concurso_id')::UUID = p_concurso_id;
END;
$$;

-- Função para atualizar ranking específico
CREATE OR REPLACE FUNCTION update_user_ranking(
    p_user_id UUID,
    p_ranking_id TEXT,
    p_ranking_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_data JSONB;
    updated_data JSONB;
BEGIN
    -- Buscar dados atuais
    SELECT consolidated_data INTO current_data
    FROM user_rankings
    WHERE user_id = p_user_id
    LIMIT 1;
    
    IF current_data IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Atualizar ranking específico
    updated_data := jsonb_set(
        current_data,
        ARRAY['rankings', p_ranking_id],
        p_ranking_data
    );
    
    -- Atualizar timestamp
    updated_data := jsonb_set(
        updated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(NOW())
    );
    
    -- Salvar no banco
    UPDATE user_rankings
    SET 
        consolidated_data = updated_data,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 5. CRIAR TRIGGERS PARA AUDITORIA E INTEGRIDADE
-- ============================================================================

-- Função de trigger para auditoria
CREATE OR REPLACE FUNCTION audit_user_rankings_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Log da alteração
    INSERT INTO user_rankings_audit (
        user_id,
        action,
        old_data,
        new_data,
        changed_at
    ) VALUES (
        NEW.user_id,
        TG_OP,
        OLD.consolidated_data,
        NEW.consolidated_data,
        NOW()
    );
    
    RETURN NEW;
END;
$$;

-- Criar tabela de auditoria se não existir
CREATE TABLE IF NOT EXISTS user_rankings_audit (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar trigger de auditoria
DROP TRIGGER IF EXISTS user_rankings_audit_trigger ON user_rankings;
CREATE TRIGGER user_rankings_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_rankings
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_rankings_changes();

-- ============================================================================
-- 6. CRIAR VIEWS PARA CONSULTAS COMUNS
-- ============================================================================

-- View para rankings com informações do usuário
CREATE OR REPLACE VIEW v_user_rankings_with_profiles AS
SELECT 
    ur.user_id,
    up.name as user_name,
    up.avatar_url,
    ranking_key as ranking_id,
    ranking_data->>'concurso_id' as concurso_id,
    (ranking_data->>'score')::NUMERIC as score,
    ranking_data->>'reservation_type' as reservation_type,
    ranking_data->>'status' as status,
    (ranking_data->>'edit_count')::INTEGER as edit_count,
    ranking_data->>'last_updated' as last_updated
FROM user_rankings ur
LEFT JOIN users_profiles up ON ur.user_id = up.id,
LATERAL jsonb_each(ur.consolidated_data->'rankings') AS rankings(ranking_key, ranking_data);

-- View para estatísticas de concursos
CREATE OR REPLACE VIEW v_concurso_statistics AS
SELECT 
    ranking_data->>'concurso_id' as concurso_id,
    COUNT(*) as total_participants,
    AVG((ranking_data->>'score')::NUMERIC) as average_score,
    MAX((ranking_data->>'score')::NUMERIC) as max_score,
    MIN((ranking_data->>'score')::NUMERIC) as min_score,
    COUNT(*) FILTER (WHERE ranking_data->>'status' = 'classificado') as classified_count,
    COUNT(*) FILTER (WHERE ranking_data->>'status' = 'eliminado') as eliminated_count
FROM user_rankings ur,
LATERAL jsonb_each(ur.consolidated_data->'rankings') AS rankings(ranking_key, ranking_data)
GROUP BY ranking_data->>'concurso_id';

-- ============================================================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE user_rankings IS 'Tabela consolidada de rankings de usuários com estrutura JSONB otimizada';
COMMENT ON COLUMN user_rankings.consolidated_data IS 'Dados consolidados em JSONB com estrutura hierárquica otimizada';
COMMENT ON FUNCTION get_user_ranking_by_concurso IS 'Busca ranking específico de um usuário em um concurso';
COMMENT ON FUNCTION get_concurso_rankings IS 'Busca todos os rankings de um concurso específico';
COMMENT ON FUNCTION update_user_ranking IS 'Atualiza ranking específico de um usuário';

-- ============================================================================
-- 8. LIMPEZA E FINALIZAÇÃO
-- ============================================================================

-- Remover tabela de backup temporária
DROP TABLE IF EXISTS user_rankings_backup;

-- Atualizar estatísticas
ANALYZE user_rankings;

RAISE NOTICE 'User rankings JSONB structure optimization completed successfully!';












