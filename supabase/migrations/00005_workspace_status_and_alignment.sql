-- ============================================================================
-- AFFIMATIK by Pawarna — Migration 00005: Workspace Status & Alignment
-- 1. Adds 'status' column to workspaces with safe default 'active'
-- 2. Enforces valid workspace status domain ('active', 'suspended', 'archived')
-- 3. Safely backfills existing workspaces to 'active'
-- 4. Confirms profiles.tier as the authoritative user subscription tier
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspaces' AND column_name = 'status'
    ) THEN
        ALTER TABLE workspaces ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
        ALTER TABLE workspaces ADD CONSTRAINT chk_workspaces_status CHECK (status IN ('active', 'suspended', 'archived'));
    END IF;
END $$;

-- Safe backfill: ensure all existing workspaces are active
UPDATE workspaces SET status = 'active' WHERE status IS NULL;
