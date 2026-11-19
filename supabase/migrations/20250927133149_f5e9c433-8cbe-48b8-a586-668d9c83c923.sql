-- Add nickname and privacy settings to users_profiles table
ALTER TABLE users_profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
  "showEmail": false,
  "showBio": true,
  "showState": true,
  "showEducation": true,
  "showCurrentJob": true,
  "showStudyArea": true,
  "showSpecialty": true,
  "showPreparatoryCourse": true,
  "showStudyRoutine": true,
  "showApprovals": true
}'::jsonb;

-- Create function to get user display name (nickname or formatted name)
CREATE OR REPLACE FUNCTION get_user_display_name(user_name TEXT, user_nickname TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN user_nickname IS NOT NULL AND LENGTH(TRIM(user_nickname)) > 0 
    THEN TRIM(user_nickname)
    ELSE CASE 
      WHEN user_name IS NOT NULL 
      THEN SUBSTRING(
        INITCAP(LOWER(user_name)),
        1, 
        15
      )
      ELSE 'Usuário'
    END
  END;
$$;