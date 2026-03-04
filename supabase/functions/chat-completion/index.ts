import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// =====================================================
// Chat Completion Edge Function — 3Vírgulas
// Provedor: NousResearch Direct API
// v3 — Memória Persistente: injeta memory_summary do usuário
// =====================================================

const NOUS_API_KEY = Deno.env.get('NOUS_API_KEY')
const NOUS_API_URL = 'https://inference-api.nousresearch.com/v1/chat/completions'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Modelos confirmados disponíveis na NousResearch Inference API
// Fonte: https://inference-api.nousresearch.com/v1/models
const NOUS_MODELS = [
    'Hermes-4-405B', // Modelo principal — máxima inteligência, raciocínio híbrido
    'Hermes-4-70B',  // Modelo secundário — mais rápido, ótimo custo-benefício
]

const DEFAULT_NOUS_MODEL = 'Hermes-4-405B'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-title, x-pro-mode, x-model-id, http-referer',
}

// System prompt base de alta performance
const BASE_SYSTEM_PROMPT = `Você é PROMETHEUS, uma IA de alta inteligência criada pela 3Vírgulas.

REGRAS FUNDAMENTAIS:
1. Responda SEMPRE de forma COMPLETA e DETALHADA — nunca truncar nem resumir desnecessariamente.
2. Use formatação rica em Markdown: títulos, listas, blocos de código quando relevante.
3. Seja direto, preciso e informativo. Evite frases de introdução desnecessárias.
4. Detecte o idioma do usuário e responda no mesmo idioma (Português ou Inglês).
5. Se a pergunta for técnica, forneça exemplos práticos e passo a passo.
6. Nunca termine uma resposta de forma abrupta — Sempre conclua o raciocínio.

Linguagem padrão: Português Brasileiro.`

// Busca a memória persistente do usuário no banco
async function fetchUserMemory(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('memory_summary, memory_updated_at')
            .eq('id', userId)
            .single()

        if (error || !data?.memory_summary) return null

        return data.memory_summary
    } catch {
        return null // Falha silenciosa — não bloqueia o chat
    }
}

// Monta o system prompt final injetando a memória do usuário
function buildSystemPrompt(basePrompt: string, userMemory: string | null): string {
    if (!userMemory) return basePrompt

    // Tenta parsear o JSON de memória para um formato mais legível
    let memoryBlock = userMemory
    try {
        const parsed = JSON.parse(userMemory)
        const parts: string[] = []

        if (parsed.nome) parts.push(`Nome: ${parsed.nome}`)
        if (parsed.profissao) parts.push(`Profissão: ${parsed.profissao}`)
        if (parsed.interesses?.length) parts.push(`Interesses: ${parsed.interesses.join(', ')}`)
        if (parsed.projetos?.length) parts.push(`Projetos: ${parsed.projetos.join(', ')}`)
        if (parsed.preferencias?.length) parts.push(`Preferências: ${parsed.preferencias.join(', ')}`)
        if (parsed.contexto_geral) parts.push(`\nContexto: ${parsed.contexto_geral}`)

        if (parts.length > 0) {
            memoryBlock = parts.join('\n')
        }
    } catch {
        // Se não for JSON, usa o texto direto
    }

    return `${basePrompt}

---
🧠 MEMÓRIA DO USUÁRIO (informações de conversas anteriores):
${memoryBlock}
---
Use estas informações para personalizar suas respostas. Não mencione explicitamente que tem esta memória a menos que o usuário pergunte.`
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (!NOUS_API_KEY) {
            console.error('❌ NOUS_API_KEY não configurada')
            return new Response(
                JSON.stringify({ error: 'Provedor de IA não configurado.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
            )
        }

        const body = await req.json()
        const { messages, model, system_prompt, max_tokens, temperature } = body

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Nenhuma mensagem fornecida.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Determinar modelo
        const selectedModel = (model && NOUS_MODELS.includes(model))
            ? model
            : DEFAULT_NOUS_MODEL

        // Autenticar usuário para buscar memória
        const authHeader = req.headers.get('Authorization')
        let userMemory: string | null = null

        if (authHeader && SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                const { data: { user } } = await supabaseAdmin.auth.getUser(
                    authHeader.replace('Bearer ', '')
                )
                if (user?.id) {
                    userMemory = await fetchUserMemory(supabaseAdmin, user.id)
                    if (userMemory) {
                        console.log(`🧠 Memória injetada para usuário ${user.id}`)
                    }
                }
            } catch {
                // Falha silenciosa — não bloqueia o chat se memória falhar
                console.warn('⚠️ Não foi possível carregar memória do usuário')
            }
        }

        // Montar system prompt com memória injetada
        const basePrompt = (system_prompt && system_prompt.trim().length > 0)
            ? system_prompt
            : BASE_SYSTEM_PROMPT

        const activeSystemPrompt = buildSystemPrompt(basePrompt, userMemory)

        // Remover system messages do histórico (evita duplicação)
        const userMessages = messages.filter((m: { role: string }) => m.role !== 'system')

        const finalMessages = [
            { role: 'system', content: activeSystemPrompt },
            ...userMessages
        ]

        console.log(`🚀 NousResearch: modelo=${selectedModel} | mensagens=${userMessages.length} | memória=${userMemory ? 'sim' : 'não'}`)

        const payload = {
            model: selectedModel,
            messages: finalMessages,
            stream: true,
            temperature: typeof temperature === 'number' ? temperature : 0.65,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : 8096,
            top_p: 0.85,
        }

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

            if (response.status === 401) throw new Error('API Key da NousResearch inválida ou expirada.')
            if (response.status === 429) throw new Error('Limite de requisições atingido. Tente novamente.')
            if (response.status === 503) throw new Error('Serviço NousResearch temporariamente indisponível.')
            throw new Error(`Provedor retornou erro ${response.status}: ${errorText.substring(0, 200)}`)
        }

        console.log(`✅ Stream iniciado: modelo=${selectedModel}`)

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
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
