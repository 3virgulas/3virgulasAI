// =====================================================
// process-pagarme-webhook - Edge Function
// =====================================================
// Recebe webhook da Pagar.me V5
// Ativa assinatura quando order.paid ou charge.paid
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

    console.log('🔔 WEBHOOK PAGAR.ME RECEBIDO')

    try {
        const payload = await req.json()
        console.log('📦 Payload:', JSON.stringify(payload).substring(0, 1000))

        const eventType = payload.type
        const data = payload.data

        console.log(`Commitment type: ${eventType}`)

        // Verificar se é evento de pagamento aprovado
        // order.paid é o principal para pedidos completos
        // charge.paid também ocorre. Vamos focar no order.paid ou charge.paid com status paid
        if (eventType !== 'order.paid' && eventType !== 'charge.paid') {
            return new Response(
                JSON.stringify({ message: 'Evento ignorado (não é pagamento aprovado)' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Tentar extrair user_id do metadata
        // A estrutura do objeto data depende do evento.
        // Se order.paid -> data é Order.
        // Se charge.paid -> data é Charge, que tem order dentro (mas as vezes nao full).

        let userId = data.metadata?.user_id
        let orderId = data.code || data.id // Pagar.me Order ID (or_...)

        // Se for charge.paid, tentar pegar do order
        if (!userId && data.order) {
            userId = data.order.metadata?.user_id // Se vier aninhado
            if (!orderId) orderId = data.order.id
        }

        if (!userId) {
            console.error('❌ User ID não encontrado no metadata')
            return new Response(
                JSON.stringify({ error: 'User ID não identificado' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`✅ Pagamento confirmado para usuario: ${userId}, Pedido: ${orderId}`)

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Buscar assinatura
        const { data: subscription, error: fetchError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()

        if (fetchError || !subscription) {
            console.error('❌ Assinatura não encontrada')
            return new Response(
                JSON.stringify({ error: 'Assinatura não encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Idempotência
        if (subscription.status === 'active' && subscription.provider === 'pagarme' && subscription.transacao_id === orderId) {
            console.log('ℹ️ Assinatura já ativa para este pedido')
            return new Response(
                JSON.stringify({ message: 'Já processado' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Renovar
        // Se for renovação (verificar metadata.is_renewal)
        // Mas por segurança, sempre somamos 31 dias a partir de agora ou da expiração atual

        const currentExpires = new Date(subscription.subscription_expires_at)
        const now = new Date()
        const isActive = subscription.status === 'active'
        const baseDate = (isActive && currentExpires > now) ? currentExpires : now

        console.log('🔄 Renewal Logic Debug:', {
            status: subscription.status,
            isActive,
            currentExpires: currentExpires.toISOString(),
            now: now.toISOString(),
            baseDate: baseDate.toISOString()
        })

        const newExpires = new Date(baseDate)
        newExpires.setDate(newExpires.getDate() + 31)
        // Ajuste fino: garantir 23:59:59
        newExpires.setHours(23, 59, 59, 999)

        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update({
                status: 'active',
                subscription_expires_at: newExpires.toISOString(),
                transacao_id: orderId,
                provider: 'pagarme',
                updated_at: new Date().toISOString()
            })
            .eq('id', subscription.id)

        if (updateError) {
            console.error('❌ Erro ao atualizar assinatura:', updateError)
            return new Response(
                JSON.stringify({ error: 'Erro ao atualizar banco' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ Assinatura ativada!')
        return new Response(
            JSON.stringify({ success: true, message: 'Assinatura ativada' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (e) {
        console.error('❌ Erro processing webhook:', e)
        return new Response(
            JSON.stringify({ error: 'Internal error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
