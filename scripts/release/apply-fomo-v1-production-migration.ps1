param([switch]$Apply, [switch]$OwnerApproved)

$ErrorActionPreference = 'Stop'
if (-not $Apply -or -not $OwnerApproved) { throw 'Migrasi production FOMO V1 memerlukan -Apply -OwnerApproved.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'
$backup = Get-ChildItem (Join-Path $repo 'output\release\backups') -Directory | Sort-Object CreationTime -Descending | Select-Object -First 1
if (-not $backup -or $backup.CreationTime -lt (Get-Date).AddHours(-3)) { throw 'Backup production baharu diperlukan sebelum migrasi.' }

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$snapshot = "SELECT json_build_object('profiles',(SELECT count(*) FROM profiles),'wallets',(SELECT count(*) FROM credit_wallets),'balance',(SELECT coalesce(sum(balance),0) FROM credit_wallets),'reserved',(SELECT coalesce(sum(reserved_balance),0) FROM credit_wallets),'orders',(SELECT count(*) FROM orders),'jobs',(SELECT count(*) FROM video_jobs))::text;"
try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Snapshot pra-migrasi production gagal.' }
  & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00041_fomo_bonus_v1.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi FOMO V1 production gagal.' }
  & $psql @args '-c' "UPDATE public.fomo_campaigns SET enabled=true,updated_at=now() WHERE code='fomo_v1';"
  if ($LASTEXITCODE -ne 0) { throw 'Campaign FOMO V1 production gagal diaktifkan.' }
  $after = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  foreach ($field in @('profiles','wallets','balance','reserved','orders','jobs')) { if ("$($before.$field)" -ne "$($after.$field)") { throw "Data production berubah: $field" } }
  $checkSql = "SELECT json_build_object('campaigns',to_regclass('public.fomo_campaigns'),'claims',to_regclass('public.fomo_bonus_claims'),'events',to_regclass('public.fomo_offer_events'),'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.fomo_bonus_claims'::regclass),'anon_select',has_table_privilege('anon','public.fomo_bonus_claims','SELECT'),'authenticated_select',has_table_privilege('authenticated','public.fomo_bonus_claims','SELECT'),'init_rpc',to_regprocedure('public.initialize_fomo_offer_v1(uuid,uuid,jsonb)')::text,'claim_rpc',to_regprocedure('public.claim_fomo_bonus_v1(uuid,uuid)')::text,'order_rpc',to_regprocedure('public.create_qr_order_fomo_v1(uuid,uuid,uuid,uuid,uuid,text)')::text,'provision_rpc',to_regprocedure('public.provision_qr_order_fomo_v1(uuid,text,text,text,bigint)')::text,'enabled',(SELECT enabled FROM fomo_campaigns WHERE code='fomo_v1'))::text;"
  $schema = (& $psql @args '-c' $checkSql).Trim() | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $schema.rls -or $schema.anon_select -or $schema.authenticated_select -or -not $schema.enabled -or -not $schema.init_rpc -or -not $schema.provision_rpc) { throw 'Semakan keselamatan skema production gagal.' }
  [pscustomobject]@{ success=$true;migration='00041_fomo_bonus_v1.sql';backup=$backup.FullName;existingDataPreserved=$true;before=$before;after=$after;schema=$schema } | ConvertTo-Json -Depth 5 -Compress
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
