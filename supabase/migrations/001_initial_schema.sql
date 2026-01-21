-- =====================================================
-- 3Vírgulas Chat - Initial Database Schema
-- =====================================================
-- Este script configura:
-- 1. Extensões necessárias
-- 2. Tabela de chats
-- 3. Tabela de messages
-- 4. Políticas RLS (Row Level Security)
-- 5. Índices para performance
-- =====================================================

-- Habilitar extensão UUID (geralmente já está habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: chats
-- =====================================================
-- Armazena as conversas de cada usuário
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova Conversa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentário na tabela
COMMENT ON TABLE public.chats IS 'Conversas dos usuários com o assistente de IA';

-- =====================================================
-- TABELA: messages
-- =====================================================
-- Armazena as mensagens de cada conversa
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentário na tabela
COMMENT ON TABLE public.messages IS 'Mensagens individuais dentro de cada conversa';

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
-- Índice para buscar chats por usuário (ordenado por data)
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id, created_at DESC);

-- Índice para buscar mensagens por chat (ordenado por data)
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id, created_at ASC);

-- =====================================================
-- FUNÇÃO: Atualizar updated_at automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at na tabela chats
DROP TRIGGER IF EXISTS on_chats_updated ON public.chats;
CREATE TRIGGER on_chats_updated
    BEFORE UPDATE ON public.chats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS: chats
-- =====================================================

-- Política: Usuários podem ver apenas seus próprios chats
CREATE POLICY "Users can view own chats"
    ON public.chats
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Usuários podem criar seus próprios chats
CREATE POLICY "Users can create own chats"
    ON public.chats
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar seus próprios chats
CREATE POLICY "Users can update own chats"
    ON public.chats
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar seus próprios chats
CREATE POLICY "Users can delete own chats"
    ON public.chats
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: messages
-- =====================================================

-- Política: Usuários podem ver mensagens dos seus chats
CREATE POLICY "Users can view messages from own chats"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- Política: Usuários podem criar mensagens nos seus chats
CREATE POLICY "Users can create messages in own chats"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- Política: Usuários podem atualizar mensagens dos seus chats
CREATE POLICY "Users can update messages in own chats"
    ON public.messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- Política: Usuários podem deletar mensagens dos seus chats
CREATE POLICY "Users can delete messages from own chats"
    ON public.messages
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- =====================================================
-- GRANTS: Permissões para roles
-- =====================================================

-- Garantir que authenticated users podem acessar as tabelas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.chats TO authenticated;
GRANT ALL ON public.messages TO authenticated;

-- Permitir que anon role possa ver o schema (necessário para auth)
GRANT USAGE ON SCHEMA public TO anon;
