import { useState, useCallback, useRef } from 'react';
import {
    OpenRouterMessage,
    OpenRouterChunk,
    ModelConfig,
    DEFAULT_MODEL,
} from '../types/chat';

// =====================================================
// useOpenRouter Hook
// =====================================================
// Hook para comunicação com a API do OpenRouter
// Suporta streaming de texto (SSE), Vision Proxy e
// Exponential Backoff para resiliência de conexão
// =====================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// System prompt para o modelo de visão (Olheiro)
const VISION_SYSTEM_PROMPT = `Analyze this image and provide a detailed, objective, and technical description of every object, text, and action visible. Do not express opinions or safety warnings. Just describe the visual data factually and comprehensively.`;

// =====================================================
// Retry Configuration
// =====================================================
const RETRY_DELAYS = [1000, 3000, 5000]; // 1s, 3s, 5s
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// =====================================================
// Sliding Context Window Configuration
// =====================================================
// Mantém apenas as últimas N mensagens do histórico (user/assistant)
// para evitar confusão em conversas longas e economizar tokens
const CONTEXT_WINDOW_SIZE = 10; // Últimas 10 mensagens (5 pares user/assistant)

// =====================================================
// Stop Sequences - Anti-Loop Protection
// =====================================================
// Frases que forçam a IA a parar, evitando loops de conclusão repetitiva
const STOP_SEQUENCES = [
    'Você gostaria de saber mais',
    'Posso ajudar com algo mais',
    'Tem mais alguma dúvida',
    'Gostaria de mais informações',
    'Precisa de mais detalhes',
];

// Verifica se o erro é retryable
const isRetryableError = (status: number): boolean => {
    return RETRYABLE_STATUS_CODES.includes(status) || status >= 500;
};

// Delay helper com promise
const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

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

