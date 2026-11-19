-- Estender retenção de posts de grupos de 90 para 365 dias
-- e recalcular expires_at dos posts existentes com base em created_at.

ALTER TABLE public.study_groups
  ALTER COLUMN post_retention_days SET DEFAULT 365;

UPDATE public.study_groups
SET post_retention_days = 365
WHERE COALESCE(post_retention_days, 90) < 365;

CREATE OR REPLACE FUNCTION public.calculate_post_expires_at(p_group_id UUID)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_retention_days INTEGER;
BEGIN
  SELECT COALESCE(post_retention_days, 365)
  INTO v_retention_days
  FROM public.study_groups
  WHERE id = p_group_id;

  RETURN NOW() + (v_retention_days || ' days')::INTERVAL;
END;
$$;

UPDATE public.study_groups sg
SET
  posts_data = sub.new_posts,
  updated_at = NOW()
FROM (
  SELECT
    sg2.id,
    COALESCE(
      jsonb_agg(
        CASE
          WHEN COALESCE((elem->>'is_deleted')::boolean, false) THEN elem
          WHEN elem->>'created_at' IS NULL THEN elem
          ELSE elem || jsonb_build_object(
            'expires_at',
            ((elem->>'created_at')::timestamptz
              + (COALESCE(sg2.post_retention_days, 365) || ' days')::interval)::text
          )
        END
        ORDER BY ord
      ),
      '[]'::jsonb
    ) AS new_posts
  FROM public.study_groups sg2
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sg2.posts_data, '[]'::jsonb))
    WITH ORDINALITY AS t(elem, ord)
  GROUP BY sg2.id
) sub
WHERE sg.id = sub.id
  AND jsonb_array_length(COALESCE(sg.posts_data, '[]'::jsonb)) > 0;

COMMENT ON COLUMN public.study_groups.post_retention_days IS
  'Dias de retenção dos posts no feed do grupo (padrão: 365).';
