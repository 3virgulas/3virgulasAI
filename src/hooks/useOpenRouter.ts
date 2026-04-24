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

// System prompt para análise de imagens (Mistral Vision via Venice)
const VISION_SYSTEM_PROMPT = `You are a precise visual analysis engine. Analyze the provided image with maximum detail and accuracy.

Describe EVERYTHING you observe:
- All objects, people, animals, text, symbols present
- Spatial relationships and layout
- Colors, textures, lighting conditions
- Any text visible (transcribe exactly)
- Actions, expressions, or states depicted
- Context and setting clues
- Technical details if relevant (diagrams, code, charts, data)

Be exhaustive, objective, and factual. Do not interpret or add subjective commentary. Provide raw visual data.`;

// =====================================================
// Configuration Constants
// =====================================================
const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s — backoff mais generoso para modelos grandes
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const REQUEST_TIMEOUT_MS = 60000;  // 60s — chat normal
const VISION_TIMEOUT_MS  = 120000; // 120s — visão (modelo 235B pode ter alta latência + retries no edge)

// Sliding Context Window — mantém as últimas N mensagens
// Venice Uncensored 1.2 suporta 128K tokens de contexto
// 50 mensagens ≈ 15-20K tokens — sweet spot qualidade/custo
const CONTEXT_WINDOW_SIZE = 50;

// Compressão de contexto — quando o histórico ultrapassa 45 msgs,
// as mais antigas são sumarizadas em vez de descartadas silenciosamente
const SUMMARIZE_THRESHOLD = 45; // dispara compressão acima deste tamanho
const KEEP_RECENT = 40;          // mensagens recentes mantidas verbatim após o resumo


// Stop Sequences removidas — o system prompt v4 já controla o encerramento.
// Manter stop sequences cortava respostas legítimas que continham essas frases.

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
    onThinking?: (thinkingContent: string) => void; // Callback para o conteúdo do <think>
    onComplete?: (fullResponse: string, thinkingContent: string) => void;
    onError?: (error: Error) => void;
}

