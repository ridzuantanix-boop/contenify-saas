BEGIN;

ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS qa_started_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS qa_reviewed_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS qa_reviewed_by UUID;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS qa_reason TEXT;
ALTER TABLE public.video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_check;
ALTER TABLE public.video_jobs ADD CONSTRAINT video_jobs_status_check CHECK (status IN (
  'DRAFT','VALIDATING','QUEUED','RESEARCHING','PROMPT_READY','SUBMITTING',
  'GENERATING','PROCESSING','QUALITY_CHECK','QA_PENDING','COMPLETED','REJECTED',
  'FAILED','FAILED_RETRYABLE','FAILED_FINAL','CANCELLED'
));
CREATE INDEX IF NOT EXISTS idx_video_jobs_qa_pending ON public.video_jobs(qa_started_at)
  WHERE status = 'QA_PENDING';

-- A pending human review retains the wallet reservation and therefore counts
-- toward the same workspace concurrency limit as generation.
DO $guard$ DECLARE v_sql TEXT; v_old TEXT;
BEGIN
  SELECT pg_get_functiondef('public.admit_video_job_atomic(uuid,uuid,uuid,character varying,character varying,integer,character varying,integer,integer,integer,text,jsonb)'::regprocedure) INTO v_sql;
  v_old := 'AND status IN (''QUEUED'', ''SUBMITTING'', ''PROCESSING'')';
  IF position(v_old IN v_sql)=0 THEN RAISE EXCEPTION 'Job admission concurrency predicate changed; review required'; END IF;
  v_sql := replace(v_sql,v_old,'AND status IN (''QUEUED'', ''SUBMITTING'', ''PROCESSING'', ''QA_PENDING'')');
  EXECUTE v_sql;
END $guard$;

CREATE OR REPLACE FUNCTION public.review_video_job_atomic(
  p_job_id UUID,
  p_decision TEXT,
  p_reason TEXT,
  p_reviewer UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_job public.video_jobs%ROWTYPE;
  v_result JSONB;
BEGIN
  IF p_decision NOT IN ('APPROVE','REJECT') THEN
    RETURN jsonb_build_object('success',false,'error','Invalid QA decision');
  END IF;
  IF p_decision = 'REJECT' AND nullif(trim(p_reason),'') IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Rejection reason required');
  END IF;

  SELECT * INTO v_job FROM public.video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Job not found'); END IF;
  IF (v_job.status='COMPLETED' AND p_decision='APPROVE') OR
     (v_job.status='REJECTED' AND p_decision='REJECT') THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status',v_job.status);
  END IF;
  IF v_job.status <> 'QA_PENDING' OR v_job.result_video_r2_key IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Job is not awaiting media review');
  END IF;

  IF p_decision='APPROVE' THEN
    IF v_job.actual_duration_seconds IS NULL OR
       abs(v_job.actual_duration_seconds-v_job.duration_seconds)>0.5 OR
       (v_job.provider='nexabot' AND v_job.output_has_audio IS DISTINCT FROM true) THEN
      RETURN jsonb_build_object('success',false,'error','Media metadata fails duration or audio gate');
    END IF;
    SELECT public.settle_credits_atomic(v_job.workspace_id,v_job.id,v_job.required_credits,('stl_'||v_job.id::text)::varchar)
      INTO v_result;
    IF COALESCE((v_result->>'success')::boolean,false) IS NOT TRUE THEN
      RETURN jsonb_build_object('success',false,'error',v_result->>'error');
    END IF;
    UPDATE public.video_jobs SET status='COMPLETED',qa_reviewed_at=now(),qa_reviewed_by=p_reviewer,
      qa_reason=nullif(trim(p_reason),''),completed_at=now(),updated_at=now()
      WHERE id=p_job_id;
    INSERT INTO public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,payload,admin_email,target_type,target_id,details)
      VALUES(v_job.workspace_id,p_reviewer,'VIDEO_QA_REVIEW','VIDEO_JOB',p_job_id::text,
        jsonb_build_object('decision','APPROVE','reason',p_reason),coalesce(p_reviewer::text,'system-qa'),
        'VIDEO_JOB',p_job_id::text,jsonb_build_object('decision','APPROVE','reason',p_reason));
    RETURN jsonb_build_object('success',true,'status','COMPLETED');
  END IF;

  SELECT public.release_credits_atomic(v_job.workspace_id,v_job.id,('rel_qa_'||v_job.id::text)::varchar)
    INTO v_result;
  IF COALESCE((v_result->>'success')::boolean,false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success',false,'error',v_result->>'error');
  END IF;
  UPDATE public.video_jobs SET status='REJECTED',qa_reviewed_at=now(),qa_reviewed_by=p_reviewer,
    qa_reason=trim(p_reason),error_message=trim(p_reason),updated_at=now()
    WHERE id=p_job_id;
  INSERT INTO public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,payload,admin_email,target_type,target_id,details)
    VALUES(v_job.workspace_id,p_reviewer,'VIDEO_QA_REVIEW','VIDEO_JOB',p_job_id::text,
      jsonb_build_object('decision','REJECT','reason',p_reason),coalesce(p_reviewer::text,'system-qa'),
      'VIDEO_JOB',p_job_id::text,jsonb_build_object('decision','REJECT','reason',p_reason));
  RETURN jsonb_build_object('success',true,'status','REJECTED');
END; $$;

REVOKE ALL ON FUNCTION public.review_video_job_atomic(UUID,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_video_job_atomic(UUID,TEXT,TEXT,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_video_qa_atomic()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id UUID; v_count INT := 0; v_result JSONB;
BEGIN
  FOR v_id IN SELECT id FROM public.video_jobs
    WHERE status='QA_PENDING' AND qa_started_at < now()-interval '24 hours'
    ORDER BY qa_started_at LIMIT 20 FOR UPDATE SKIP LOCKED
  LOOP
    SELECT public.review_video_job_atomic(v_id,'REJECT','Semakan kualiti tamat selepas 24 jam.',NULL) INTO v_result;
    IF COALESCE((v_result->>'success')::boolean,false) THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('success',true,'expired',v_count);
END; $$;
REVOKE ALL ON FUNCTION public.expire_video_qa_atomic() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_video_qa_atomic() TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_workspace_metrics(p_workspace_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'product_images',(SELECT count(*) FROM product_images WHERE workspace_id=p_workspace_id),
    'saved_videos',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status='COMPLETED' AND result_video_r2_key IS NOT NULL),
    'completed_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status='COMPLETED'),
    'active_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status IN ('QUEUED','SUBMITTING','PROCESSING','QA_PENDING')),
    'failed_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status IN ('FAILED','REJECTED')),
    'total_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id)
  );
$$;
REVOKE ALL ON FUNCTION public.dashboard_workspace_metrics(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_workspace_metrics(UUID) TO service_role;

COMMIT;
