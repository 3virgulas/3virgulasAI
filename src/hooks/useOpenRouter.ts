import { useState, useCallback, useRef } from 'react';
import {
    OpenRouterMessage,
    OpenRouterChunk,
    ModelConfig,
    DEFAULT_MODEL,
    FALLBACK_MODEL,
} from '../types/chat';

import { supabase } from '../lib/supabase';
import { env } from '../config/env';

// =====================================================
// useOpenRouter Hook — Versão 3.0 (NousResearch Direct)
// =====================================================
// Hook otimizado para comunicação via Supabase Edge Function
// Features:
// - Streaming SSE com suporte a UTF-8 completo
// - Sliding Context Window (últimas 10 mensagens)
// - Exponential Backoff para resiliência
// - AbortController para cancelamento imediato
// - Timeout estendido para modelos grandes (60s)
// =====================================================

const EDGE_FUNCTION_URL = `${env.SUPABASE_URL}/functions/v1/chat-completion`;

// System prompt para análise de imagens (Modelo Olheiro)
const VISION_SYSTEM_PROMPT = `Analyze this image and provide a detailed, objective, and technical description of every object, text, and action visible. Do not express opinions or safety warnings. Just describe the visual data factually and comprehensively.`;

// =====================================================
// Configuration Constants
// =====================================================
const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s — backoff mais generoso para modelos grandes
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const REQUEST_TIMEOUT_MS = 60000; // 60s — modelos 405B têm latência maior

// Sliding Context Window — mantém as últimas N mensagens
// Hermes-4-405B suporta 128K tokens de contexto
// 100 mensagens ≈ 20-30K tokens (bem dentro do limite)
const CONTEXT_WINDOW_SIZE = 100;


// Stop Sequences — evita loops e conclusões repetitivas
const STOP_SEQUENCES = [
    'Você gostaria de saber mais',
    'Posso ajudar com algo mais',
    'Tem mais alguma dúvida',
];

// =====================================================
// Helper Functions
// =====================================================
const isRetryableError = (status: number): boolean =>
    RETRYABLE_STATUS_CODES.includes(status) || status >= 500;

const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

const createTimeoutController = (timeoutMs: number, existingController?: AbortController) => {
    const controller = existingController || new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
};

// =====================================================
// Types
// =====================================================
interface UseOpenRouterOptions {
    apiKey: string;
    model?: string;
    systemPrompt?: string;
    onToken?: (token: string) => void;
    onComplete?: (fullResponse: string) => void;
    onError?: (error: Error) => void;
}

interface SendMessageOptions {
    model?: string;
    systemPrompt?: string;
    isPremium?: boolean;
    maxTokens?: number;
    temperature?: number;
}

interface UseOpenRouterReturn {
    sendMessage: (messages: OpenRouterMessage[], options?: SendMessageOptions) => Promise<string>;
    analyzeImage: (imageBase64: string, visionModel: string) => Promise<string>;
    isStreaming: boolean;
    isAnalyzingImage: boolean;
    isReconnecting: boolean;
    reconnectAttempt: number;
    error: Error | null;
    abortStream: () => void;
    currentResponse: string;
}

