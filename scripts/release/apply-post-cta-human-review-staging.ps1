param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Use -Apply to migrate the staging database.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-v9-staging-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-southeast-2.pooler.supabase.com','-p','5432','-U','postgres.bymorrozeokshzuzcdro','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00042_post_cta_human_review.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Staging migration 00042 failed.' }
  $query = "SELECT json_build_object('table',to_regclass('public.video_quality_flags'),'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.video_quality_flags'::regclass),'anon_select',has_table_privilege('anon','public.video_quality_flags','SELECT'),'service_insert',has_table_privilege('service_role','public.video_quality_flags','INSERT'),'speech_flags',(SELECT count(*) FROM public.video_quality_flags WHERE code='POST_CTA_SPEECH_REVIEW'))::text;"
  $result = (& $psql @args '-c' $query).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $result.table -or -not $result.rls -or $result.anon_select -or -not $result.service_insert) { throw 'Staging migration verification failed.' }
  $smoke = @'
BEGIN;
DO $$
DECLARE v_job uuid; v_first jsonb; v_duplicate jsonb; v_fact jsonb; v_review jsonb; v_again jsonb; v_flag uuid;
BEGIN
  SELECT id INTO v_job FROM public.video_jobs WHERE status IN ('QA_PENDING','COMPLETED') AND result_video_r2_key IS NOT NULL LIMIT 1;
  IF v_job IS NULL THEN RAISE EXCEPTION 'No staging video fixture available'; END IF;
  v_first := public.record_video_quality_flag_atomic(v_job,'POST_CTA_SPEECH_REVIEW','Repeated CTA',10.68,13.08,'tekan butang di bawah, tekan butang di bawah','staging-smoke');
  IF v_first->>'success' <> 'true' OR v_first->>'duplicate' <> 'false' THEN RAISE EXCEPTION 'Speech flag insert failed'; END IF;
  v_duplicate := public.record_video_quality_flag_atomic(v_job,'POST_CTA_SPEECH_REVIEW','Repeated CTA',10.68,13.08,'tekan butang di bawah, tekan butang di bawah','staging-smoke');
  IF v_duplicate->>'duplicate' <> 'true' OR v_duplicate->>'id' <> v_first->>'id' THEN RAISE EXCEPTION 'Duplicate guard failed'; END IF;
  v_fact := public.record_video_quality_flag_atomic(v_job,'PRODUCT_FACT_REVIEW','Unverified dosage',3.26,7.96,'ambil satu kapsul selepas makan','staging-smoke');
  IF v_fact->>'success' <> 'true' OR v_fact->>'id' = v_first->>'id' THEN RAISE EXCEPTION 'Fact separation failed'; END IF;
  v_flag := (v_first->>'id')::uuid;
  v_review := public.review_video_quality_flag_atomic(v_flag,'staging-smoke','Evidence heard');
  v_again := public.review_video_quality_flag_atomic(v_flag,'staging-smoke','Do not overwrite');
  IF v_review->>'idempotent' <> 'false' OR v_again->>'idempotent' <> 'true' THEN RAISE EXCEPTION 'Review idempotency failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.video_quality_flags WHERE id=v_flag AND transcript_evidence='tekan butang di bawah, tekan butang di bawah' AND review_note='Evidence heard') THEN RAISE EXCEPTION 'Original evidence was changed'; END IF;
END $$;
ROLLBACK;
'@
  & $psql @args '-c' $smoke
  if ($LASTEXITCODE -ne 0) { throw 'Staging transactional smoke failed.' }
  $result | ConvertTo-Json -Compress
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
