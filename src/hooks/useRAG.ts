import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { env } from '../config/env';

// =====================================================
// useRAG Hook — Memória Semântica (Level 3)
// =====================================================
// Dispara a geração de embeddings após cada resposta da IA.
// Os embeddings são armazenados em message_embeddings e
// usados pelo chat-completion para busca semântica RAG.
// Operação 100% fire-and-forget — nunca bloqueia o chat.
// =====================================================

const EMBED_URL = `${env.SUPABASE_URL}/functions/v1/embed-message`;

// Mínimo de caracteres para valer a pena embeddar
const MIN_CONTENT_LENGTH = 20;

// Intervalo mínimo entre chamadas (evita spam)
const MIN_INTERVAL_MS = 3000;

interface EmbedMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface UseRAGReturn {
    embedMessages: (messages: EmbedMessage[], chatId?: string) => void;
}

export function useRAG(): UseRAGReturn {
    const lastEmbedRef = useRef<number>(0);
    const pendingRef = useRef<boolean>(false);

    const embedMessages = useCallback((messages: EmbedMessage[], chatId?: string): void => {
        // Filtrar mensagens válidas
        const validMessages = messages.filter(
            m => m.content?.length >= MIN_CONTENT_LENGTH &&
                ['user', 'assistant'].includes(m.role)
        );

        if (validMessages.length === 0) return;

        // Rate limiting
        const now = Date.now();
        if (now - lastEmbedRef.current < MIN_INTERVAL_MS || pendingRef.current) {
            return;
        }

        lastEmbedRef.current = now;
        pendingRef.current = true;

        // Fire-and-forget: não bloqueia a UI
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) return;

                await fetch(EMBED_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        messages: validMessages,
                        chat_id: chatId || null,
                    }),
                });

                console.log(`[RAG] ✅ ${validMessages.length} mensagem(s) embedadas`);
            } catch (err) {
                // Falha silenciosa — RAG nunca deve quebrar o chat
                console.warn('[RAG] Falha ao embedar mensagens (silenciosa):', err);
            } finally {
                pendingRef.current = false;
            }
        })();
    }, []);

    return { embedMessages };
}

export default useRAG;
