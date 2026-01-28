// =====================================================
// check-pagarme-payment-status - Edge Function
// =====================================================
// Verifica manualmente o status do pedido na Pagar.me V5
// Usado para polling no frontend
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

    try {
        const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!PAGARME_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'Configuração incompleta' }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { transactionId } = await req.json() // Aqui recebemos o ID do PEDIDO Pagar.me (or_...)

        if (!transactionId) {
            return new Response(
                JSON.stringify({ error: 'Transaction ID obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`🔍 Verificando status Pedido: ${transactionId}`)

        // Get Order API Pagar.me V5
        const response = await fetch(`https://api.pagar.me/core/v5/orders/${transactionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(PAGARME_API_KEY + ':')
            }
        })

        if (!response.ok) {
            const err = await response.text()
            console.error('❌ Erro Pagar.me API:', err)
            return new Response(
                JSON.stringify({ error: 'Erro ao consultar Pagar.me', details: err }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const order = await response.json()
        const status = order.status // 'paid', 'pending', 'canceled', 'failed'
        console.log(`📊 Status atual: ${status}`)

        let active = false

        if (status === 'paid') {
            active = true

            // Se pagou, vamos garantir que está ativo no banco (caso webhook tenha falhado)
            // Mas precisamos saber quem é o usuario.
            // O Order tem metadata.user_id
            const userId = order.metadata?.user_id

            if (userId) {
                const supabaseAdmin = createClient(
                    SUPABASE_URL ?? '',
                    SUPABASE_SERVICE_ROLE_KEY ?? '',
                    { auth: { autoRefreshToken: false, persistSession: false } }
                )

                const { data: subscription } = await supabaseAdmin
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle()

                if (subscription && subscription.status !== 'active') {
                    console.log('🔄 Atualizando assinatura via polling...')

                    const currentExpires = new Date(subscription.subscription_expires_at)
                    const now = new Date()
                    const baseDate = currentExpires > now ? currentExpires : now
                    const newExpires = new Date(baseDate)
                    newExpires.setDate(newExpires.getDate() + 31)
                    newExpires.setHours(23, 59, 59, 999)

                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            status: 'active',
                            subscription_expires_at: newExpires.toISOString(),
                            transacao_id: transactionId,
                            provider: 'pagarme',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', subscription.id)
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                status: active ? 'active' : 'pending',
                pagarme_status: status
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (e) {
        console.error('❌ Erro check status:', e)
        return new Response(
            JSON.stringify({ error: 'Internal error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
