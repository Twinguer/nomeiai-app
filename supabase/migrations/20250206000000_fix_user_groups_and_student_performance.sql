-- Migration: Fix get_user_groups to include posts_data and current_members
-- Also ensure proper field names match StudyGroup type

CREATE OR REPLACE FUNCTION public.get_user_groups(p_user_id UUID)
RETURNS TABLE(
  id UUID, 
  name TEXT, 
  description TEXT, 
  cover_image_url TEXT,
  privacy_level TEXT,
  max_members INTEGER,
  current_members INTEGER,
  focus_area TEXT,
  target_concurso_id UUID,
  coach_id UUID,
  created_by UUID,
  posts_data JSONB,
  group_settings JSONB,
  post_retention_days INTEGER,
  archived BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  role TEXT,
  joined_at TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sg.id,
    sg.name,
    sg.description,
    sg.cover_image_url,
    sg.privacy_level,
    sg.max_members,
    sg.current_members,
    sg.focus_area,
    sg.target_concurso_id,
    sg.coach_id,
    sg.created_by,
    COALESCE(sg.posts_data, '[]'::jsonb) as posts_data,
    COALESCE(sg.group_settings, '{}'::jsonb) as group_settings,
    sg.post_retention_days,
    sg.archived,
    sg.created_at,
    sg.updated_at,
    sgm.role,
    sgm.joined_at
  FROM study_group_members sgm
  JOIN study_groups sg ON sg.id = sgm.group_id
  WHERE sgm.user_id = p_user_id
    AND sgm.status = 'active'
    AND sg.archived = false
  ORDER BY sgm.joined_at DESC;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.get_user_groups(UUID) TO anon, authenticated;





