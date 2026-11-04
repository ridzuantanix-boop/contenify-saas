-- ============================================================================
-- AFFIMATIK by Pawarna — Migration 00006: Billing, Subscriptions, Affiliates & Safety
-- 1. Orders and Subscriptions tables for commercial sales
-- 2. Affiliate partners and 20% commission ledger
-- 3. Audit logs for administrative actions
-- 4. System settings for emergency pause & margin protection
-- 5. Atomic order settlement RPC (settle_order_payment_atomic)
-- ============================================================================

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,
    amount_myr NUMERIC(10, 2) NOT NULL,
    credits_granted INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')),
    gateway_provider VARCHAR(50) NOT NULL DEFAULT 'manual_fpx',
    gateway_reference VARCHAR(255),
    payment_method VARCHAR(50) DEFAULT 'fpx',
    referral_code VARCHAR(50),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_orders_workspace_id ON orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_gateway_reference ON orders(gateway_reference);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscriptions_workspace UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 3. Affiliate Partners Table
CREATE TABLE IF NOT EXISTS affiliate_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    referral_code VARCHAR(50) NOT NULL UNIQUE,
    payout_bank VARCHAR(100),
    payout_account_number VARCHAR(100),
    payout_account_holder VARCHAR(255),
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referral_code ON affiliate_partners(referral_code);

-- 4. Affiliate Commissions Table (20% commercial commission ledger)
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    amount_myr NUMERIC(10, 2) NOT NULL,
    rate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'REVERSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    payout_reference VARCHAR(255),
    CONSTRAINT uq_affiliate_order UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);

