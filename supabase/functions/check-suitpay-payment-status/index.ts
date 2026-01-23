// =====================================================
// check-suitpay-payment-status - Edge Function
// =====================================================
// Fallback para polling manual do status do pagamento
// Consulta API SuitPay e ativa assinatura se pago
// Com retry e tratamento de erros HTTP/2
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para chamar SuitPay com retry
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 2
): Promise<Response | null> {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options)
            return response
        } catch (error) {
            console.warn(`⚠️ Tentativa ${i + 1}/${retries + 1} falhou:`, error.message)
            if (i === retries) {
                return null // Todas tentativas falharam
            }
            // Esperar antes de retry (backoff exponencial)
            await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        }
    }
    return null
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const SUITPAY_CLIENT_ID = Deno.env.get('SUITPAY_CLIENT_ID')
        const SUITPAY_CLIENT_SECRET = Deno.env.get('SUITPAY_CLIENT_SECRET')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!SUITPAY_CLIENT_ID || !SUITPAY_CLIENT_SECRET) {
            return new Response(
                JSON.stringify({ success: false, status: 'error', message: 'Configuração incompleta' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar autenticação
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, status: 'error', message: 'Não autenticado' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar usuário
        const supabaseClient = createClient(
            SUPABASE_URL ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(
                JSON.stringify({ success: false, status: 'error', message: 'Usuário não autenticado' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Ler parâmetros (opcional: transactionId)
        let transactionId: string | null = null
        try {
            const body = await req.json()
            transactionId = body.transactionId || body.transaction_id || null
        } catch {
            // Body vazio é OK
        }

        const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // Buscar assinatura do usuário
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()

        // Se já está ativo, retornar sucesso
        if (subscription?.status === 'active') {
            return new Response(
                JSON.stringify({
                    success: true,
                    status: 'active',
                    message: 'Assinatura já está ativa',
                    subscription_expires_at: subscription.subscription_expires_at
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Se não tem assinatura pendente, retornar
        if (!subscription) {
            return new Response(
                JSON.stringify({
                    success: false,
                    status: 'none',
                    message: 'Nenhuma assinatura encontrada'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Obter transaction ID
        const txId = transactionId || subscription.transacao_id
        if (!txId) {
            return new Response(
                JSON.stringify({
                    success: false,
                    status: 'pending',
                    message: 'Aguardando pagamento'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`🔍 Consultando status na SuitPay: ${txId}`)

        // Consultar status na API SuitPay (com retry)
        const suitpayResponse = await fetchWithRetry(
            `https://ws.suitpay.app/api/v1/gateway/consult-status-transaction/${txId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'ci': SUITPAY_CLIENT_ID,
                    'cs': SUITPAY_CLIENT_SECRET
                }
            }
        )

        // Se falhou após retries, retornar pendente (não erro)
        if (!suitpayResponse) {
            console.warn('⚠️ Não foi possível consultar SuitPay, retornando pendente')
            return new Response(
                JSON.stringify({
                    success: false,
                    status: 'pending',
                    message: 'Aguardando pagamento'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const responseText = await suitpayResponse.text()

        if (!suitpayResponse.ok) {
            console.warn('⚠️ SuitPay retornou erro, retornando pendente')
            return new Response(
                JSON.stringify({
                    success: false,
                    status: 'pending',
                    message: 'Aguardando pagamento'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let suitpayData
        try {
            suitpayData = JSON.parse(responseText)
        } catch {
            return new Response(
                JSON.stringify({
                    success: false,
                    status: 'pending',
                    message: 'Aguardando pagamento'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const paymentStatus = suitpayData.statusTransaction || suitpayData.status
        const paidStatuses = ['PAID_OUT', 'PAID', 'APPROVED', 'COMPLETED']
        const isPaid = paidStatuses.includes(paymentStatus?.toUpperCase())

        console.log(`📋 Status: ${paymentStatus} (isPaid: ${isPaid})`)

        if (!isPaid) {
            return new Response(
                JSON.stringify({
                    success: false,
                    status: paymentStatus || 'pending',
                    message: 'Aguardando pagamento'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Pagamento confirmado! Ativar assinatura
        console.log('✅ Pagamento confirmado via polling!')

        // Calcular nova expiração
        const expirationDate = new Date()
        expirationDate.setDate(expirationDate.getDate() + 31)
        expirationDate.setHours(23, 59, 59, 999)

        // Ativar assinatura
        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update({
                status: 'active',
                subscription_expires_at: expirationDate.toISOString(),
                transacao_id: txId,
                updated_at: new Date().toISOString()
            })
            .eq('id', subscription.id)

        if (updateError) {
            console.error('❌ Erro ao ativar:', updateError.message)
            return new Response(
                JSON.stringify({
                    success: false,
                    status: 'error',
                    message: 'Erro ao ativar assinatura'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ Assinatura ativada via fallback!')

        return new Response(
            JSON.stringify({
                success: true,
                status: 'active',
                message: 'Assinatura ativada com sucesso',
                subscription_expires_at: expirationDate.toISOString()
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        // Retorna pendente em vez de erro para não quebrar o fluxo
        console.warn('⚠️ Erro capturado, retornando pendente:', error.message)
        return new Response(
            JSON.stringify({ success: false, status: 'pending', message: 'Aguardando pagamento' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
