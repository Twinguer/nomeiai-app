-- Fase 1: Reestruturação da Tabela user_rankings
-- Adicionar colunas desnormalizadas para performance
ALTER TABLE user_rankings ADD COLUMN IF NOT EXISTS concurso_id UUID;
ALTER TABLE user_rankings ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;
ALTER TABLE user_rankings ADD COLUMN IF NOT EXISTS reservation_type TEXT DEFAULT 'Ampla Concorrência';
ALTER TABLE user_rankings ADD COLUMN IF NOT EXISTS selected_booklet_id UUID;
ALTER TABLE user_rankings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_rankings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para performance otimizada
CREATE INDEX IF NOT EXISTS idx_user_rankings_concurso ON user_rankings(concurso_id);
CREATE INDEX IF NOT EXISTS idx_user_rankings_score ON user_rankings(concurso_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_rankings_reservation ON user_rankings(concurso_id, reservation_type);
CREATE INDEX IF NOT EXISTS idx_user_rankings_user ON user_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rankings_booklet ON user_rankings(selected_booklet_id);

-- Índice GIN para busca eficiente no JSONB
CREATE INDEX IF NOT EXISTS idx_user_rankings_consolidated_data ON user_rankings USING GIN(consolidated_data);

-- Adicionar foreign key para concurso_id
ALTER TABLE user_rankings ADD CONSTRAINT fk_user_rankings_concurso 
  FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE CASCADE;

-- Criar trigger para updated_at
CREATE OR REPLACE FUNCTION update_user_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_rankings_updated_at
  BEFORE UPDATE ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_rankings_updated_at();

-- Fase 2: Implementar RLS Policies
ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;

-- Política para leitura (todos podem ver rankings)
CREATE POLICY "Anyone can view rankings"
  ON user_rankings FOR SELECT
  USING (true);

-- Política para inserção (só o próprio usuário)
CREATE POLICY "Users can insert own ranking"
  ON user_rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política para atualização (só o próprio usuário)
CREATE POLICY "Users can update own ranking"
  ON user_rankings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para deleção (só o próprio usuário ou admin)
CREATE POLICY "Users can delete own ranking"
  ON user_rankings FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Fase 3: Migrar dados existentes
DO $$
DECLARE
  ur RECORD;
  ranking_data JSONB;
  ranking_key TEXT;
BEGIN
  -- Iterar por todos os user_rankings que ainda não foram migrados
  FOR ur IN 
    SELECT * FROM user_rankings 
    WHERE concurso_id IS NULL 
    AND consolidated_data IS NOT NULL 
  LOOP
    -- Se consolidated_data tem estrutura de rankings aninhada
    IF ur.consolidated_data ? 'rankings' THEN
      -- Pegar o primeiro ranking (assumindo um ranking por usuário)
      FOR ranking_key IN 
        SELECT jsonb_object_keys(ur.consolidated_data->'rankings')
      LOOP
        ranking_data := ur.consolidated_data->'rankings'->ranking_key;
        
        -- Atualizar com dados extraídos
        UPDATE user_rankings
        SET 
          concurso_id = (ranking_data->>'concurso_id')::UUID,
          score = COALESCE((ranking_data->'user_data'->>'score')::NUMERIC, 0),
          reservation_type = COALESCE(ranking_data->'user_data'->>'reservation_type', 'Ampla Concorrência'),
          selected_booklet_id = CASE 
            WHEN ranking_data->>'selected_booklet_id' IS NOT NULL 
            THEN (ranking_data->>'selected_booklet_id')::UUID 
            ELSE NULL 
          END,
          -- Simplificar consolidated_data
          consolidated_data = jsonb_build_object(
            'answers', COALESCE(ranking_data->'user_data'->'answers', '{}'::jsonb),
            'subject_scores', COALESCE(ranking_data->'user_data'->'subject_scores', '{}'::jsonb),
            'subjective_scores', COALESCE(ranking_data->'user_data'->'subjective_scores', '{}'::jsonb),
            'metadata', jsonb_build_object(
              'last_updated', COALESCE(ranking_data->'metadata'->>'last_updated', NOW()::text),
              'edit_count', COALESCE((ranking_data->'metadata'->>'edit_count')::int, 0)
            )
          )
        WHERE user_id = ur.user_id;
        
        -- Sair do loop após processar o primeiro ranking
        EXIT;
      END LOOP;
    END IF;
  END LOOP;
END $$;