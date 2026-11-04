-- ============================================================================
-- CONTENIFY SaaS — Core Multi-Tenant Database Schema (Milestone 0)
-- PostgreSQL / Supabase Migration
-- ============================================================================

-- Ensure Supabase standard roles exist if running on vanilla PostgreSQL
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END $$;

-- Enable UUID extension or fallback to native gen_random_uuid()
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS $$
    SELECT gen_random_uuid();
$$ LANGUAGE sql;

-- Ensure auth schema and auth.uid() stub exist for RLS policies
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$ LANGUAGE sql;

-- ----------------------------------------------------------------------------
-- 1. TENANCY & WORKSPACES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL, -- references auth.users(id) in Supabase
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- matches auth.users(id)
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    tier VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'agency', 'enterprise')),
    default_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. CREDITS & FINANCIAL AUDIT LEDGER (Append-Only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
    balance INT NOT NULL DEFAULT 10 CHECK (balance >= 0),
    reserved_balance INT NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
    lifetime_granted INT NOT NULL DEFAULT 10,
    lifetime_spent INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- positive for grant/refund, negative for settle
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'REFUND', 'MANUAL_ADJUSTMENT')),
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('BATCH', 'VIDEO_JOB', 'SUBSCRIPTION', 'TOP_UP', 'ADMIN_ADJUSTMENT')),
    reference_id UUID NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    job_id UUID NOT NULL,
    amount INT NOT NULL CHECK (amount > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SETTLED', 'RELEASED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    UNIQUE(job_id)
);

-- ----------------------------------------------------------------------------
-- 3. ASSET MANAGEMENT & PRODUCTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    selling_points JSONB DEFAULT '[]'::jsonb,
    prohibited_claims JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(64),
    cleaned_r2_key TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avatars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    gender VARCHAR(50) CHECK (gender IN ('female', 'male', 'faceless')),
    modesty_style VARCHAR(50) DEFAULT 'muslimah_proper' CHECK (modesty_style IN ('muslimah_proper', 'general_modest', 'standard')),
    image_r2_key TEXT NOT NULL,
    consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    is_official BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. OFFICIAL GEMS & PROMPTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prompt_presets (
    id VARCHAR(100) PRIMARY KEY, -- e.g. 'gem_real_affiliate', 'gem_ugc_hand_demo'
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    target_duration_seconds INT NOT NULL DEFAULT 10,
    supported_providers JSONB NOT NULL DEFAULT '["nexabot", "runninghub"]'::jsonb,
    is_official BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    system_rules TEXT NOT NULL,
    template_text TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    preset_id VARCHAR(100) REFERENCES prompt_presets(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    custom_template TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. BATCHES & DURABLE PRODUCTION JOBS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'PAUSED')),
    total_jobs INT NOT NULL DEFAULT 0,
    completed_jobs INT NOT NULL DEFAULT 0,
    failed_jobs INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL,
    preset_id VARCHAR(100) REFERENCES prompt_presets(id) ON DELETE RESTRICT,
    preset_version INT NOT NULL,
    
    -- Status pipeline as per blueprint
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'VALIDATING', 'QUEUED', 'RESEARCHING', 'PROMPT_READY',
        'SUBMITTING', 'GENERATING', 'PROCESSING', 'QUALITY_CHECK',
        'COMPLETED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED'
    )),
    
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('nexabot', 'runninghub', 'mock')),
    duration_seconds INT NOT NULL CHECK (duration_seconds IN (10, 15, 20, 30, 60)),
    aspect_ratio VARCHAR(20) NOT NULL DEFAULT '9:16',
    voice_accent VARCHAR(50) NOT NULL DEFAULT 'ms-MY-standard',
    
    -- Immutable snapshot
    compiled_prompt_snapshot TEXT,
    reference_image_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    input_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Provider Task Tracking
    provider_task_id VARCHAR(255),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_code VARCHAR(100),
    error_message TEXT,
    
    -- Output Storage
    result_video_r2_key TEXT,
    thumbnail_r2_key TEXT,
    duration_actual_seconds NUMERIC(5, 2),
    file_size_bytes BIGINT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS job_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
    step_name VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'STARTED',
    details JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 6. AUDIT LOGS & FEATURE FLAGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    payload JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
    key VARCHAR(100) PRIMARY KEY,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_workspace_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. INDEXES FOR PERFORMANCE & SAFETY
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace ON credit_ledger(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference ON credit_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_workspace ON video_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_batch ON video_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_provider_task ON video_jobs(provider_task_id);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Workspace Isolation Policy (Users only access records in their member workspaces)
CREATE POLICY workspace_member_access ON workspaces
    FOR ALL USING (
        id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY product_workspace_access ON products
    FOR ALL USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY video_job_workspace_access ON video_jobs
    FOR ALL USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );
