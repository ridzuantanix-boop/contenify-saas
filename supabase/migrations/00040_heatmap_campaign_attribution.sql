-- Campaign labels are non-personal UTM values supplied by the landing URL.
-- Existing heatmap events remain unattributed; no historical backfill is invented.
ALTER TABLE public.salespage_heatmap_events
  ADD COLUMN IF NOT EXISTS campaign_key TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salespage_heatmap_campaign_key_length') THEN
    ALTER TABLE public.salespage_heatmap_events
      ADD CONSTRAINT salespage_heatmap_campaign_key_length CHECK (campaign_key IS NULL OR length(campaign_key) <= 100);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS salespage_heatmap_campaign_recent
  ON public.salespage_heatmap_events (campaign_key, occurred_at DESC)
  WHERE campaign_key IS NOT NULL;
