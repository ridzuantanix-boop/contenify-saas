-- Run only after confirming no V7 data must be retained.
ALTER TABLE public.video_jobs DROP COLUMN IF EXISTS creator_preset_id;
ALTER TABLE public.video_jobs DROP COLUMN IF EXISTS background_id;
DROP FUNCTION IF EXISTS public.set_creator_preset_default(UUID, UUID);
DROP TABLE IF EXISTS public.creator_presets;
DROP TABLE IF EXISTS public.background_assets;
