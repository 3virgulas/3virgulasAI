-- =====================================================
-- 3Vírgulas Chat - Subscriptions & Profiles Migration
-- =====================================================
-- Sistema de Assinaturas Premium com SuitPay
-- Inclui tabelas profiles e subscriptions com RLS
-- =====================================================

-- =====================================================
-- TABELA: profiles
-- =====================================================
-- Dados pessoais do usuário para pagamento PIX

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    tax_id TEXT, -- CPF (apenas números)
    cellphone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentário na tabela
COMMENT ON TABLE public.profiles IS 'Dados pessoais dos usuários para pagamentos PIX';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- TABELA: subscriptions
-- =====================================================
-- Assinaturas Premium dos usuários

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired')),
    plan_type TEXT NOT NULL DEFAULT 'premium',
    plan_name TEXT,
    plan_price DECIMAL(10,2),
    subscription_expires_at TIMESTAMPTZ,
    provider TEXT DEFAULT 'suitpay',
    transacao_id TEXT, -- ID da transação SuitPay (para match com webhook)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id)
);

-- Comentário na tabela
COMMENT ON TABLE public.subscriptions IS 'Assinaturas Premium dos usuários via SuitPay';

-- Índice para buscar assinaturas ativas
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
    ON public.subscriptions(user_id, status);

-- Índice para buscar por transação (webhook)
CREATE INDEX IF NOT EXISTS idx_subscriptions_transacao_id 
    ON public.subscriptions(transacao_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS on_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER on_subscriptions_updated
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - profiles
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Política: Usuários podem criar seu próprio perfil
CREATE POLICY "Users can create own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Política: Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Política: Admin pode ver todos os perfis
CREATE POLICY "Admin can view all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'contato@3virgulas.com');

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - subscriptions
-- =====================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver sua própria assinatura
CREATE POLICY "Users can view own subscription"
    ON public.subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Admin pode ver todas as assinaturas
CREATE POLICY "Admin can view all subscriptions"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'contato@3virgulas.com');

-- Política: Service Role pode gerenciar todas (para Edge Functions/webhooks)
-- Nota: service_role bypassa RLS por padrão, mas deixamos explícito
CREATE POLICY "Service role can manage all subscriptions"
    ON public.subscriptions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- GRANTS: Permissões para roles
-- =====================================================

-- Profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Subscriptions (usuários só leem, Edge Functions gerenciam via service_role)
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- =====================================================
-- FUNÇÃO: Criar perfil automático no signup
-- =====================================================
-- Cria um perfil vazio quando um novo usuário é criado

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil no signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
