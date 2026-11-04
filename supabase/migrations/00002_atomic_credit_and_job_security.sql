-- ============================================================================
-- AFFIMATIK by Pawarna — Atomic Credit & Job Security Migration (V2.1.2)
-- High-concurrency PostgreSQL RPC functions with row-level locks
-- ============================================================================

-- 1. Ensure unique constraint on idempotency_key in credit_ledger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'credit_ledger_idempotency_key_key'
    ) THEN
        ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_idempotency_key_key UNIQUE (idempotency_key);
    END IF;
END $$;

-- 2. Add client_request_id and idempotency_key to video_jobs if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_jobs' AND column_name = 'client_request_id'
    ) THEN
        ALTER TABLE video_jobs ADD COLUMN client_request_id VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_video_jobs_client_request ON video_jobs(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. ATOMIC RPC FUNCTION: reserve_credits_atomic
-- Performs concurrency-safe wallet locking (FOR UPDATE), checks available balance,
-- records reservation and append-only ledger entry in a single atomic transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_credits_atomic(
    p_workspace_id UUID,
    p_job_id UUID,
    p_amount INT,
    p_idempotency_key VARCHAR,
    p_description TEXT DEFAULT 'Reservation for video job'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_available INT;
    v_existing_ledger RECORD;
BEGIN
    -- Check idempotency
    SELECT * INTO v_existing_ledger FROM credit_ledger WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Duplicate request acknowledged without double debit'
        );
    END IF;

    -- Lock credit wallet row exclusively for this workspace
    SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id = p_workspace_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dompet kredit akaun tidak ditemui.');
    END IF;

    -- Compute available credits
    v_available := v_wallet.balance - v_wallet.reserved_balance;
    IF v_available < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Baki kredit tidak mencukupi. Diperlukan: %s, Baki tersedia: %s', p_amount, v_available)
        );
    END IF;

    -- Update reserved balance
    UPDATE credit_wallets 
    SET reserved_balance = reserved_balance + p_amount,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    -- Insert into credit_reservations
    INSERT INTO credit_reservations (workspace_id, job_id, amount, status, created_at)
    VALUES (p_workspace_id, p_job_id, p_amount, 'PENDING', NOW())
    ON CONFLICT (job_id) DO UPDATE 
    SET amount = p_amount, status = 'PENDING';

    -- Insert into credit_ledger (Append-only audit trail)
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
        -p_amount,
        'RESERVE',
        'VIDEO_JOB',
        p_job_id,
        p_idempotency_key,
        p_description,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'reserved_amount', p_amount,
        'remaining_available', v_available - p_amount
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. ATOMIC RPC FUNCTION: settle_credits_atomic
-- Settles reserved credits upon verified MP4 generation. Deducts balance permanently.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION settle_credits_atomic(
    p_workspace_id UUID,
    p_job_id UUID,
    p_amount INT,
    p_idempotency_key VARCHAR,
    p_description TEXT DEFAULT 'Settlement for completed video job'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_existing_ledger RECORD;
    v_reservation RECORD;
BEGIN
    SELECT * INTO v_existing_ledger FROM credit_ledger WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id = p_workspace_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dompet kredit tidak ditemui.');
    END IF;

    -- Verify reservation
    SELECT * INTO v_reservation FROM credit_reservations WHERE job_id = p_job_id;
    
    -- Deduct balance and reserved balance
    UPDATE credit_wallets
    SET balance = balance - p_amount,
        reserved_balance = GREATEST(0, reserved_balance - p_amount),
        lifetime_spent = lifetime_spent + p_amount,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    -- Update reservation status
    IF FOUND THEN
        UPDATE credit_reservations
        SET status = 'SETTLED',
            settled_at = NOW()
        WHERE job_id = p_job_id;
    END IF;

    -- Append SETTLE event
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
        -p_amount,
        'SETTLE',
        'VIDEO_JOB',
        p_job_id,
        p_idempotency_key,
        p_description,
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'settled_amount', p_amount);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC RPC FUNCTION: release_credits_atomic
-- Releases reserved credits on upstream generation failure or cancellation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_credits_atomic(
    p_workspace_id UUID,
    p_job_id UUID,
    p_idempotency_key VARCHAR,
    p_description TEXT DEFAULT 'Release reservation for failed job'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_existing_ledger RECORD;
    v_reservation RECORD;
BEGIN
    SELECT * INTO v_existing_ledger FROM credit_ledger WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id = p_workspace_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dompet kredit tidak ditemui.');
    END IF;

    SELECT * INTO v_reservation FROM credit_reservations WHERE job_id = p_job_id;
    IF NOT FOUND OR v_reservation.status != 'PENDING' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Tiada tempahan aktif ditemui untuk dilepaskan.');
    END IF;

    -- Restore reserved balance
    UPDATE credit_wallets
    SET reserved_balance = GREATEST(0, reserved_balance - v_reservation.amount),
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    -- Update reservation status
    UPDATE credit_reservations
    SET status = 'RELEASED'
    WHERE job_id = p_job_id;

    -- Append RELEASE event
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
        v_reservation.amount,
        'RELEASE',
        'VIDEO_JOB',
        p_job_id,
        p_idempotency_key,
        p_description,
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'released_amount', v_reservation.amount);
END;
$$;
