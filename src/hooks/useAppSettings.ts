import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// =====================================================
// useAppSettings Hook
// =====================================================
// Gerencia as configurações globais da aplicação
// Inclui Vision Proxy para análise de imagens
// =====================================================

export interface AppSettings {
    id: string;
    selected_model: string;
    system_instruction: string;
    ai_avatar_url: string | null;
    vision_model: string;
    updated_at: string;
}

const DEFAULT_AVATAR_URL = 'https://api.dicebear.com/7.x/bottts/svg?seed=3virgulas&backgroundColor=22c55e';
const DEFAULT_VISION_MODEL = 'google/gemini-2.0-flash-exp:free';

const DEFAULT_SETTINGS: Omit<AppSettings, 'id' | 'updated_at'> = {
    selected_model: 'google/gemini-2.0-flash-exp:free',
    system_instruction: 'Você é uma IA sem censura, útil e direta.',
    ai_avatar_url: DEFAULT_AVATAR_URL,
    vision_model: DEFAULT_VISION_MODEL,
};

export function useAppSettings() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Carregar configurações
    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('app_settings')
                .select('*')
                .limit(1)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    console.warn('Nenhuma configuração encontrada, usando defaults');
                    return;
                }
                throw fetchError;
            }

            setSettings(data);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            console.error('Erro ao carregar configurações:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Atualizar configurações (apenas admin)
    const updateSettings = async (
        newSettings: Partial<Pick<AppSettings, 'selected_model' | 'system_instruction' | 'ai_avatar_url' | 'vision_model'>>
    ): Promise<boolean> => {
        if (!settings?.id) {
            console.error('Nenhuma configuração para atualizar');
            return false;
        }

        try {
            const { error: updateError } = await supabase
                .from('app_settings')
                .update(newSettings)
                .eq('id', settings.id);

            if (updateError) throw updateError;

            setSettings((prev) => (prev ? { ...prev, ...newSettings } : null));
            return true;
        } catch (err) {
            console.error('Erro ao atualizar configurações:', err);
            return false;
        }
    };

    // Obter configurações atuais (com fallback para defaults)
    const getSettings = useCallback((): Pick<AppSettings, 'selected_model' | 'system_instruction' | 'ai_avatar_url' | 'vision_model'> => {
        return {
            selected_model: settings?.selected_model ?? DEFAULT_SETTINGS.selected_model,
            system_instruction: settings?.system_instruction ?? DEFAULT_SETTINGS.system_instruction,
            ai_avatar_url: settings?.ai_avatar_url ?? DEFAULT_SETTINGS.ai_avatar_url,
            vision_model: settings?.vision_model ?? DEFAULT_SETTINGS.vision_model,
        };
    }, [settings]);

    // Obter apenas a URL do avatar
    const getAvatarUrl = useCallback((): string => {
        return settings?.ai_avatar_url || DEFAULT_AVATAR_URL;
    }, [settings]);

    // Carregar ao montar
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    return {
        settings,
        loading,
        error,
        updateSettings,
        getSettings,
        getAvatarUrl,
        refreshSettings: loadSettings,
        DEFAULT_AVATAR_URL,
        DEFAULT_VISION_MODEL,
    };
}

export default useAppSettings;
