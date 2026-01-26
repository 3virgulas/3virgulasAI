
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

        if (!TAVILY_API_KEY) {
            throw new Error('TAVILY_API_KEY not configured')
        }

        // 2. Requisição para a Tavily
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

        // Check if response is ok before parsing
        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`)
        }

        const data = await response.json()

        // 3. Formatar contexto (Crucial para a IA não alucinar)
        // Estamos mantendo o formato esperado pelo frontend ({ context: string })
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

        // 4. Retorno com Sucesso + CORS
        return new Response(JSON.stringify({ context }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        // 5. Retorno de Erro + CORS
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
