-- =====================================================
-- 3Vírgulas Chat - Add AI Avatar Column
-- =====================================================
-- Adiciona coluna para avatar customizado da IA
-- =====================================================

-- Adicionar coluna ai_avatar_url
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS ai_avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=3virgulas&backgroundColor=8b5cf6';

-- Comentário na coluna
COMMENT ON COLUMN public.app_settings.ai_avatar_url IS 'URL da imagem de avatar da IA exibida no chat';
