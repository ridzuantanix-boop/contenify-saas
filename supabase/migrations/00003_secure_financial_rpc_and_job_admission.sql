-- ============================================================================
-- AFFIMATIK by Pawarna — Migration 00003: Final P0 Integration & Security Gate
-- 1. Lock down financial RPC to service_role only (Revoke from authenticated).
-- 2. Add required_credits and user_id to video_jobs.
-- 3. Coordinated atomic admission procedure: admit_video_job_atomic.
-- 4. Safe indexes for concurrency count & idempotency.
-- ============================================================================

-- 1. Ensure columns exist on video_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_jobs' AND column_name = 'required_credits'
    ) THEN
        ALTER TABLE video_jobs ADD COLUMN required_credits INT NOT NULL DEFAULT 10;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_jobs' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE video_jobs ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 2. Safe Indexes for concurrency counting and client_request_id idempotency
CREATE INDEX IF NOT EXISTS idx_video_jobs_concurrency 
    ON video_jobs(workspace_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_jobs_client_request 
    ON video_jobs(workspace_id, client_request_id) 
    WHERE client_request_id IS NOT NULL;

-- 3. Financial RPC Security Lockdown: Revoke ALL from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION reserve_credits_atomic(UUID, UUID, INT, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_credits_atomic(UUID, UUID, INT, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_credits_atomic(UUID, UUID, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;

-- Grant execution ONLY to trusted backend service_role
GRANT EXECUTE ON FUNCTION reserve_credits_atomic(UUID, UUID, INT, VARCHAR, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION settle_credits_atomic(UUID, UUID, INT, VARCHAR, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION release_credits_atomic(UUID, UUID, VARCHAR, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. ATOMIC RPC FUNCTION: admit_video_job_atomic
-- Coordinated single-transaction admission:
-- a) Idempotency check on (workspace_id, client_request_id)
-- b) Row-level lock on credit_wallets FOR UPDATE
-- c) Concurrency limit check (QUEUED, SUBMITTING, PROCESSING)
-- d) Balance verification
-- e) Credit reservation in credit_wallets & credit_reservations
-- f) Insert video_jobs with SUBMITTING status
-- g) Append credit_ledger audit entry
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admit_video_job_atomic(
    p_workspace_id UUID,
    p_user_id UUID,
    p_job_id UUID,
    p_client_request_id VARCHAR,
    p_preset_id VARCHAR,
    p_preset_version INT,
    p_provider VARCHAR,
    p_duration_seconds INT,
    p_required_credits INT,
    p_max_concurrency INT,
    p_compiled_prompt TEXT,
    p_input_options JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_job RECORD;
    v_wallet RECORD;
    v_active_count INT;
    v_available INT;
    v_idempotency_key VARCHAR;
BEGIN
    -- Step A: Idempotency check by client_request_id
    IF p_client_request_id IS NOT NULL AND p_client_request_id != '' THEN
        SELECT * INTO v_existing_job 
        FROM video_jobs 
        WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'job_id', v_existing_job.id,
                'provider_task_id', v_existing_job.provider_task_id,
                'status', v_existing_job.status,
                'required_credits', v_existing_job.required_credits
            );
        END IF;
    END IF;

    -- Step B: Exclusively lock wallet row
    SELECT * INTO v_wallet 
    FROM credit_wallets 
    WHERE workspace_id = p_workspace_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-provision initial wallet with 10 free credits for valid workspace
        INSERT INTO credit_wallets (workspace_id, balance, reserved_balance, lifetime_granted, lifetime_spent, updated_at)
        VALUES (p_workspace_id, 10, 0, 10, 0, NOW())
        RETURNING * INTO v_wallet;
    END IF;

    -- Step C: Concurrency Check (Active jobs in QUEUED, SUBMITTING, PROCESSING)
    SELECT COUNT(*) INTO v_active_count 
    FROM video_jobs 
    WHERE workspace_id = p_workspace_id 
      AND status IN ('QUEUED', 'SUBMITTING', 'PROCESSING');

    IF v_active_count >= p_max_concurrency THEN
        RETURN jsonb_build_object(
            'success', false,
            'concurrency_limit_reached', true,
            'active_count', v_active_count,
            'max_concurrency', p_max_concurrency,
            'error', format('Had penjanaan serentak dicapai (%s/%s tugasan aktif). Sila tunggu sehingga video semasa selesai diproses.', v_active_count, p_max_concurrency)
        );
    END IF;

    -- Step D: Balance Verification
    v_available := v_wallet.balance - v_wallet.reserved_balance;
    IF v_available < p_required_credits THEN
        RETURN jsonb_build_object(
            'success', false,
            'insufficient_credits', true,
            'required_credits', p_required_credits,
            'available_credits', v_available,
            'error', format('Baki kredit tidak mencukupi. Diperlukan: %s, Baki tersedia: %s.', p_required_credits, v_available)
        );
    END IF;

    -- Step E: Atomically Reserve Credits
    UPDATE credit_wallets 
    SET reserved_balance = reserved_balance + p_required_credits,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    v_idempotency_key := 'job_idem_' || p_job_id::TEXT;

    -- Step F: Insert video_jobs with SUBMITTING status
    INSERT INTO video_jobs (
        id,
        workspace_id,
        user_id,
        client_request_id,
        preset_id,
        preset_version,
        provider,
        duration_seconds,
        required_credits,
        aspect_ratio,
        voice_accent,
        status,
        compiled_prompt_snapshot,
        input_options,
        idempotency_key,
        created_at,
        updated_at
    )
    VALUES (
        p_job_id,
        p_workspace_id,
        p_user_id,
        p_client_request_id,
        p_preset_id,
        p_preset_version,
        p_provider,
        p_duration_seconds,
        p_required_credits,
        '9:16',
        'ms-MY-standard',
        'SUBMITTING',
        p_compiled_prompt,
        p_input_options,
        v_idempotency_key,
        NOW(),
        NOW()
    );

    -- Step G: Insert credit_reservations
    INSERT INTO credit_reservations (
        workspace_id,
        job_id,
        amount,
        status,
        created_at
    )
    VALUES (
        p_workspace_id,
        p_job_id,
        p_required_credits,
        'PENDING',
        NOW()
    );

    -- Step H: Insert audit ledger entry
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
        -p_required_credits,
        'RESERVE',
        'VIDEO_JOB',
        p_job_id,
        'res_' || v_idempotency_key,
        format('Tempahan %s kredit untuk tugasan %s', p_required_credits, p_job_id),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', false,
        'job_id', p_job_id,
        'reserved_credits', p_required_credits,
        'remaining_available', v_available - p_required_credits
    );
END;
$$;

-- Restrict admit_video_job_atomic ONLY to service_role
REVOKE ALL ON FUNCTION admit_video_job_atomic(UUID, UUID, UUID, VARCHAR, VARCHAR, INT, VARCHAR, INT, INT, INT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admit_video_job_atomic(UUID, UUID, UUID, VARCHAR, VARCHAR, INT, VARCHAR, INT, INT, INT, TEXT, JSONB) TO service_role;
