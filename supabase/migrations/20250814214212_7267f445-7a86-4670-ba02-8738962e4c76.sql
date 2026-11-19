-- Add missing columns to study_schedule table
ALTER TABLE study_schedule 
ADD COLUMN IF NOT EXISTS discipline_name TEXT,
ADD COLUMN IF NOT EXISTS block_name TEXT,
ADD COLUMN IF NOT EXISTS cycle_id UUID,
ADD COLUMN IF NOT EXISTS session_link TEXT;