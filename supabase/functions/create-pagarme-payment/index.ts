// =====================================================
// create-pagarme-payment - Edge Function
// =====================================================
// Gera pedido PIX via Pagar.me V5 para assinatura Premium
// Valor: R$ 34,90 - Plano Premium
// Inclui estratégia de fallback para documento (User -> Owner CNPJ -> Owner CPF)
// =====================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuração do plano Premium
const PREMIUM_PLAN = {
    id: 'premium',
    name: 'Assinatura Premium',
    price: 3490, // em centavos (R$ 34,90) - Pagar.me usa centavos
    duration: 31, // dias
    type: 'premium'
}

// Dados do Proprietário para Fallback
const OWNER_CNPJ = '62176016000107'
const OWNER_CPF = '15592704623'

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        // 1. VERIFICAR VARIÁVEIS DE AMBIENTE
        const PAGARME_API_KEY = Deno.env.get('PAGARME_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!PAGARME_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.error('❌ Credenciais não configuradas (PAGARME_API_KEY)')
            return new Response(
                JSON.stringify({ error: 'Credenciais Pagar.me não configuradas' }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. VERIFICAR AUTENTICAÇÃO
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Token de autenticação não fornecido' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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

        console.log(`📋 Gerando Pedido Pagar.me para usuário: ${user.id}`)

        // 3. LER PAYLOAD
        let isRenewal = false
        try {
            const body = await req.json()
            isRenewal = body.isRenewal || false
        } catch {
            // Body vazio ok
        }

        // 4. BUSCAR PERFIL
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
            return new Response(
                JSON.stringify({ error: 'Erro ao buscar perfil', details: profileError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!profile) {
            return new Response(
                JSON.stringify({
                    error: 'Complete seu perfil antes de assinar',
                    errorCode: 'PROFILE_INCOMPLETE',
                    message: 'Adicione seu número de telefone'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. VALIDAR CELULAR
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

        // Formatação de dados
        const cleanPhone = profile.cellphone.replace(/\D/g, '')
        const countryCode = '55'
        const areaCode = cleanPhone.substring(0, 2)
        const number = cleanPhone.substring(2)
        const customerName = profile.full_name || user.email?.split('@')[0] || 'Cliente'
        const customerEmail = user.email || profile.email

        // FUNÇÃO DE CRIAÇÃO DO PEDIDO (Para Retry)
        async function createOrder(document: string, docType: string) {
            const isCompany = docType.replace(/\D/g, '').length > 11

            const payload = {
                items: [
                    {
                        amount: PREMIUM_PLAN.price,
                        description: PREMIUM_PLAN.name,
                        quantity: 1,
                        code: 'premium_sub'
                    }
                ],
                customer: {
                    name: customerName,
                    email: customerEmail,
                    type: isCompany ? 'company' : 'individual',
                    document: document.replace(/\D/g, ''),
                    phones: {
                        mobile_phone: {
                            country_code: countryCode,
                            area_code: areaCode,
                            number: number
                        }
                    }
                },
                payments: [
                    {
                        payment_method: "pix",
                        pix: {
                            expires_in: 3600,
                            additional_information: [
                                {
                                    name: "Plano",
                                    value: "Premium"
                                }
                            ]
                        }
                    }
                ],
                metadata: {
                    user_id: user.id,
                    plan_type: 'premium',
                    is_renewal: isRenewal ? 'true' : 'false'
                }
            }

            console.log(`📤 Tentando Pagar.me com Doc: ${document} (${isCompany ? 'CNPJ' : 'CPF'})...`)

            const response = await fetch('https://api.pagar.me/core/v5/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(PAGARME_API_KEY + ':')
                },
                body: JSON.stringify(payload)
            })

            const data = await response.json()
            return { ok: response.ok, status: response.status, data }
        }

        // ============================================================
        // LÓGICA DE RETRY (User Doc -> Owner CNPJ -> Owner CPF)
        // ============================================================
        let responseData
        let success = false
        let finalStatus = 400

        // 1. Tentar documento do usuário (se existir)
        if (profile.tax_id) {
            const result = await createOrder(profile.tax_id, profile.tax_id)
            if (result.ok) {
                success = true
                responseData = result.data
            } else {
                console.warn('⚠️ Falha com documento do usuário:', result.data.message)
            }
        } else {
            console.warn('⚠️ Usuário sem documento no perfil.')
        }

        // 2. Tentar Owner CNPJ (se falhou ou não tinha doc)
        if (!success) {
            console.log('🔄 Fallback: Tentando CNPJ do Proprietário...')
            const result = await createOrder(OWNER_CNPJ, OWNER_CNPJ)
            if (result.ok) {
                success = true
                responseData = result.data
            } else {
                console.warn('⚠️ Falha com CNPJ do Proprietário:', result.data.message)
                finalStatus = result.status
                responseData = result.data
            }
        }

        // 3. Tentar Owner CPF (se CNPJ falhou)
        if (!success) {
            console.log('🔄 Fallback: Tentando CPF do Proprietário...')
            const result = await createOrder(OWNER_CPF, OWNER_CPF)
            success = result.ok
            responseData = result.data
            finalStatus = result.status
            if (!success) {
                console.error('❌ Todas as tentativas falharam.')
            }
        }

        if (!success) {
            return new Response(
                JSON.stringify({
                    error: 'Falha ao processar pagamento na Pagar.me',
                    details: responseData,
                    message: responseData?.message || 'Erro ao gerar PIX (Documento recusado)'
                }),
                { status: finalStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📥 Pedido criado com sucesso: ${responseData.id}`)

        // 8. EXTRAIR DADOS DO PIX
        const charge = responseData.charges?.[0]
        const transaction = charge?.last_transaction

        const pixCode = transaction?.qr_code
        const qrCodeUrl = transaction?.qr_code_url
        const orderId = responseData.id

        if (!pixCode) {
            return new Response(
                JSON.stringify({ error: 'QR Code PIX não retornado', details: responseData }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 9. SALVAR NO BANCO
        const expirationDate = new Date()
        expirationDate.setDate(expirationDate.getDate() + PREMIUM_PLAN.duration)
        expirationDate.setHours(23, 59, 59, 999)

        const { data: existingSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('id, status')
            .eq('user_id', user.id)
            .maybeSingle()

        if (existingSubscription) {
            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: isRenewal && existingSubscription.status === 'active' ? existingSubscription.status : 'pending',
                    plan_type: PREMIUM_PLAN.type,
                    plan_name: PREMIUM_PLAN.name,
                    plan_price: PREMIUM_PLAN.price / 100,
                    subscription_expires_at: expirationDate.toISOString(),
                    provider: 'pagarme',
                    transacao_id: orderId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSubscription.id)
        } else {
            await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    status: 'pending',
                    plan_type: PREMIUM_PLAN.type,
                    plan_name: PREMIUM_PLAN.name,
                    plan_price: PREMIUM_PLAN.price / 100,
                    subscription_expires_at: expirationDate.toISOString(),
                    provider: 'pagarme',
                    transacao_id: orderId
                })
        }

        // 10. RETORNAR SUCESSO
        return new Response(
            JSON.stringify({
                success: true,
                pixCode: pixCode,
                qrCodeUrl: qrCodeUrl,
                transaction_id: orderId,
                user_id: user.id,
                amount: PREMIUM_PLAN.price / 100,
                provider: 'pagarme'
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
