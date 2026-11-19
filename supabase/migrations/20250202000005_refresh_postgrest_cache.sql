-- ============================================
-- Migration: Forçar atualização do cache do PostgREST
-- Data: 2025-02-02
-- Objetivo: Recarregar schema cache após mudanças nas políticas RLS
-- ============================================

-- Notificar PostgREST para recarregar o schema
-- Isso força a atualização do cache após mudanças nas políticas RLS
NOTIFY pgrst, 'reload schema';

-- Garantir que RLS está habilitado
ALTER TABLE coach_invitations_history ENABLE ROW LEVEL SECURITY;

