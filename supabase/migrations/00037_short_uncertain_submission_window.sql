-- Do not leave a customer watching an unconfirmed provider submission for 45
-- minutes. Tasks with a confirmed provider_task_id retain durable recovery;
-- only submissions for which Nexabot returned no task id use this five-minute
-- safety window before the existing atomic credit release runs.
BEGIN;

CREATE OR REPLACE FUNCTION public.fail_nexabot_dispatch_atomic(
  p_job_id UUID,
  p_dispatch_token UUID,
  p_failure_class TEXT,
  p_error TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD; v_delay INT; v_failures INT; v_open TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.dispatch_token IS DISTINCT FROM p_dispatch_token OR v_job.status<>'SUBMITTING' THEN
    RETURN jsonb_build_object('success',false,'error','DISPATCH_CLAIM_LOST');
  END IF;
  IF p_failure_class='AMBIGUOUS' THEN
    UPDATE video_jobs SET submission_uncertain=true,dispatch_lease_until=now()+interval '5 minutes',
      raw_status='SUBMISSION_OUTCOME_UNCERTAIN',
      error_message='Penerimaan Nexabot sedang disahkan. Jika tiada task ID diterima, kredit dipulangkan secara automatik dalam masa lima minit.',
      updated_at=now() WHERE id=p_job_id;
    RETURN jsonb_build_object('success',true,'submission_uncertain',true,'hold_until',now()+interval '5 minutes');
  ELSIF p_failure_class='TRANSIENT' THEN
    v_delay:=LEAST(600,30*power(2,LEAST(v_job.dispatch_attempt_count,4))::int);
    UPDATE video_jobs SET status='QUEUED',dispatch_token=NULL,dispatch_lease_until=NULL,next_dispatch_at=now()+make_interval(secs=>v_delay),
      raw_status='PROVIDER_COOLDOWN',error_message='Pelayan Nexabot sedang sibuk. Tugasan kekal dalam giliran dan akan dicuba semula tanpa caj berganda.',updated_at=now() WHERE id=p_job_id;
    SELECT COALESCE((value->>'consecutiveFailures')::int,0)+1 INTO v_failures FROM system_settings WHERE key='nexabot_circuit' FOR UPDATE;
    v_open:=CASE WHEN v_failures>=3 THEN now()+interval '2 minutes' ELSE NULL END;
    UPDATE system_settings SET value=jsonb_build_object('consecutiveFailures',v_failures,'openUntil',v_open,'lastError',left(COALESCE(p_error,''),500)),updated_at=now() WHERE key='nexabot_circuit';
    RETURN jsonb_build_object('success',true,'requeued',true,'retry_after_seconds',v_delay,'circuit_open_until',v_open);
  END IF;
  UPDATE video_jobs SET dispatch_lease_until=NULL,raw_status='DISPATCH_FINAL_FAILURE',error_message=left(COALESCE(p_error,'Nexabot dispatch failed'),1000),updated_at=now() WHERE id=p_job_id;
  RETURN jsonb_build_object('success',true,'finalize_required',true);
END $$;

REVOKE ALL ON FUNCTION public.fail_nexabot_dispatch_atomic(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_nexabot_dispatch_atomic(UUID,UUID,TEXT,TEXT) TO service_role;

COMMIT;
