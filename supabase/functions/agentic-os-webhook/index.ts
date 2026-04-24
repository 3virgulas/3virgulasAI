// =====================================================
// smart-actions-webhook - Edge Function para AgenticOS
// =====================================================
// Recebe requisições via POST do AgenticOS de WhatsApp.
// Executa ações na conta de usuários via auth admin e database admin API.
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const AGENT_WEBHOOK_SECRET = Deno.env.get('AGENT_WEBHOOK_SECRET')

        // 1. Verificar Autenticação do AgenticOS
        // Recomendamos que o AgenticOS envie um Bearer Token em conformidade com o formato esperado de Auth ou envia-lo no custom header.
        const authHeader = req.headers.get('Authorization')

        if (AGENT_WEBHOOK_SECRET) {
            if (!authHeader || authHeader.replace('Bearer ', '') !== AGENT_WEBHOOK_SECRET) {
                return new Response(
                    JSON.stringify({ status: 'error', message: 'Token de autorização do webhook inválido ou ausente.' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        } else {
            console.warn("Aviso: AGENT_WEBHOOK_SECRET não está defindo nas variáveis de ambiente. Recomendável para segurança.");
        }

        // 2. Inicializar Client Admin (Service Role)
        const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // 3. Ler parâmetros enviados pelo AgenticOS
        // Para investigar o formato exato que a IA envia, logar o payload completo:
        const bodyText = await req.text()
        console.log(`📥 Full Request Text Recebido:`, bodyText)

        // Tentar parse para JSON
        let body: any = {}
        try {
            if (bodyText) body = JSON.parse(bodyText)
        } catch (e) {
            console.error("❌ Erro ao parsear o JSON do request:", e)
        }

        // IAs e Webhooks diferentes enviam os dados em diferentes formatos. 
        // Pelo log recebido, o AgenticOS empacota os dados usando o próprio NAome da Ferramenta como chave (GerenciarConta3Virgulas).
        let args: any = body;
        try {
            // Se o AgenticOS envia a string json dentro do nome da action:
            if (body.GerenciarConta3Virgulas) {
                args = typeof body.GerenciarConta3Virgulas === 'string'
                    ? JSON.parse(body.GerenciarConta3Virgulas)
                    : body.GerenciarConta3Virgulas;
            }
            // Fallbacks clássicos de IA
            else if (body.arguments) {
                args = typeof body.arguments === 'string' ? JSON.parse(body.arguments) : body.arguments;
            } else if (body.parameters) {
                args = typeof body.parameters === 'string' ? JSON.parse(body.parameters) : body.parameters;
            } else if (body.args) {
                args = typeof body.args === 'string' ? JSON.parse(body.args) : body.args;
            }

            // Tenta decodificar o próprio dict caso tenha vindo escapado na root
            if (typeof args === 'string') {
                args = JSON.parse(args)
            }
        } catch (e) {
            console.error("❌ Erro ao tentar extrair argumentos internos:", e)
        }

        const action = args?.action || body?.action
        const email = args?.email || body?.email
        const new_password = args?.new_password || body?.new_password
        const days = args?.days || body?.days

        console.log(`📥 Valores extraídos: action=${action}, email=${email}`)

        if (!action || !email) {
            console.error(`❌ Request inválido faltando campos: action=${action}, email=${email}`)
            return new Response(
                JSON.stringify({ status: 'error', message: 'Os campos "action" e "email" são obrigatórios.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Buscar usuário pelo email usando a tabela de Perfis
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single()

        if (profileError || !profile) {
            console.error(`❌ Usuário não encontrado na tabela profiles para o email: ${email}. Erro:`, profileError)
            return new Response(
                JSON.stringify({ status: 'error', message: `Não localizei nenhum usuário cadastrado com o email ${email}.` }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const userId = profile.id;

        // 5. Roteamento de Ações Inteligentes (Universal Dispatcher)
        switch (action) {
            case 'change_password': {
                if (!new_password) {
                    console.error(`❌ Campo 'new_password' não foi enviado pela IA para o email: ${email}`)
                    return new Response(
                        JSON.stringify({ status: 'error', message: 'O campo "new_password" é obrigatório para mudar a senha.' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    password: new_password
                })

                if (authError) {
                    console.error('Erro ao atualizar senha:', authError.message)
                    return new Response(
                        JSON.stringify({ status: 'error', message: `Tive um problema ao mudar a senha: ${authError.message}` }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                console.log(`✅ Senha alterada com sucesso para o usuário: ${email}`)
                return new Response(
                    JSON.stringify({
                        status: 'success',
                        message: `Senha alterada com sucesso. Pode informar ao humano que a nova senha dele já está ativa e é: ${new_password}`
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'grant_premium': {
                const grantDays = parseInt(days) || 30
                const expirationDate = new Date()
                expirationDate.setDate(expirationDate.getDate() + grantDays)
                expirationDate.setHours(23, 59, 59, 999)

                const { error: upsertError } = await supabaseAdmin
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        status: 'active',
                        plan_type: 'premium',
                        plan_name: 'Premium',
                        plan_price: 34.90, // valor default
                        subscription_expires_at: expirationDate.toISOString(),
                        provider: 'manual',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })

                if (upsertError) {
                    console.error('Erro ao ativar premium:', upsertError.message)
                    return new Response(
                        JSON.stringify({ status: 'error', message: `Erro ao ativar a assinatura no banco de dados: ${upsertError.message}` }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                console.log(`✅ Premium concedido para: ${email} (${grantDays} dias)`)
                return new Response(
                    JSON.stringify({
                        status: 'success',
                        message: `A assinatura Premium foi ativada com sucesso para os próximos ${grantDays} dias.`
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'cancel_subscription': {
                const { error: cancelError } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)

                if (cancelError) {
                    console.error('Erro ao cancelar:', cancelError.message)
                    return new Response(
                        JSON.stringify({ status: 'error', message: `Erro ao cancelar a assinatura: ${cancelError.message}` }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                console.log(`❌ Assinatura cancelada via Agent para: ${email}`)
                return new Response(
                    JSON.stringify({
                        status: 'success',
                        message: `A assinatura vinculada ao email foi cancelada com sucesso no sistema.`
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            default:
                console.error(`❌ Ação não reconhecida enviada pela IA: ${action}`)
                return new Response(
                    JSON.stringify({ status: 'error', message: `Ação não reconhecida: ${action}. Eu como inteligência devo reportar que as ações suportadas são change_password, grant_premium e cancel_subscription.` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
        }

    } catch (error) {
        console.error('❌ Erro no Agentic Webhook:', error.message)
        return new Response(
            JSON.stringify({ status: 'error', message: `Ocorreu um erro interno: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
