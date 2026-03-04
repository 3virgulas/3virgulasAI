-- =====================================================
-- Migração: Memória Persistente da IA
-- Versão: 010_persistent_memory.sql
-- =====================================================
-- Adiciona campos de memória compacta ao profiles.
-- A IA gera automaticamente um resumo das conversas
-- passadas do usuário, que é injetado no system prompt.
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS memory_summary TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS memory_updated_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.memory_summary IS
  'Resumo compacto gerado pela IA sobre o histórico de conversas do usuário. Injetado no system prompt.';

COMMENT ON COLUMN public.profiles.memory_updated_at IS
  'Timestamp da última atualização da memória persistente.';
