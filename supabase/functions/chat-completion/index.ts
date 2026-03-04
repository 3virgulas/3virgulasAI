import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// =====================================================
// Chat Completion Edge Function — 3Vírgulas
// Provedor: NousResearch Direct API
// v4 — RAG: busca semântica + memória persistente
// =====================================================

const NOUS_API_KEY = Deno.env.get('NOUS_API_KEY')
const NOUS_API_URL = 'https://inference-api.nousresearch.com/v1/chat/completions'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const NOUS_MODELS = ['Hermes-4-405B', 'Hermes-4-70B']
const DEFAULT_NOUS_MODEL = 'Hermes-4-405B'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-title, x-pro-mode, x-model-id, http-referer',
}

const BASE_SYSTEM_PROMPT = `Você é PROMETHEUS, uma IA de alta inteligência criada pela 3Vírgulas.

REGRAS FUNDAMENTAIS:
1. Responda SEMPRE de forma COMPLETA e DETALHADA — nunca truncar nem resumir.
2. Use formatação rica em Markdown: títulos, listas, blocos de código quando relevante.
3. Seja direto, preciso e informativo. Evite frases de introdução desnecessárias.
4. Detecte o idioma do usuário e responda no mesmo idioma (Português ou Inglês).
5. Se a pergunta for técnica, forneça exemplos práticos e passo a passo.
6. Nunca termine uma resposta de forma abrupta — Sempre conclua o raciocínio.

Linguagem padrão: Português Brasileiro.`

// ─── Memória Persistente (Level 2) ───────────────────────────────────────────
async function fetchUserMemory(
    supabaseAdmin: ReturnType<typeof createClient>,
    userId: string
): Promise<string | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('memory_summary')
            .eq('id', userId)
            .single()
        if (error || !data?.memory_summary) return null
        return data.memory_summary
    } catch { return null }
}

function formatMemoryBlock(rawMemory: string): string {
    let block = rawMemory
    try {
        const p = JSON.parse(rawMemory)
        const parts: string[] = []
        if (p.nome) parts.push(`Nome: ${p.nome}`)
        if (p.profissao) parts.push(`Profissão: ${p.profissao}`)
        if (p.interesses?.length) parts.push(`Interesses: ${p.interesses.join(', ')}`)
        if (p.projetos?.length) parts.push(`Projetos: ${p.projetos.join(', ')}`)
        if (p.preferencias?.length) parts.push(`Preferências: ${p.preferencias.join(', ')}`)
        if (p.contexto_geral) parts.push(`\nContexto: ${p.contexto_geral}`)
        if (parts.length > 0) block = parts.join('\n')
    } catch { /* usa texto raw */ }
    return block
}

// ─── RAG Semântico (Level 3) ─────────────────────────────────────────────────
async function fetchSemanticMemories(
    supabaseAdmin: ReturnType<typeof createClient>,
    userId: string,
    queryText: string
): Promise<string | null> {
    try {
        // Gerar embedding para a query atual usando gte-small (384 dims)
        const model = new Supabase.ai.Session('gte-small')
        const queryEmbedding = await model.run(queryText.substring(0, 1000), {
            mean_pool: true,
            normalize: true,
        })
        const embeddingArray = Array.from(queryEmbedding as Float32Array)

        // Busca semântica por similaridade de cosseno
        const { data: memories, error } = await supabaseAdmin.rpc('match_messages', {
            query_embedding: embeddingArray,
            match_user_id: userId,
            match_threshold: 0.72,
            match_count: 6,
        })

        if (error || !memories || memories.length === 0) return null

        console.log(`🔍 RAG: ${memories.length} memórias semânticas encontradas`)

        // Formatar as memórias recuperadas para injeção no prompt
        const formatted = memories
            .map((m: { role: string; content: string; similarity: number }) => {
                const roleLabel = m.role === 'user' ? '👤 Usuário disse' : '🤖 IA respondeu'
                const simPct = Math.round(m.similarity * 100)
                return `[Relevância: ${simPct}%] ${roleLabel}:\n"${m.content.substring(0, 400)}${m.content.length > 400 ? '...' : ''}"`
            })
            .join('\n\n')

        return formatted
    } catch (err) {
        console.warn('⚠️ RAG semântico falhou (silencioso):', err)
        return null
    }
}

