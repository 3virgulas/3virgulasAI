-- =====================================================
-- Migração: RAG com escopo por chat_id
-- Versão: 012_rag_chat_scope.sql
-- =====================================================
-- Adiciona índice composto (user_id, chat_id) para
-- filtrar embeddings semânticos por conversa específica,
-- evitando contaminação cruzada entre chats diferentes.
-- =====================================================

-- 1. Índice composto para filtro por usuário + chat
-- Permite que a RPC filtre eficientemente por (user_id, chat_id)
-- antes de executar o scan ANN de vetores.
CREATE INDEX IF NOT EXISTS idx_message_embeddings_user_chat
    ON public.message_embeddings (user_id, chat_id);

-- 2. Remover versão antiga (assinatura diferente — sem match_chat_id)
-- Necessário porque CREATE OR REPLACE só funciona com mesma assinatura.
DROP FUNCTION IF EXISTS match_messages(vector(384), uuid, float, int);

-- 3. Criar nova versão com match_chat_id opcional
-- Se match_chat_id for fornecido, filtra apenas embeddings daquele chat.
-- Se for NULL, mantém comportamento global (para casos sem chat_id).
CREATE OR REPLACE FUNCTION match_messages(
    query_embedding  vector(384),
    match_user_id    UUID,
    match_threshold  FLOAT   DEFAULT 0.65,
    match_count      INT     DEFAULT 10,
    match_chat_id    UUID    DEFAULT NULL
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
       AND (match_chat_id IS NULL OR me.chat_id = match_chat_id)
       AND 1 - (me.embedding <=> query_embedding) > match_threshold
    ORDER  BY me.embedding <=> query_embedding
    LIMIT  match_count;
END;
$$;

COMMENT ON FUNCTION match_messages IS
    'Busca semântica por similaridade de cosseno com escopo opcional por chat_id.
     match_chat_id: se fornecido, retorna apenas memórias do chat especificado.
     Evita contaminação cruzada entre conversas diferentes do mesmo usuário.';
