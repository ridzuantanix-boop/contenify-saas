param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Use -Apply after a verified production backup.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'
$backup = Get-ChildItem -LiteralPath (Join-Path $repo 'output\release\backups') -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $backup -or $backup.CreationTime -lt (Get-Date).AddHours(-3)) { throw 'A recent production backup is required.' }
function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$snapshot = 'SELECT json_build_object(''events'',(SELECT count(*) FROM public.salespage_heatmap_events),''orders'',(SELECT count(*) FROM public.orders),''jobs'',(SELECT count(*) FROM public.video_jobs))::text;'
try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $arguments = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @arguments '-c' $snapshot).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Pre-migration snapshot failed.' }
  & $psql @arguments '-1' '-f' (Join-Path $repo 'supabase\migrations\00040_heatmap_campaign_attribution.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Campaign attribution migration failed.' }
  $after = (& $psql @arguments '-c' $snapshot).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or $after.events -lt $before.events -or $after.orders -lt $before.orders -or $after.jobs -lt $before.jobs) { throw 'Existing production rows decreased.' }
  $column = (& $psql @arguments '-c' "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='salespage_heatmap_events' AND column_name='campaign_key';").Trim()
  if ($LASTEXITCODE -ne 0 -or $column -ne '1') { throw 'campaign_key column unavailable.' }
  [pscustomobject]@{ success = $true; migration = '00040_heatmap_campaign_attribution.sql'; backup = $backup.Name; existingRowsPreserved = $true; events = $after.events } | ConvertTo-Json -Compress
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