-- 5. Audit Logs Table (Administrative actions & financial adjustments)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 6. System Settings Table (Emergency generation pause, unit costs, safety buffer)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default operating safety settings
INSERT INTO system_settings (key, value, updated_at)
VALUES 
    ('generation_status', '{"paused": false, "reason": ""}'::jsonb, NOW()),
    ('provider_unit_costs', '{"nexabot_10s_myr": 1.50, "runninghub_15s_myr": 2.00}'::jsonb, NOW()),
    ('financial_safety', '{"minimum_safety_buffer_myr": 500.00, "refund_reserve_percent": 10.0}'::jsonb, NOW()),
    ('provider_concurrency_caps', '{"nexabot": 5, "runninghub": 5}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- 7. Atomic Order Settlement RPC Function
CREATE OR REPLACE FUNCTION settle_order_payment_atomic(
    p_order_id UUID,
    p_gateway_reference VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_wallet RECORD;
    v_new_balance INT;
    v_tier VARCHAR(50);
    v_affiliate RECORD;
    v_commission_amount NUMERIC(10, 2);
    v_ledger_key VARCHAR(100);
BEGIN
    -- 1. Lock the order record
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Idempotency: If order is already settled as PAID, return current state
    IF v_order.status = 'PAID' THEN
        SELECT balance INTO v_new_balance FROM credit_wallets WHERE workspace_id = v_order.workspace_id;
        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'order_id', v_order.id,
            'status', 'PAID',
            'balance', v_new_balance
        );
    END IF;

    -- 2. Mark order as PAID
    UPDATE orders
    SET status = 'PAID',
        paid_at = NOW(),
        gateway_reference = COALESCE(p_gateway_reference, gateway_reference, 'man_' || gen_random_uuid()),
        metadata = COALESCE(metadata, '{}'::jsonb) || p_metadata
    WHERE id = p_order_id;

    -- 3. Determine tier from plan_id
    IF v_order.plan_id LIKE '%agency%' THEN
        v_tier := 'agency';
    ELSIF v_order.plan_id LIKE '%pro%' THEN
        v_tier := 'pro';
    ELSE
        v_tier := 'starter';
    END IF;

    -- Update profile tier
    UPDATE profiles
    SET tier = v_tier
    WHERE id = v_order.user_id;

    -- Upsert subscription record
    INSERT INTO subscriptions (
        workspace_id,
        user_id,
        plan_id,
        tier,
        status,
        current_period_start,
        current_period_end,
        updated_at
    ) VALUES (
        v_order.workspace_id,
        v_order.user_id,
        v_order.plan_id,
        v_tier,
        'active',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW()
    )
    ON CONFLICT (workspace_id)
    DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        tier = EXCLUDED.tier,
        status = 'active',
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = NOW();

    -- 4. Credit wallet atomic grant
    v_ledger_key := 'ord_pay_' || p_order_id::text;

    -- Lock wallet
    SELECT * INTO v_wallet
    FROM credit_wallets
    WHERE workspace_id = v_order.workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- If wallet missing, initialize with initial 10 + purchased credits
        INSERT INTO credit_wallets (workspace_id, balance, reserved_balance, lifetime_granted, lifetime_spent, updated_at)
        VALUES (v_order.workspace_id, 10 + v_order.credits_granted, 0, 10 + v_order.credits_granted, 0, NOW())
        RETURNING * INTO v_wallet;

        INSERT INTO credit_ledger (workspace_id, wallet_id, amount, event_type, reference_type, reference_id, idempotency_key, description)
        VALUES 
            (v_order.workspace_id, v_wallet.id, 10, 'GRANT', 'SUBSCRIPTION', v_order.workspace_id::text, 'init_' || v_order.workspace_id::text, 'Initial Free Trial Credits'),
            (v_order.workspace_id, v_wallet.id, v_order.credits_granted, 'GRANT', 'SUBSCRIPTION', p_order_id::text, v_ledger_key, 'Plan Credit Top-up: ' || v_order.plan_id);
    ELSE
        UPDATE credit_wallets
        SET balance = balance + v_order.credits_granted,
            lifetime_granted = lifetime_granted + v_order.credits_granted,
            updated_at = NOW()
        WHERE workspace_id = v_order.workspace_id
        RETURNING * INTO v_wallet;

        INSERT INTO credit_ledger (workspace_id, wallet_id, amount, event_type, reference_type, reference_id, idempotency_key, description)
        VALUES (v_order.workspace_id, v_wallet.id, v_order.credits_granted, 'GRANT', 'SUBSCRIPTION', p_order_id::text, v_ledger_key, 'Plan Credit Top-up: ' || v_order.plan_id)
        ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    v_new_balance := v_wallet.balance;

    -- 5. Affiliate Commission Attribution (20%)
    IF v_order.referral_code IS NOT NULL AND TRIM(v_order.referral_code) <> '' THEN
        SELECT * INTO v_affiliate
        FROM affiliate_partners
        WHERE referral_code = v_order.referral_code AND status = 'active';

        IF FOUND THEN
            v_commission_amount := ROUND((v_order.amount_myr * (v_affiliate.commission_rate / 100.0)), 2);

            INSERT INTO affiliate_commissions (
                affiliate_id,
                order_id,
                workspace_id,
                amount_myr,
                rate_percentage,
                status
            ) VALUES (
                v_affiliate.id,
                v_order.id,
                v_order.workspace_id,
                v_commission_amount,
                v_affiliate.commission_rate,
                'PENDING'
            )
            ON CONFLICT (order_id) DO NOTHING;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'status', 'PAID',
        'credits_granted', v_order.credits_granted,
        'tier', v_tier,
        'balance', v_new_balance
    );
END;
$$;

-- Restrict execution to trusted service role
REVOKE EXECUTE ON FUNCTION settle_order_payment_atomic(UUID, VARCHAR, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION settle_order_payment_atomic(UUID, VARCHAR, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION settle_order_payment_atomic(UUID, VARCHAR, JSONB) TO service_role;

-- 8. Atomic Administrative Credit Adjustment RPC Function
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

    -- 1. Lock wallet
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

    -- 2. Record in credit_ledger
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

    -- 3. Record in audit_logs
    INSERT INTO audit_logs (
        admin_email,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        p_admin_email,
        'CREDIT_MANUAL_ADJUSTMENT',
        'WALLET',
        p_workspace_id::text,
        jsonb_build_object(
            'adjusted_by', p_amount,
            'new_balance', v_new_balance,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', p_workspace_id,
        'adjusted_by', p_amount,
        'new_balance', v_new_balance
    );
END;
$$;

-- Restrict execution to trusted service role
REVOKE EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_credits_atomic(UUID, INT, TEXT, VARCHAR) TO service_role;

