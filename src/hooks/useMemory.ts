import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { env } from '../config/env';

// =====================================================
// useMemory Hook — Memória Persistente entre Conversas
// =====================================================
// Dispara a extração de memória da conversa anterior
// antes de iniciar uma nova. A IA usará essas memórias
// automaticamente em futuras conversas via chat-completion.
// =====================================================

const SAVE_MEMORY_URL = `${env.SUPABASE_URL}/functions/v1/save-memory`;

// Mínimo de mensagens (user+assistant) para gerar memória
const MIN_MESSAGES_FOR_MEMORY = 6;

// Debounce: evita chamadas duplicadas em sequência rápida
const DEBOUNCE_MS = 2000;

interface UseMemoryOptions {
    onMemorySaved?: (memory: string) => void;
}

export function useMemory({ onMemorySaved }: UseMemoryOptions = {}) {
    const lastSavedRef = useRef<number>(0);
    const isSavingRef = useRef<boolean>(false);

    // saveMemory: chamada pelo ChatPage ao trocar de conversa
    // messages = mensagens da conversa que ESTÁ SENDO ABANDONADA
    const saveMemory = useCallback(async (
        messages: Array<{ role: string; content: string }>
    ): Promise<void> => {
        // Verificar se há mensagens suficientes
        const meaningfulMessages = messages.filter(m => m.role !== 'system');
        if (meaningfulMessages.length < MIN_MESSAGES_FOR_MEMORY) {
            console.log(`[Memory] Conversa muito curta (${meaningfulMessages.length} msgs) — pulando`);
            return;
        }

        // Debounce: evita chamadas duplicadas em < 2s
        const now = Date.now();
        if (now - lastSavedRef.current < DEBOUNCE_MS || isSavingRef.current) {
            console.log('[Memory] Debounce ativo — pulando');
            return;
        }

        isSavingRef.current = true;
        lastSavedRef.current = now;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                console.warn('[Memory] Usuário não autenticado — memória não salva');
                return;
            }

            console.log(`[Memory] 🧠 Salvando memória de ${meaningfulMessages.length} mensagens...`);

            const response = await fetch(SAVE_MEMORY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ messages: meaningfulMessages }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error('[Memory] Erro ao salvar memória:', err);
                return;
            }

            const result = await response.json();

            if (result.skipped) {
                console.log('[Memory] Memória pulada:', result.reason);
                return;
            }

            if (result.success) {
                console.log('[Memory] ✅ Memória salva com sucesso!');
                onMemorySaved?.(result.memory);
            }
        } catch (err) {
            // Falha silenciosa — nunca bloquear a troca de conversa
            console.warn('[Memory] Falha ao salvar memória (silenciosa):', err);
        } finally {
            isSavingRef.current = false;
        }
    }, [onMemorySaved]);

    return { saveMemory };
}

export default useMemory;
