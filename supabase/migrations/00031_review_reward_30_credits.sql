-- One-time customer review reward: 30 credits after two distinct completed-video downloads.
BEGIN;

ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_reference_type_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reference_type_check
  CHECK (reference_type IN ('BATCH','VIDEO_JOB','SUBSCRIPTION','TOP_UP','ADMIN_ADJUSTMENT','REVIEW_REWARD'));

CREATE TABLE IF NOT EXISTS public.review_reward_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  video_job_id UUID NOT NULL REFERENCES public.video_jobs(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, video_job_id)
);

CREATE TABLE IF NOT EXISTS public.review_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  review_text TEXT,
  published_url TEXT,
  marketing_consent BOOLEAN NOT NULL,
  credits_granted INT NOT NULL DEFAULT 30 CHECK (credits_granted = 30),
  status TEXT NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED','REVIEWED','REJECTED')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id),
  UNIQUE (user_id),
  CHECK (length(trim(COALESCE(review_text,''))) >= 40 OR published_url IS NOT NULL),
  CHECK (published_url IS NULL OR published_url ~ '^https://')
);

CREATE INDEX IF NOT EXISTS idx_review_reward_claims_created
  ON public.review_reward_claims(granted_at DESC);

ALTER TABLE public.review_reward_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_reward_downloads, public.review_reward_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.review_reward_downloads, public.review_reward_claims TO service_role;

CREATE OR REPLACE FUNCTION public.record_review_reward_download_atomic(
  p_workspace_id UUID,
  p_user_id UUID,
  p_video_job_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success',false,'error','WORKSPACE_ACCESS_DENIED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM video_jobs
    WHERE id = p_video_job_id AND workspace_id = p_workspace_id
      AND status = 'COMPLETED' AND result_video_r2_key IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('success',false,'error','COMPLETED_VIDEO_NOT_FOUND');
  END IF;

  INSERT INTO review_reward_downloads(workspace_id,user_id,video_job_id)
  VALUES(p_workspace_id,p_user_id,p_video_job_id)
  ON CONFLICT (workspace_id,user_id,video_job_id) DO NOTHING;

  SELECT count(*) INTO v_count FROM review_reward_downloads
  WHERE workspace_id=p_workspace_id AND user_id=p_user_id;
  RETURN jsonb_build_object('success',true,'download_count',v_count,'eligible',v_count>=2);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_review_reward_atomic(
  p_workspace_id UUID,
  p_user_id UUID,
  p_review_text TEXT DEFAULT NULL,
  p_published_url TEXT DEFAULT NULL,
  p_marketing_consent BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_wallet credit_wallets%ROWTYPE; v_claim review_reward_claims%ROWTYPE; v_count INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 30));
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success',false,'error','WORKSPACE_ACCESS_DENIED');
  END IF;
  IF NOT p_marketing_consent THEN
    RETURN jsonb_build_object('success',false,'error','MARKETING_CONSENT_REQUIRED');
  END IF;
  IF length(trim(COALESCE(p_review_text,''))) < 40 AND p_published_url IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','REVIEW_OR_LINK_REQUIRED');
  END IF;
  IF p_published_url IS NOT NULL AND (length(p_published_url)>1000 OR p_published_url !~ '^https://') THEN
    RETURN jsonb_build_object('success',false,'error','INVALID_PUBLISHED_URL');
  END IF;

  SELECT * INTO v_claim FROM review_reward_claims
  WHERE user_id=p_user_id OR workspace_id=p_workspace_id LIMIT 1;
  IF FOUND THEN
    SELECT balance INTO v_wallet.balance FROM credit_wallets WHERE workspace_id=p_workspace_id;
    RETURN jsonb_build_object('success',true,'idempotent',true,'claimed',true,'credits_granted',0,'balance',v_wallet.balance);
  END IF;

  SELECT count(*) INTO v_count FROM review_reward_downloads
  WHERE workspace_id=p_workspace_id AND user_id=p_user_id;
  IF v_count < 2 THEN
    RETURN jsonb_build_object('success',false,'error','TWO_DOWNLOADS_REQUIRED','download_count',v_count);
  END IF;

  SELECT * INTO v_wallet FROM credit_wallets WHERE workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','WALLET_NOT_FOUND'); END IF;

  INSERT INTO review_reward_claims(workspace_id,user_id,review_text,published_url,marketing_consent,metadata)
  VALUES(p_workspace_id,p_user_id,NULLIF(trim(p_review_text),''),p_published_url,true,
    jsonb_build_object('eligibility_download_count',v_count,'automatic_one_time_grant',true))
  RETURNING * INTO v_claim;

  UPDATE credit_wallets
  SET balance=balance+30,lifetime_granted=lifetime_granted+30,updated_at=now()
  WHERE id=v_wallet.id RETURNING * INTO v_wallet;

  INSERT INTO credit_ledger(workspace_id,wallet_id,amount,event_type,reference_type,reference_id,idempotency_key,description,metadata)
  VALUES(p_workspace_id,v_wallet.id,30,'GRANT','REVIEW_REWARD',v_claim.id,
    'review-reward:'||p_user_id::text,'Ganjaran ulasan pelanggan sekali sahaja: 30 kredit',
    jsonb_build_object('claim_id',v_claim.id,'download_count',v_count,'marketing_consent',true));

  RETURN jsonb_build_object('success',true,'claimed',true,'credits_granted',30,'balance',v_wallet.balance,'claim_id',v_claim.id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_review_reward_download_atomic(UUID,UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_review_reward_atomic(UUID,UUID,TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_review_reward_download_atomic(UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_review_reward_atomic(UUID,UUID,TEXT,TEXT,BOOLEAN) TO service_role;

COMMIT;
