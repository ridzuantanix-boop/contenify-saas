-- Durable, rate-limited recovery for genuine Nexabot outages.
-- Permanent input/moderation errors retain the existing bounded policy.
BEGIN;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS provider_recovery_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_recovery_deadline TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS video_jobs_provider_recovery_due
  ON public.video_jobs(next_retry_at)
  WHERE provider='nexabot' AND status='SUBMITTING'
    AND provider_task_id IS NULL AND next_retry_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.schedule_video_job_retry_atomic(
  p_job_id UUID,
  p_expected_provider_task_id TEXT,
  p_provider_error TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_job RECORD;
  v_delay INTERVAL;
  v_next TIMESTAMPTZ;
  v_attempt INT;
  v_effective_max INT;
  v_is_outage BOOLEAN;
  v_recovery_started TIMESTAMPTZ;
  v_recovery_deadline TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.status NOT IN ('SUBMITTING','PROCESSING') THEN
    RETURN jsonb_build_object('success',false,'error','JOB_NOT_RETRYABLE','status',v_job.status);
  END IF;
  IF p_expected_provider_task_id IS DISTINCT FROM v_job.provider_task_id THEN
    RETURN jsonb_build_object('success',true,'stale_observation',true,'status',v_job.status,'provider_task_id',v_job.provider_task_id);
  END IF;

  v_is_outage := v_job.provider_recovery_deadline IS NOT NULL OR COALESCE(p_provider_error,'') ~*
    '(timeout|timed out|econn|network|fetch failed|http 429|http 5[0-9][0-9]|gateway|service unavailable|temporar|server (error|down|unavailable)|pelayan .*terganggu|provider unavailable|capacity|overload|busy)';
  v_recovery_started := CASE WHEN v_is_outage THEN COALESCE(v_job.provider_recovery_started_at,now()) ELSE NULL END;
  v_recovery_deadline := CASE WHEN v_is_outage THEN COALESCE(v_job.provider_recovery_deadline,now()+interval '7 days') ELSE NULL END;
  v_effective_max := CASE WHEN v_is_outage THEN 168 ELSE LEAST(COALESCE(v_job.max_retries,3),3) END;

  IF v_job.retry_count >= v_effective_max OR (v_is_outage AND v_recovery_deadline<=now()) THEN
    RETURN jsonb_build_object(
      'success',true,'retry_exhausted',true,'retry_count',v_job.retry_count,
      'max_retries',v_effective_max,'recovery_mode',v_is_outage,
      'recovery_deadline',v_recovery_deadline
    );
  END IF;

  v_attempt := v_job.retry_count+1;
  v_delay := CASE
    WHEN NOT v_is_outage THEN CASE v_attempt WHEN 1 THEN interval '2 minutes' WHEN 2 THEN interval '5 minutes' ELSE interval '10 minutes' END
    WHEN v_attempt=1 THEN interval '2 minutes'
    WHEN v_attempt=2 THEN interval '5 minutes'
    WHEN v_attempt=3 THEN interval '10 minutes'
    WHEN v_attempt=4 THEN interval '20 minutes'
    WHEN v_attempt=5 THEN interval '30 minutes'
    ELSE interval '60 minutes'
  END;
  v_next := now()+v_delay;

  UPDATE video_jobs SET
    status='SUBMITTING',provider_task_id=NULL,retry_count=v_attempt,next_retry_at=v_next,
    provider_recovery_started_at=v_recovery_started,
    provider_recovery_deadline=v_recovery_deadline,
    last_provider_error=left(COALESCE(p_provider_error,'provider failure'),1000),
    error_message=CASE WHEN v_is_outage
      THEN 'Pelayan Nexabot sedang terganggu. AffiMatik akan cuba semula secara berkala sehingga pembekal pulih. Kredit kekal ditempah sekali sahaja.'
      ELSE format('Pelayan Nexabot sedang terganggu. Cubaan semula automatik %s daripada %s dijadualkan. Kredit masih ditempah dan tidak dicaj dua kali.',v_attempt,v_effective_max)
    END,
    raw_status=CASE WHEN v_is_outage THEN 'PROVIDER_OUTAGE_RECOVERY_SCHEDULED' ELSE 'RETRY_SCHEDULED' END,
    updated_at=now()
  WHERE id=p_job_id;

  INSERT INTO audit_logs(admin_email,action,resource_type,resource_id,target_type,target_id,details)
  VALUES('provider-retry@affimatik.online','VIDEO_PROVIDER_RETRY_SCHEDULED','VIDEO_JOB',p_job_id::text,'VIDEO_JOB',p_job_id::text,
    jsonb_build_object('attempt',v_attempt,'max_retries',v_effective_max,'next_retry_at',v_next,
      'provider',v_job.provider,'recovery_mode',v_is_outage,'recovery_deadline',v_recovery_deadline));

  RETURN jsonb_build_object(
    'success',true,'retry_scheduled',true,'retry_count',v_attempt,
    'max_retries',v_effective_max,'next_retry_at',v_next,
    'recovery_mode',v_is_outage,'recovery_deadline',v_recovery_deadline
  );
END $$;

REVOKE ALL ON FUNCTION public.schedule_video_job_retry_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_video_job_retry_atomic(UUID,TEXT,TEXT) TO service_role;

COMMIT;
