param(
  [switch]$Apply,
  [Parameter(Mandatory=$true)][string]$OperationalRepo
)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Use -Apply after release preflight has passed.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$operations = (Resolve-Path -LiteralPath $OperationalRepo).Path
$secureDir = Join-Path $operations 'output/release/secure'
$psql = Join-Path $operations 'output/release/tools/pgsql/bin/psql.exe'
$ca = Join-Path $operations 'output/release/tools/supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $arguments = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @arguments '-c' "SELECT json_build_object('jobs',(SELECT count(*) FROM public.video_jobs),'flags_table',to_regclass('public.video_quality_flags'))::text;").Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Production preflight query failed.' }
  & $psql @arguments '-f' (Join-Path $repo 'supabase/migrations/00042_post_cta_human_review.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Production migration 00042 failed.' }
  $after = (& $psql @arguments '-c' "SELECT json_build_object('jobs',(SELECT count(*) FROM public.video_jobs),'flags',(SELECT count(*) FROM public.video_quality_flags),'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.video_quality_flags'::regclass),'anon_select',has_table_privilege('anon','public.video_quality_flags','SELECT'),'service_insert',has_table_privilege('service_role','public.video_quality_flags','INSERT'))::text;").Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Production verification query failed.' }
  $initial = $before | ConvertFrom-Json
  $verified = $after | ConvertFrom-Json
  if ($initial.jobs -ne $verified.jobs -or -not $verified.rls -or $verified.anon_select -or -not $verified.service_insert) { throw 'Production migration invariant failed.' }
  [pscustomobject]@{ before=$initial; after=$verified } | ConvertTo-Json -Compress -Depth 4
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
