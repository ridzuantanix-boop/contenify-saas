-- Keep customer originals untouched while allowing a smaller deterministic
-- transport copy to be sent to Nexabot's base64-only API.
BEGIN;

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS provider_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_size_bytes BIGINT;

ALTER TABLE public.background_assets
  ADD COLUMN IF NOT EXISTS provider_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_size_bytes BIGINT;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS provider_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_size_bytes BIGINT;

ALTER TABLE public.avatars DROP CONSTRAINT IF EXISTS avatars_provider_size_check;
ALTER TABLE public.avatars ADD CONSTRAINT avatars_provider_size_check CHECK (provider_size_bytes IS NULL OR provider_size_bytes BETWEEN 8 AND 1572864);
ALTER TABLE public.background_assets DROP CONSTRAINT IF EXISTS background_assets_provider_size_check;
ALTER TABLE public.background_assets ADD CONSTRAINT background_assets_provider_size_check CHECK (provider_size_bytes IS NULL OR provider_size_bytes BETWEEN 8 AND 1572864);
ALTER TABLE public.product_images DROP CONSTRAINT IF EXISTS product_images_provider_size_check;
ALTER TABLE public.product_images ADD CONSTRAINT product_images_provider_size_check CHECK (provider_size_bytes IS NULL OR provider_size_bytes BETWEEN 8 AND 1572864);

COMMIT;
