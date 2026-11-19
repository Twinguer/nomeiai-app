-- Fase 2: backfill idempotente study_schedule ← weekly_schedule
-- Backup automático antes de alterar. Reexecutar é seguro (ON CONFLICT DO NOTHING no backup).

CREATE TABLE IF NOT EXISTS public.user_study_v2_migration_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  migration_name text NOT NULL,
  study_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  study_cycles jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, migration_name)
);

COMMENT ON TABLE public.user_study_v2_migration_backup IS
  'Snapshots para rollback de migrations em user_study_v2. Ver supabase/scripts/rollback_study_schedule_backfill.sql';

DO $$
DECLARE
  v_migration_name text := '20260525120000_backfill_study_schedule';
  v_row record;
  v_schedule jsonb;
  v_cycle jsonb;
  v_day jsonb;
  v_sess jsonb;
  v_new_entry jsonb;
  v_added int;
  v_users int := 0;
  v_total_added int := 0;
BEGIN
  FOR v_row IN SELECT user_id, study_schedule, study_cycles FROM public.user_study_v2 WHERE study_cycles IS NOT NULL LOOP
    INSERT INTO public.user_study_v2_migration_backup (user_id, migration_name, study_schedule, study_cycles)
    VALUES (
      v_row.user_id,
      v_migration_name,
      COALESCE(v_row.study_schedule, '[]'::jsonb),
      v_row.study_cycles
    )
    ON CONFLICT (user_id, migration_name) DO NOTHING;

    v_schedule := COALESCE(v_row.study_schedule, '[]'::jsonb);
    v_added := 0;

    FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_row.study_cycles) LOOP
      IF v_cycle->'schedule_data'->'weekly_schedule' IS NULL THEN
        CONTINUE;
      END IF;

      FOR v_day IN SELECT * FROM jsonb_array_elements(v_cycle->'schedule_data'->'weekly_schedule') LOOP
        FOR v_sess IN SELECT * FROM jsonb_array_elements(v_day->'sessions') LOOP
          IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_schedule) AS existing
            WHERE existing->>'id' = v_sess->>'id'
          ) THEN
            CONTINUE;
          END IF;

          v_new_entry := jsonb_build_object(
            'id', v_sess->>'id',
            'schedule_session_id', v_sess->>'id',
            'cycle_id', v_cycle->>'id',
            'day_of_week', (v_day->>'day')::int,
            'start_time', COALESCE(v_sess->>'start_time', '09:00'),
            'end_time', COALESCE(v_sess->>'end_time', '10:00'),
            'discipline_name', v_sess->>'discipline_name',
            'block_name', v_sess->>'block_name',
            'session_link', v_sess->>'session_link',
            'study_plan_id', v_sess->>'study_plan_id',
            'subject_id', v_sess->>'subject_id',
            'duration_minutes', v_sess->'duration_minutes',
            'display_order', v_sess->'display_order',
            'total_stats', COALESCE(
              v_sess->'total_stats',
              jsonb_build_object(
                'session_count', 0,
                'total_duration_minutes', 0,
                'total_questions', 0,
                'total_correct', 0
              )
            ),
            'migrated_from_weekly_at', now(),
            'created_at', COALESCE(v_sess->>'created_at', now()::text),
            'updated_at', now()::text
          );

          v_schedule := v_schedule || jsonb_build_array(v_new_entry);
          v_added := v_added + 1;
        END LOOP;
      END LOOP;
    END LOOP;

    IF v_added > 0 THEN
      UPDATE public.user_study_v2
      SET study_schedule = v_schedule,
          updated_at = now()
      WHERE user_id = v_row.user_id;

      v_users := v_users + 1;
      v_total_added := v_total_added + v_added;
    END IF;
  END LOOP;

  RAISE NOTICE 'backfill_study_schedule: users_updated=%, tasks_added=%', v_users, v_total_added;
END $$;