export function useOpenRouter({
    apiKey,
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

    const abortStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsStreaming(false);
            setIsAnalyzingImage(false);
            setIsReconnecting(false);
            setReconnectAttempt(0);
        }
    }, []);

    // =====================================================
    // analyzeImage - Vision Proxy (Modelo 1 - Olheiro)
    // Com Exponential Backoff Retry
    // =====================================================
    const analyzeImage = useCallback(
        async (imageBase64: string, visionModel: string): Promise<string> => {
            setIsAnalyzingImage(true);
            setError(null);
            setIsReconnecting(false);
            setReconnectAttempt(0);

            const controller = new AbortController();

            // Preparar mensagem com imagem para o modelo de visão
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
                            image_url: {
                                url: imageBase64,
                            },
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
                max_tokens: 1024,
                stream: false,
            };

            let lastError: Error | null = null;

            // Retry loop com exponential backoff
            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    const response = await fetch(OPENROUTER_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                            'HTTP-Referer': window.location.origin,
                            'X-Title': '3Vírgulas Vision Proxy',
                        },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal,
                    });

                    // Sucesso!
                    if (response.ok) {
                        const data = await response.json();
                        const description = data.choices?.[0]?.message?.content || '';

                        setIsAnalyzingImage(false);
                        setIsReconnecting(false);
                        setReconnectAttempt(0);
                        return description;
                    }

                    // Verifica se é um erro retryable
                    if (isRetryableError(response.status) && attempt < RETRY_DELAYS.length) {
                        const delayMs = RETRY_DELAYS[attempt];
                        console.warn(
                            `[Vision] HTTP ${response.status} - Retry ${attempt + 1}/${RETRY_DELAYS.length} em ${delayMs}ms`
                        );

                        setIsReconnecting(true);
                        setReconnectAttempt(attempt + 1);

                        await delay(delayMs);
                        continue;
                    }

                    // Erro não-retryable ou tentativas esgotadas
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage =
                        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                    throw new Error(`Vision analysis failed: ${errorMessage}`);

                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));

                    // Se for AbortError, não faz retry
                    if (lastError.name === 'AbortError') {
                        throw lastError;
                    }

                    // Se ainda tem tentativas, faz retry
                    if (attempt < RETRY_DELAYS.length) {
                        const delayMs = RETRY_DELAYS[attempt];
                        console.warn(
                            `[Vision] Error: ${lastError.message} - Retry ${attempt + 1}/${RETRY_DELAYS.length} em ${delayMs}ms`
                        );

                        setIsReconnecting(true);
                        setReconnectAttempt(attempt + 1);

                        await delay(delayMs);
                        continue;
                    }
                }
            }

            // Todas as tentativas falharam
            const finalError = lastError || new Error('Vision analysis failed after all retries');
            setError(finalError);
            setIsAnalyzingImage(false);
            setIsReconnecting(false);
            setReconnectAttempt(0);

            if (onError) {
                onError(finalError);
            }

            throw finalError;
        },
        [apiKey, onError]
    );

    // =====================================================
    // sendMessage - Chat normal (Modelo 2 - Executor)
    // Com Exponential Backoff Retry para conexão inicial
    // =====================================================
    const sendMessage = useCallback(
        async (messages: OpenRouterMessage[], options?: SendMessageOptions): Promise<string> => {
            const model = options?.model ?? defaultModel;
            const systemPrompt = options?.systemPrompt ?? defaultSystemPrompt;

            setError(null);
            setCurrentResponse('');
            setIsStreaming(true);
            setIsReconnecting(false);
            setReconnectAttempt(0);

            abortControllerRef.current = new AbortController();

            // =====================================================
            // Sliding Context Window - Janela de Contexto Deslizante
            // =====================================================
            // 1. Sempre mantém o System Prompt (identidade da IA)
            // 2. Pega apenas as últimas N mensagens do histórico
            // Isso evita confusão em conversas longas e economiza tokens
            const recentMessages = messages.length > CONTEXT_WINDOW_SIZE
                ? messages.slice(-CONTEXT_WINDOW_SIZE)
                : messages;

            const preparedMessages: OpenRouterMessage[] = systemPrompt
                ? [{ role: 'system', content: systemPrompt }, ...recentMessages]
                : recentMessages;

            const modelConfig: ModelConfig = {
                model,
                temperature: 0.7,           // Equilíbrio entre criatividade e lógica
                max_tokens: 2048,           // Reduzido de 4096 para evitar delírios
                top_p: 0.9,                 // Corta respostas estatisticamente improváveis
                top_k: 40,                  // Limita vocabulário para manter coerência
                repetition_penalty: 1.1,    // CRÍTICO: Penaliza repetição de palavras/frases
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                stop: STOP_SEQUENCES,       // CRÍTICO: Para antes de loops de conclusão
            };

            const requestBody = {
                ...modelConfig,
                messages: preparedMessages,
                stream: true,
            };

            let lastError: Error | null = null;

            // Retry loop com exponential backoff para conexão inicial
            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    // Se abortado, sai
                    if (!abortControllerRef.current) {
                        throw new Error('Request aborted');
                    }

                    const response = await fetch(OPENROUTER_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                            'HTTP-Referer': window.location.origin,
                            'X-Title': '3Vírgulas Chat',
                        },
                        body: JSON.stringify(requestBody),
                        signal: abortControllerRef.current.signal,
                    });

                    // Verifica se é um erro retryable (antes de começar streaming)
                    if (!response.ok) {
                        if (isRetryableError(response.status) && attempt < RETRY_DELAYS.length) {
                            const delayMs = RETRY_DELAYS[attempt];
                            console.warn(
                                `[Chat] HTTP ${response.status} - Retry ${attempt + 1}/${RETRY_DELAYS.length} em ${delayMs}ms`
                            );

                            setIsReconnecting(true);
                            setReconnectAttempt(attempt + 1);

                            await delay(delayMs);
                            continue;
                        }

                        const errorData = await response.json().catch(() => ({}));
                        const errorMessage =
                            errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                        throw new Error(errorMessage);
                    }

                    if (!response.body) {
                        throw new Error('Resposta sem body - streaming não suportado');
                    }

                    // Conexão estabelecida com sucesso - limpa status de reconexão
                    setIsReconnecting(false);
                    setReconnectAttempt(0);

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let fullResponse = '';
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            break;
                        }

                        buffer += decoder.decode(value, { stream: true });

                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmedLine = line.trim();

                            if (!trimmedLine || trimmedLine.startsWith(':')) {
                                continue;
                            }

                            if (trimmedLine.startsWith('data: ')) {
                                const data = trimmedLine.slice(6);

                                if (data === '[DONE]') {
                                    continue;
                                }

                                try {
                                    const chunk: OpenRouterChunk = JSON.parse(data);
                                    const content = chunk.choices[0]?.delta?.content;

                                    if (content) {
                                        fullResponse += content;
                                        setCurrentResponse(fullResponse);

                                        if (onToken) {
                                            onToken(content);
                                        }
                                    }

                                    if (chunk.choices[0]?.finish_reason) {
                                        break;
                                    }
                                } catch (parseError) {
                                    console.warn('Erro ao parsear chunk:', parseError);
                                }
                            }
                        }
                    }

                    setIsStreaming(false);
                    setIsReconnecting(false);
                    setReconnectAttempt(0);

                    if (onComplete) {
                        onComplete(fullResponse);
                    }

                    return fullResponse;

                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));

                    if (lastError.name === 'AbortError') {
                        setIsStreaming(false);
                        setIsReconnecting(false);
                        setReconnectAttempt(0);
                        return currentResponse;
                    }

                    // Se ainda tem tentativas e não começou streaming, faz retry
                    if (attempt < RETRY_DELAYS.length) {
                        const delayMs = RETRY_DELAYS[attempt];
                        console.warn(
                            `[Chat] Error: ${lastError.message} - Retry ${attempt + 1}/${RETRY_DELAYS.length} em ${delayMs}ms`
                        );

                        setIsReconnecting(true);
                        setReconnectAttempt(attempt + 1);

                        await delay(delayMs);
                        continue;
                    }
                }
            }

            // Todas as tentativas falharam
            const finalError = lastError || new Error('Connection failed after all retries');
            setError(finalError);
            setIsStreaming(false);
            setIsReconnecting(false);
            setReconnectAttempt(0);

            if (onError) {
                onError(finalError);
            }

            abortControllerRef.current = null;
            throw finalError;
        },
        [apiKey, defaultModel, defaultSystemPrompt, onToken, onComplete, onError, currentResponse]
    );

    return {
        sendMessage,
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
