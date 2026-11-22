param([switch]$Apply)
$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Gunakan -Apply selepas menyemak migrasi.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secure = Get-Content -LiteralPath (Join-Path $repo 'output/release/secure/supabase-db-password.dpapi') -Raw | ConvertTo-SecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = Join-Path $repo 'output/release/tools/supabase-prod-ca-2021.crt'
$env:PGCONNECT_TIMEOUT = '20'
$psql = Join-Path $repo 'output/release/tools/pgsql/bin/psql.exe'
$args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
try {
  $before = (& $psql @args '-c' "SELECT conname || ':' || pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.salespage_heatmap_events'::regclass AND contype='c' ORDER BY conname;")
  if ($LASTEXITCODE -ne 0) { throw 'Semakan constraint gagal.' }
  $oldShape = $before | Where-Object { $_ -match '^salespage_heatmap_events_check:' }
  $oldKind = $before | Where-Object { $_ -match '^salespage_heatmap_events_kind_check:' }
  if (-not $oldShape -or -not $oldKind) { throw 'Constraint heatmap asal tidak sepadan; migrasi dihentikan.' }
  $countsBefore = (& $psql @args '-c' 'SELECT count(*) FROM public.salespage_heatmap_events;').Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Snapshot awal gagal.' }
  & $psql @args '-1' '-f' (Join-Path $repo 'supabase/migrations/00041_bonus_heatmap.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi bonus heatmap gagal.' }
  $result = (& $psql @args '-c' "SELECT json_build_object('rows', count(*), 'legacy', count(*) FILTER (WHERE page_variant IS NULL), 'rls', (SELECT relrowsecurity FROM pg_class WHERE oid='public.salespage_heatmap_events'::regclass), 'kind_v2', EXISTS(SELECT 1 FROM pg_constraint WHERE conname='salespage_heatmap_kind_v2'), 'shape_v2', EXISTS(SELECT 1 FROM pg_constraint WHERE conname='salespage_heatmap_shape_v2'))::text FROM public.salespage_heatmap_events;").Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or "$($result.rows)" -ne "$countsBefore" -or -not $result.rls -or -not $result.kind_v2 -or -not $result.shape_v2) { throw 'Semakan selepas migrasi gagal.' }
  [pscustomobject]@{ success = $true; migration = '00041_bonus_heatmap.sql'; rowsPreserved = $result.rows; oldRowsKeptAsLegacy = $result.legacy; rls = $result.rls } | ConvertTo-Json -Compress
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
