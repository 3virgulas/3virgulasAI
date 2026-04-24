// =====================================================
// Venice AI Service
// =====================================================
// Serviço para uso fora de componentes React
// Útil para Edge Functions e contexts
// =====================================================

import {
    OpenRouterMessage,
    OpenRouterChunk,
    ModelConfig,
    DEFAULT_MODEL
} from '../types/chat';
import { supabase } from './supabase';
import { env } from '../config/env';

// Roteamento via Edge Function (auth via Supabase session)
const EDGE_FUNCTION_URL = `${env.SUPABASE_URL}/functions/v1/chat-completion`;


// =====================================================
// Sliding Context Window Configuration
// =====================================================
// Mantém apenas as últimas N mensagens do histórico (user/assistant)
// para evitar confusão em conversas longas e economizar tokens
const CONTEXT_WINDOW_SIZE = 50; // 50 mensagens — sweet spot qualidade/custo

// Stop Sequences removidas — o system prompt v4 controla o encerramento.

export interface StreamOptions {
    apiKey: string;
    messages: OpenRouterMessage[];
    model?: string;
    systemPrompt?: string;
    onToken?: (token: string) => void;
    onComplete?: (fullResponse: string) => void;
    onError?: (error: Error) => void;
    signal?: AbortSignal;
}

/**
 * Função para streaming de resposta do OpenRouter
 * Pode ser usada fora de componentes React
 */
export async function streamOpenRouterResponse({
    apiKey,
    messages,
    model = DEFAULT_MODEL,
    systemPrompt,
    onToken,
    onComplete,
    onError,
    signal,
}: StreamOptions): Promise<string> {
    // =====================================================
    // Sliding Context Window - Janela de Contexto Deslizante
    // =====================================================
    // 1. Sempre mantém o System Prompt (identidade da IA)
    // 2. Pega apenas as últimas N mensagens do histórico
    const recentMessages = messages.length > CONTEXT_WINDOW_SIZE
        ? messages.slice(-CONTEXT_WINDOW_SIZE)
        : messages;

    // Edge Function injeta o system prompt automaticamente para NousResearch

    const modelConfig: ModelConfig = {
        model,
        temperature: 0.85,
        max_tokens: 65536,
        top_p: 0.95,
        stop: [],
        // frequency_penalty e presence_penalty REMOVIDOS — causavam respostas vagas
    };

    try {
        // Obter token de sessão
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || apiKey;

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                ...modelConfig,
                messages: recentMessages,
                system_prompt: systemPrompt,
                stream: true,
            }),
            signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Streaming não suportado');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullResponse = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue;

                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const chunk: OpenRouterChunk = JSON.parse(data);
                        const content = chunk.choices[0]?.delta?.content;

                        if (content) {
                            fullResponse += content;
                            onToken?.(content);
                        }

                        if (chunk.choices[0]?.finish_reason) break;
                    } catch {
                        // Ignorar erros de parse
                    }
                }
            }
        }

        onComplete?.(fullResponse);
        return fullResponse;

    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (error.name !== 'AbortError') {
            onError?.(error);
        }

        throw error;
    }
}

/**
 * Função para requisição não-streaming (resposta completa de uma vez)
 * Útil para geradores de título e outras operações rápidas
 */
export async function fetchOpenRouterResponse({
    apiKey,
    messages,
    model = DEFAULT_MODEL,
    systemPrompt,
}: Omit<StreamOptions, 'onToken' | 'onComplete' | 'onError' | 'signal'>): Promise<string> {
    // Sliding Context Window - Janela de Contexto Deslizante
    const recentMessages = messages.length > CONTEXT_WINDOW_SIZE
        ? messages.slice(-CONTEXT_WINDOW_SIZE)
        : messages;

    // Edge Function injeta o system prompt automaticamente para NousResearch

    // Obter token de sessão
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || apiKey;

    const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            model,
            messages: recentMessages,
            system_prompt: systemPrompt,
            temperature: 0.85,
            max_tokens: 65536,
            top_p: 0.95,
            stream: false,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

/**
 * Gera um título para o chat baseado na primeira mensagem
 */
export async function generateChatTitle(
    apiKey: string,
    firstMessage: string,
    model: string = DEFAULT_MODEL
): Promise<string> {
    const response = await fetchOpenRouterResponse({
        apiKey,
        model,
        messages: [
            {
                role: 'user',
                content: firstMessage,
            },
        ],
        systemPrompt: `Você é um assistente que gera títulos curtos e descritivos para conversas.
Baseado na mensagem do usuário, gere um título de NO MÁXIMO 5 palavras que resuma o tópico.
Responda APENAS com o título, sem aspas, sem pontuação final, sem explicações.`,
    });

    // Limpar e truncar o título
    return response.trim().slice(0, 100);
}

export default {
    streamOpenRouterResponse,
    fetchOpenRouterResponse,
    generateChatTitle,
};
