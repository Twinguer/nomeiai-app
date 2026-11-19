-- Remove tabelas não utilizadas do sistema

-- 1. Remove payment_preferences (Mercado Pago deprecated)
DROP TABLE IF EXISTS public.payment_preferences CASCADE;

-- 2. Remove query_performance_logs (não utilizada)
DROP TABLE IF EXISTS public.query_performance_logs CASCADE;

-- 3. Remove performance_alerts (não utilizada no frontend)
DROP TABLE IF EXISTS public.performance_alerts CASCADE;

-- 4. Remove performance_metrics (não utilizada no frontend)
DROP TABLE IF EXISTS public.performance_metrics CASCADE;

-- 5. Remove secure_tokens (completamente não utilizada)
DROP TABLE IF EXISTS public.secure_tokens CASCADE;

-- Remover funções relacionadas se existirem
DROP FUNCTION IF EXISTS public.cleanup_expired_tokens() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_alerts() CASCADE;
DROP FUNCTION IF EXISTS public.check_performance_alerts() CASCADE;
DROP FUNCTION IF EXISTS public.collect_performance_metrics() CASCADE;
DROP FUNCTION IF EXISTS public.check_advanced_performance_alerts() CASCADE;