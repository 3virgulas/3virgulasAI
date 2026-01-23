// =====================================================
// Subscription Types - Tipos para assinaturas Premium
// =====================================================

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'canceled' | 'banned';

export interface Subscription {
    id: string;
    user_id: string;
    status: SubscriptionStatus;
    plan_type: string;
    plan_name: string | null;
    plan_price: number | null;
    subscription_expires_at: string | null;
    provider: string;
    transacao_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface Profile {
    id: string;
    full_name: string | null;
    tax_id: string | null;
    cellphone: string | null;
    email: string | null;
    created_at: string;
    updated_at: string;
}

export interface PixPaymentResponse {
    success: boolean;
    pixCode?: string;
    qrCodeImage?: string;
    transaction_id?: string;
    user_id?: string;
    amount?: number;
    plan_name?: string;
    expires_in_days?: number;
    error?: string;
    errorCode?: string;
    message?: string;
    missingFields?: {
        full_name?: boolean;
        tax_id?: boolean;
        cellphone?: boolean;
    };
}

export interface PaymentStatusResponse {
    success: boolean;
    status: string;
    message?: string;
    subscription_expires_at?: string;
}
