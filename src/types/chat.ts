// =====================================================
// Chat Types — VOUGHT
// Provedor: Venice AI (api.venice.ai/api/v1)
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

// Tipo para mensagens no formato da API NousResearch (compatível OpenAI)
export interface OpenRouterMessage {
    role: MessageRole;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// Resposta da API em formato streaming chunk (SSE)
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
    stop?: string[];
    // frequency_penalty e presence_penalty intencionalmente omitidos
    // Causam respostas vagas e salços de tópico no venice-uncensored-1-2
}

// =====================================================
// Modelos Venice AI (venice.ai)
// Provedor: Venice — OpenAI-compatible, sem censura
// =====================================================
export const VENICE_MODELS = {
    'venice-uncensored-1-2': 'PROMETHEUS ⚡ (Venice Uncensored 1.2)',
} as const;

export type VeniceModelId = keyof typeof VENICE_MODELS;

// Modelo único para todos os usuários
export const DEFAULT_MODEL: VeniceModelId = 'venice-uncensored-1-2';
export const FALLBACK_MODEL: VeniceModelId = 'venice-uncensored-1-2';

// Aliases para compatibilidade — mesmo modelo para free e premium
export const FREE_MODEL = 'venice-uncensored-1-2';
export const PREMIUM_MODEL = 'venice-uncensored-1-2';
