import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Chat } from '../types/chat';

// =====================================================
// useChats Hook
// =====================================================
// Gerencia a lista de chats do usuário
// =====================================================

export function useChats(userId: string | undefined) {
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Carregar chats do usuário
    useEffect(() => {
        if (!userId) {
            setChats([]);
            setLoading(false);
            return;
        }

        loadChats();
    }, [userId]);

    const loadChats = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (fetchError) throw fetchError;

            setChats(data || []);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            console.error('Erro ao carregar chats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Criar novo chat
    const createChat = async (title = 'Nova Conversa'): Promise<Chat | null> => {
        if (!userId) return null;

        try {
            const { data, error: insertError } = await supabase
                .from('chats')
                .insert({
                    user_id: userId,
                    title,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Adicionar na lista local
            setChats((prev) => [data, ...prev]);

            return data;
        } catch (err) {
            console.error('Erro ao criar chat:', err);
            return null;
        }
    };

    // Atualizar título do chat
    const updateChatTitle = async (chatId: string, title: string) => {
        try {
            const { error: updateError } = await supabase
                .from('chats')
                .update({ title })
                .eq('id', chatId);

            if (updateError) throw updateError;

            // Atualizar localmente
            setChats((prev) =>
                prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat))
            );
        } catch (err) {
            console.error('Erro ao atualizar título:', err);
        }
    };

    // Deletar chat
    const deleteChat = async (chatId: string) => {
        try {
            const { error: deleteError } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatId);

            if (deleteError) throw deleteError;

            // Remover localmente
            setChats((prev) => prev.filter((chat) => chat.id !== chatId));
        } catch (err) {
            console.error('Erro ao deletar chat:', err);
        }
    };

    return {
        chats,
        loading,
        error,
        createChat,
        updateChatTitle,
        deleteChat,
        refreshChats: loadChats,
    };
}

export default useChats;
