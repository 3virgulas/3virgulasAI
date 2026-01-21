// =====================================================
// OpenRouter Service
// =====================================================
// Serviço alternativo para uso fora de componentes React
// Útil para Edge Functions e contexts
// =====================================================

import {
    OpenRouterMessage,
    OpenRouterChunk,
    ModelConfig,
    DEFAULT_MODEL
} from '../types/chat';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    // Preparar mensagens com system prompt
    const preparedMessages: OpenRouterMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

    const modelConfig: ModelConfig = {
        model,
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 0.9,
    };

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
                'X-Title': '3Vírgulas Chat',
            },
            body: JSON.stringify({
                ...modelConfig,
                messages: preparedMessages,
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
    const preparedMessages: OpenRouterMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
            'X-Title': '3Vírgulas Chat',
        },
        body: JSON.stringify({
            model,
            messages: preparedMessages,
            temperature: 0.7,
            max_tokens: 4096,
            stream: false, // Sem streaming
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
    model = DEFAULT_MODEL
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
