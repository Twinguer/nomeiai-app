-- Corrige ambiguidade table_name em cleanup_score_calculation_logs (RETURNS TABLE com mesma coluna)
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
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables ist
    WHERE ist.table_schema = 'public'
      AND ist.table_name = 'score_calculation_logs'
  ) THEN
    RETURN QUERY SELECT
      0::BIGINT,
      'score_calculation_logs'::TEXT,
      p_retention_days;
    RETURN;
  END IF;

  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;

  EXECUTE format(
    'DELETE FROM public.score_calculation_logs WHERE created_at < %L',
    v_cutoff_date
  );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT
    v_deleted_count,
    'score_calculation_logs'::TEXT,
    p_retention_days;
END;
$$;
