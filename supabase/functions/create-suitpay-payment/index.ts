// =====================================================
// create-suitpay-payment - Edge Function
// =====================================================
// Gera QR Code PIX via SuitPay para assinatura Premium
// Valor: R$ 34,90 - Plano Premium
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuração do plano Premium (TESTE - alterar para 34.90 em produção)
const PREMIUM_PLAN = {
    id: 'premium',
    name: 'Premium',
    price: 2.00, // TESTE: R$ 2,00 (mudar para 34.90 em produção)
    duration: 31, // dias
    type: 'premium'
}

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        // 1. VERIFICAR VARIÁVEIS DE AMBIENTE
        const SUITPAY_CLIENT_ID = Deno.env.get('SUITPAY_CLIENT_ID')
        const SUITPAY_CLIENT_SECRET = Deno.env.get('SUITPAY_CLIENT_SECRET')
        const SUITPAY_WEBHOOK_SECRET = Deno.env.get('SUITPAY_WEBHOOK_SECRET')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!SUITPAY_CLIENT_ID || !SUITPAY_CLIENT_SECRET || !SUITPAY_WEBHOOK_SECRET || !SUPABASE_URL) {
            console.error('❌ Credenciais não configuradas')
            return new Response(
                JSON.stringify({ error: 'Credenciais SuitPay não configuradas' }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. VERIFICAR AUTENTICAÇÃO DO USUÁRIO
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Token de autenticação não fornecido' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Cliente Supabase para verificar usuário autenticado
        const supabaseClient = createClient(
            SUPABASE_URL,
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Usuário não autenticado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📋 Gerando PIX para usuário: ${user.id}`)

        // 3. LER PAYLOAD (opcional - para renovação)
        let isRenewal = false
        try {
            const body = await req.json()
            isRenewal = body.isRenewal || false
        } catch {
            // Body vazio ou inválido é OK
        }

        // 4. BUSCAR PERFIL DO USUÁRIO (nome, CPF, telefone)
        const supabaseAdmin = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('full_name, tax_id, cellphone, email')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError) {
            console.error('❌ Erro ao buscar perfil:', profileError.message)
            return new Response(
                JSON.stringify({ error: 'Erro ao buscar perfil', details: profileError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Se perfil não existe, criar um vazio e retornar erro
        if (!profile) {
            console.log('📝 Perfil não existe, criando...')
            await supabaseAdmin
                .from('profiles')
                .insert({ id: user.id, email: user.email })
                .select()
                .maybeSingle()

            return new Response(
                JSON.stringify({
                    error: 'Complete seu perfil antes de assinar',
                    errorCode: 'PROFILE_INCOMPLETE',
                    message: 'Adicione seu número de telefone'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. VALIDAR APENAS CELULAR (nome e CPF são fixos)
        if (!profile.cellphone) {
            return new Response(
                JSON.stringify({
                    error: 'Adicione seu telefone para continuar',
                    errorCode: 'PHONE_REQUIRED',
                    message: 'Precisamos do seu telefone para contato'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Limpar telefone (apenas números)
        const cleanPhone = profile.cellphone.replace(/\D/g, '')
        if (cleanPhone.length < 10) {
            return new Response(
                JSON.stringify({
                    error: 'Telefone inválido',
                    errorCode: 'INVALID_PHONE',
                    message: 'Digite um telefone válido com DDD'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 6. CONSTRUIR CALLBACK URL (onde SuitPay enviará o webhook)
        const callbackUrl = `${SUPABASE_URL}/functions/v1/process-suitpay-webhook?secret=${SUITPAY_WEBHOOK_SECRET}`
        console.log(`📡 Callback URL: ${callbackUrl}`)

        // 7. PREPARAR PAYLOAD PARA SUITPAY
        // Usando CNPJ MEI fixo do proprietário (ou CPF se necessário)
        const OWNER_CNPJ = '62176016000107'  // CNPJ MEI
        const OWNER_CPF = '15592704623'       // Fallback CPF
        const OWNER_NAME = '62.176.016 Gabriel Semiao De Carvalho'

        const requestNumber = isRenewal ? `renewal_${user.id}` : user.id
        const paymentData = {
            requestNumber: requestNumber,
            dueDate: new Date().toISOString().split('T')[0],
            amount: PREMIUM_PLAN.price,
            client: {
                name: OWNER_NAME,
                document: OWNER_CNPJ,  // Tenta CNPJ primeiro
                email: user.email || profile.email
            },
            callbackUrl: callbackUrl
        }

        console.log('📤 Enviando para SuitPay (CNPJ MEI fixo):', JSON.stringify({
            ...paymentData,
            client: { ...paymentData.client, document: '***' }
        }))

        // 8. CHAMAR API SUITPAY
        const suitpayResponse = await fetch('https://ws.suitpay.app/api/v1/gateway/request-qrcode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ci': SUITPAY_CLIENT_ID,
                'cs': SUITPAY_CLIENT_SECRET
            },
            body: JSON.stringify(paymentData)
        })

        const responseText = await suitpayResponse.text()
        console.log(`📥 Resposta SuitPay (${suitpayResponse.status}):`, responseText.substring(0, 500))

        if (!suitpayResponse.ok) {
            // Verificar se é erro de CPF inválido
            if (responseText.toUpperCase().includes('INVALID_DOCUMENT')) {
                return new Response(
                    JSON.stringify({
                        error: 'CPF recusado pela SuitPay',
                        errorCode: 'INVALID_CPF_SUITPAY',
                        message: 'O CPF informado é inválido. Verifique e tente novamente.'
                    }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({
                    error: 'Falha ao gerar pagamento PIX',
                    details: responseText
                }),
                { status: suitpayResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 9. PARSEAR RESPOSTA
        const suitpayData = JSON.parse(responseText)
        const pixCode = suitpayData.paymentCode
        const qrCodeImage = suitpayData.paymentCodeBase64
        const transactionId = suitpayData.idTransaction

        if (!pixCode) {
            console.error('❌ PIX code não retornado:', suitpayData)
            return new Response(
                JSON.stringify({ error: 'PIX code não retornado pela SuitPay' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`✅ PIX gerado! Transaction ID: ${transactionId}`)

        // 10. CRIAR/ATUALIZAR ASSINATURA NO BANCO (status: pending)
        const expirationDate = new Date()
        expirationDate.setDate(expirationDate.getDate() + PREMIUM_PLAN.duration)
        expirationDate.setHours(23, 59, 59, 999)

        const { data: existingSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('id, status')
            .eq('user_id', user.id)
            .maybeSingle()

        if (existingSubscription) {
            // Atualizar assinatura existente
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: isRenewal && existingSubscription.status === 'active'
                        ? existingSubscription.status
                        : 'pending',
                    plan_type: PREMIUM_PLAN.type,
                    plan_name: PREMIUM_PLAN.name,
                    plan_price: PREMIUM_PLAN.price,
                    subscription_expires_at: expirationDate.toISOString(),
                    provider: 'suitpay',
                    transacao_id: transactionId?.toString() || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSubscription.id)

            console.log(`📝 Assinatura atualizada: ${existingSubscription.id}`)
        } else {
            // Criar nova assinatura
            const { data: newSub, error: insertError } = await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    status: 'pending',
                    plan_type: PREMIUM_PLAN.type,
                    plan_name: PREMIUM_PLAN.name,
                    plan_price: PREMIUM_PLAN.price,
                    subscription_expires_at: expirationDate.toISOString(),
                    provider: 'suitpay',
                    transacao_id: transactionId?.toString() || null
                })
                .select()
                .single()

            if (insertError) {
                console.error('❌ Erro ao criar assinatura:', insertError.message)
            } else {
                console.log(`📝 Nova assinatura criada: ${newSub?.id}`)
            }
        }

        // 11. RETORNAR DADOS DO PIX PARA O FRONTEND
        return new Response(
            JSON.stringify({
                success: true,
                pixCode: pixCode,
                qrCodeImage: qrCodeImage,
                transaction_id: transactionId,
                user_id: user.id,
                amount: PREMIUM_PLAN.price,
                plan_name: PREMIUM_PLAN.name,
                expires_in_days: PREMIUM_PLAN.duration
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro interno:', error.message)
        return new Response(
            JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
