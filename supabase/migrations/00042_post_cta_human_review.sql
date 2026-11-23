-- Advisory human-review evidence only. Never changes job status or credit accounting.
BEGIN;

CREATE TABLE IF NOT EXISTS public.video_quality_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.video_jobs(id) ON DELETE CASCADE,
  provider_task_id TEXT,
  asset_id TEXT NOT NULL, -- video_jobs.result_video_r2_key is the durable output asset identifier
  code TEXT NOT NULL CHECK (code IN ('POST_CTA_SPEECH_REVIEW', 'PRODUCT_FACT_REVIEW')),
  category TEXT NOT NULL CHECK (category IN ('SPEECH', 'PRODUCT_FACT')),
  issue TEXT NOT NULL CHECK (length(issue) BETWEEN 3 AND 400),
  start_seconds NUMERIC(8,3),
  end_seconds NUMERIC(8,3),
  transcript_evidence TEXT NOT NULL CHECK (length(transcript_evidence) BETWEEN 1 AND 1000),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_note TEXT,
  CONSTRAINT video_quality_flags_code_category CHECK (
    (code='POST_CTA_SPEECH_REVIEW' AND category='SPEECH') OR
    (code='PRODUCT_FACT_REVIEW' AND category='PRODUCT_FACT')
  ),
  CONSTRAINT video_quality_flags_interval CHECK (
    (start_seconds IS NULL AND end_seconds IS NULL) OR
    (start_seconds >= 0 AND end_seconds >= start_seconds AND end_seconds <= 60)
  ),
  CONSTRAINT video_quality_flags_once UNIQUE (job_id, code)
);

CREATE INDEX IF NOT EXISTS video_quality_flags_recent ON public.video_quality_flags (created_at DESC);
ALTER TABLE public.video_quality_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_quality_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.video_quality_flags TO service_role;

CREATE OR REPLACE FUNCTION public.record_video_quality_flag_atomic(
  p_job_id UUID, p_code TEXT, p_issue TEXT, p_start_seconds NUMERIC,
  p_end_seconds NUMERIC, p_transcript_evidence TEXT, p_actor TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job RECORD; v_id UUID; v_category TEXT;
BEGIN
  IF p_code IS NULL OR p_code NOT IN ('POST_CTA_SPEECH_REVIEW','PRODUCT_FACT_REVIEW')
     OR length(trim(coalesce(p_issue,''))) NOT BETWEEN 3 AND 400
     OR length(trim(coalesce(p_transcript_evidence,''))) NOT BETWEEN 1 AND 1000
     OR nullif(trim(coalesce(p_actor,'')),'') IS NULL
     OR ((p_start_seconds IS NULL) <> (p_end_seconds IS NULL))
     OR (p_start_seconds IS NOT NULL AND (p_start_seconds<0 OR p_end_seconds<p_start_seconds OR p_end_seconds>60)) THEN
    RETURN jsonb_build_object('success',false,'error','INVALID_EVIDENCE');
  END IF;
  SELECT id,provider_task_id,result_video_r2_key,status INTO v_job
    FROM public.video_jobs WHERE id=p_job_id;
  IF NOT FOUND OR v_job.result_video_r2_key IS NULL OR v_job.status NOT IN ('QA_PENDING','COMPLETED') THEN
    RETURN jsonb_build_object('success',false,'error','VIDEO_NOT_REVIEWABLE');
  END IF;
  v_category := CASE WHEN p_code='POST_CTA_SPEECH_REVIEW' THEN 'SPEECH' ELSE 'PRODUCT_FACT' END;
  INSERT INTO public.video_quality_flags
    (job_id,provider_task_id,asset_id,code,category,issue,start_seconds,end_seconds,transcript_evidence,created_by)
  VALUES (p_job_id,v_job.provider_task_id,v_job.result_video_r2_key,p_code,v_category,trim(p_issue),p_start_seconds,p_end_seconds,trim(p_transcript_evidence),p_actor)
  ON CONFLICT (job_id,code) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.video_quality_flags WHERE job_id=p_job_id AND code=p_code;
    RETURN jsonb_build_object('success',true,'id',v_id,'duplicate',true);
  END IF;
  RETURN jsonb_build_object('success',true,'id',v_id,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.review_video_quality_flag_atomic(
  p_flag_id UUID, p_actor TEXT, p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_flag RECORD;
BEGIN
  IF nullif(trim(coalesce(p_actor,'')),'') IS NULL OR length(coalesce(p_note,''))>500 THEN
    RETURN jsonb_build_object('success',false,'error','INVALID_REVIEW');
  END IF;
  UPDATE public.video_quality_flags
     SET reviewed_at=now(),reviewed_by=p_actor,review_note=nullif(trim(coalesce(p_note,'')),'')
   WHERE id=p_flag_id AND reviewed_at IS NULL
   RETURNING id,job_id INTO v_flag;
  IF FOUND THEN RETURN jsonb_build_object('success',true,'id',v_flag.id,'job_id',v_flag.job_id,'idempotent',false); END IF;
  SELECT id,job_id INTO v_flag FROM public.video_quality_flags WHERE id=p_flag_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','FLAG_NOT_FOUND'); END IF;
  RETURN jsonb_build_object('success',true,'id',v_flag.id,'job_id',v_flag.job_id,'idempotent',true);
END $$;

REVOKE ALL ON FUNCTION public.record_video_quality_flag_atomic(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_video_quality_flag_atomic(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_video_quality_flag_atomic(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_video_quality_flag_atomic(UUID,TEXT,TEXT) TO service_role;

COMMIT;
