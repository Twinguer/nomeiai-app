-- Corrige alertas do Supabase Database Linter sem mudar o comportamento do app:
-- 1) auth_users_exposed: remove JOIN em auth.users na view de vouchers
-- 2) security_definer_view: views públicas e vouchers com security_invoker = true
-- Ref: https://supabase.com/docs/guides/database/database-linter

-- =============================================================================
-- public_profiles (sem wrapper em função SECURITY DEFINER)
-- =============================================================================
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  avatar_url,
  created_at,
  updated_at
FROM public.users_profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Perfil público (security_invoker). Respeita RLS de users_profiles.';

-- =============================================================================
-- public_rankings
-- =============================================================================
CREATE OR REPLACE VIEW public.public_rankings
WITH (security_invoker = true)
AS
SELECT
  ur.id,
  ur.concurso_id,
  ur.score,
  ur.basic_knowledge_score,
  ur.specific_knowledge_score,
  ur.discursive_score,
  ur.reservation_type,
  up.name AS user_name,
  up.avatar_url,
  c.titulo AS concurso_title,
  c.orgao,
  c.banca
FROM public.user_rankings ur
LEFT JOIN public.users_profiles up ON ur.user_id = up.id
LEFT JOIN public.concursos c ON ur.concurso_id = c.id;

ALTER VIEW public.public_rankings SET (security_barrier = true);
GRANT SELECT ON public.public_rankings TO authenticated, anon;

-- =============================================================================
-- leaderboard_rankings
-- =============================================================================
CREATE OR REPLACE VIEW public.leaderboard_rankings
WITH (security_invoker = true)
AS
SELECT
  ur.id,
  ur.concurso_id,
  ur.score,
  ur.reservation_type,
  up.name AS user_name,
  up.avatar_url,
  c.titulo AS concurso_title,
  c.orgao,
  c.banca,
  NULL::numeric AS basic_knowledge_score,
  NULL::numeric AS specific_knowledge_score,
  NULL::numeric AS discursive_score,
  NULL::jsonb AS customDisciplineScores,
  NULL::jsonb AS weightedCustomDisciplineScores
FROM public.user_rankings ur
LEFT JOIN public.users_profiles up ON ur.user_id = up.id
LEFT JOIN public.concursos c ON ur.concurso_id = c.id
ORDER BY ur.score DESC;

ALTER VIEW public.leaderboard_rankings SET (security_barrier = true);
GRANT SELECT ON public.leaderboard_rankings TO authenticated, anon;

-- =============================================================================
-- vouchers_applied_with_users: sem auth.users; só authenticated (admin UI)
-- =============================================================================
DROP VIEW IF EXISTS public.vouchers_applied_with_users;

CREATE VIEW public.vouchers_applied_with_users
WITH (security_invoker = true)
AS
SELECT
  v.code AS voucher_code,
  v.voucher_type,
  v.plan AS voucher_plan,
  v.duration_months,
  v.description AS voucher_description,
  v.created_at AS voucher_created_at,
  v.expires_at AS voucher_expires_at,
  us.user_id,
  us.plan AS user_plan,
  us.expires_at AS subscription_expires_at,
  us.is_active AS subscription_active,
  us.created_at AS applied_at,
  up.name AS user_name,
  up.email AS user_email,
  up.email AS auth_email,
  NULL::TEXT AS coach_plan_type,
  NULL::INTEGER AS coach_max_students,
  NULL::DECIMAL AS coach_price,
  NULL::TEXT AS coach_status
FROM public.vouchers v
LEFT JOIN public.user_subscriptions us ON v.code = us.voucher_code
LEFT JOIN public.users_profiles up ON us.user_id = up.id
WHERE v.voucher_type = 'subscription'
  AND v.plan IN ('free', 'pro')

UNION ALL

SELECT
  v.code AS voucher_code,
  v.voucher_type,
  v.plan AS voucher_plan,
  v.duration_months,
  v.description AS voucher_description,
  v.created_at AS voucher_created_at,
  v.expires_at AS voucher_expires_at,
  cs.coach_id AS user_id,
  NULL::subscription_plan AS user_plan,
  cs.expires_at AS subscription_expires_at,
  (cs.status = 'active')::BOOLEAN AS subscription_active,
  cs.created_at AS applied_at,
  up.name AS user_name,
  up.email AS user_email,
  up.email AS auth_email,
  cs.plan_type AS coach_plan_type,
  cs.max_students AS coach_max_students,
  cs.price AS coach_price,
  cs.status AS coach_status
FROM public.vouchers v
LEFT JOIN public.coach_subscriptions cs ON v.code = cs.voucher_code
LEFT JOIN public.users_profiles up ON cs.coach_id = up.id
WHERE v.voucher_type = 'subscription'
  AND v.plan LIKE 'coach_%';

ALTER VIEW public.vouchers_applied_with_users SET (security_barrier = true);

REVOKE ALL ON public.vouchers_applied_with_users FROM anon;
REVOKE ALL ON public.vouchers_applied_with_users FROM PUBLIC;
GRANT SELECT ON public.vouchers_applied_with_users TO authenticated;

COMMENT ON VIEW public.vouchers_applied_with_users IS
  'Vouchers aplicados (security_invoker). Sem auth.users; email via users_profiles. Apenas authenticated.';
