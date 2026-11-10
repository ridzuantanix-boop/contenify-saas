-- Credit-safe, persistent retry scheduling for transient Nexabot failures.
-- A reservation stays pending while retries run and settles/releases once only.
BEGIN;

ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS last_provider_error TEXT;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS raw_status TEXT;
CREATE INDEX IF NOT EXISTS video_jobs_retry_due
  ON public.video_jobs(next_retry_at)
  WHERE status='SUBMITTING' AND provider_task_id IS NULL AND next_retry_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.schedule_video_job_retry_atomic(
  p_job_id UUID,
  p_expected_provider_task_id TEXT,
  p_provider_error TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD; v_delay INTERVAL; v_next TIMESTAMPTZ; v_attempt INT;
BEGIN
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.status NOT IN ('SUBMITTING','PROCESSING') THEN
    RETURN jsonb_build_object('success',false,'error','JOB_NOT_RETRYABLE','status',v_job.status);
  END IF;
  IF p_expected_provider_task_id IS DISTINCT FROM v_job.provider_task_id THEN
    RETURN jsonb_build_object('success',true,'stale_observation',true,'status',v_job.status,'provider_task_id',v_job.provider_task_id);
  END IF;
  IF v_job.retry_count >= v_job.max_retries THEN
    RETURN jsonb_build_object('success',true,'retry_exhausted',true,'retry_count',v_job.retry_count,'max_retries',v_job.max_retries);
  END IF;
  v_attempt:=v_job.retry_count+1;
  v_delay:=CASE v_attempt WHEN 1 THEN interval '2 minutes' WHEN 2 THEN interval '5 minutes' ELSE interval '10 minutes' END;
  v_next:=now()+v_delay;
  UPDATE video_jobs SET status='SUBMITTING',provider_task_id=NULL,retry_count=v_attempt,next_retry_at=v_next,
    last_provider_error=left(COALESCE(p_provider_error,'provider failure'),1000),
    error_message=format('Pelayan Nexabot sedang terganggu. Cubaan semula automatik %s daripada %s dijadualkan. Kredit masih ditempah dan tidak dicaj dua kali.',v_attempt,v_job.max_retries),
    raw_status='RETRY_SCHEDULED',updated_at=now()
  WHERE id=p_job_id;
  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES('provider-retry@affimatik.online','VIDEO_PROVIDER_RETRY_SCHEDULED','VIDEO_JOB',p_job_id::text,'VIDEO_JOB',p_job_id::text,
    jsonb_build_object('attempt',v_attempt,'max_retries',v_job.max_retries,'next_retry_at',v_next,'provider',v_job.provider));
  RETURN jsonb_build_object('success',true,'retry_scheduled',true,'retry_count',v_attempt,'max_retries',v_job.max_retries,'next_retry_at',v_next);
END $$;

CREATE OR REPLACE FUNCTION public.claim_video_job_retry_atomic(p_job_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.status<>'SUBMITTING' OR v_job.provider_task_id IS NOT NULL OR v_job.next_retry_at IS NULL OR v_job.next_retry_at>now() THEN
    RETURN jsonb_build_object('success',true,'claimed',false,'status',v_job.status,'next_retry_at',v_job.next_retry_at);
  END IF;
  UPDATE video_jobs SET last_retry_at=now(),next_retry_at=now()+interval '15 minutes',raw_status='RETRY_DISPATCHING',updated_at=now()
  WHERE id=p_job_id;
  RETURN jsonb_build_object('success',true,'claimed',true,'retry_count',v_job.retry_count,'max_retries',v_job.max_retries);
END $$;

CREATE OR REPLACE FUNCTION public.complete_video_job_retry_dispatch_atomic(p_job_id UUID,p_provider_task_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD;
BEGIN
  IF nullif(trim(p_provider_task_id),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','PROVIDER_TASK_ID_REQUIRED'); END IF;
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.status='PROCESSING' AND v_job.provider_task_id=p_provider_task_id THEN
    RETURN jsonb_build_object('success',true,'idempotent_replay',true);
  END IF;
  IF v_job.status<>'SUBMITTING' OR v_job.provider_task_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','RETRY_CLAIM_LOST','status',v_job.status);
  END IF;
  UPDATE video_jobs SET status='PROCESSING',provider_task_id=p_provider_task_id,next_retry_at=NULL,error_message=NULL,
    raw_status='RETRY_SUBMITTED',updated_at=now() WHERE id=p_job_id;
  RETURN jsonb_build_object('success',true,'provider_task_id',p_provider_task_id,'retry_count',v_job.retry_count);
END $$;

REVOKE ALL ON FUNCTION public.schedule_video_job_retry_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_video_job_retry_atomic(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_video_job_retry_dispatch_atomic(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_video_job_retry_atomic(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_video_job_retry_atomic(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_video_job_retry_dispatch_atomic(UUID,TEXT) TO service_role;

COMMIT;
