// =====================================================
// admin-manage-subscription - Edge Function
// =====================================================
// Gerencia assinaturas (ativar, cancelar, adicionar dias)
// Usa service_role para bypass RLS
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'contato@3virgulas.com'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        // Verificar autenticação
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Não autenticado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar se é admin
        const supabaseClient = createClient(
            SUPABASE_URL ?? '',
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

        if (user.email !== ADMIN_EMAIL) {
            return new Response(
                JSON.stringify({ error: 'Acesso negado. Apenas admin.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Ler payload
        const body = await req.json()
        const { action, subscriptionId, days } = body

        if (!action) {
            return new Response(
                JSON.stringify({ error: 'Action é obrigatória' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Client com service_role para bypass RLS
        const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // =====================================================
        // TRATAMENTO DA AÇÃO "GRANT_PREMIUM" (Por UserID)
        // =====================================================
        if (action === 'grant_premium') {
            const targetUserId = body.userId
            const grantDays = parseInt(days) || 30

            if (!targetUserId) {
                return new Response(
                    JSON.stringify({ error: 'UserId obrigatório para grant_premium' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const expirationDate = new Date()
            expirationDate.setDate(expirationDate.getDate() + grantDays)
            expirationDate.setHours(23, 59, 59, 999)

            // Upsert na tabela subscriptions
            const { error: upsertError } = await supabaseAdmin
                .from('subscriptions')
                .upsert({
                    user_id: targetUserId,
                    status: 'active',
                    plan_type: 'premium',
                    plan_name: 'Premium',
                    plan_price: 34.90,
                    subscription_expires_at: expirationDate.toISOString(),
                    provider: 'manual',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' })

            if (upsertError) {
                console.error('Erro no upsert:', upsertError)
                throw upsertError
            }

            console.log(`✅ Premium concedido para: ${targetUserId} (${grantDays} dias)`)
            return new Response(
                JSON.stringify({
                    success: true,
                    message: `Premium concedido por ${grantDays} dias`,
                    new_status: 'active'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // =====================================================
        // OUTRAS AÇÕES (Por SubscriptionID)
        // =====================================================

        if (!subscriptionId) {
            return new Response(
                JSON.stringify({ error: 'subscriptionId obrigatório para esta ação' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Buscar assinatura atual
        const { data: subscription, error: fetchError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('id', subscriptionId)
            .single()

        if (fetchError || !subscription) {
            return new Response(
                JSON.stringify({ error: 'Assinatura não encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let updateData: Record<string, any> = { updated_at: new Date().toISOString() }

        switch (action) {
            case 'add_days': {
                const daysToAdd = parseInt(days) || 30
                const currentExpiration = subscription.subscription_expires_at
                    ? new Date(subscription.subscription_expires_at)
                    : new Date()

                currentExpiration.setDate(currentExpiration.getDate() + daysToAdd)
                updateData.subscription_expires_at = currentExpiration.toISOString()

                // Se adicionar dias e estava expirado/cancelado, reativar
                if (daysToAdd > 0 && ['expired', 'canceled'].includes(subscription.status)) {
                    updateData.status = 'active'
                }

                console.log(`📅 ${daysToAdd > 0 ? '+' : ''}${daysToAdd} dias para ${subscriptionId}`)
                break
            }

            case 'subtract_days': {
                const daysToSubtract = Math.abs(parseInt(days) || 7)
                const currentExpiration = subscription.subscription_expires_at
                    ? new Date(subscription.subscription_expires_at)
                    : new Date()

                currentExpiration.setDate(currentExpiration.getDate() - daysToSubtract)
                updateData.subscription_expires_at = currentExpiration.toISOString()

                // Verificar se expirou
                if (currentExpiration < new Date()) {
                    updateData.status = 'expired'
                }

                console.log(`📅 -${daysToSubtract} dias para ${subscriptionId}`)
                break
            }

            case 'activate': {
                const expirationDate = new Date()
                expirationDate.setDate(expirationDate.getDate() + 31)
                expirationDate.setHours(23, 59, 59, 999)

                updateData.status = 'active'
                updateData.subscription_expires_at = expirationDate.toISOString()

                console.log(`✅ Ativação manual: ${subscriptionId}`)
                break
            }

            case 'cancel': {
                updateData.status = 'canceled'
                console.log(`❌ Cancelado: ${subscriptionId}`)
                break
            }

            case 'ban': {
                updateData.status = 'banned'
                console.log(`🚫 Banido: ${subscriptionId}`)
                break
            }

            case 'expire': {
                updateData.status = 'expired'
                console.log(`⏰ Expirado manualmente: ${subscriptionId}`)
                break
            }

            default:
                return new Response(
                    JSON.stringify({ error: `Ação desconhecida: ${action}` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
        }

        // Aplicar atualização
        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update(updateData)
            .eq('id', subscriptionId)

        if (updateError) {
            console.error('❌ Erro ao atualizar:', updateError.message)
            return new Response(
                JSON.stringify({ error: 'Erro ao atualizar assinatura', details: updateError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Ação '${action}' executada com sucesso`,
                subscription_id: subscriptionId,
                new_status: updateData.status || subscription.status,
                new_expiration: updateData.subscription_expires_at || subscription.subscription_expires_at
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro:', error.message)
        return new Response(
            JSON.stringify({ error: 'Erro interno', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
