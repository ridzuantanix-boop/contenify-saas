BEGIN;
REVOKE ALL ON FUNCTION public.schedule_video_job_retry_atomic(UUID,TEXT,TEXT) FROM service_role;
REVOKE ALL ON FUNCTION public.claim_video_job_retry_atomic(UUID) FROM service_role;
REVOKE ALL ON FUNCTION public.complete_video_job_retry_dispatch_atomic(UUID,TEXT) FROM service_role;
UPDATE public.video_jobs SET next_retry_at=NULL WHERE next_retry_at IS NOT NULL;
COMMIT;
