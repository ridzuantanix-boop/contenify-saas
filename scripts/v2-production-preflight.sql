-- Read-only checks before any V2 migration or application rollout.
-- Export the result with the database/auth/storage backup manifest.
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.workspaces) AS workspaces,
  (SELECT count(*) FROM public.credit_wallets) AS wallets,
  (SELECT coalesce(sum(balance),0) FROM public.credit_wallets) AS total_balance,
  (SELECT coalesce(sum(reserved_balance),0) FROM public.credit_wallets) AS reserved_balance,
  (SELECT count(*) FROM public.video_jobs) AS jobs,
  (SELECT count(*) FROM public.video_jobs WHERE status='COMPLETED') AS completed_jobs,
  (SELECT count(*) FROM public.orders WHERE status='PAID') AS paid_orders,
  (SELECT count(*) FROM public.affiliate_commissions) AS commissions,
  (SELECT count(*) FROM (SELECT gateway_reference FROM public.orders WHERE status='PAID' AND gateway_reference IS NOT NULL GROUP BY gateway_reference HAVING count(*)>1) d) AS duplicate_paid_references;

SELECT id, workspace_id, status, provider, result_video_url
FROM public.video_jobs
WHERE status='COMPLETED' AND (result_video_url IS NULL OR result_video_url NOT LIKE '/api/videos/%')
ORDER BY created_at LIMIT 100;

SELECT table_name,column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('affiliate_commissions','video_jobs','profiles')
  AND column_name IN ('available_at','actual_duration_seconds','referred_by_affiliate_id')
ORDER BY table_name,column_name;
