-- AffiMatik V7.2: database-backed global Nexabot queue and observed cost registry.
-- Additive and compatible with existing wallets, jobs, media and subscriptions.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.video_job_queue_sequence;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS queue_sequence BIGINT;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS enqueued_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS next_dispatch_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS dispatch_lease_until TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS dispatch_token UUID;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS dispatch_attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS submission_uncertain BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS submission_started_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS provider_model_id TEXT;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS provider_dispatched_at TIMESTAMPTZ;
-- 00022 must remain independently deployable on the production baseline. These
-- retry-observability columns were introduced by the optional 00021 release,
-- but the V7.2 queue functions below also use them directly.
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS last_provider_error TEXT;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS raw_status TEXT;
UPDATE public.video_jobs SET queue_sequence=nextval('public.video_job_queue_sequence'),enqueued_at=COALESCE(created_at,now())
WHERE status='QUEUED' AND queue_sequence IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS video_jobs_queue_sequence_unique ON public.video_jobs(queue_sequence) WHERE queue_sequence IS NOT NULL;
CREATE INDEX IF NOT EXISTS video_jobs_nexabot_queue_due ON public.video_jobs(next_dispatch_at,enqueued_at,queue_sequence)
  WHERE provider='nexabot' AND status='QUEUED';
CREATE INDEX IF NOT EXISTS video_jobs_nexabot_active ON public.video_jobs(status,provider_task_id,dispatch_lease_until)
  WHERE provider='nexabot' AND status IN ('SUBMITTING','PROCESSING');

