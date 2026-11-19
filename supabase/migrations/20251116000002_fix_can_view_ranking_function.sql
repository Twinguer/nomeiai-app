-- Corrigir função can_view_ranking: Free pode ver rankings que criou OU rankings que participa
-- Free users podem criar rankings e ver todos os rankings que criaram
-- Free users podem ver até 2 rankings que não criaram (mas participam)

CREATE OR REPLACE FUNCTION public.can_view_ranking(
  p_concurso_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Pro pode ver todos
  -- Free pode ver se criou OU se participa
  SELECT 
    public.is_user_pro(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM concursos c
      WHERE c.id = p_concurso_id
        AND c.created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM user_rankings ur
      WHERE ur.user_id = auth.uid()
        AND ur.consolidated_data IS NOT NULL
        AND ur.consolidated_data != '{}'::jsonb
        AND ur.consolidated_data ? 'rankings'
        AND EXISTS (
          SELECT 1
          FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
          WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
        )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
$$;

COMMENT ON FUNCTION public.can_view_ranking(UUID) IS 
'Free users podem ver rankings que criaram (ilimitados) ou rankings que participam (até 2 que não criou). Pro users podem ver todos.';
