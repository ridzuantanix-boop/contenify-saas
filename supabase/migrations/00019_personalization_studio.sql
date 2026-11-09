-- AffiMatik V7 Personalization Studio (additive and workspace scoped)
CREATE TABLE IF NOT EXISTS public.background_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  image_r2_key TEXT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_assets_workspace_created
  ON public.background_assets(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_presets_workspace_created
  ON public.creator_presets(workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_presets_one_default
  ON public.creator_presets(workspace_id) WHERE is_default;

ALTER TABLE public.background_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_presets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.background_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.creator_presets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.background_assets TO service_role;
GRANT ALL ON public.creator_presets TO service_role;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS background_id UUID REFERENCES public.background_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_preset_id UUID REFERENCES public.creator_presets(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_creator_preset_default(p_workspace_id UUID, p_preset_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_preset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.creator_presets WHERE id = p_preset_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Preset does not belong to workspace';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_workspace_id::text));
  UPDATE public.creator_presets SET is_default = FALSE, updated_at = NOW()
   WHERE workspace_id = p_workspace_id AND is_default;
  IF p_preset_id IS NOT NULL THEN
    UPDATE public.creator_presets SET is_default = TRUE, updated_at = NOW()
     WHERE id = p_preset_id AND workspace_id = p_workspace_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_creator_preset_default(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_creator_preset_default(UUID, UUID) TO service_role;
