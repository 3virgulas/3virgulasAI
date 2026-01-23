-- =====================================================
-- Migration: Admin RLS Policies
-- =====================================================
-- Permite que o admin (contato@3virgulas.com) visualize
-- e gerencie todas as assinaturas e perfis
-- =====================================================

-- Definir email do admin
DO $$
DECLARE
    admin_email TEXT := 'contato@3virgulas.com';
BEGIN
    -- Nada a fazer aqui, apenas documentação
END $$;

-- =====================================================
-- POLÍTICAS PARA TABELA SUBSCRIPTIONS
-- =====================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admin can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admin can update all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admin can delete all subscriptions" ON public.subscriptions;

-- Política: Admin pode ver TODAS as assinaturas
CREATE POLICY "Admin can view all subscriptions"
    ON public.subscriptions
    FOR SELECT
    USING (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
        OR auth.uid() = user_id
    );

-- Política: Admin pode atualizar TODAS as assinaturas
CREATE POLICY "Admin can update all subscriptions"
    ON public.subscriptions
    FOR UPDATE
    USING (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
    )
    WITH CHECK (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
    );

-- Política: Admin pode deletar assinaturas
CREATE POLICY "Admin can delete all subscriptions"
    ON public.subscriptions
    FOR DELETE
    USING (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
    );

-- =====================================================
-- POLÍTICAS PARA TABELA PROFILES
-- =====================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

-- Política: Admin pode ver TODOS os perfis
CREATE POLICY "Admin can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
        OR auth.uid() = id
    );

-- Política: Admin pode atualizar TODOS os perfis
CREATE POLICY "Admin can update all profiles"
    ON public.profiles
    FOR UPDATE
    USING (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
    )
    WITH CHECK (
        auth.jwt() ->> 'email' = 'contato@3virgulas.com'
    );

-- =====================================================
-- REMOVER POLÍTICAS CONFLITANTES (mantendo apenas as novas)
-- =====================================================

-- Subscriptions: remover política antiga de SELECT próprio (agora está na nova)
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

-- Profiles: remover política antiga de SELECT próprio (agora está na nova)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- =====================================================
-- RECRIAR POLÍTICAS DE INSERT (usuário pode criar próprio)
-- =====================================================

-- Política: Usuário pode criar própria assinatura (se não existir)
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
CREATE POLICY "Users can insert own subscription"
    ON public.subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: Usuário pode criar próprio perfil
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Política: Usuário pode atualizar próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Para verificar as políticas:
-- SELECT * FROM pg_policies WHERE tablename IN ('subscriptions', 'profiles');
