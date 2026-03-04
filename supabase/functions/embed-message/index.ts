import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// =====================================================
// embed-message Edge Function — 3Vírgulas
// =====================================================
// Gera embeddings vetoriais (384 dims) para mensagens
// usando o modelo gte-small do Supabase AI runtime
// (sem custo extra, sem API key externa).
// Armazena em message_embeddings para busca semântica.
// Chamada como fire-and-forget pelo frontend após
// cada resposta completa da IA.
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Autenticar usuário
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Authorization ausente' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Token inválido' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        // 2. Receber mensagens para embeddar
        const { messages, chat_id } = await req.json()

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Nenhuma mensagem fornecida' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        console.log(`🔢 [embed-message] Gerando embeddings para ${messages.length} mensagem(s)...`)

        // 3. Inicializar modelo gte-small via Supabase AI
        // Modelo gratuito, 384 dimensões, suporte multilíngue
        const model = new Supabase.ai.Session('gte-small')

        // 4. Gerar e armazenar embeddings para cada mensagem
        const embeddings: {
            user_id: string
            chat_id: string | null
            content: string
            role: string
            embedding: number[]
        }[] = []

        for (const msg of messages) {
            const { role, content } = msg

            // Só embeda mensagens de usuário e assistente (não system)
            if (!content || !['user', 'assistant'].includes(role)) continue

            // Trunca mensagens muito longas para evitar sobrecarga
            const truncatedContent = content.length > 2000
                ? content.substring(0, 2000) + '...'
                : content

            try {
                const rawEmbedding = await model.run(truncatedContent, {
                    mean_pool: true,
                    normalize: true,
                })

                // Converter Float32Array → Array<number> para serialização JSON
                const embeddingArray = Array.from(rawEmbedding as Float32Array)

                embeddings.push({
                    user_id: user.id,
                    chat_id: chat_id || null,
                    content: truncatedContent,
                    role,
                    embedding: embeddingArray,
                })

                console.log(`✅ Embedding gerado: role=${role}, dims=${embeddingArray.length}`)
            } catch (embErr) {
                console.error(`❌ Falha ao gerar embedding para mensagem (role=${role}):`, embErr)
                // Continua com as próximas mensagens
            }
        }

        if (embeddings.length === 0) {
            return new Response(
                JSON.stringify({ skipped: true, reason: 'Nenhum embedding válido gerado' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Inserir em batch no banco
        const { error: insertError } = await supabaseAdmin
            .from('message_embeddings')
            .insert(embeddings)

        if (insertError) {
            throw new Error(`Erro ao inserir embeddings: ${insertError.message}`)
        }

        console.log(`✅ [embed-message] ${embeddings.length} embeddings salvos para usuário ${user.id}`)

        return new Response(
            JSON.stringify({ success: true, count: embeddings.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro embed-message:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
