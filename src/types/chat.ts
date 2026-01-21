// =====================================================
// Chat Types - Definições de tipos para o chat
// =====================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    id: string;
    chat_id: string;
    role: MessageRole;
    content: string;
    created_at: string;
}

export interface Chat {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

// Tipo para mensagens no formato da API OpenRouter
export interface OpenRouterMessage {
    role: MessageRole;
    content: string;
}

// Resposta da API OpenRouter (streaming chunk)
export interface OpenRouterChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }[];
}

// Configurações do modelo
export interface ModelConfig {
    model: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}

// Lista de modelos uncensored disponíveis
export const UNCENSORED_MODELS = {
    // Modelos gratuitos (recomendados para início)
    'nousresearch/hermes-3-llama-3.1-405b:free': 'Hermes 3 405B (Free)',
    'nousresearch/hermes-2-pro-llama-3-8b': 'Hermes 2 Pro 8B',
    'cognitivecomputations/dolphin-llama-3-70b': 'Dolphin Llama 3 70B',
    'undi95/toppy-m-7b': 'Toppy M 7B',

    // Modelos pagos de alta qualidade
    'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
    'openai/gpt-4-turbo': 'GPT-4 Turbo',
    'meta-llama/llama-3.1-405b-instruct': 'Llama 3.1 405B',
} as const;

export type UncensoredModelId = keyof typeof UNCENSORED_MODELS;

// Modelo padrão (uncensored e gratuito)
export const DEFAULT_MODEL: UncensoredModelId = 'nousresearch/hermes-3-llama-3.1-405b:free';
