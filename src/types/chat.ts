// =====================================================
// Chat Types — 3Vírgulas
// Provedor: NousResearch Direct API
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
    frequency_penalty?: number;
    presence_penalty?: number;
}

// =====================================================
// Modelos NousResearch Inference API (confirmados em /v1/models)
// =====================================================
export const NOUS_MODELS = {
    'Hermes-4-405B': 'Hermes 4 405B 🔥 (Máximo)',
    'Hermes-4-70B': 'Hermes 4 70B ⚡ (Rápido)',
} as const;

export type NousModelId = keyof typeof NOUS_MODELS;

// Modelo principal e fallback
export const DEFAULT_MODEL: NousModelId = 'Hermes-4-405B';
export const FALLBACK_MODEL: NousModelId = 'Hermes-4-70B';

// Aliases para compatibilidade
export const FREE_MODEL = 'Hermes-4-405B';
export const PREMIUM_MODEL = 'Hermes-4-405B';
