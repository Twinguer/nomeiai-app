-- ============================================
-- Retenção de audit_logs: 15 dias + agendamento diário
-- ============================================

-- Limpar audit_logs com retenção rolante de 15 dias (todos os severity)
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs(
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
  IF p_retention_days IS NULL OR p_retention_days < 1 THEN
    RAISE EXCEPTION 'p_retention_days deve ser >= 1';
  END IF;

  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;

  DELETE FROM public.audit_logs
  WHERE created_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT
    v_deleted_count,
    'audit_logs'::TEXT,
    p_retention_days;
END;
$$;

COMMENT ON FUNCTION public.cleanup_audit_logs(INTEGER) IS
'Remove registros de audit_logs mais antigos que N dias (padrão: 15). Retenção rolante.';

-- Função unificada: audit 15d, score_calculation 15d
CREATE OR REPLACE FUNCTION public.cleanup_all_logs(
  p_audit_retention_days INTEGER DEFAULT 15,
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
  FOR v_result IN
    SELECT * FROM public.cleanup_audit_logs(p_audit_retention_days)
  LOOP
    RETURN QUERY SELECT v_result.table_name, v_result.deleted_count, v_result.retention_days;
  END LOOP;

  FOR v_result IN
    SELECT * FROM public.cleanup_score_calculation_logs(p_score_retention_days)
  LOOP
    RETURN QUERY SELECT v_result.table_name, v_result.deleted_count, v_result.retention_days;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.cleanup_all_logs(INTEGER, INTEGER) IS
'Limpa audit_logs e score_calculation_logs. Padrão: 15 dias para ambos.';

-- Alinhar função legada (se ainda for chamada em algum lugar)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 15
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- Apenas roles internas podem executar limpeza manualmente (não usuários autenticados)
REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs(INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_score_calculation_logs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_score_calculation_logs(INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_all_logs(INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_all_logs(INTEGER, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs(INTEGER) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_score_calculation_logs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_all_logs(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs(INTEGER) TO service_role;

-- Agendamento diário via pg_cron (habilitar pg_cron em Database → Extensions no Dashboard)
DO $schedule$
DECLARE
  v_job_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron não habilitado: ative em Supabase Dashboard → Database → Extensions, depois execute SELECT cron.schedule(...) manualmente ou reaplique esta migração.';
    RETURN;
  END IF;

  FOREACH v_job_name IN ARRAY ARRAY[
    'cleanup-audit-logs-15d',
    'cleanup-all-logs-15d',
    'cleanup-all-logs-daily'
  ]
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job_name);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;

  PERFORM cron.schedule(
    'cleanup-all-logs-15d',
    '0 4 * * *',
    $cmd$SELECT public.cleanup_all_logs(15, 15);$cmd$
  );
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN
    RAISE NOTICE 'pg_cron indisponível: habilite a extensão no Dashboard.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível agendar cleanup-all-logs-15d: %', SQLERRM;
END;
$schedule$;
