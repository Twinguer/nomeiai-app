-- Auditoria READ-ONLY: divergências entre study_schedule e weekly_schedule
-- Executar no SQL Editor do Supabase. Não altera dados.

-- 1) Usuários com tarefas só no legado (weekly_schedule), sem study_schedule equivalente
WITH legacy_tasks AS (
  SELECT
    u.user_id,
    c->>'id' AS cycle_id,
    (day_elem->>'day')::int AS day_of_week,
    sess->>'id' AS session_id,
    sess->>'discipline_name' AS discipline_name,
    sess->'total_stats' AS total_stats
  FROM user_study_v2 u
  CROSS JOIN LATERAL jsonb_array_elements(u.study_cycles) AS c
  CROSS JOIN LATERAL jsonb_array_elements(c->'schedule_data'->'weekly_schedule') AS day_elem
  CROSS JOIN LATERAL jsonb_array_elements(day_elem->'sessions') AS sess
  WHERE jsonb_array_length(COALESCE(u.study_schedule, '[]'::jsonb)) = 0
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(COALESCE(u.study_schedule, '[]'::jsonb)) AS ss
       WHERE ss->>'id' = sess->>'id'
     )
),
schedule_ids AS (
  SELECT u.user_id, ss->>'id' AS session_id
  FROM user_study_v2 u
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.study_schedule, '[]'::jsonb)) AS ss
)
SELECT
  'legacy_only_tasks' AS report,
  COUNT(*) AS row_count,
  COUNT(DISTINCT user_id) AS user_count
FROM legacy_tasks;

-- 2) Detalhe: tarefas legadas ausentes em study_schedule (top 50)
WITH legacy_tasks AS (
  SELECT
    u.user_id,
    c->>'id' AS cycle_id,
    (day_elem->>'day')::int AS day_of_week,
    sess->>'id' AS session_id,
    sess->>'discipline_name' AS discipline_name
  FROM user_study_v2 u
  CROSS JOIN LATERAL jsonb_array_elements(u.study_cycles) AS c
  CROSS JOIN LATERAL jsonb_array_elements(c->'schedule_data'->'weekly_schedule') AS day_elem
  CROSS JOIN LATERAL jsonb_array_elements(day_elem->'sessions') AS sess
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(u.study_schedule, '[]'::jsonb)) AS ss
    WHERE ss->>'id' = sess->>'id'
  )
)
SELECT * FROM legacy_tasks
ORDER BY user_id
LIMIT 50;

-- 3) Resumo por usuário
SELECT
  u.user_id,
  jsonb_array_length(COALESCE(u.study_schedule, '[]'::jsonb)) AS schedule_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(u.study_cycles) AS c
    CROSS JOIN LATERAL jsonb_array_elements(c->'schedule_data'->'weekly_schedule') AS d
    CROSS JOIN LATERAL jsonb_array_elements(d->'sessions') AS s
  ) AS legacy_task_count,
  jsonb_array_length(COALESCE(u.study_sessions, '[]'::jsonb)) AS ledger_count
FROM user_study_v2 u
ORDER BY ledger_count DESC;
