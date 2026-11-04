-- ============================================================================
-- AFFIMATIK by Pawarna — Migration 00004: Migration Compatibility & Double-Checked Idempotency Lock
-- 1. Safely align credit_wallets columns.
-- 2. Implement Double-Checked Locking in admit_video_job_atomic to eliminate
--    concurrent duplicate admission race conditions.
-- 3. Mandate client_request_id and grant initial credit ledger record idempotently.
-- ============================================================================

-- 1. Align credit_wallets safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_wallets' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE credit_wallets ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- 2. Fully Transactional Idempotent Wallet Provisioning Procedure
CREATE OR REPLACE FUNCTION provision_wallet_atomic(
    p_workspace_id UUID,
    p_initial_balance INT DEFAULT 10
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

    -- Fast check with lock
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

    -- Provision wallet atomically
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
    ON CONFLICT (workspace_id) DO UPDATE SET updated_at = NOW()
    RETURNING * INTO v_wallet;

    -- Atomically insert initial GRANT ledger entry
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
        v_wallet.id,
        'grant_initial_' || p_workspace_id::TEXT,
        'Pemberian baki permulaan akaun AffiMatik (10 kredit percuma)',
        NOW()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

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

-- Restrict provision_wallet_atomic ONLY to service_role
REVOKE ALL ON FUNCTION provision_wallet_atomic(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION provision_wallet_atomic(UUID, INT) TO service_role;

-- 3. Updated Atomic Admission Procedure with Double-Checked Locking
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
    -- Client request ID is strictly MANDATORY
    IF p_client_request_id IS NULL OR trim(p_client_request_id) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'clientRequestId wajib diisi bagi setiap permintaan penjanaan video.'
        );
    END IF;

    -- Step A: Fast pre-lock check for duplicate client_request_id
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

    -- Step B: Exclusively lock wallet row FOR UPDATE (Serializes admissions for this workspace)
    SELECT * INTO v_wallet 
    FROM credit_wallets 
    WHERE workspace_id = p_workspace_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-provision initial wallet with 10 free credits atomically
        PERFORM provision_wallet_atomic(p_workspace_id, 10);

        SELECT * INTO v_wallet 
        FROM credit_wallets 
        WHERE workspace_id = p_workspace_id 
        FOR UPDATE;
    END IF;

    -- Step C: CRITICAL DOUBLE-CHECKED LOCKING
    -- Recheck client_request_id AFTER acquiring wallet lock!
    -- If an identical concurrent request was waiting for the lock, it has now committed.
    -- Rechecking here prevents PostgreSQL 23505 unique constraint violation.
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

    -- Step D: Concurrency Check (Active jobs in QUEUED, SUBMITTING, PROCESSING)
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

    -- Step E: Balance Verification
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

    -- Step F: Atomically Reserve Credits
    UPDATE credit_wallets 
    SET reserved_balance = reserved_balance + p_required_credits,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    v_idempotency_key := 'job_idem_' || p_job_id::TEXT;

    -- Step G: Insert video_jobs with SUBMITTING status
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

    -- Step H: Insert credit_reservations
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

    -- Step I: Insert audit ledger entry
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

-- Ensure service_role has full trusted backend permissions across public schema
DO $$
BEGIN
    ALTER ROLE service_role WITH BYPASSRLS;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;
