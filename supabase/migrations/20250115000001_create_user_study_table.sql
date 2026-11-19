-- Migration: Create user_study table to consolidate all study-related data
-- This replaces 12 separate study tables with a single JSONB-based table

CREATE TABLE user_study (
  -- Primary keys
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Study data consolidated in JSONB
  study_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_statistics JSONB NOT NULL DEFAULT '{
    "totalHours": 0,
    "totalSessions": 0,
    "questionsAnswered": 0,
    "correctAnswers": 0,
    "wrongAnswers": 0,
    "currentStreak": 0,
    "longestStreak": 0,
    "lastStudyDate": null,
    "dailyStats": {},
    "weeklyStats": {},
    "monthlyStats": {},
    "averages": {
      "dailyHours": 0,
      "weeklyHours": 0,
      "monthlyHours": 0
    },
    "sessionHistory": [],
    "subjectStats": {},
    "lastUpdated": null
  }'::jsonb,
  study_cycles JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_goals_tracking JSONB NOT NULL DEFAULT '{}'::jsonb,
  study_progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_reminders JSONB NOT NULL DEFAULT '[]'::jsonb,
  spaced_repetition_queue JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_study_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_contests JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  last_activity_date DATE,
  total_sessions_count INTEGER DEFAULT 0,
  total_schedule_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_study ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own study data"
ON user_study FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study data"
ON user_study FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study data"
ON user_study FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study data"
ON user_study FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_user_study_user_id ON user_study(user_id);
CREATE INDEX idx_user_study_last_activity ON user_study(last_activity_date);

-- GIN indexes for JSONB columns
CREATE INDEX idx_user_study_sessions ON user_study USING GIN(study_sessions);
CREATE INDEX idx_user_study_schedule ON user_study USING GIN(study_schedule);
CREATE INDEX idx_user_study_statistics ON user_study USING GIN(study_statistics);
CREATE INDEX idx_user_study_cycles ON user_study USING GIN(study_cycles);
CREATE INDEX idx_user_study_plans ON user_study USING GIN(study_plans);
CREATE INDEX idx_user_study_subjects ON user_study USING GIN(study_subjects);
CREATE INDEX idx_user_study_goals ON user_study USING GIN(study_goals);
CREATE INDEX idx_user_study_progress ON user_study USING GIN(study_progress);
CREATE INDEX idx_user_study_reminders ON user_study USING GIN(study_reminders);
CREATE INDEX idx_user_study_repetition ON user_study USING GIN(spaced_repetition_queue);
CREATE INDEX idx_user_study_days ON user_study USING GIN(user_study_days);
CREATE INDEX idx_user_study_contests ON user_study USING GIN(study_contests);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_study_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_study_updated_at
  BEFORE UPDATE ON user_study
  FOR EACH ROW
  EXECUTE FUNCTION update_user_study_updated_at();

-- Helper functions for JSONB manipulation
CREATE OR REPLACE FUNCTION get_user_study_data(user_uuid UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT to_jsonb(us.*) 
    FROM user_study us 
    WHERE us.user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_user_study_data(
  user_uuid UUID,
  study_data JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_study (user_id, study_sessions, study_schedule, study_statistics, study_cycles, study_plans, study_subjects, study_goals, study_goals_tracking, study_progress, study_reminders, spaced_repetition_queue, user_study_days, study_contests)
  VALUES (
    user_uuid,
    COALESCE(study_data->'study_sessions', '[]'::jsonb),
    COALESCE(study_data->'study_schedule', '[]'::jsonb),
    COALESCE(study_data->'study_statistics', '{}'::jsonb),
    COALESCE(study_data->'study_cycles', '[]'::jsonb),
    COALESCE(study_data->'study_plans', '[]'::jsonb),
    COALESCE(study_data->'study_subjects', '[]'::jsonb),
    COALESCE(study_data->'study_goals', '[]'::jsonb),
    COALESCE(study_data->'study_goals_tracking', '{}'::jsonb),
    COALESCE(study_data->'study_progress', '[]'::jsonb),
    COALESCE(study_data->'study_reminders', '[]'::jsonb),
    COALESCE(study_data->'spaced_repetition_queue', '[]'::jsonb),
    COALESCE(study_data->'user_study_days', '[]'::jsonb),
    COALESCE(study_data->'study_contests', '[]'::jsonb)
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    study_sessions = EXCLUDED.study_sessions,
    study_schedule = EXCLUDED.study_schedule,
    study_statistics = EXCLUDED.study_statistics,
    study_cycles = EXCLUDED.study_cycles,
    study_plans = EXCLUDED.study_plans,
    study_subjects = EXCLUDED.study_subjects,
    study_goals = EXCLUDED.study_goals,
    study_goals_tracking = EXCLUDED.study_goals_tracking,
    study_progress = EXCLUDED.study_progress,
    study_reminders = EXCLUDED.study_reminders,
    spaced_repetition_queue = EXCLUDED.spaced_repetition_queue,
    user_study_days = EXCLUDED.user_study_days,
    study_contests = EXCLUDED.study_contests,
    last_activity_date = CURRENT_DATE,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to add a session to user study data
CREATE OR REPLACE FUNCTION add_study_session(
  user_uuid UUID,
  session_data JSONB
)
RETURNS void AS $$
DECLARE
  current_sessions JSONB;
BEGIN
  -- Get current sessions
  SELECT study_sessions INTO current_sessions
  FROM user_study
  WHERE user_id = user_uuid;
  
  -- If no record exists, create one
  IF current_sessions IS NULL THEN
    INSERT INTO user_study (user_id, study_sessions)
    VALUES (user_uuid, '[]'::jsonb);
    current_sessions := '[]'::jsonb;
  END IF;
  
  -- Add new session to array
  current_sessions := current_sessions || jsonb_build_array(session_data);
  
  -- Update the record
  UPDATE user_study
  SET 
    study_sessions = current_sessions,
    total_sessions_count = jsonb_array_length(current_sessions),
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to update study statistics
CREATE OR REPLACE FUNCTION update_study_statistics(
  user_uuid UUID,
  stats_data JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_study (user_id, study_statistics)
  VALUES (user_uuid, stats_data)
  ON CONFLICT (user_id)
  DO UPDATE SET
    study_statistics = EXCLUDED.study_statistics,
    last_activity_date = CURRENT_DATE,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_study TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_study_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_study_data(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION add_study_session(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_study_statistics(UUID, JSONB) TO authenticated;

