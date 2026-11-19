
-- Função para gerenciar cadernos de prova via JSONB
CREATE OR REPLACE FUNCTION public.manage_exam_booklets(
  p_operation text,
  p_concurso_id uuid DEFAULT NULL,
  p_booklet_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_display_order integer DEFAULT NULL,
  p_booklets jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_exam_booklets jsonb;
BEGIN
  CASE p_operation
    WHEN 'GET' THEN
      -- Buscar cadernos de um concurso do JSONB
      SELECT exam_booklets INTO v_exam_booklets
      FROM concursos
      WHERE id = p_concurso_id;
      
      -- Ordenar por display_order
      v_exam_booklets := (
        SELECT jsonb_agg(booklet ORDER BY (booklet->>'display_order')::int)
        FROM jsonb_array_elements(COALESCE(v_exam_booklets, '[]'::jsonb)) AS booklet
      );
      
      RETURN jsonb_build_object(
        'success', true,
        'booklets', COALESCE(v_exam_booklets, '[]'::jsonb)
      );
      
    WHEN 'CREATE' THEN
      -- Criar novo caderno no JSONB
      SELECT exam_booklets INTO v_exam_booklets
      FROM concursos
      WHERE id = p_concurso_id;
      
      -- Adicionar novo caderno
      v_exam_booklets := COALESCE(v_exam_booklets, '[]'::jsonb) || jsonb_build_object(
        'id', gen_random_uuid(),
        'name', p_name,
        'display_order', COALESCE(p_display_order, 1),
        'is_active', true,
        'total_questions', 0
      );
      
      -- Atualizar na tabela concursos
      UPDATE concursos 
      SET exam_booklets = v_exam_booklets
      WHERE id = p_concurso_id;
      
      RETURN jsonb_build_object('success', true);
      
    WHEN 'UPDATE' THEN
      -- Atualizar caderno no JSONB
      SELECT exam_booklets INTO v_exam_booklets
      FROM concursos
      WHERE id = p_concurso_id;
      
      -- Atualizar caderno específico
      v_exam_booklets := (
        SELECT jsonb_agg(
          CASE 
            WHEN (booklet->>'id')::uuid = p_booklet_id THEN
              booklet || jsonb_build_object(
                'name', COALESCE(p_name, booklet->>'name'),
                'display_order', COALESCE(p_display_order, (booklet->>'display_order')::int)
              )
            ELSE booklet
          END
        )
        FROM jsonb_array_elements(COALESCE(v_exam_booklets, '[]'::jsonb)) AS booklet
      );
      
      -- Atualizar na tabela concursos
      UPDATE concursos 
      SET exam_booklets = v_exam_booklets
      WHERE id = p_concurso_id;
      
      RETURN jsonb_build_object('success', true);
      
    WHEN 'DELETE' THEN
      -- Deletar caderno do JSONB
      SELECT exam_booklets INTO v_exam_booklets
      FROM concursos
      WHERE id = p_concurso_id;
      
      -- Remover caderno específico
      v_exam_booklets := (
        SELECT jsonb_agg(booklet)
        FROM jsonb_array_elements(COALESCE(v_exam_booklets, '[]'::jsonb)) AS booklet
        WHERE (booklet->>'id')::uuid != p_booklet_id
      );
      
      -- Atualizar na tabela concursos
      UPDATE concursos 
      SET exam_booklets = v_exam_booklets
      WHERE id = p_concurso_id;
      
      RETURN jsonb_build_object('success', true);
      
    WHEN 'SAVE_ALL' THEN
      -- Salvar todos os cadernos (usado pelo frontend)
      UPDATE concursos 
      SET exam_booklets = p_booklets
      WHERE id = p_concurso_id;
      
      RETURN jsonb_build_object('success', true);
      
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Operação inválida');
  END CASE;
END;
$$;

-- Função removida - dados agora são gerenciados via JSONB na tabela concursos

-- Função removida - dados agora são gerenciados via JSONB na tabela concursos

-- Função removida - dados agora são gerenciados via JSONB na tabela concursos
