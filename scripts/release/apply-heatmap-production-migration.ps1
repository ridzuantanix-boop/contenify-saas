param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Gunakan -Apply selepas backup production selesai.' }
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

$snapshot = @"
SELECT json_build_object(
  'profiles',(SELECT count(*) FROM public.profiles),
  'wallets',(SELECT count(*) FROM public.credit_wallets),
  'balance',(SELECT coalesce(sum(balance),0) FROM public.credit_wallets),
  'reserved',(SELECT coalesce(sum(reserved_balance),0) FROM public.credit_wallets),
  'orders',(SELECT count(*) FROM public.orders),
  'jobs',(SELECT count(*) FROM public.video_jobs)
)::text;
"@

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Snapshot sebelum migrasi gagal.' }
  & $psql @args '-1' '-f' (Join-Path $repo 'supabase\migrations\00036_salespage_heatmap.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi heatmap gagal.' }
  $after = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Snapshot selepas migrasi gagal.' }
  foreach ($field in @('profiles','wallets','balance','reserved','orders','jobs')) {
    if ("$($before.$field)" -ne "$($after.$field)") { throw "Data pelanggan berubah: $field" }
  }
  $checks = @"
SELECT json_build_object(
  'table',to_regclass('public.salespage_heatmap_events'),
  'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.salespage_heatmap_events'::regclass),
  'anon_select',has_table_privilege('anon','public.salespage_heatmap_events','SELECT'),
  'authenticated_insert',has_table_privilege('authenticated','public.salespage_heatmap_events','INSERT'),
  'service_select',has_table_privilege('service_role','public.salespage_heatmap_events','SELECT'),
  'service_insert',has_table_privilege('service_role','public.salespage_heatmap_events','INSERT')
)::text;
"@
  $schema = (& $psql @args '-c' $checks).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $schema.rls -or $schema.anon_select -or $schema.authenticated_insert -or -not $schema.service_select -or -not $schema.service_insert) { throw 'Semakan keselamatan skema gagal.' }
  [pscustomobject]@{ success = $true; migration = '00036_salespage_heatmap.sql'; existingDataPreserved = $true; schema = $schema } | ConvertTo-Json -Compress
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
