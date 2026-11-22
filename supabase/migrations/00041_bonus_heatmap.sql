-- Keep historical coordinates unchanged. New observations are tagged by page layout.
ALTER TABLE public.salespage_heatmap_events
  ADD COLUMN IF NOT EXISTS page_variant TEXT,
  ADD COLUMN IF NOT EXISTS region_key TEXT,
  ADD COLUMN IF NOT EXISTS target_key TEXT;

ALTER TABLE public.salespage_heatmap_events
  DROP CONSTRAINT IF EXISTS salespage_heatmap_events_kind_check,
  DROP CONSTRAINT IF EXISTS salespage_heatmap_events_check;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salespage_heatmap_kind_v2') THEN
    ALTER TABLE public.salespage_heatmap_events ADD CONSTRAINT salespage_heatmap_kind_v2
      CHECK (kind IN ('click', 'scroll', 'section_view'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salespage_heatmap_shape_v2') THEN
    ALTER TABLE public.salespage_heatmap_events ADD CONSTRAINT salespage_heatmap_shape_v2 CHECK (
      (kind = 'click' AND x_pct IS NOT NULL AND y_pct IS NOT NULL AND scroll_pct IS NULL)
      OR (kind = 'scroll' AND scroll_pct IS NOT NULL AND x_pct IS NULL AND y_pct IS NULL)
      OR (kind = 'section_view' AND scroll_pct IS NULL AND x_pct IS NULL AND y_pct IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salespage_heatmap_tags_v1') THEN
    ALTER TABLE public.salespage_heatmap_events ADD CONSTRAINT salespage_heatmap_tags_v1 CHECK (
      (page_variant IS NULL OR page_variant IN ('pending', 'base_v1', 'bonus_v1'))
      AND (region_key IS NULL OR region_key = 'bonus')
      AND (target_key IS NULL OR target_key IN ('bonus_claim', 'bonus_register', 'bonus_help_open', 'bonus_help_submit'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS salespage_heatmap_variant_recent
  ON public.salespage_heatmap_events (page_variant, device, occurred_at DESC);
