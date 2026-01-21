-- =====================================================
-- 3Vírgulas Chat - Add Vision Model Column
-- =====================================================
-- Adiciona coluna para modelo de visão (análise de imagens)
-- =====================================================

-- Adicionar coluna vision_model
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS vision_model TEXT DEFAULT 'google/gemini-2.0-flash-exp:free';

-- Comentário na coluna
COMMENT ON COLUMN public.app_settings.vision_model IS 'Modelo usado para análise de imagens (Vision Proxy)';
