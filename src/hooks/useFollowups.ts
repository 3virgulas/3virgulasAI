// =====================================================
// useFollowups — Gera perguntas de aprofundamento
// Similar ao "Acompanhamentos" do SkynetChat
// Fire-and-forget após cada resposta da IA
// =====================================================

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { env } from '../config/env';

const FOLLOWUPS_URL = `${env.SUPABASE_URL}/functions/v1/generate-followups`;

export function useFollowups() {
    const [followups, setFollowups] = useState<string[]>([]);
    const [isLoadingFollowups, setIsLoadingFollowups] = useState(false);

    const generateFollowups = useCallback(async (
        userMessage: string,
        aiResponse: string
    ) => {
        // Não gerar para mensagens muito curtas
        if (!userMessage?.trim() || !aiResponse?.trim()) return;
        if (aiResponse.length < 50) return;

        setIsLoadingFollowups(true);
        setFollowups([]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const response = await fetch(FOLLOWUPS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ userMessage, aiResponse }),
            });

            if (!response.ok) return;

            const data = await response.json();
            if (Array.isArray(data.followups) && data.followups.length > 0) {
                setFollowups(data.followups);
            }
        } catch (err) {
            console.warn('⚠️ Followups: erro silencioso', err);
        } finally {
            setIsLoadingFollowups(false);
        }
    }, []);

    const clearFollowups = useCallback(() => {
        setFollowups([]);
    }, []);

    return {
        followups,
        isLoadingFollowups,
        generateFollowups,
        clearFollowups,
    };
}

export default useFollowups;
