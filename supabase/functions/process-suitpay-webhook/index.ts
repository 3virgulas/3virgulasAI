// =====================================================
// process-suitpay-webhook - Edge Function
// =====================================================
// Recebe confirmação de pagamento da SuitPay
// Ativa a assinatura Premium quando status = PAID_OUT
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    console.log('🔔 WEBHOOK SUITPAY RECEBIDO')
    console.log(`📅 Timestamp: ${new Date().toISOString()}`)

    try {
        // Validar método HTTP
        if (req.method !== 'POST') {
            console.warn('⚠️ Método não permitido:', req.method)
            return new Response(
                JSON.stringify({ error: 'Method not allowed' }),
                { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validar secret (opcional mas recomendado)
        const url = new URL(req.url)
        const secretParam = url.searchParams.get('secret')
        const expectedSecret = Deno.env.get('SUITPAY_WEBHOOK_SECRET')

        if (expectedSecret && secretParam !== expectedSecret) {
            console.warn('⚠️ Secret inválido')
            return new Response(
                JSON.stringify({ error: 'Invalid secret' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Ler payload
        const rawBody = await req.text()
        console.log('📦 Payload recebido:', rawBody)

        let webhookData
        try {
            webhookData = JSON.parse(rawBody)
        } catch (e) {
            console.error('❌ JSON inválido')
            return new Response(
                JSON.stringify({ error: 'JSON inválido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Extrair dados do payload (suporta múltiplos formatos)
        const transactionId = webhookData.idTransaction || webhookData.id_transaction || webhookData.transactionId
        const paymentStatus = webhookData.statusTransaction || webhookData.status || webhookData.paymentStatus
        const userId = webhookData.requestNumber || webhookData.request_number || webhookData.externalId
        const amount = webhookData.value || webhookData.amount

        console.log('📋 Dados extraídos:')
        console.log('  - Transaction ID:', transactionId)
        console.log('  - Status:', paymentStatus)
        console.log('  - User ID (requestNumber):', userId)
        console.log('  - Amount:', amount)

        if (!transactionId || !paymentStatus || !userId) {
            console.error('❌ Campos obrigatórios faltando')
            return new Response(
                JSON.stringify({ error: 'Campos obrigatórios faltando', received: webhookData }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Detectar se é renovação (requestNumber começa com 'renewal_')
        const isRenewal = userId.startsWith('renewal_')
        const actualUserId = isRenewal ? userId.replace('renewal_', '') : userId

        // Verificar se pagamento foi aprovado
        const paidStatuses = ['PAID_OUT', 'PAID', 'APPROVED', 'COMPLETED']
        if (!paidStatuses.includes(paymentStatus.toUpperCase())) {
            console.log(`⏳ Pagamento não confirmado ainda. Status: ${paymentStatus}`)
            return new Response(
                JSON.stringify({
                    message: 'Webhook recebido, aguardando pagamento',
                    status: paymentStatus
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ PAGAMENTO CONFIRMADO!')

        // Criar cliente Supabase Admin
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Buscar assinatura do usuário
        const { data: subscription, error: fetchError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', actualUserId)
            .maybeSingle()

        if (fetchError || !subscription) {
            console.error('❌ Assinatura não encontrada para user_id:', actualUserId)

            // Tentar buscar por transação
            const { data: subByTx } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('transacao_id', transactionId?.toString())
                .maybeSingle()

            if (subByTx) {
                console.log('📋 Assinatura encontrada por transacao_id:', subByTx.id)
                // Continuar com esta assinatura
            } else {
                return new Response(
                    JSON.stringify({ error: 'Assinatura não encontrada' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        const sub = subscription || (await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('transacao_id', transactionId?.toString())
            .single()).data

        console.log('📋 Assinatura encontrada:', sub?.id)

        // Verificar idempotência (evitar processar 2x)
        if (sub?.status === 'active' && !isRenewal) {
            console.log('ℹ️ Assinatura já ativa - idempotência')
            return new Response(
                JSON.stringify({ message: 'Assinatura já está ativa' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Calcular nova data de expiração
        let expirationDate: Date
        if (isRenewal && sub?.subscription_expires_at) {
            // Renovação: adicionar 31 dias à data atual de expiração (ou agora, se já expirou)
            const currentExpiration = new Date(sub.subscription_expires_at)
            const now = new Date()
            const baseDate = currentExpiration > now ? currentExpiration : now
            expirationDate = new Date(baseDate)
            expirationDate.setDate(expirationDate.getDate() + 31)
        } else {
            // Nova assinatura: 31 dias a partir de agora
            expirationDate = new Date()
            expirationDate.setDate(expirationDate.getDate() + 31)
        }
        expirationDate.setHours(23, 59, 59, 999)

        console.log('📅 Nova data de expiração:', expirationDate.toISOString())

        // Atualizar assinatura para ATIVA
        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update({
                status: 'active',
                subscription_expires_at: expirationDate.toISOString(),
                transacao_id: transactionId?.toString() || sub?.transacao_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', sub?.id)

        if (updateError) {
            console.error('❌ Erro ao atualizar assinatura:', updateError.message)
            return new Response(
                JSON.stringify({ error: 'Falha ao ativar assinatura' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ ASSINATURA ATIVADA COM SUCESSO!')
        console.log(`  - User ID: ${actualUserId}`)
        console.log(`  - Expira em: ${expirationDate.toISOString()}`)
        console.log(`  - Transaction ID: ${transactionId}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Assinatura ativada com sucesso',
                user_id: actualUserId,
                expires_at: expirationDate.toISOString(),
                transaction_id: transactionId,
                is_renewal: isRenewal
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro no webhook:', error.message)
        return new Response(
            JSON.stringify({ error: 'Erro interno', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
