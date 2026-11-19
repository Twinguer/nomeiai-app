-- =====================================================
-- MIGRATION: Remover tabela ranking_calculations
-- OBJETIVO: Limpar proposta arquitetural não implementada
-- DATA: 2025-01-15
-- =====================================================

-- Verificar se a tabela existe antes de remover
DO $$
DECLARE
  table_exists BOOLEAN;
  table_count INTEGER;
BEGIN
  -- Verificar se a tabela existe
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ranking_calculations'
  ) INTO table_exists;
  
  IF table_exists THEN
    -- Contar registros se existir
    SELECT COUNT(*) INTO table_count FROM ranking_calculations;
    
    IF table_count > 0 THEN
      RAISE NOTICE 'Tabela ranking_calculations contém % registros. Removendo com dados.', table_count;
    ELSE
      RAISE NOTICE 'Tabela ranking_calculations está vazia. Removendo com segurança.';
    END IF;
    
    -- Remover tabela (CASCADE remove dependências)
    DROP TABLE IF EXISTS ranking_calculations CASCADE;
    RAISE NOTICE 'Tabela ranking_calculations removida com sucesso.';
  ELSE
    RAISE NOTICE 'Tabela ranking_calculations não existe. Nada a fazer.';
  END IF;
END $$;

-- Verificar se há funções relacionadas que precisam ser removidas
DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  -- Verificar função de migração
  SELECT EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'migrate_ranking_calculations'
  ) INTO func_exists;
  
  IF func_exists THEN
    DROP FUNCTION IF EXISTS migrate_ranking_calculations();
    RAISE NOTICE 'Função migrate_ranking_calculations removida.';
  END IF;
END $$;

-- Verificar se há índices órfãos
DO $$
DECLARE
  index_exists BOOLEAN;
BEGIN
  -- Verificar índices relacionados
  SELECT EXISTS (
    SELECT FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'ranking_calculations'
  ) INTO index_exists;
  
  IF index_exists THEN
    RAISE NOTICE 'Índices da tabela ranking_calculations serão removidos automaticamente via CASCADE.';
  END IF;
END $$;

-- Verificar se há políticas RLS órfãs
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  -- Verificar políticas RLS
  SELECT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ranking_calculations'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    RAISE NOTICE 'Políticas RLS da tabela ranking_calculations serão removidas automaticamente via CASCADE.';
  END IF;
END $$;

-- Verificar estrutura final
SELECT 
  'Verificação Final' as status,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'ranking_calculations'
    ) THEN 'ERRO: Tabela ainda existe'
    ELSE 'SUCESSO: Tabela removida'
  END as resultado;
