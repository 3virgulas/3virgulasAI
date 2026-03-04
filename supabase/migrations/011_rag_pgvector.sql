-- =====================================================
-- Migração: RAG com pgvector — Memória Semântica Real
-- Versão: 011_rag_pgvector.sql
-- =====================================================
-- Habilita busca semântica por similaridade de embeddings.
-- O modelo gte-small (384 dims) é usado via Supabase AI
-- runtime (sem custo adicional, sem API key externa).
-- =====================================================

-- 1. Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de embeddings de mensagens
CREATE TABLE IF NOT EXISTS public.message_embeddings (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id     UUID        REFERENCES public.chats(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    embedding   vector(384),            -- gte-small: 384 dimensões
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.message_embeddings IS
    'Embeddings vetoriais de mensagens para busca semântica (RAG). Modelo: gte-small (384 dims).';

-- 3. Índice IVFFlat para busca aproximada rápida (ANN)
-- lists=100 é ideal para tabelas de até ~1M linhas
CREATE INDEX IF NOT EXISTS idx_message_embeddings_vector
    ON public.message_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 4. Índice por usuário (para filtrar antes do ANN scan)
CREATE INDEX IF NOT EXISTS idx_message_embeddings_user
    ON public.message_embeddings (user_id, created_at DESC);

-- 5. RLS
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can view own embeddings"
    ON public.message_embeddings
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages embeddings" ON public.message_embeddings;
CREATE POLICY "Service role manages embeddings"
    ON public.message_embeddings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Grants
GRANT SELECT ON public.message_embeddings TO authenticated;
GRANT ALL    ON public.message_embeddings TO service_role;

-- 7. Função RPC: busca semântica por similaridade de cosseno
-- Retorna as N mensagens mais relevantes acima do threshold
CREATE OR REPLACE FUNCTION match_messages(
    query_embedding  vector(384),
    match_user_id    UUID,
    match_threshold  FLOAT   DEFAULT 0.72,
    match_count      INT     DEFAULT 6
)
RETURNS TABLE (
    id          UUID,
    content     TEXT,
    role        TEXT,
    similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        me.id,
        me.content,
        me.role,
        1 - (me.embedding <=> query_embedding) AS similarity
    FROM   public.message_embeddings me
    WHERE  me.user_id = match_user_id
       AND 1 - (me.embedding <=> query_embedding) > match_threshold
    ORDER  BY me.embedding <=> query_embedding
    LIMIT  match_count;
END;
$$;