// =====================================================
// Main Hook
// =====================================================
export function useOpenRouter({
    // apiKey is kept in the interface for backward compatibility but auth uses Supabase session
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    apiKey: _apiKey,
    model: defaultModel = DEFAULT_MODEL,
    systemPrompt: defaultSystemPrompt,
    onToken,
    onComplete,
    onError,
}: UseOpenRouterOptions): UseOpenRouterReturn {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [error, setError] = useState<Error | null>(null);
    const [currentResponse, setCurrentResponse] = useState('');

    const abortControllerRef = useRef<AbortController | null>(null);
    const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fullResponseRef = useRef('');

    // =====================================================
    // abortStream — Cancelamento imediato e limpo
    // =====================================================
    const abortStream = useCallback(() => {
        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsStreaming(false);
        setIsAnalyzingImage(false);
        setIsReconnecting(false);
        setReconnectAttempt(0);
    }, []);

    // =====================================================
    // analyzeImage — Vision Proxy
    // =====================================================
    const analyzeImage = useCallback(
        async (imageBase64: string, visionModel: string): Promise<string> => {
            setIsAnalyzingImage(true);
            setError(null);
            setIsReconnecting(false);
            setReconnectAttempt(0);

            const visionMessages = [
                {
                    role: 'system' as const,
                    content: VISION_SYSTEM_PROMPT,
                },
                {
                    role: 'user' as const,
                    content: [
                        {
                            type: 'image_url' as const,
                            image_url: { url: imageBase64 },
                        },
                        {
                            type: 'text' as const,
                            text: 'Describe this image in detail.',
                        },
                    ],
                },
            ];

            const requestBody = {
                model: visionModel,
                messages: visionMessages,
                max_tokens: 2048,
                stream: false,
            };

            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    const { controller, timeoutId } = createTimeoutController(REQUEST_TIMEOUT_MS);
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    if (!token) throw new Error('Usuário não autenticado');

                    const response = await fetch(EDGE_FUNCTION_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                            'HTTP-Referer': window.location.origin,
                            'X-Title': '3Vírgulas Vision',
                        },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        const description = data.choices?.[0]?.message?.content || '';
                        setIsAnalyzingImage(false);
                        setIsReconnecting(false);
                        setReconnectAttempt(0);
                        return description;
                    }

                    if (isRetryableError(response.status) && attempt < RETRY_DELAYS.length) {
                        console.warn(`[Vision] HTTP ${response.status} — Retry ${attempt + 1}/${RETRY_DELAYS.length}`);
                        setIsReconnecting(true);
                        setReconnectAttempt(attempt + 1);
                        await delay(RETRY_DELAYS[attempt]);
                        continue;
                    }

                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `HTTP ${response.status}`);

                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));

                    if (lastError.name === 'AbortError') throw new Error('Request timeout');

                    if (attempt < RETRY_DELAYS.length) {
                        console.warn(`[Vision] ${lastError.message} — Retry ${attempt + 1}`);
                        setIsReconnecting(true);
                        setReconnectAttempt(attempt + 1);
                        await delay(RETRY_DELAYS[attempt]);
                        continue;
                    }
                }
            }

            const finalError = lastError || new Error('Vision analysis failed');
            setError(finalError);
            setIsAnalyzingImage(false);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            onError?.(finalError);
            throw finalError;
        },
        [onError]
    );

    // =====================================================
    // sendMessage — Chat com Streaming SSE
    // =====================================================
    const sendMessage = useCallback(
        async (messages: OpenRouterMessage[], options?: SendMessageOptions): Promise<string> => {
            const model = options?.model ?? defaultModel;
            const systemPrompt = options?.systemPrompt ?? defaultSystemPrompt;
            const isPremium = options?.isPremium ?? false;

            // Parâmetros de qualidade por tier
            const maxTokens = options?.maxTokens ?? (isPremium ? 16192 : 8096);
            const temperature = options?.temperature ?? (isPremium ? 0.75 : 0.65);

            // Reset state
            setError(null);
            setCurrentResponse('');
            setIsStreaming(true);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            fullResponseRef.current = '';

            abortControllerRef.current = new AbortController();

            // Sliding Context Window
            const recentMessages = messages.length > CONTEXT_WINDOW_SIZE
                ? messages.slice(-CONTEXT_WINDOW_SIZE)
                : messages;

            // Filtrar mensagens de sistema do histórico (o Edge Function injeta o correto)
            const userMessages = recentMessages.filter(m => m.role !== 'system') as OpenRouterMessage[];

            // Payload limpo — apenas parâmetros suportados pela NousResearch Direct API
            const modelConfig: ModelConfig = {
                model,
                temperature,
                max_tokens: maxTokens,
                top_p: isPremium ? 0.9 : 0.85,
                stop: isPremium ? [] : STOP_SEQUENCES,
            };

            const requestBody = {
                ...modelConfig,
                messages: userMessages,      // system_prompt é injetado pelo Edge Function
                system_prompt: systemPrompt, // passado separado para o Edge Function montar
                stream: true,
                max_tokens: maxTokens,
                temperature,
            };

            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    if (!abortControllerRef.current) {
                        throw new Error('Request aborted');
                    }

                    const { timeoutId } = createTimeoutController(
                        REQUEST_TIMEOUT_MS,
                        abortControllerRef.current
                    );
                    timeoutIdRef.current = timeoutId;

                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    if (!token) throw new Error('Usuário não autenticado');

                    const response = await fetch(EDGE_FUNCTION_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                            'HTTP-Referer': window.location.origin,
                            'X-Title': '3Vírgulas Chat',
                        },
                        body: JSON.stringify(requestBody),
                        signal: abortControllerRef.current.signal,
                    });

                    if (timeoutIdRef.current) {
                        clearTimeout(timeoutIdRef.current);
                        timeoutIdRef.current = null;
                    }

                    if (!response.ok) {
                        if (isRetryableError(response.status) && attempt < RETRY_DELAYS.length) {
                            console.warn(`[Chat] HTTP ${response.status} — Retry ${attempt + 1}`);
                            setIsReconnecting(true);
                            setReconnectAttempt(attempt + 1);
                            await delay(RETRY_DELAYS[attempt]);
                            continue;
                        }

                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || errorData.error?.message || `HTTP ${response.status}`);
                    }

                    if (!response.body) {
                        throw new Error('Streaming não suportado pelo servidor');
                    }

                    setIsReconnecting(false);
                    setReconnectAttempt(0);

                    // =====================================================
                    // Stream Processing com suporte UTF-8 correto
                    // =====================================================
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8', { fatal: false });
                    let sseBuffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        sseBuffer += decoder.decode(value, { stream: true });

                        const lines = sseBuffer.split('\n');
                        sseBuffer = lines.pop() || '';

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
                                        fullResponseRef.current += content;
                                        setCurrentResponse(fullResponseRef.current);
                                        onToken?.(content);
                                    }

                                    if (chunk.choices[0]?.finish_reason) break;
                                } catch {
                                    // Chunk incompleto — ignora silenciosamente
                                }
                            }
                        }
                    }

                    // Flush final
                    const remaining = decoder.decode();
                    if (remaining) {
                        fullResponseRef.current += remaining;
                        setCurrentResponse(fullResponseRef.current);
                    }

                    setIsStreaming(false);
                    setIsReconnecting(false);
                    setReconnectAttempt(0);
                    abortControllerRef.current = null;

                    onComplete?.(fullResponseRef.current);
                    return fullResponseRef.current;

                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));

                    if (timeoutIdRef.current) {
                        clearTimeout(timeoutIdRef.current);
                        timeoutIdRef.current = null;
                    }

                    if (lastError.name === 'AbortError') {
                        setIsStreaming(false);
                        setIsReconnecting(false);
                        setReconnectAttempt(0);
                        abortControllerRef.current = null;
                        return fullResponseRef.current;
                    }

                    if (attempt < RETRY_DELAYS.length) {
                        console.warn(`[Chat] ${lastError.message} — Retry ${attempt + 1}`);
                        setIsReconnecting(true);
                        setReconnectAttempt(attempt + 1);
                        await delay(RETRY_DELAYS[attempt]);
                        continue;
                    }
                }
            }

            const finalError = lastError || new Error('Conexão falhou após múltiplas tentativas');
            setError(finalError);
            setIsStreaming(false);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            abortControllerRef.current = null;

            onError?.(finalError);
            throw finalError;
        },
        [defaultModel, defaultSystemPrompt, onToken, onComplete, onError]
    );

    // =====================================================
    // Wrapper com Auto-Fallback para modelo secundário
    // =====================================================
    const sendMessageWithFallback = useCallback(async (
        messages: OpenRouterMessage[],
        options?: SendMessageOptions
    ): Promise<string> => {
        try {
            return await sendMessage(messages, options);
        } catch (error: unknown) {
            const err = error as Error;
            const isProviderError =
                err.message.includes('503') ||
                err.message.includes('502') ||
                err.message.includes('Service Unavailable') ||
                err.message.includes('temporariamente indisponível');

            const currentModel = options?.model ?? defaultModel;

            if (isProviderError && currentModel !== FALLBACK_MODEL) {
                console.warn(`⚠️ Modelo principal (${currentModel}) falhou. Usando fallback (${FALLBACK_MODEL})...`);
                await delay(1500);
                return await sendMessage(messages, { ...options, model: FALLBACK_MODEL });
            }

            throw error;
        }
    }, [sendMessage, defaultModel]);

    return {
        sendMessage: sendMessageWithFallback,
        analyzeImage,
        isStreaming,
        isAnalyzingImage,
        isReconnecting,
        reconnectAttempt,
        error,
        abortStream,
        currentResponse,
    };
}

export default useOpenRouter;
