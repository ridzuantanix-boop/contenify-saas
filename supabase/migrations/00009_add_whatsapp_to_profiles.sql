-- ============================================================================
-- AFFIMATIK by Pawarna — Soft Launch V1.0 Migration 00009
-- Add Mandatory WhatsApp Number to Customer Profiles
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);
COMMENT ON COLUMN profiles.whatsapp IS 'Mandatory customer WhatsApp contact number for soft launch notification and support';
