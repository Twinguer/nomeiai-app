-- Adicionar permissões para coaches acessarem dados de seus alunos na tabela user_study_v2
-- Os alunos devem ter aceitado o convite (status = 'active') no student_relationships

-- Policy para SELECT (coaches podem ver dados de seus alunos)
CREATE POLICY IF NOT EXISTS "Coaches can view their students study data"
ON user_study_v2 FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM coach_profiles cp
    WHERE cp.coach_id = auth.uid()
    AND (
      SELECT COUNT(*) FROM jsonb_array_elements(cp.student_relationships)
      WHERE (value->>'student_id')::uuid = user_study_v2.user_id
      AND (value->>'status')::text = 'active'
    ) > 0
  )
);

-- Policy para UPDATE (coaches podem atualizar dados de seus alunos)
CREATE POLICY IF NOT EXISTS "Coaches can update their students study data"
ON user_study_v2 FOR UPDATE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM coach_profiles cp
    WHERE cp.coach_id = auth.uid()
    AND (
      SELECT COUNT(*) FROM jsonb_array_elements(cp.student_relationships)
      WHERE (value->>'student_id')::uuid = user_study_v2.user_id
      AND (value->>'status')::text = 'active'
    ) > 0
  )
)
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM coach_profiles cp
    WHERE cp.coach_id = auth.uid()
    AND (
      SELECT COUNT(*) FROM jsonb_array_elements(cp.student_relationships)
      WHERE (value->>'student_id')::uuid = user_study_v2.user_id
      AND (value->>'status')::text = 'active'
    ) > 0
  )
);

-- Comentário explicativo
COMMENT ON POLICY "Coaches can view their students study data" ON user_study_v2 IS 
  'Permite que coaches vejam dados de estudo de alunos que aceitaram o convite (status: active)';

COMMENT ON POLICY "Coaches can update their students study data" ON user_study_v2 IS 
  'Permite que coaches atualizem dados de estudo de alunos que aceitaram o convite (status: active)';


