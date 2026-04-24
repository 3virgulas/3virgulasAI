// =====================================================
// agentic-os-events-webhook - Edge Function
// =====================================================
// Recebe webhooks assíncronos gerados pelo sistema AgenticOS.
// Eventos cobertos: 'sale.completed' e 'lead.created'
// Utiliza criptografia HMAC-SHA256 para prevenir requisições falsas.
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

// Importação segura do crypto padrao Deno
import { createHmac } from "node:crypto"

// Helper function para gerar HMAC-SHA256
async function generateHmacSha256(secret: string, data: string): Promise<string> {
    return createHmac("sha256", secret).update(data).digest("hex");
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agentic-signature',
}

serve(async (req) => {
    // Tratamento de Preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        // Chave secreta pactuada com o AgenticOS para assinar esse Webhook
        const AGENTIC_EVENTS_SECRET = Deno.env.get('AGENTIC_EVENTS_SECRET')

        // 1. Validar e capturar o payload cru para checagem da Assinatura Hash.
        const rawBody = await req.text()
        const agenticSignature = req.headers.get('x-agentic-signature')

        if (AGENTIC_EVENTS_SECRET) {
            if (!agenticSignature) {
                return new Response(
                    JSON.stringify({ status: 'error', message: 'Assinatura x-agentic-signature ausente.' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // A assinatura do AgenticOS costuma ser gerada aplicando HMAC SHA256 no json body.
            const calculatedSignature = await generateHmacSha256(AGENTIC_EVENTS_SECRET, rawBody);

            if (calculatedSignature !== agenticSignature) {
                console.error(`❌ Assinatura inválida. Esperada: ${calculatedSignature}, Recebida: ${agenticSignature}`);
                return new Response(
                    JSON.stringify({ status: 'error', message: 'Assinatura inválida.' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        } else {
            console.warn("⚠️ Aviso: AGENTIC_EVENTS_SECRET não configurado. Validação HMAC pulada.");
        }

        // 2. Transforma o rawBody testado em JSON manipulável
        let payload: any = {}
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            return new Response(
                JSON.stringify({ status: 'error', message: 'Corpo da requisição não é um JSON válido.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { event, created_at, data } = payload

        if (!event || !data) {
            return new Response(
                JSON.stringify({ status: 'error', message: 'Payload inválida. Os campos event e data são obrigatórios.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📥 Recebido novo evento: [${event}] para ${data.email || data.phone || 'Usuário Não-Identificado'}`);

        // 3. Inicializar DB Auth Bypass (Service Role)
        const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // ==========================================================
        // ROUTER DOS EVENTOS
        // ==========================================================
        switch (event) {

            // -------------------------------------------------------------
            // VENDA CONCLUÍDA (Pix pago pelo WhatsApp e reportado via AI)
            // -------------------------------------------------------------
            case 'sale.completed': {
                // Buscamos o usuário usando 'phone' ou 'email'.
                // Retiramos caracteres especiais do celular para normalizar, ou assumimos a literal que vem do db
                let userProfile = null;

                if (data.email) {
                    const { data: profile_email } = await supabaseAdmin.from('profiles').select('id').eq('email', data.email).single();
                    userProfile = profile_email;
                }

                if (!userProfile && data.phone) {
                    const { data: profile_phone } = await supabaseAdmin.from('profiles').select('id').eq('cellphone', data.phone).single();
                    userProfile = profile_phone;
                }

                if (!userProfile) {
                    // Se o usuário não existe no sistema, precisariamos que ele efetuasse login.
                    // Opcionalmente: Você pode convidar/inserir o 'auth.user' automaticamente aqui, enviando email pra ele com uma senha OTP provisória,
                    // mas num fluxo puramente Web, como não sabemos a senha que ele quer colocar e dependemos do UUID do Auth publicamente gerado,
                    // a melhor prática é apenas logar o aviso e criar rotinas futuras.
                    console.error(`⚠️ Venda concluida mas usuario não localizado na tabela profiles usando o email ${data.email} e celular ${data.phone}. O plano pago nao foi ativado localmente.`);
                    return new Response(
                        // Retorna sucesso para o AgenticOS desencanar do retentativa já que o problema não foi técnico lá do lado deles
                        JSON.stringify({ status: 'success', message: 'Evento de venda recebido, mas usuário ainda inexistente no supabase interno.' }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                const userId = userProfile.id;

                // Concede status Premium Ativo por 30 dias a partir da data da compra.
                const grantDays = 30; // Pode parametrizar usando data.plan_duration etc.
                const expirationDate = new Date()
                expirationDate.setDate(expirationDate.getDate() + grantDays)
                expirationDate.setHours(23, 59, 59, 999)

                const { error: upsertError } = await supabaseAdmin
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        status: 'active',
                        plan_type: 'premium',
                        plan_name: data.interest || 'Premium Automático (Zap)',
                        subscription_expires_at: expirationDate.toISOString(),
                        provider: 'agenticos',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })

                if (upsertError) {
                    throw new Error(`Erro ao injetar o premium no upsert da subscriptions: ${upsertError.message}`)
                }

                console.log(`✅ Evento de venda computado no BD! Assinatura ativada no Supabase para ${userId}`);
                break;
            }

            // -------------------------------------------------------------
            // NOVO LEAD (Potencial cliente gerou interesse ou fluxo inicial)
            // -------------------------------------------------------------
            case 'lead.created': {
                // COMO NÃO EXISTE a tabela `leads`, e sob sua instrução de achar a melhor tabela local, 
                // vamos inserir os dados do novo interessado em nossa base principal "profiles" se ele ainda não estiver lá.
                // Mas, há uma pegadinha: No supabase o perfil só existe quando associado a um 'auth.user'.
                // Como um LEAD puro não completou onboarding no Auth, não podemos espreme-lo na tabela "profiles" amarrado nativamente ao Auth.users id.
                console.log(`📝 Novo lead recebido: ${data.name} / ${data.phone}`);
                console.warn(`⏳ Sem uma tabela focada no stage de "leads crus", este insight está temporariamente apenas monitorado via Log e Dashboard Webhooks. Insira aqui a injeção ao Active Campaign ou Pipedrive pelo Node.js se desejar!`)

                // Exemplo prático de uma possível rota, que se você quisesse nós conectariamos numa API externa:
                // await fetch('https://minha-api.activecampaign.com/api/3/contacts', ...)

                break;
            }

            default:
                console.log(`ℹ️ Evento do tipo ${event} ignorado.`)
        }

        // Webhooks geralmente requerem que o endpoint responda com 200 OK rapido para confirmar recebimento e não ficarem retentando a exaustao
        return new Response(
            JSON.stringify({ status: 'success', message: `Evento ${event} processado.` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro massivo no Event Webhook:', error.message)
        return new Response(
            JSON.stringify({ status: 'error', message: `Internal server crash: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
