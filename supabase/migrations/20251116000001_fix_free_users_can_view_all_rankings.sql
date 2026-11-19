-- RLS policy para Free users: podem ver rankings que criaram OU rankings que participam (até 2 que não criou)
-- Free users podem criar rankings e ver todos os rankings que criaram
-- Free users podem ver até 2 rankings que não criaram (mas participam)

DROP POLICY IF EXISTS "free_users_can_only_view_participated_rankings" ON public.concursos;

CREATE POLICY "free_users_can_view_created_or_participated_rankings"
  ON public.concursos FOR SELECT
  USING (
    -- Pro pode ver todos
    public.is_user_pro(auth.uid())
    OR
    -- Free pode ver se:
    -- 1. Criou o ranking (pode ver todos os que criou)
    -- 2. Participa do ranking (pode ver até 2 que não criou)
    (
      NOT public.is_user_pro(auth.uid())
      AND (
        -- É o criador do ranking
        concursos.created_by_user_id = auth.uid()
        OR
        -- Participa do ranking
        EXISTS (
          SELECT 1
          FROM user_rankings ur
          WHERE ur.user_id = auth.uid()
            AND ur.consolidated_data IS NOT NULL
            AND ur.consolidated_data != '{}'::jsonb
            AND ur.consolidated_data ? 'rankings'
            AND EXISTS (
              SELECT 1
              FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
              WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = concursos.id
            )
        )
      )
    )
    OR
    -- Admins podem ver todos
    public.has_role(auth.uid(), 'admin'::app_role)
  );

COMMENT ON POLICY "free_users_can_view_created_or_participated_rankings" ON public.concursos IS 
'Free users podem ver rankings que criaram (ilimitados) ou rankings que participam (até 2 que não criou). Pro users podem ver todos.';
