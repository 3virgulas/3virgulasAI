import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// =====================================================
// save-memory Edge Function — 3Vírgulas
// =====================================================
// Gera um resumo compacto da conversa atual usando o
// NousResearch e salva na tabela profiles.memory_summary.
// Chamada pelo frontend quando o usuário inicia uma nova
// conversa (se a conversa anterior teve ≥ 6 mensagens).
// =====================================================

const NOUS_API_KEY = Deno.env.get('NOUS_API_KEY')
const NOUS_API_URL = 'https://inference-api.nousresearch.com/v1/chat/completions'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Prompt para gerar resumo compacto
const MEMORY_EXTRACTOR_PROMPT = `Você é um extrator de memória de alta precisão.

Analise a conversa abaixo e extraia APENAS informações FACTUAIS e DURADOURAS sobre o USUÁRIO.
Ignore detalhes triviais, perguntas genéricas e respostas da IA.

Formate a saída EXATAMENTE assim (JSON puro, sem markdown):
{
  "nome": "Nome do usuário se mencionado, senão null",
  "profissao": "Profissão ou área de atuação se mencionada, senão null",
  "interesses": ["lista", "de", "interesses", "identificados"],
  "projetos": ["projetos", "mencionados"],
  "preferencias": ["preferências", "identificadas"],
  "contexto_geral": "Um parágrafo resumindo o perfil e histórico do usuário em 2-3 frases."
}

REGRAS:
- Inclua apenas informações EXPLICITAMENTE ditas pelo usuário
- Se não houver informação suficiente para um campo, use null ou []
- Seja conciso — máximo 500 tokens no total
- Responda APENAS com o JSON, sem texto antes ou depois`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!NOUS_API_KEY) {
      throw new Error('NOUS_API_KEY não configurada')
    }

    // 1. Autenticar usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header ausente' }),
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

    // 2. Receber mensagens da conversa
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length < 4) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Conversa muito curta para gerar memória' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🧠 Gerando memória para usuário ${user.id} (${messages.length} mensagens)`)

    // 3. Buscar memória existente (para fazer merge, não sobrescrever)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('memory_summary')
      .eq('id', user.id)
      .single()

    const existingMemory = profile?.memory_summary || null

    // 4. Preparar conversa para extração (apenas user + assistant, últimas 40 mensagens)
    const conversationText = messages
      .filter((m: { role: string }) => m.role !== 'system')
      .slice(-40)
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? 'USUÁRIO' : 'IA'}: ${m.content}`
      )
      .join('\n\n')

    // 5. Chamar NousResearch para extrair memória
    // Usamos Hermes-4-70B (mais rápido e econômico para esta tarefa)
    const extractionMessages: { role: string; content: string }[] = [
      { role: 'system', content: MEMORY_EXTRACTOR_PROMPT },
    ]

    if (existingMemory) {
      extractionMessages.push({
        role: 'system',
        content: `Memória prévia do usuário (faça MERGE com as novas informações):\n${existingMemory}`
      })
    }

    extractionMessages.push({
      role: 'user',
      content: `Conversa a analisar:\n\n${conversationText}`
    })

    const nousResponse = await fetch(NOUS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Hermes-4-70B',
        messages: extractionMessages,
        stream: false,
        temperature: 0.2,    // Baixa temperatura para extração factual precisa
        max_tokens: 600,
      })
    })

    if (!nousResponse.ok) {
      const err = await nousResponse.text()
      throw new Error(`NousResearch error ${nousResponse.status}: ${err}`)
    }

    const nousData = await nousResponse.json()
    const rawMemory = nousData.choices?.[0]?.message?.content?.trim() || ''

    if (!rawMemory) {
      throw new Error('Resposta vazia do extrator de memória')
    }

    // 6. Salvar no banco
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        memory_summary: rawMemory,
        memory_updated_at: new Date().toISOString(),
      })

    if (updateError) {
      throw new Error(`Erro ao salvar memória: ${updateError.message}`)
    }

    console.log(`✅ Memória salva para usuário ${user.id}`)

    return new Response(
      JSON.stringify({ success: true, memory: rawMemory }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro save-memory:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
