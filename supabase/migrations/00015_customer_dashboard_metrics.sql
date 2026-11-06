BEGIN;
CREATE OR REPLACE FUNCTION public.dashboard_workspace_metrics(p_workspace_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'product_images',(SELECT count(*) FROM product_images WHERE workspace_id=p_workspace_id),
    'saved_videos',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status='COMPLETED' AND result_video_r2_key IS NOT NULL),
    'completed_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status='COMPLETED'),
    'active_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status IN ('QUEUED','SUBMITTING','PROCESSING')),
    'failed_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id AND status='FAILED'),
    'total_jobs',(SELECT count(*) FROM video_jobs WHERE workspace_id=p_workspace_id)
  );
$$;
REVOKE ALL ON FUNCTION public.dashboard_workspace_metrics(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_workspace_metrics(UUID) TO service_role;
COMMIT;
