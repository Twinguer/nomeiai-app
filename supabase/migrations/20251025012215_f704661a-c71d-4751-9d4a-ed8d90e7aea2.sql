-- ============================================================================
-- CORREÇÃO DE SEGURANÇA CRÍTICA: Habilitar RLS em tabelas expostas
-- ============================================================================

-- 1. Habilitar RLS em tabelas críticas sem proteção
ALTER TABLE public.concursos_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidated_answers_by_concurso_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rankings_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rankings_structure_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- 2. Criar policies básicas para tabelas de backup (somente leitura admin)
CREATE POLICY "Only admins can access backup tables"
  ON public.concursos_backup FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can access consolidated backup"
  ON public.consolidated_answers_by_concurso_backup FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can access user rankings backup"
  ON public.user_rankings_backup FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can access user rankings structure backup"
  ON public.user_rankings_structure_backup FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Policies para error_logs (admins podem ver, sistema pode inserir)
CREATE POLICY "Admins can view error logs"
  ON public.error_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert error logs"
  ON public.error_logs FOR INSERT
  WITH CHECK (true);

-- 4. Policies para migration_config (somente sistema)
CREATE POLICY "Only system can access migration config"
  ON public.migration_config FOR ALL
  USING (false);

-- 5. Policies para performance_alerts (admins e sistema)
CREATE POLICY "Admins can view performance alerts"
  ON public.performance_alerts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage performance alerts"
  ON public.performance_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update performance alerts"
  ON public.performance_alerts FOR UPDATE
  USING (true);

-- 6. Policies para performance_metrics (admins e sistema)
CREATE POLICY "Admins can view performance metrics"
  ON public.performance_metrics FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert performance metrics"
  ON public.performance_metrics FOR INSERT
  WITH CHECK (true);

-- 7. Policies para query_performance_logs (admins e sistema)
CREATE POLICY "Admins can view query performance logs"
  ON public.query_performance_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert query performance logs"
  ON public.query_performance_logs FOR INSERT
  WITH CHECK (true);

-- 8. Policies para audit_trail (admins podem ver, sistema pode inserir)
CREATE POLICY "Admins can view audit trail"
  ON public.audit_trail FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit trail"
  ON public.audit_trail FOR INSERT
  WITH CHECK (true);

-- 9. Adicionar search_path seguro às funções de limpeza criadas
ALTER FUNCTION public.cleanup_expired_tokens() SET search_path = public;
ALTER FUNCTION public.cleanup_old_audit_logs(integer) SET search_path = public;

COMMENT ON SCHEMA public IS 'Sistema de segurança reforçado: RLS habilitado em todas as tabelas públicas';