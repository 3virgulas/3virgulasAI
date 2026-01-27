
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Tratamento do Preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()
        const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!TAVILY_API_KEY) {
            throw new Error('TAVILY_API_KEY not configured')
        }

        // Criar cliente Supabase com Service Role para acessar e modificar profiles sem restrição de RLS do usuário
        // Isso é seguro pois estamos no backend validando o usuário pelo token
        const supabaseAdmin = createClient(
            SUPABASE_URL ?? '',
            SUPABASE_SERVICE_ROLE_KEY ?? ''
        )

        // 2. Identificar Usuário
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !user) {
            throw new Error('Invalid user token')
        }

        const userId = user.id

        // 3. Buscar Perfil e Verificar Limites
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('research_count, research_limit, research_last_reset')
            .eq('id', userId)
            .single()

        if (profileError) {
            throw new Error('Failed to fetch user profile')
        }

        let currentCount = profile.research_count || 0
        const limit = profile.research_limit || 300 // Default seguro
        const lastReset = profile.research_last_reset ? new Date(profile.research_last_reset) : new Date(0)
        const now = new Date()

        // 4. Lazy Reset (O Pulo do Gato)
        // Se o último reset foi em um mês anterior ao atual
        const isSameMonth = lastReset.getMonth() === now.getMonth() &&
            lastReset.getFullYear() === now.getFullYear()

        if (!isSameMonth) {
            console.log(`[Deep Research] Resetting quota for user ${userId}`)
            // Resetar contadores
            const { error: resetError } = await supabaseAdmin
                .from('profiles')
                .update({
                    research_count: 0,
                    research_last_reset: now.toISOString()
                })
                .eq('id', userId)

            if (resetError) {
                console.error('Error resetting quota:', resetError)
                throw new Error('Failed to reset monthly quota')
            }

            // Atualizar variável local para continuar processamento
            currentCount = 0
        }

        // 5. Verificar Limite
        if (currentCount >= limit) {
            return new Response(JSON.stringify({ error: 'Limite mensal de 300 pesquisas atingido.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            })
        }

        // 6. Executar Pesquisa na Tavily
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: true,
                max_results: 5
            })
        })

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`)
        }

        const data = await response.json()

        // 7. Incrementar Uso (Somente após sucesso)
        const { error: incrementError } = await supabaseAdmin
            .from('profiles')
            .update({ research_count: currentCount + 1 })
            .eq('id', userId)

        if (incrementError) {
            console.error('Failed to increment usage:', incrementError)
            // Não falhamos a requisição se o incremento falhar, mas logamos
        }

        // 8. Formatar Contexto
        let context = ""
        if (data.answer) {
            context += `Summarized Answer: ${data.answer}\n\n`
        }
        if (data.results && Array.isArray(data.results)) {
            context += "Web Search Results:\n"
            data.results.forEach((r: any, index: number) => {
                context += `[${index + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n\n`
            })
        }

        return new Response(JSON.stringify({ context }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Deep Research Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: error.message.includes('Limite') ? 403 : 400,
        })
    }
})
