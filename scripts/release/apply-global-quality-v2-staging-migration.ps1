$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-v9-staging-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-southeast-2.pooler.supabase.com','-p','5432','-U','postgres.bymorrozeokshzuzcdro','-d','postgres','-v','ON_ERROR_STOP=1')
  & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00042_video_quality_v2.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi staging 00042 gagal.' }
  $verify = "SELECT json_build_object('assessments',to_regclass('public.video_quality_assessments'),'reports',to_regclass('public.video_quality_reports'),'assessment_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.video_quality_assessments'::regclass),'report_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.video_quality_reports'::regclass),'anon_report_insert',has_table_privilege('anon','public.video_quality_reports','INSERT'),'authenticated_report_select',has_table_privilege('authenticated','public.video_quality_reports','SELECT'),'service_report_insert',has_table_privilege('service_role','public.video_quality_reports','INSERT'),'wallet_rows',(SELECT count(*) FROM public.credit_wallets))::text;"
  $result = (& $psql @args '-At' '-c' $verify).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $result) { throw 'Semakan migrasi staging gagal.' }
  Write-Output $result
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
