// =====================================================
// admin-delete-user - Edge Function
// =====================================================
// Deleta um usuário completamente (Auth + Banco)
// Usa service_role para bypass RLS e Auth Admin API
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

        // 1. Verificar Autenticação do Solicitante
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Não autenticado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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

        // 2. Verificar se solicitante é Admin
        if (user.email !== ADMIN_EMAIL) {
            return new Response(
                JSON.stringify({ error: 'Acesso negado. Apenas admin.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Ler parâmetros
        const { userId } = await req.json()
        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'UserId é obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Inicializar Client Admin (Service Role)
        const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // 5. Deletar do Auth (Isso deve gerar cascade dependendo da config, mas vamos garantir)
        // A deleção do Auth User geralmente limpa as tabelas public.profiles se houver trigger/FK cascade
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteAuthError) {
            console.error('Erro ao deletar user auth:', deleteAuthError)
            throw new Error(`Erro ao deletar autenticação: ${deleteAuthError.message}`)
        }

        // (Opcional) Deleção manual de dados caso não haja cascade
        // Por segurança, vamos tentar limpar subscriptions e profiles se eles ainda existirem
        await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)
        await supabaseAdmin.from('messages').delete().eq('user_id', userId)
        await supabaseAdmin.from('conversations').delete().eq('user_id', userId)

        console.log(`✅ Usuário deletado com sucesso: ${userId}`)

        return new Response(
            JSON.stringify({ success: true, message: 'Usuário deletado com sucesso' }),
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
