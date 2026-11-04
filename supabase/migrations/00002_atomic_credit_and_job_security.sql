-- ============================================================================
-- AFFIMATIK by Pawarna — Atomic Credit & Job Security Migration (V2.1.3)
-- High-concurrency PostgreSQL RPC functions with row-level locks,
-- strict UUID alignment, search_path isolation, and idempotent settlements.
-- ============================================================================

-- 1. Ensure prompt_presets contains all 13 official Video Styles to satisfy FK constraints
INSERT INTO prompt_presets (id, name, category, description, target_duration_seconds, supported_providers, is_official, is_active, system_rules, template_text, version)
VALUES
    ('NX01', 'Sembang Kawan', 'creator_review', 'Perbualan santai kawan rapat', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX01 template', 2),
    ('NX02', 'Review Sambil Pegang', 'creator_review', 'Penerangan jujur produk', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX02 template', 2),
    ('NX03', 'First Impression', 'creator_review', 'Reaksi spontan', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX03 template', 2),
    ('NX05', 'Masalah Seharian', 'problem_solution', 'Fokus masalah dan solusi', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX05 template', 2),
    ('NX07', 'Soalan & Jawapan', 'problem_solution', 'Q&A produk direct', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX07 template', 2),
    ('NX09', 'Goyang Produk + VO', 'hand_demo', 'Fokus produk dengan suara BM', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX09 template', 2),
    ('NX10', 'Label Talk', 'hand_demo', 'Penerangan maklumat label', 10, '["nexabot"]'::jsonb, true, true, 'Realism engine rules', 'NX10 template', 2),
    ('RH01', 'Goyang Produk Natural', 'hand_demo', 'Pergerakan tangan 15s visual realistik', 15, '["runninghub"]'::jsonb, true, true, 'Strict zero speech', 'RH01 template', 2),
    ('RH02', 'Gentle Product Tilt', 'hand_demo', 'Kelewatan sudut 15s kilauan', 15, '["runninghub"]'::jsonb, true, true, 'Strict zero speech', 'RH02 template', 2),
    ('RH03', 'Pick Up & Put Down', 'hand_demo', 'Interaksi fizikal atas meja', 15, '["runninghub"]'::jsonb, true, true, 'Strict zero speech', 'RH03 template', 2),
    ('RH04', 'Shelf Pickup', 'lifestyle', 'Diambil dari rak rumah', 15, '["runninghub"]'::jsonb, true, true, 'Strict zero speech', 'RH04 template', 2),
    ('RH17', 'Desk Setup', 'lifestyle', 'Visual estetik atas meja kerja', 15, '["runninghub"]'::jsonb, true, true, 'Strict zero speech', 'RH17 template', 2),
    ('RH19', 'Window Daylight', 'lifestyle', 'Pencahayaan tingkap natural', 15, '["runninghub"]'::jsonb, true, true, 'Strict zero speech', 'RH19 template', 2)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    version = EXCLUDED.version;

-- 2. Add client_request_id and result_video_url to video_jobs if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_jobs' AND column_name = 'client_request_id'
    ) THEN
        ALTER TABLE video_jobs ADD COLUMN client_request_id VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_video_jobs_client_request ON video_jobs(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_jobs' AND column_name = 'result_video_url'
    ) THEN
        ALTER TABLE video_jobs ADD COLUMN result_video_url TEXT;
    END IF;

    -- Update status check constraint on video_jobs to include 'FAILED'
    ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_check;
    ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_check CHECK (status IN (
        'DRAFT', 'VALIDATING', 'QUEUED', 'RESEARCHING', 'PROMPT_READY',
        'SUBMITTING', 'GENERATING', 'PROCESSING', 'QUALITY_CHECK',
        'COMPLETED', 'FAILED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED'
    ));
END $$;

-- 3. Ensure unique constraint on idempotency_key in credit_ledger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'credit_ledger_idempotency_key_key'
    ) THEN
        ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_idempotency_key_key UNIQUE (idempotency_key);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. ATOMIC RPC FUNCTION: reserve_credits_atomic
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
SET search_path = public, pg_temp
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
            'message', 'Duplicate reservation request acknowledged without double debit'
        );
    END IF;

    -- Lock credit wallet row exclusively for this workspace
    SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id = p_workspace_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dompet kredit akaun tidak ditemui dalam pangkalan data.');
    END IF;

    -- Compute available credits
    v_available := v_wallet.balance - v_wallet.reserved_balance;
    IF v_available < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Baki kredit tidak mencukupi. Diperlukan: %s, Baki tersedia: %s', p_amount, v_available)
        );
    END IF;

    -- Update reserved balance atomically
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
-- 5. ATOMIC RPC FUNCTION: settle_credits_atomic
-- Enforces:
-- 1. Reservation cannot be settled twice.
-- 2. Released reservation cannot subsequently be settled.
-- 3. Settlement amount must match original reservation.
-- 4. Verification of job and workspace ownership.
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_wallet RECORD;
    v_existing_ledger RECORD;
    v_reservation RECORD;
BEGIN
    -- Idempotency check
    SELECT * INTO v_existing_ledger FROM credit_ledger WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    -- Check reservation
    SELECT * INTO v_reservation 
    FROM credit_reservations 
    WHERE job_id = p_job_id AND workspace_id = p_workspace_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tiada rekod tempahan kredit ditemui untuk tugasan ini.');
    END IF;

    IF v_reservation.status = 'SETTLED' THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Tugasan telah pun diselesaikan sebelum ini.');
    END IF;

    IF v_reservation.status = 'RELEASED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tempahan kredit ini telah dilepaskan/dibatalkan dan tidak boleh diselesaikan.');
    END IF;

    IF v_reservation.amount != p_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Jumlah penyelesaian (%s kredit) tidak sepadan dengan tempahan asal (%s kredit).', p_amount, v_reservation.amount)
        );
    END IF;

    -- Lock wallet row
    SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id = p_workspace_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dompet kredit tidak ditemui.');
    END IF;

    -- Deduct balance permanently and release reservation
    UPDATE credit_wallets
    SET balance = balance - p_amount,
        reserved_balance = GREATEST(0, reserved_balance - p_amount),
        lifetime_spent = lifetime_spent + p_amount,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    -- Mark reservation SETTLED
    UPDATE credit_reservations
    SET status = 'SETTLED',
        settled_at = NOW()
    WHERE job_id = p_job_id;

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
-- 6. ATOMIC RPC FUNCTION: release_credits_atomic
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
SET search_path = public, pg_temp
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

    SELECT * INTO v_reservation 
    FROM credit_reservations 
    WHERE job_id = p_job_id AND workspace_id = p_workspace_id 
    FOR UPDATE;

    IF NOT FOUND OR v_reservation.status != 'PENDING' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Tiada tempahan aktif ditemui untuk dilepaskan.');
    END IF;

    SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id = p_workspace_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dompet kredit tidak ditemui.');
    END IF;

    -- Restore reserved balance
    UPDATE credit_wallets
    SET reserved_balance = GREATEST(0, reserved_balance - v_reservation.amount),
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    -- Mark reservation as RELEASED
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

-- 7. Restrict execution permissions (Security Hardening)
REVOKE EXECUTE ON FUNCTION reserve_credits_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION settle_credits_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION release_credits_atomic FROM PUBLIC;

GRANT EXECUTE ON FUNCTION reserve_credits_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION settle_credits_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_credits_atomic TO authenticated, service_role;
