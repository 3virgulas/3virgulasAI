-- =====================================================
-- Migration: Fix Status Constraint
-- =====================================================
-- Atualiza a constraint de status para permitir
-- 'canceled' e 'banned'
-- =====================================================

DO $$
BEGIN
    -- Remover constraint antiga se existir
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'subscriptions_status_check' 
        AND table_name = 'subscriptions'
    ) THEN
        ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_status_check;
    END IF;

    -- Adicionar nova constraint
    ALTER TABLE public.subscriptions 
    ADD CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('pending', 'active', 'expired', 'canceled', 'banned'));

END $$;
