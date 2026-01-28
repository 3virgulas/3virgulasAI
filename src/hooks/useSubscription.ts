import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
    Subscription,
    Profile,
    PixPaymentResponse,
    PaymentStatusResponse
} from '../types/subscription';

// =====================================================
// useSubscription Hook
// =====================================================
// Gerencia assinatura Premium do usuário
// Inclui geração de PIX, polling e Realtime updates
// =====================================================

interface UseSubscriptionReturn {
    subscription: Subscription | null;
    profile: Profile | null;
    loading: boolean;
    error: Error | null;
    isPremium: boolean;
    daysRemaining: number | null;
    // Métodos
    refreshSubscription: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    updateProfile: (data: Partial<Profile>) => Promise<boolean>;
    generatePixPayment: (isRenewal?: boolean) => Promise<PixPaymentResponse>;
    checkPaymentStatus: (transactionId?: string) => Promise<PaymentStatusResponse>;
}

export function useSubscription(userId?: string): UseSubscriptionReturn {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Calcular dias restantes
    const daysRemaining = (() => {
        if (!subscription?.subscription_expires_at) return null;
        const expires = new Date(subscription.subscription_expires_at);
        const now = new Date();
        const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    })();

    // Verificar se é Premium ativo (status active E data válida)
    const isPremium = Boolean(subscription?.status === 'active' &&
        subscription?.subscription_expires_at &&
        new Date(subscription.subscription_expires_at) > new Date());

    // =====================================================
    // Carregar assinatura
    // =====================================================
    const refreshSubscription = useCallback(async () => {
        if (!userId) {
            setSubscription(null);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            setSubscription(data);
        } catch (err) {
            console.error('Erro ao carregar assinatura:', err);
        }
    }, [userId]);

    // =====================================================
    // Carregar perfil
    // =====================================================
    const refreshProfile = useCallback(async () => {
        if (!userId) {
            setProfile(null);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }
            setProfile(data);
        } catch (err) {
            console.error('Erro ao carregar perfil:', err);
        }
    }, [userId]);

    // =====================================================
    // Atualizar perfil
    // =====================================================
    const updateProfile = async (data: Partial<Profile>): Promise<boolean> => {
        if (!userId) return false;

        try {
            // Verificar se perfil existe
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

            if (existing) {
                // Update
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(data)
                    .eq('id', userId);

                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({ id: userId, ...data });

                if (insertError) throw insertError;
            }

            await refreshProfile();
            return true;
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
            return false;
        }
    };

    // =====================================================
    // Gerar pagamento PIX
    // =====================================================
    const generatePixPayment = async (isRenewal = false): Promise<PixPaymentResponse> => {
        try {
            // [MODIFIED] Pagar.me Integration
            // Replace 'create-suitpay-payment' with 'create-pagarme-payment'
            // const { data, error: fnError } = await supabase.functions.invoke(
            //     'create-suitpay-payment',
            //     {
            //         body: { isRenewal }
            //     }
            // );

            const { data, error: fnError } = await supabase.functions.invoke(
                'create-pagarme-payment',
                {
                    body: { isRenewal }
                }
            );

            if (fnError) {
                throw new Error(fnError.message || 'Erro ao gerar PIX');
            }

            // Atualizar assinatura local
            await refreshSubscription();

            return data as PixPaymentResponse;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Erro ao gerar PIX:', error);
            return {
                success: false,
                error: error.message,
                message: 'Falha ao gerar pagamento'
            };
        }
    };

    // =====================================================
    // Verificar status do pagamento (polling fallback)
    // =====================================================
    const checkPaymentStatus = async (transactionId?: string): Promise<PaymentStatusResponse> => {
        try {
            // [MODIFIED] Pagar.me Integration
            // Replace 'check-suitpay-payment-status' with 'check-pagarme-payment-status'
            // const { data, error: fnError } = await supabase.functions.invoke(
            //     'check-suitpay-payment-status',
            //     {
            //         body: { transactionId }
            //     }
            // );

            const { data, error: fnError } = await supabase.functions.invoke(
                'check-pagarme-payment-status',
                {
                    body: { transactionId }
                }
            );

            if (fnError) {
                throw new Error(fnError.message || 'Erro ao verificar status');
            }

            // Se ativou, atualizar assinatura local
            if (data?.success && data?.status === 'active') {
                await refreshSubscription();
            }

            return data as PaymentStatusResponse;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Erro ao verificar status:', error);
            return {
                success: false,
                status: 'error',
                message: error.message
            };
        }
    };

    // =====================================================
    // Carregar dados iniciais
    // =====================================================
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                await Promise.all([
                    refreshSubscription(),
                    refreshProfile()
                ]);
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [refreshSubscription, refreshProfile]);

    // =====================================================
    // Supabase Realtime - Escutar mudanças na assinatura
    // =====================================================
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`subscription-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'subscriptions',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('🔔 Subscription update:', payload);

                    if (payload.eventType === 'DELETE') {
                        setSubscription(null);
                    } else {
                        setSubscription(payload.new as Subscription);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return {
        subscription,
        profile,
        loading,
        error,
        isPremium,
        daysRemaining,
        refreshSubscription,
        refreshProfile,
        updateProfile,
        generatePixPayment,
        checkPaymentStatus
    };
}

export default useSubscription;
