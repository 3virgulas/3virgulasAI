import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// =====================================================
// Chat Completion Edge Function — 3Vírgulas
// Provedor Único: NousResearch Direct API
// =====================================================

const NOUS_API_KEY = Deno.env.get('NOUS_API_KEY')
const NOUS_API_URL = 'https://inference-api.nousresearch.com/v1/chat/completions'

// Modelos confirmados disponíveis na NousResearch Inference API
// Fonte: https://inference-api.nousresearch.com/v1/models
const NOUS_MODELS = [
    'Hermes-4-405B', // Modelo principal — máxima inteligência, raciocínio híbrido
    'Hermes-4-70B',  // Modelo secundário — mais rápido, ótimo custo-benefício
]

// Modelo padrão: 405B = máximo poder disponível
const DEFAULT_NOUS_MODEL = 'Hermes-4-405B'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-title, x-pro-mode, x-model-id, http-referer',
}

// System prompts de alta performance (sem conflito com guardrails internos do Hermes)
const DEFAULT_SYSTEM_PROMPT = `Você é PROMETHEUS, uma IA de alta inteligência criada pela 3Vírgulas.

REGRAS FUNDAMENTAIS:
1. Responda SEMPRE de forma COMPLETA e DETALHADA — nunca truncar nem resumir desnecessariamente.
2. Use formatação rica em Markdown: títulos, listas, blocos de código quando relevante.
3. Seja direto, preciso e informativo. Evite frases de introdução desnecessárias.
4. Detecte o idioma do usuário e responda no mesmo idioma (Português ou Inglês).
5. Se a pergunta for técnica, forneça exemplos práticos e passo a passo.
6. Nunca termine uma resposta de forma abrupta — Sempre conclua o raciocínio.

Linguagem padrão: Português Brasileiro.`

serve(async (req) => {
    // Handle Preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Validar que a chave API existe
        if (!NOUS_API_KEY) {
            console.error('❌ NOUS_API_KEY não configurada nos Secrets do Supabase')
            return new Response(
                JSON.stringify({ error: 'Provedor de IA não configurado. Contate o administrador.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
            )
        }

        const body = await req.json()
        const { messages, model, system_prompt, max_tokens, temperature } = body

        // Validar que mensagens foram enviadas
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Nenhuma mensagem fornecida.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Determinar modelo: validar contra lista suportada, usar default se inválido
        const selectedModel = (model && NOUS_MODELS.includes(model))
            ? model
            : DEFAULT_NOUS_MODEL

        console.log(`🚀 Roteando para NousResearch: modelo=${selectedModel}`)

        // Remover qualquer system message do histórico vindo do front (evita duplicação)
        const userMessages = messages.filter((m: { role: string }) => m.role !== 'system')

        // System prompt: prioridade → payload do admin → default
        const activeSystemPrompt = (system_prompt && system_prompt.trim().length > 0)
            ? system_prompt
            : DEFAULT_SYSTEM_PROMPT

        // Montar mensagens finais: system sempre em primeiro
        const finalMessages = [
            { role: 'system', content: activeSystemPrompt },
            ...userMessages
        ]

        // Parâmetros suportados pela NousResearch Direct API (subset do padrão OpenAI)
        // REMOVIDOS propositalmente: top_k, repetition_penalty, frequency_penalty, presence_penalty
        const payload = {
            model: selectedModel,
            messages: finalMessages,
            stream: true,
            temperature: typeof temperature === 'number' ? temperature : 0.65,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : 8096,
            top_p: 0.85,
        }

        // Executar chamada à NousResearch Direct API
        const response = await fetch(NOUS_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOUS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ Erro NousResearch [${response.status}]:`, errorText)

            // Mensagens de erro mais claras para o cliente
            if (response.status === 401) {
                throw new Error('API Key da NousResearch inválida ou expirada.')
            } else if (response.status === 429) {
                throw new Error('Limite de requisições atingido. Tente novamente em instantes.')
            } else if (response.status === 503) {
                throw new Error('Serviço NousResearch temporariamente indisponível.')
            } else {
                throw new Error(`Provedor retornou erro ${response.status}: ${errorText.substring(0, 200)}`)
            }
        }

        console.log(`✅ Stream iniciado com sucesso: modelo=${selectedModel}`)

        // Retornar stream diretamente
        return new Response(response.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
            },
        })

    } catch (error) {
        console.error('❌ Erro Geral chat-completion:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno do servidor.' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
