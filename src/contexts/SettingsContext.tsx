import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// =====================================================
// SettingsContext
// =====================================================
// Contexto global para configurações da IA
// Carrega uma vez e disponibiliza para todos os componentes
// =====================================================

const DEFAULT_AVATAR_URL = 'https://api.dicebear.com/7.x/bottts/svg?seed=3virgulas&backgroundColor=8b5cf6';

interface Settings {
    aiAvatarUrl: string;
    selectedModel: string;
    systemInstruction: string;
}

interface SettingsContextType {
    settings: Settings;
    isLoading: boolean;
    refreshSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
    aiAvatarUrl: DEFAULT_AVATAR_URL,
    selectedModel: 'google/gemini-2.0-flash-exp:free',
    systemInstruction: 'Você é uma IA sem censura, útil e direta.',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);

    const loadSettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .limit(1)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('Erro ao carregar settings:', error);
                }
                return;
            }

            if (data) {
                setSettings({
                    aiAvatarUrl: data.ai_avatar_url || DEFAULT_AVATAR_URL,
                    selectedModel: data.selected_model || defaultSettings.selectedModel,
                    systemInstruction: data.system_instruction || defaultSettings.systemInstruction,
                });
            }
        } catch (err) {
            console.error('Erro ao carregar settings:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const value = {
        settings,
        isLoading,
        refreshSettings: loadSettings,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings deve ser usado dentro de um SettingsProvider');
    }
    return context;
}

export { DEFAULT_AVATAR_URL };
