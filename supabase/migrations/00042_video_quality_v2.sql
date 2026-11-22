-- Conservative quality observations and customer reports. No wallet mutation or retries.
BEGIN;

CREATE TABLE IF NOT EXISTS public.video_quality_assessments (
  job_id uuid PRIMARY KEY REFERENCES public.video_jobs(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('QUALITY_PASS','QUALITY_FAIL','QUALITY_UNCERTAIN')),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  detector_version text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.video_jobs(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  video_object_key text NOT NULL,
  style_id text NOT NULL,
  provider text NOT NULL,
  generation_at timestamptz NOT NULL,
  category text NOT NULL CHECK (category IN (
    'cta_cutoff','dialogue_cutoff','robotic_voice','lip_sync','visual_motion',
    'product_identity','niqab_exposure','audio_broken','other'
  )),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
  admin_note text NOT NULL DEFAULT '' CHECK (length(admin_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(job_id,user_id,category)
);
CREATE INDEX IF NOT EXISTS video_quality_reports_admin_queue ON public.video_quality_reports(status,created_at DESC);
CREATE INDEX IF NOT EXISTS video_quality_reports_workspace ON public.video_quality_reports(workspace_id,created_at DESC);

ALTER TABLE public.video_quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_quality_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_quality_assessments,public.video_quality_reports FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.video_quality_assessments,public.video_quality_reports TO service_role;

COMMIT;
