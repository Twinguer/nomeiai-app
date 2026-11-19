-- ============================================
-- FUNÇÃO DE LIMPEZA DE LOGS
-- Remove logs antigos mantendo retenção configurável
-- Data: 2025-12-02
-- ============================================

-- Função para limpar audit_logs mantendo apenas os últimos N dias
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs(
  p_retention_days INTEGER DEFAULT 45
)
RETURNS TABLE(
  deleted_count BIGINT,
  table_name TEXT,
  retention_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  -- Calcular data de corte
  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
  
  -- Deletar logs antigos (exceto logs críticos)
  -- Manter logs com severity 'critical' ou 'high' por mais tempo
  DELETE FROM public.audit_logs
  WHERE created_at < v_cutoff_date
    AND severity NOT IN ('critical', 'high');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    v_deleted_count,
    'audit_logs'::TEXT,
    p_retention_days;
END;
$$;

COMMENT ON FUNCTION public.cleanup_audit_logs(INTEGER) IS 
'Remove logs de auditoria antigos mantendo apenas os últimos N dias (padrão: 45 dias). Logs críticos e de alta severidade são preservados por mais tempo.';

-- Função para limpar score_calculation_logs
CREATE OR REPLACE FUNCTION public.cleanup_score_calculation_logs(
  p_retention_days INTEGER DEFAULT 15
)
RETURNS TABLE(
  deleted_count BIGINT,
  table_name TEXT,
  retention_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count BIGINT;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  -- Verificar se a tabela existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'score_calculation_logs'
  ) THEN
    RETURN QUERY SELECT 
      0::BIGINT,
      'score_calculation_logs'::TEXT,
      p_retention_days;
    RETURN;
  END IF;
  
  -- Calcular data de corte
  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
  
  -- Deletar logs antigos
  EXECUTE format('
    DELETE FROM public.score_calculation_logs
    WHERE created_at < %L
  ', v_cutoff_date);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    v_deleted_count,
    'score_calculation_logs'::TEXT,
    p_retention_days;
END;
$$;

COMMENT ON FUNCTION public.cleanup_score_calculation_logs(INTEGER) IS 
'Remove logs de cálculo de score antigos mantendo apenas os últimos N dias (padrão: 15 dias). Estes logs são principalmente para debug.';

-- Função unificada para limpar todos os logs
CREATE OR REPLACE FUNCTION public.cleanup_all_logs(
  p_audit_retention_days INTEGER DEFAULT 45,
  p_score_retention_days INTEGER DEFAULT 15
)
RETURNS TABLE(
  table_name TEXT,
  deleted_count BIGINT,
  retention_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Limpar audit_logs
  FOR v_result IN 
    SELECT * FROM public.cleanup_audit_logs(p_audit_retention_days)
  LOOP
    RETURN QUERY SELECT v_result.table_name, v_result.deleted_count, v_result.retention_days;
  END LOOP;
  
  -- Limpar score_calculation_logs
  FOR v_result IN 
    SELECT * FROM public.cleanup_score_calculation_logs(p_score_retention_days)
  LOOP
    RETURN QUERY SELECT v_result.table_name, v_result.deleted_count, v_result.retention_days;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.cleanup_all_logs(INTEGER, INTEGER) IS 
'Função unificada para limpar todos os logs do sistema. Parâmetros: dias de retenção para audit_logs (padrão: 45) e score_calculation_logs (padrão: 15).';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_score_calculation_logs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_all_logs(INTEGER, INTEGER) TO authenticated;

-- Criar função para obter estatísticas de logs (útil para monitoramento)
-- Remover função existente se houver
DROP FUNCTION IF EXISTS public.get_log_statistics();

CREATE OR REPLACE FUNCTION public.get_log_statistics()
RETURNS TABLE(
  table_name TEXT,
  total_count BIGINT,
  oldest_record TIMESTAMPTZ,
  newest_record TIMESTAMPTZ,
  size_mb NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Estatísticas de audit_logs
  RETURN QUERY
  SELECT 
    'audit_logs'::TEXT,
    COUNT(*)::BIGINT,
    MIN(created_at),
    MAX(created_at),
    ROUND(
      (pg_total_relation_size('public.audit_logs')::NUMERIC / 1024 / 1024)::NUMERIC,
      2
    )
  FROM public.audit_logs;
  
  -- Estatísticas de score_calculation_logs (se existir)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'score_calculation_logs'
  ) THEN
    RETURN QUERY
    EXECUTE format('
      SELECT 
        ''score_calculation_logs''::TEXT,
        COUNT(*)::BIGINT,
        MIN(created_at),
        MAX(created_at),
        ROUND(
          (pg_total_relation_size(''public.score_calculation_logs'')::NUMERIC / 1024 / 1024)::NUMERIC,
          2
        )
      FROM public.score_calculation_logs
    ');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_log_statistics() IS 
'Retorna estatísticas sobre os logs do sistema: contagem, datas e tamanho em MB.';

GRANT EXECUTE ON FUNCTION public.get_log_statistics() TO authenticated;