interface SendMessageOptions {
    model?: string;
    systemPrompt?: string;
    isPremium?: boolean;
    maxTokens?: number;
    temperature?: number;
    chatId?: string; // Escopo RAG por chat — evita contaminação cruzada entre conversas
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
    currentThinking: string; // Conteúdo atual do bloco <think>
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
    onThinking,
    onComplete,
    onError,
}: UseOpenRouterOptions): UseOpenRouterReturn {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [error, setError] = useState<Error | null>(null);
    const [currentResponse, setCurrentResponse] = useState('');
    const [currentThinking, setCurrentThinking] = useState('');

    const abortControllerRef = useRef<AbortController | null>(null);
    const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fullResponseRef = useRef('');
    const thinkingRef = useRef('');      // Conteúdo acumulado de <think>
    const inThinkBlockRef = useRef(false); // Flag: estamos dentro de <think>?
    // Cache do resumo de contexto — evita re-sumarizar a cada mensagem
    const summaryCacheRef = useRef<{ upToIndex: number; summary: string } | null>(null);

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
                is_vision: true, // flag explícita para garantir roteamento correto no edge function
            };

            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    const { controller, timeoutId } = createTimeoutController(VISION_TIMEOUT_MS);
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
    // summarizeOldMessages — Compressão de contexto
    // Sumariza mensagens antigas para preservar decisões/fatos
    // sem exceder a janela de contexto do modelo
    // =====================================================
    const summarizeOldMessages = useCallback(
        async (oldMessages: OpenRouterMessage[], token: string): Promise<string> => {
            const formatted = oldMessages
                .filter(m => m.role !== 'system')
                .map(m => {
                    const role = m.role === 'user' ? 'Usuário' : 'IA';
                    const content = typeof m.content === 'string'
                        ? m.content
                        : (m.content as Array<{ type: string; text?: string }>)
                            .find(c => c.type === 'text')?.text ?? '[imagem/arquivo]';
                    return `${role}: ${content.substring(0, 600)}`;
                })
                .join('\n\n');

            const summaryPrompt = [
                {
                    role: 'user' as const,
                    content: `Abaixo está um trecho de uma conversa. Crie um RESUMO COMPACTO preservando:
- Todos os fatos, decisões e requisitos estabelecidos pelo usuário
- Nomes de variáveis, funções, arquivos, tecnologias ou dados mencionados
- Preferências, restrições e instruções específicas
- O fio condutor lógico da troca

Escreva SOMENTE o resumo, sem introdução ou conclusão. Máximo 600 palavras.

HISTÓRICO:\n${formatted}`,
                },
            ];

            try {
                const response = await fetch(EDGE_FUNCTION_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                        'HTTP-Referer': window.location.origin,
                        'X-Title': '3Vírgulas Summarizer',
                    },
                    body: JSON.stringify({
                        messages: summaryPrompt,
                        stream: false,
                        max_tokens: 1024,
                        temperature: 0.3,
                    }),
                    signal: AbortSignal.timeout(30000),
                });

                if (!response.ok) return '';
                const data = await response.json();
                return data.choices?.[0]?.message?.content ?? '';
            } catch {
                return '';
            }
        },
        []
    );

    // =====================================================
    // sendMessage — Chat com Streaming SSE
    // =====================================================
    const sendMessage = useCallback(
        async (messages: OpenRouterMessage[], options?: SendMessageOptions): Promise<string> => {
            const model = options?.model ?? defaultModel;
            const systemPrompt = options?.systemPrompt ?? defaultSystemPrompt;
            const chatId = options?.chatId ?? null;

            // Parâmetros máximos — Venice Uncensored 1.2 (mesmo para free e premium)
            const maxTokens = options?.maxTokens ?? 65536;
            const temperature = options?.temperature ?? 0.85;

            // Reset state
            setError(null);
            setCurrentResponse('');
            setCurrentThinking('');
            setIsStreaming(true);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            fullResponseRef.current = '';
            thinkingRef.current = '';
            inThinkBlockRef.current = false;

            abortControllerRef.current = new AbortController();

            // ── Compressão de Contexto ──────────────────────────────────────
            // Quando o histórico ultrapassa SUMMARIZE_THRESHOLD mensagens,
            // as antigas são sumarizadas em vez de descartadas silenciosamente.
            // Isso preserva decisões, requisitos e fatos estabelecidos cedo.
            const nonSystem = messages.filter(m => m.role !== 'system') as OpenRouterMessage[];
            let userMessages: OpenRouterMessage[];

            if (nonSystem.length > SUMMARIZE_THRESHOLD) {
                const splitAt = nonSystem.length - KEEP_RECENT;
                const oldMessages = nonSystem.slice(0, splitAt);
                const recentMessages = nonSystem.slice(splitAt);

                // Só re-sumariza se o ponto de corte mudou (novas msgs antigas entraram)
                if (!summaryCacheRef.current || summaryCacheRef.current.upToIndex !== splitAt) {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    if (token) {
                        console.log(`[Context] 📚 Comprimindo ${oldMessages.length} msgs antigas em resumo...`);
                        const summary = await summarizeOldMessages(oldMessages, token);
                        if (summary) {
                            summaryCacheRef.current = { upToIndex: splitAt, summary };
                            console.log(`[Context] ✅ Resumo gerado (${summary.length} chars)`);
                        }
                    }
                }

                if (summaryCacheRef.current?.summary) {
                    // Injeta o resumo como par user/assistant no topo do histórico
                    const summaryPair: OpenRouterMessage[] = [
                        {
                            role: 'user',
                            content: `[RESUMO DO HISTÓRICO ANTERIOR]\n\n${summaryCacheRef.current.summary}`,
                        },
                        {
                            role: 'assistant',
                            content: 'Contexto anterior carregado. Prosseguindo com base nessas informações.',
                        },
                    ];
                    userMessages = [...summaryPair, ...recentMessages];
                } else {
                    // Fallback: corte simples se a sumarização falhar
                    userMessages = recentMessages;
                }
            } else {
                // Abaixo do threshold: comportamento padrão — janela deslizante
                userMessages = nonSystem.slice(-CONTEXT_WINDOW_SIZE);
            }

            // Payload limpo — parâmetros suportados pela Venice AI
            const modelConfig: ModelConfig = {
                model,
                temperature,
                max_tokens: maxTokens,
                top_p: 0.95,
                stop: [],
                // frequency_penalty e presence_penalty REMOVIDOS intencionalmente:
                // causavam respostas vagas e salços de tópico
            };

            const requestBody = {
                ...modelConfig,
                messages: userMessages,      // system_prompt é injetado pelo Edge Function
                system_prompt: systemPrompt, // passado separado para o Edge Function montar
                chat_id: chatId,             // escopo RAG: filtra embeddings do chat atual
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
                    // partialTagBuffer — persiste entre chunks para detectar tags <think>/</think>
                    // que chegam divididas em múltiplos chunks SSE (ex: "<thi" + "nk>").
                    // Segura o sufixo do texto anterior que pode ser prefixo de uma tag.
                    let partialTagBuffer = '';

                    // Máximo de chars que uma tag pode ter (</think> = 8 chars)
                    const MAX_TAG_LEN = 8;

                    // =====================================================
                    // processChunk — parser centralizado de <think>
                    // Usado tanto no loop SSE quanto no flush final,
                    // garantindo que nenhum fragmento bypasse o parser.
                    // =====================================================
                    const processChunk = (text: string) => {
                        let rem = text;
                        while (rem.length > 0) {
                            if (inThinkBlockRef.current) {
                                const closeIdx = rem.indexOf('</think>');
                                if (closeIdx !== -1) {
                                    thinkingRef.current += rem.substring(0, closeIdx);
                                    setCurrentThinking(thinkingRef.current);
                                    onThinking?.(thinkingRef.current);
                                    inThinkBlockRef.current = false;
                                    rem = rem.substring(closeIdx + 8);
                                } else {
                                    thinkingRef.current += rem;
                                    setCurrentThinking(thinkingRef.current);
                                    rem = '';
                                }
                            } else {
                                const openIdx = rem.indexOf('<think>');
                                if (openIdx !== -1) {
                                    const before = rem.substring(0, openIdx);
                                    if (before) {
                                        fullResponseRef.current += before;
                                        setCurrentResponse(fullResponseRef.current);
                                        onToken?.(before);
                                    }
                                    inThinkBlockRef.current = true;
                                    rem = rem.substring(openIdx + 7);
                                } else {
                                    fullResponseRef.current += rem;
                                    setCurrentResponse(fullResponseRef.current);
                                    onToken?.(rem);
                                    rem = '';
                                }
                            }
                        }
                    };

                    // flushSafe — passa texto pelo partialTagBuffer antes de processChunk.
                    // Retém no buffer o sufixo que pode ser prefixo incompleto de uma tag,
                    // liberando apenas o que certamente não é início de tag.
                    const flushSafe = (incoming: string, isFinal = false) => {
                        const combined = partialTagBuffer + incoming;

                        if (isFinal) {
                            // No flush final: não há mais chunks — processa tudo
                            partialTagBuffer = '';
                            if (combined) processChunk(combined);
                            return;
                        }

                        // Verifica se o final de `combined` pode ser prefixo de <think> ou </think>
                        const tags = ['<think>', '</think>'];
                        let safeUpTo = combined.length;

                        for (const tag of tags) {
                            for (let pLen = Math.min(tag.length - 1, MAX_TAG_LEN); pLen >= 1; pLen--) {
                                const prefix = tag.substring(0, pLen);
                                if (combined.endsWith(prefix)) {
                                    // O final do buffer pode ser início de tag — retém
                                    safeUpTo = Math.min(safeUpTo, combined.length - pLen);
                                    break;
                                }
                            }
                        }

                        if (safeUpTo > 0) {
                            processChunk(combined.substring(0, safeUpTo));
                        }
                        partialTagBuffer = combined.substring(safeUpTo);
                    };

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
                                        flushSafe(content);
                                    }

                                    if (chunk.choices[0]?.finish_reason) break;
                                } catch {
                                    // Chunk incompleto — ignora silenciosamente
                                }
                            }
                        }
                    }

                    // Flush final — esvazia partialTagBuffer e passa pelo parser de <think>
                    const finalFlush = decoder.decode();
                    flushSafe(finalFlush, true); // isFinal=true: libera qualquer prefixo retido

                    setIsStreaming(false);
                    setIsReconnecting(false);
                    setReconnectAttempt(0);
                    abortControllerRef.current = null;

                    onComplete?.(fullResponseRef.current, thinkingRef.current);
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
        [defaultModel, defaultSystemPrompt, summarizeOldMessages, onToken, onThinking, onComplete, onError]
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
        currentThinking,
    };
}

export default useOpenRouter;
