BEGIN;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS actual_duration_seconds NUMERIC(8,3);
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS output_has_audio BOOLEAN;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS output_size_bytes BIGINT;
COMMIT;
