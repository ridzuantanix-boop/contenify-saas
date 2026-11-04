-- =====================================================================================
-- AFFIMATIK V3.0 — MIGRATION 00007: FIX ADMIN CREDIT ADJUSTMENT UUID INCOMPATIBILITY
-- Forward-only migration: 
-- 1. Adds missing columns to audit_logs safely if they do not exist (aligning 00001 with 00006)
-- 2. Corrects credit_ledger.reference_id to genuine UUID in admin_adjust_credits_atomic
-- =====================================================================================

-- 1. Safely add audit_logs columns for backward & forward schema alignment
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- 2. Atomic Administrative Credit Adjustment RPC Function
CREATE OR REPLACE FUNCTION admin_adjust_credits_atomic(
    p_workspace_id UUID,
    p_amount INT,
    p_reason TEXT,
    p_admin_email VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance INT;
    v_ledger_key VARCHAR(100);
    v_reference_id UUID;
BEGIN
    IF p_amount = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adjustment amount cannot be zero');
    END IF;

    -- 1. Lock wallet record
    SELECT * INTO v_wallet
    FROM credit_wallets
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- If wallet missing and positive adjustment, create it
        IF p_amount > 0 THEN
            INSERT INTO credit_wallets (workspace_id, balance, reserved_balance, lifetime_granted, lifetime_spent, updated_at)
            VALUES (p_workspace_id, p_amount, 0, p_amount, 0, NOW())
            RETURNING * INTO v_wallet;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Wallet not found for debit adjustment');
        END IF;
    ELSE
        -- Prevent negative resulting balance
        IF (v_wallet.balance + p_amount) < 0 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', format('Insufficient credit balance for debit. Current: %s, Requested: %s', v_wallet.balance, p_amount)
            );
        END IF;

        UPDATE credit_wallets
        SET balance = balance + p_amount,
            lifetime_granted = CASE WHEN p_amount > 0 THEN lifetime_granted + p_amount ELSE lifetime_granted END,
            lifetime_spent = CASE WHEN p_amount < 0 THEN lifetime_spent + ABS(p_amount) ELSE lifetime_spent END,
            updated_at = NOW()
        WHERE workspace_id = p_workspace_id
        RETURNING * INTO v_wallet;
    END IF;

    v_new_balance := v_wallet.balance;
    v_reference_id := gen_random_uuid();
    v_ledger_key := 'adj_' || v_reference_id::text;

    -- 2. Record in credit_ledger with genuine RFC4122 UUID reference_id
    INSERT INTO credit_ledger (
        workspace_id,
        wallet_id,
        amount,
        event_type,
        reference_type,
        reference_id,
        idempotency_key,
        description
    ) VALUES (
        p_workspace_id,
        v_wallet.id,
        p_amount,
        'MANUAL_ADJUSTMENT',
        'ADMIN_ADJUSTMENT',
        v_reference_id,
        v_ledger_key,
        COALESCE(p_reason, 'Manual Administrative Adjustment') || ' [Admin: ' || COALESCE(p_admin_email, 'system') || ']'
    );

    -- 3. Record in audit_logs (populates both 00001 and 00006 column structures)
    INSERT INTO audit_logs (
        workspace_id,
        action,
        resource_type,
        resource_id,
        payload,
        admin_email,
        target_type,
        target_id,
        details
    ) VALUES (
        p_workspace_id,
        'CREDIT_MANUAL_ADJUSTMENT',
        'WALLET',
        p_workspace_id::text,
        jsonb_build_object(
            'admin_email', p_admin_email,
            'adjusted_by', p_amount,
            'new_balance', v_new_balance,
            'reason', p_reason,
            'ledger_reference_id', v_reference_id
        ),
        COALESCE(p_admin_email, 'admin@affimatik.internal'),
        'WALLET',
        p_workspace_id::text,
        jsonb_build_object(
            'adjusted_by', p_amount,
            'new_balance', v_new_balance,
            'reason', p_reason,
            'ledger_reference_id', v_reference_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', p_workspace_id,
        'adjusted_by', p_amount,
        'new_balance', v_new_balance,
        'reference_id', v_reference_id
    );
END;
$$;

-- Secure execution privileges (Trusted server role only)
REVOKE EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) TO service_role;
