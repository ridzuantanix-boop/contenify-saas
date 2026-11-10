BEGIN;
UPDATE public.system_settings SET value=jsonb_set(value,'{enabled}','false'::jsonb),updated_at=now() WHERE key='nexabot_queue_config';
REVOKE ALL ON FUNCTION public.claim_next_nexabot_job_atomic(INT,INT) FROM service_role;
REVOKE ALL ON FUNCTION public.complete_nexabot_dispatch_atomic(UUID,UUID,TEXT) FROM service_role;
REVOKE ALL ON FUNCTION public.mark_nexabot_submission_started_atomic(UUID,UUID) FROM service_role;
REVOKE ALL ON FUNCTION public.recover_expired_nexabot_dispatch_leases_atomic() FROM service_role;
REVOKE ALL ON FUNCTION public.fail_nexabot_dispatch_atomic(UUID,UUID,TEXT,TEXT) FROM service_role;
REVOKE ALL ON FUNCTION public.expire_uncertain_nexabot_jobs_atomic() FROM service_role;
REVOKE ALL ON FUNCTION public.get_nexabot_queue_metrics() FROM service_role;
REVOKE ALL ON FUNCTION public.cancel_queued_nexabot_job_atomic(UUID,UUID) FROM service_role;
-- Existing jobs, costs and wallet records are intentionally preserved.
COMMIT;
