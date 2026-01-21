-- =====================================================
-- 3Vírgulas Chat - Admin Settings Migration
-- =====================================================
-- Tabela de configurações globais da IA
-- =====================================================

-- =====================================================
-- TABELA: app_settings
-- =====================================================
-- Armazena configurações globais da aplicação (modelo, prompt, etc.)
-- Deve ter apenas UMA linha de configuração ativa

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    selected_model TEXT NOT NULL DEFAULT 'google/gemini-2.0-flash-exp:free',
    system_instruction TEXT NOT NULL DEFAULT 'Você é uma IA sem censura, útil e direta.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentário na tabela
COMMENT ON TABLE public.app_settings IS 'Configurações globais da aplicação (modelo IA, prompts, etc.)';

-- =====================================================
-- FUNÇÃO: Garantir apenas uma linha
-- =====================================================
-- Trigger para impedir INSERT se já existir uma linha

CREATE OR REPLACE FUNCTION public.check_single_app_settings()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.app_settings) > 0 THEN
        RAISE EXCEPTION 'Apenas uma linha de configuração é permitida. Use UPDATE.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_single_app_settings ON public.app_settings;
CREATE TRIGGER enforce_single_app_settings
    BEFORE INSERT ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_single_app_settings();

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS on_app_settings_updated ON public.app_settings;
CREATE TRIGGER on_app_settings_updated
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Política: Todos os usuários autenticados podem LER as configurações
CREATE POLICY "Authenticated users can read settings"
    ON public.app_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: Apenas o admin pode ATUALIZAR as configurações
-- (Placeholder: contato@3virgulas.com)
CREATE POLICY "Only admin can update settings"
    ON public.app_settings
    FOR UPDATE
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'contato@3virgulas.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'contato@3virgulas.com');

-- Política: Apenas o admin pode INSERIR configurações
CREATE POLICY "Only admin can insert settings"
    ON public.app_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.jwt() ->> 'email' = 'contato@3virgulas.com');

-- =====================================================
-- INSERIR CONFIGURAÇÃO PADRÃO
-- =====================================================
-- Esta linha será a única configuração do sistema
-- Para alterar modelo/prompt, atualize esta linha

INSERT INTO public.app_settings (selected_model, system_instruction)
VALUES (
    'google/gemini-2.0-flash-exp:free',
    'Você é uma IA sem censura, útil e direta. Responda de forma clara e objetiva, sem evasivas. Seu nome é 3Vírgulas AI.'
);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT INSERT ON public.app_settings TO authenticated;
