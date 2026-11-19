-- Migration: Consolidate study_statistics to one row per user

-- Step 1: Backup duplicates before deletion (optional, for safety)
CREATE TEMP TABLE study_statistics_backup AS
SELECT * FROM study_statistics;

-- Step 2: Delete duplicates, keeping only the most recent record per user
DELETE FROM study_statistics
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) as rn
    FROM study_statistics
  ) t
  WHERE rn > 1
);

-- Step 3: Add UNIQUE constraint to prevent future duplicates
ALTER TABLE study_statistics
ADD CONSTRAINT study_statistics_user_id_unique UNIQUE (user_id);

-- Step 4: Log the cleanup
INSERT INTO migration_logs (migration_name, details)
VALUES (
  'consolidate_study_statistics',
  jsonb_build_object(
    'backup_rows', (SELECT COUNT(*) FROM study_statistics_backup),
    'remaining_rows', (SELECT COUNT(*) FROM study_statistics),
    'description', 'Consolidated study_statistics to one row per user'
  )
);