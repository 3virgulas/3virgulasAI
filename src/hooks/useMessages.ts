import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../types/chat';

// =====================================================
// useMessages Hook
// =====================================================
// Gerencia mensagens de um chat específico
// REFATORADO: addUserMessage agora aceita chatId override
// =====================================================

export function useMessages(chatId: string | undefined) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);

    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            setStreamingMessage(null);
            setLoading(false);
            return;
        }

        loadMessages();
    }, [chatId]);

    const loadMessages = useCallback(async () => {
        if (!chatId) return;

        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;

            setMessages(data || []);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            console.error('Erro ao carregar mensagens:', error);
        } finally {
            setLoading(false);
        }
    }, [chatId]);

    // Adicionar mensagem do usuário
    // IMPORTANTE: Aceita override de chatId para resolver problema de state async
    const addUserMessage = async (
        content: string,
        overrideChatId?: string
    ): Promise<Message | null> => {
        const targetChatId = overrideChatId || chatId;

        if (!targetChatId) {
            console.error('addUserMessage: Nenhum chatId disponível');
            return null;
        }

        try {
            const { data, error: insertError } = await supabase
                .from('messages')
                .insert({
                    chat_id: targetChatId,
                    role: 'user',
                    content,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            setMessages((prev) => [...prev, data]);

            return data;
        } catch (err) {
            console.error('Erro ao adicionar mensagem:', err);
            return null;
        }
    };

    // Adicionar mensagem do assistente
    // IMPORTANTE: Aceita override de chatId para resolver problema de state async
    const addAssistantMessage = async (
        content: string,
        overrideChatId?: string
    ): Promise<Message | null> => {
        const targetChatId = overrideChatId || chatId;

        if (!targetChatId) {
            console.error('addAssistantMessage: Nenhum chatId disponível');
            return null;
        }

        try {
            const { data, error: insertError } = await supabase
                .from('messages')
                .insert({
                    chat_id: targetChatId,
                    role: 'assistant',
                    content,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            setMessages((prev) => [...prev, data]);
            setStreamingMessage(null);

            return data;
        } catch (err) {
            console.error('Erro ao adicionar resposta:', err);
            return null;
        }
    };

    // Iniciar streaming
    const startStreaming = useCallback((overrideChatId?: string) => {
        const targetChatId = overrideChatId || chatId;
        if (!targetChatId) return;

        const tempMessage: Message = {
            id: `streaming-${Date.now()}`,
            chat_id: targetChatId,
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
        };

        setStreamingMessage(tempMessage);
    }, [chatId]);

    // Atualizar conteúdo do streaming
    const updateStreamingContent = useCallback((content: string) => {
        setStreamingMessage((prev) => (prev ? { ...prev, content } : null));
    }, []);

    // Cancelar streaming
    const cancelStreaming = useCallback(() => {
        setStreamingMessage(null);
    }, []);

    // Limpar mensagens
    const clearMessages = useCallback(() => {
        setMessages([]);
        setStreamingMessage(null);
    }, []);

    // Combinar mensagens persistidas + streaming para renderização
    const allMessages = streamingMessage ? [...messages, streamingMessage] : messages;

    return {
        messages: allMessages,
        loading,
        error,
        addUserMessage,
        addAssistantMessage,
        startStreaming,
        updateStreamingContent,
        cancelStreaming,
        isStreaming: !!streamingMessage,
        streamingContent: streamingMessage?.content ?? '',
        clearMessages,
        refreshMessages: loadMessages,
    };
}

export default useMessages;
