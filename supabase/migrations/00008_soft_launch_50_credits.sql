-- Migration 00008: AffiMatik Soft Launch V1.0 - 50 Free Trial Credits
-- Atomically provisions new eligible workspaces with exactly 50 free credits upon registration.

CREATE OR REPLACE FUNCTION provision_wallet_atomic(
    p_workspace_id UUID,
    p_initial_balance INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_wallet RECORD;
BEGIN
    IF p_workspace_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'workspace_id is required');
    END IF;

    -- Fast check with lock to enforce idempotency
    SELECT * INTO v_wallet
    FROM credit_wallets
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'workspace_id', v_wallet.workspace_id,
            'wallet_id', v_wallet.id,
            'balance', v_wallet.balance,
            'reserved_balance', v_wallet.reserved_balance,
            'lifetime_granted', v_wallet.lifetime_granted,
            'lifetime_spent', v_wallet.lifetime_spent,
            'updated_at', v_wallet.updated_at,
            'is_new', false
        );
    END IF;

    -- Provision wallet atomically with exactly 50 credits (or caller provided initial balance)
    INSERT INTO credit_wallets (
        workspace_id,
        balance,
        reserved_balance,
        lifetime_granted,
        lifetime_spent,
        created_at,
        updated_at
    )
    VALUES (
        p_workspace_id,
        p_initial_balance,
        0,
        p_initial_balance,
        0,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_wallet;

    -- Record initial GRANT in credit ledger atomically
    INSERT INTO credit_ledger (
        workspace_id,
        wallet_id,
        amount,
        event_type,
        reference_type,
        reference_id,
        idempotency_key,
        description,
        created_at
    )
    VALUES (
        p_workspace_id,
        v_wallet.id,
        p_initial_balance,
        'GRANT',
        'SUBSCRIPTION',
        p_workspace_id,
        'grant_welcome_' || p_workspace_id,
        'Pemberian baki permulaan akaun AffiMatik (50 kredit percuma)',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', v_wallet.workspace_id,
        'wallet_id', v_wallet.id,
        'balance', v_wallet.balance,
        'reserved_balance', v_wallet.reserved_balance,
        'lifetime_granted', v_wallet.lifetime_granted,
        'lifetime_spent', v_wallet.lifetime_spent,
        'updated_at', v_wallet.updated_at,
        'is_new', true
    );
END;
$$;

-- Restrict execution strictly to service_role
REVOKE ALL ON FUNCTION provision_wallet_atomic(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION provision_wallet_atomic(UUID, INT) TO service_role;