CREATE TABLE IF NOT EXISTS public.provider_cost_registry(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL, model_identifier TEXT NOT NULL,
  duration_seconds INT NOT NULL, billing_mode TEXT NOT NULL, observed_provider_credits NUMERIC(12,4) NOT NULL,
  provider_cost_per_credit NUMERIC(14,4) NOT NULL, provider_currency TEXT NOT NULL,
  fx_rate_to_myr NUMERIC(18,8), fx_basis TEXT NOT NULL, fx_observed_at TIMESTAMPTZ,
  estimated_myr_cost NUMERIC(14,6), source TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK(verification_status IN ('OBSERVED','ESTIMATED','PARTIAL','UNVERIFIED')),
  observed_at TIMESTAMPTZ NOT NULL, sample_size INT NOT NULL DEFAULT 1, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider,model_identifier,duration_seconds,billing_mode)
);
CREATE TABLE IF NOT EXISTS public.provider_job_costs(
  job_id UUID PRIMARY KEY REFERENCES public.video_jobs(id) ON DELETE CASCADE,
  cost_registry_id UUID REFERENCES public.provider_cost_registry(id) ON DELETE SET NULL,
  observed_provider_credits NUMERIC(12,4), estimated_myr_cost NUMERIC(14,6),
  cost_status TEXT NOT NULL CHECK(cost_status IN ('OBSERVED','ESTIMATED','UNKNOWN')),
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.provider_cost_registry,public.provider_job_costs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.provider_cost_registry,public.provider_job_costs TO service_role;

INSERT INTO public.provider_cost_registry(provider,model_identifier,duration_seconds,billing_mode,observed_provider_credits,
 provider_cost_per_credit,provider_currency,fx_rate_to_myr,fx_basis,fx_observed_at,estimated_myr_cost,source,
 verification_status,observed_at,sample_size,metadata)
VALUES('nexabot','376',15,'standard_credit',0.15,1000,'IDR',0.00030,
 'CONSERVATIVE_CONFIGURED_FX_NOT_SETTLED',now(),0.045,
 'AffiMatik controlled concurrency test 2026-11-10: 3 completed i2v jobs',
 'PARTIAL',TIMESTAMPTZ '2026-11-10 00:00:00+08',3,
 '{"batch_provider_credits":0.45,"mean_duration_seconds":67.064,"batch_completion_seconds":70.139,"http_acceptance":"3_of_3"}'::jsonb)
ON CONFLICT(provider,model_identifier,duration_seconds,billing_mode) DO UPDATE SET
 observed_provider_credits=excluded.observed_provider_credits,provider_cost_per_credit=excluded.provider_cost_per_credit,
 provider_currency=excluded.provider_currency,fx_rate_to_myr=excluded.fx_rate_to_myr,fx_basis=excluded.fx_basis,
 fx_observed_at=excluded.fx_observed_at,estimated_myr_cost=excluded.estimated_myr_cost,source=excluded.source,
 verification_status=excluded.verification_status,observed_at=excluded.observed_at,sample_size=excluded.sample_size,metadata=excluded.metadata,updated_at=now();

INSERT INTO public.system_settings(key,value,updated_at) VALUES
 ('nexabot_queue_config','{"maxActive":3,"submissionLeaseSeconds":180,"uncertainHoldMinutes":45,"enabled":true}'::jsonb,now()),
 ('nexabot_circuit','{"consecutiveFailures":0,"openUntil":null,"lastError":""}'::jsonb,now())
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.system_settings(key,value,updated_at) VALUES('provider_unit_costs',
 '{"nexabot_model":"376","nexabot_15s_provider_credits":0.15,"provider_credit_price_idr":1000,"estimated_myr":0.045,"conservative_reserve_myr":0.15,"fx_rate_to_myr":0.00030,"fx_basis":"CONSERVATIVE_CONFIGURED_FX_NOT_SETTLED","source":"controlled_3_job_test_2026-11-10","verification_status":"PARTIAL"}'::jsonb,now())
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

CREATE OR REPLACE FUNCTION public.admit_nexabot_job_to_queue_atomic(
 p_workspace_id UUID,p_user_id UUID,p_job_id UUID,p_client_request_id VARCHAR,p_preset_id VARCHAR,
 p_preset_version INT,p_provider VARCHAR,p_duration_seconds INT,p_required_credits INT,p_max_concurrency INT,
 p_compiled_prompt TEXT,p_input_options JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result JSONB; v_sequence BIGINT;
BEGIN
  SELECT public.admit_video_job_atomic(p_workspace_id,p_user_id,p_job_id,p_client_request_id,p_preset_id,
    p_preset_version,p_provider,p_duration_seconds,p_required_credits,p_max_concurrency,p_compiled_prompt,p_input_options) INTO v_result;
  IF COALESCE((v_result->>'success')::boolean,false) IS NOT TRUE OR COALESCE((v_result->>'is_duplicate')::boolean,false) IS TRUE THEN
    RETURN v_result;
  END IF;
  IF p_provider<>'nexabot' THEN RETURN v_result; END IF;
  v_sequence:=nextval('public.video_job_queue_sequence');
  UPDATE video_jobs SET status='QUEUED',queue_sequence=v_sequence,enqueued_at=now(),next_dispatch_at=now(),
    provider_model_id='376',raw_status='QUEUE_WAITING',updated_at=now() WHERE id=p_job_id;
  RETURN v_result||jsonb_build_object('status','QUEUED','queue_sequence',v_sequence);
END $$;

CREATE OR REPLACE FUNCTION public.claim_next_nexabot_job_atomic(p_max_active INT DEFAULT 3,p_lease_seconds INT DEFAULT 180)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_active INT; v_job RECORD; v_token UUID; v_circuit JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_nexabot_global_queue',0));
  SELECT value INTO v_circuit FROM system_settings WHERE key='nexabot_circuit';
  IF nullif(v_circuit->>'openUntil','') IS NOT NULL AND (v_circuit->>'openUntil')::timestamptz>now() THEN
    RETURN jsonb_build_object('success',true,'claimed',false,'circuit_open',true,'open_until',v_circuit->>'openUntil');
  END IF;
  SELECT count(*) INTO v_active FROM video_jobs WHERE provider='nexabot' AND (
    (status='PROCESSING' AND provider_task_id IS NOT NULL) OR
    (status='SUBMITTING' AND dispatch_lease_until>now())
  );
  IF v_active>=LEAST(GREATEST(p_max_active,1),3) THEN
    RETURN jsonb_build_object('success',true,'claimed',false,'capacity_full',true,'active_count',v_active,'max_active',3);
  END IF;
  SELECT q.* INTO v_job FROM (
    SELECT j.*,COALESCE((SELECT max(x.provider_dispatched_at) FROM video_jobs x
      WHERE x.workspace_id=j.workspace_id AND x.provider='nexabot'),TIMESTAMPTZ 'epoch') AS workspace_last_dispatch
    FROM video_jobs j WHERE j.provider='nexabot' AND j.status='QUEUED'
      AND COALESCE(j.next_dispatch_at,j.enqueued_at,j.created_at)<=now()
    ORDER BY workspace_last_dispatch ASC,j.enqueued_at ASC,j.queue_sequence ASC
    FOR UPDATE SKIP LOCKED LIMIT 1
  ) q;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'claimed',false,'active_count',v_active,'max_active',3); END IF;
  v_token:=gen_random_uuid();
  UPDATE video_jobs SET status='SUBMITTING',dispatch_token=v_token,dispatch_lease_until=now()+make_interval(secs=>LEAST(GREATEST(p_lease_seconds,30),600)),
    dispatch_attempt_count=dispatch_attempt_count+1,provider_dispatched_at=now(),submission_uncertain=false,
    submission_started_at=NULL,raw_status='DISPATCH_CLAIMED',updated_at=now() WHERE id=v_job.id;
  RETURN jsonb_build_object('success',true,'claimed',true,'job_id',v_job.id,'dispatch_token',v_token,
    'active_count',v_active+1,'max_active',3,'dispatch_attempt_count',v_job.dispatch_attempt_count+1);
END $$;

CREATE OR REPLACE FUNCTION public.mark_nexabot_submission_started_atomic(p_job_id UUID,p_dispatch_token UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE video_jobs SET submission_started_at=now(),raw_status='PROVIDER_SUBMISSION_STARTED',updated_at=now()
 WHERE id=p_job_id AND status='SUBMITTING' AND dispatch_token=p_dispatch_token AND provider_task_id IS NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','DISPATCH_CLAIM_LOST');END IF;
 RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.recover_expired_nexabot_dispatch_leases_atomic()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_safe INT:=0;v_uncertain INT:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_nexabot_global_queue',0));
 UPDATE video_jobs SET status='QUEUED',dispatch_token=NULL,dispatch_lease_until=NULL,next_dispatch_at=now(),
   raw_status='DISPATCH_LEASE_RECOVERED_SAFE',updated_at=now()
 WHERE provider='nexabot' AND status='SUBMITTING' AND provider_task_id IS NULL AND submission_uncertain=false
   AND submission_started_at IS NULL AND dispatch_lease_until<=now();
 GET DIAGNOSTICS v_safe=ROW_COUNT;
 UPDATE video_jobs SET submission_uncertain=true,dispatch_lease_until=now()+interval '45 minutes',
   raw_status='SUBMISSION_OUTCOME_UNCERTAIN',error_message='Worker terhenti selepas penghantaran bermula. Tugasan tidak akan dihantar semula tanpa task ID.',updated_at=now()
 WHERE provider='nexabot' AND status='SUBMITTING' AND provider_task_id IS NULL AND submission_uncertain=false
   AND submission_started_at IS NOT NULL AND dispatch_lease_until<=now();
 GET DIAGNOSTICS v_uncertain=ROW_COUNT;
 RETURN jsonb_build_object('success',true,'safe_requeued',v_safe,'marked_uncertain',v_uncertain);
END $$;

CREATE OR REPLACE FUNCTION public.complete_nexabot_dispatch_atomic(p_job_id UUID,p_dispatch_token UUID,p_provider_task_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD; v_cost UUID;
BEGIN
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.provider_task_id=p_provider_task_id AND v_job.status='PROCESSING' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true); END IF;
  IF v_job.status<>'SUBMITTING' OR v_job.dispatch_token IS DISTINCT FROM p_dispatch_token OR v_job.provider_task_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','DISPATCH_CLAIM_LOST');
  END IF;
  UPDATE video_jobs SET status='PROCESSING',provider_task_id=p_provider_task_id,dispatch_lease_until=NULL,
    submission_uncertain=false,raw_status='PROVIDER_ACCEPTED',error_message=NULL,updated_at=now() WHERE id=p_job_id;
  SELECT id INTO v_cost FROM provider_cost_registry WHERE provider='nexabot' AND model_identifier=COALESCE(v_job.provider_model_id,'376')
    AND duration_seconds=v_job.duration_seconds AND billing_mode='standard_credit';
  IF v_cost IS NOT NULL THEN INSERT INTO provider_job_costs(job_id,cost_registry_id,observed_provider_credits,estimated_myr_cost,cost_status)
    SELECT p_job_id,id,observed_provider_credits,estimated_myr_cost,'ESTIMATED' FROM provider_cost_registry WHERE id=v_cost
    ON CONFLICT(job_id) DO NOTHING; END IF;
  UPDATE system_settings SET value=jsonb_build_object('consecutiveFailures',0,'openUntil',NULL,'lastError',''),updated_at=now() WHERE key='nexabot_circuit';
  RETURN jsonb_build_object('success',true,'job_id',p_job_id,'provider_task_id',p_provider_task_id);
END $$;

CREATE OR REPLACE FUNCTION public.fail_nexabot_dispatch_atomic(p_job_id UUID,p_dispatch_token UUID,p_failure_class TEXT,p_error TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD; v_delay INT; v_failures INT; v_open TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
  IF v_job.dispatch_token IS DISTINCT FROM p_dispatch_token OR v_job.status<>'SUBMITTING' THEN
    RETURN jsonb_build_object('success',false,'error','DISPATCH_CLAIM_LOST');
  END IF;
  IF p_failure_class='AMBIGUOUS' THEN
    UPDATE video_jobs SET submission_uncertain=true,dispatch_lease_until=now()+interval '45 minutes',
      raw_status='SUBMISSION_OUTCOME_UNCERTAIN',error_message='Status penghantaran ke Nexabot belum dapat dipastikan. Sistem tidak akan menghantar semula secara membuta tuli.',updated_at=now() WHERE id=p_job_id;
    RETURN jsonb_build_object('success',true,'submission_uncertain',true,'hold_until',now()+interval '45 minutes');
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

CREATE OR REPLACE FUNCTION public.expire_uncertain_nexabot_jobs_atomic()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD; v_count INT:=0;
BEGIN
  FOR v_job IN SELECT * FROM video_jobs WHERE provider='nexabot' AND status='SUBMITTING' AND submission_uncertain=true
    AND dispatch_lease_until<=now() FOR UPDATE SKIP LOCKED LOOP
    PERFORM release_credits_atomic(v_job.workspace_id,v_job.id,'rel_uncertain_'||v_job.id::text,
      'Tempahan kredit dipulangkan selepas keputusan penghantaran Nexabot tidak dapat disahkan; tiada penghantaran semula dibuat.');
    UPDATE video_jobs SET status='FAILED',dispatch_token=NULL,dispatch_lease_until=NULL,
      error_message='Nexabot tidak dapat mengesahkan penerimaan tugasan. Kredit dipulangkan dan video tidak dihantar semula bagi mengelakkan caj berganda.',
      raw_status='SUBMISSION_UNCERTAIN_EXPIRED',updated_at=now() WHERE id=v_job.id;
    v_count:=v_count+1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'expired_count',v_count);
END $$;

CREATE OR REPLACE FUNCTION public.get_nexabot_queue_metrics()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object(
  'active',count(*) FILTER(WHERE status='PROCESSING' AND provider_task_id IS NOT NULL),
  'dispatching',count(*) FILTER(WHERE status='SUBMITTING' AND dispatch_lease_until>now()),
  'queued',count(*) FILTER(WHERE status='QUEUED'),
  'completed',count(*) FILTER(WHERE status='COMPLETED'),
  'failed',count(*) FILTER(WHERE status='FAILED'),
  'average_duration_seconds',round(avg(actual_duration_seconds) FILTER(WHERE status='COMPLETED'),3),
  'estimated_provider_spend_myr',COALESCE((SELECT sum(estimated_myr_cost) FROM provider_job_costs),0),
  'observed_provider_credits',COALESCE((SELECT sum(COALESCE((metadata->>'batch_provider_credits')::numeric,observed_provider_credits*sample_size)) FROM provider_cost_registry WHERE verification_status IN('OBSERVED','PARTIAL')),0),
  'estimated_provider_credits',COALESCE((SELECT sum(observed_provider_credits) FROM provider_job_costs),0)
  ,'outstanding_customer_credits',COALESCE((SELECT sum(balance) FROM credit_wallets),0)
  ,'estimated_credit_liability_myr',round(COALESCE((SELECT sum(balance) FROM credit_wallets),0)/10.0*0.045,2)
  ,'provider_balance',NULL
 ) FROM video_jobs WHERE provider='nexabot';
$$;

CREATE OR REPLACE FUNCTION public.cancel_queued_nexabot_job_atomic(p_job_id UUID,p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD;v_release JSONB;
BEGIN
 SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id AND workspace_id=p_workspace_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND');END IF;
 IF v_job.status='CANCELLED' THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true);END IF;
 IF v_job.status<>'QUEUED' OR v_job.provider_task_id IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error','ONLY_WAITING_JOB_CAN_BE_CANCELLED');END IF;
 SELECT release_credits_atomic(v_job.workspace_id,v_job.id,'rel_queue_cancel_'||v_job.id::text,'Pelanggan membatalkan tugasan sebelum dihantar ke Nexabot.') INTO v_release;
 IF COALESCE((v_release->>'success')::boolean,false) IS NOT TRUE THEN RETURN v_release;END IF;
 UPDATE video_jobs SET status='CANCELLED',next_dispatch_at=NULL,raw_status='QUEUE_CANCELLED',error_message='Tugasan dibatalkan sebelum dihantar. Kredit telah dipulangkan.',updated_at=now() WHERE id=v_job.id;
 RETURN jsonb_build_object('success',true,'credit_restored',true,'job_id',v_job.id);
END $$;

-- Provider-declared failed tasks may be retried, but every retry must acquire
-- one of the same three global slots. Polling/network errors never use this RPC.
CREATE OR REPLACE FUNCTION public.claim_video_job_retry_atomic(p_job_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD;v_active INT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('affimatik_nexabot_global_queue',0));
 SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND'); END IF;
 IF v_job.status<>'SUBMITTING' OR v_job.provider_task_id IS NOT NULL OR v_job.next_retry_at IS NULL OR v_job.next_retry_at>now() THEN
   RETURN jsonb_build_object('success',true,'claimed',false,'status',v_job.status,'next_retry_at',v_job.next_retry_at);END IF;
 SELECT count(*) INTO v_active FROM video_jobs WHERE provider='nexabot' AND ((status='PROCESSING' AND provider_task_id IS NOT NULL) OR (status='SUBMITTING' AND dispatch_lease_until>now()));
 IF v_active>=3 THEN RETURN jsonb_build_object('success',true,'claimed',false,'capacity_full',true,'active_count',v_active);END IF;
 UPDATE video_jobs SET last_retry_at=now(),next_retry_at=now()+interval '15 minutes',dispatch_lease_until=now()+interval '15 minutes',raw_status='RETRY_DISPATCHING',updated_at=now() WHERE id=p_job_id;
 RETURN jsonb_build_object('success',true,'claimed',true,'retry_count',v_job.retry_count,'max_retries',v_job.max_retries);
END $$;

CREATE OR REPLACE FUNCTION public.complete_video_job_retry_dispatch_atomic(p_job_id UUID,p_provider_task_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD;
BEGIN
 IF nullif(trim(p_provider_task_id),'') IS NULL THEN RETURN jsonb_build_object('success',false,'error','PROVIDER_TASK_ID_REQUIRED');END IF;
 SELECT * INTO v_job FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','JOB_NOT_FOUND');END IF;
 IF v_job.status='PROCESSING' AND v_job.provider_task_id=p_provider_task_id THEN RETURN jsonb_build_object('success',true,'idempotent_replay',true);END IF;
 IF v_job.status<>'SUBMITTING' OR v_job.provider_task_id IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error','RETRY_CLAIM_LOST');END IF;
 UPDATE video_jobs SET status='PROCESSING',provider_task_id=p_provider_task_id,next_retry_at=NULL,dispatch_lease_until=NULL,error_message=NULL,raw_status='RETRY_SUBMITTED',updated_at=now() WHERE id=p_job_id;
 RETURN jsonb_build_object('success',true,'provider_task_id',p_provider_task_id,'retry_count',v_job.retry_count);
END $$;

REVOKE ALL ON FUNCTION public.admit_nexabot_job_to_queue_atomic(UUID,UUID,UUID,VARCHAR,VARCHAR,INT,VARCHAR,INT,INT,INT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_next_nexabot_job_atomic(INT,INT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_nexabot_dispatch_atomic(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_nexabot_submission_started_atomic(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.recover_expired_nexabot_dispatch_leases_atomic() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_nexabot_dispatch_atomic(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_uncertain_nexabot_jobs_atomic() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_nexabot_queue_metrics() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_queued_nexabot_job_atomic(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_nexabot_job_to_queue_atomic(UUID,UUID,UUID,VARCHAR,VARCHAR,INT,VARCHAR,INT,INT,INT,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_nexabot_job_atomic(INT,INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_nexabot_dispatch_atomic(UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_nexabot_submission_started_atomic(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_expired_nexabot_dispatch_leases_atomic() TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_nexabot_dispatch_atomic(UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_uncertain_nexabot_jobs_atomic() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_nexabot_queue_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_queued_nexabot_job_atomic(UUID,UUID) TO service_role;
COMMIT;