// ─── Montagem do System Prompt Final ─────────────────────────────────────────
function buildSystemPrompt(
    basePrompt: string,
    userMemory: string | null,
    semanticMemories: string | null
): string {
    let prompt = basePrompt
    const sections: string[] = []

    if (userMemory) {
        sections.push(`🧠 PERFIL DO USUÁRIO (memórias persistentes):\n${userMemory}`)
    }

    if (semanticMemories) {
        sections.push(`📖 CONTEXTO RELEVANTE DE CONVERSAS PASSADAS:\n${semanticMemories}`)
    }

    if (sections.length > 0) {
        prompt += `\n\n${'─'.repeat(60)}\n${sections.join('\n\n' + '─'.repeat(60) + '\n')}\n${'─'.repeat(60)}\nUSE as informações acima para contextualizar suas respostas.\nNADA disso precisa ser mencionado explicitamente ao usuário.`
    }

    return prompt
}

// ─── Handler Principal ────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (!NOUS_API_KEY) {
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

        const selectedModel = (model && NOUS_MODELS.includes(model)) ? model : DEFAULT_NOUS_MODEL

        // Autenticar e buscar memória + RAG
        const authHeader = req.headers.get('Authorization')
        let userMemory: string | null = null
        let semanticMemories: string | null = null

        if (authHeader && SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                const { data: { user } } = await supabaseAdmin.auth.getUser(
                    authHeader.replace('Bearer ', '')
                )

                if (user?.id) {
                    // Extrai a última mensagem do usuário para a busca semântica
                    const lastUserMsg = [...messages]
                        .reverse()
                        .find((m: { role: string }) => m.role === 'user')

                    // Executar Level 2 (memória persistente) + Level 3 (RAG) em paralelo
                    const [memory, rag] = await Promise.allSettled([
                        fetchUserMemory(supabaseAdmin, user.id),
                        lastUserMsg?.content
                            ? fetchSemanticMemories(supabaseAdmin, user.id, lastUserMsg.content)
                            : Promise.resolve(null),
                    ])

                    userMemory = memory.status === 'fulfilled' ? memory.value : null
                    semanticMemories = rag.status === 'fulfilled' ? rag.value : null

                    if (userMemory) userMemory = formatMemoryBlock(userMemory)

                    console.log(`🧠 Memória persistente: ${userMemory ? 'sim' : 'não'} | 🔍 RAG: ${semanticMemories ? 'sim' : 'não'}`)
                }
            } catch {
                console.warn('⚠️ Falha ao carregar contexto de memória (silenciosa)')
            }
        }

        // Montar system prompt com Level 2 + Level 3
        const basePrompt = (system_prompt?.trim().length > 0) ? system_prompt : BASE_SYSTEM_PROMPT
        const activeSystemPrompt = buildSystemPrompt(basePrompt, userMemory, semanticMemories)

        // Filtrar system messages do histórico (evita duplicação)
        const userMessages = messages.filter((m: { role: string }) => m.role !== 'system')

        const finalMessages = [
            { role: 'system', content: activeSystemPrompt },
            ...userMessages
        ]

        console.log(`🚀 NousResearch: ${selectedModel} | msgs=${userMessages.length} | mem=${userMemory ? '✓' : '✗'} | rag=${semanticMemories ? '✓' : '✗'}`)

        const response = await fetch(NOUS_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOUS_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: finalMessages,
                stream: true,
                temperature: typeof temperature === 'number' ? temperature : 0.65,
                max_tokens: typeof max_tokens === 'number' ? max_tokens : 8096,
                top_p: 0.85,
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ Erro NousResearch [${response.status}]:`, errorText)
            if (response.status === 401) throw new Error('API Key da NousResearch inválida ou expirada.')
            if (response.status === 429) throw new Error('Limite de requisições atingido. Tente novamente.')
            if (response.status === 503) throw new Error('Serviço NousResearch temporariamente indisponível.')
            throw new Error(`Erro ${response.status}: ${errorText.substring(0, 200)}`)
        }

        console.log(`✅ Stream iniciado: ${selectedModel}`)

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
