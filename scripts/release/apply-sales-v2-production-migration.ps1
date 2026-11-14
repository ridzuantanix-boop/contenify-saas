param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Gunakan -Apply selepas backup dan restore rehearsal disahkan.' }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path)) { throw "Rahsia $Name tidak ditemui." }
  $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
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
  'wallet_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||balance::text||'|'||reserved_balance::text||'|'||lifetime_granted::text||'|'||lifetime_spent::text,'~' ORDER BY id),'')) FROM public.credit_wallets),
  'orders',(SELECT count(*) FROM public.orders),
  'jobs',(SELECT count(*) FROM public.video_jobs),
  'job_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||status||'|'||coalesce(provider_task_id,'')||'|'||required_credits::text,'~' ORDER BY id),'')) FROM public.video_jobs)
)::text;
"@

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')

  $before = (& $psql @args '-c' $snapshot).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $before) { throw 'Snapshot production pra-migrasi gagal.' }

  & $psql @args '-1' '-f' (Join-Path $repo 'supabase\migrations\00028_conversion_events.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migration 00028 production gagal.' }

  $after = (& $psql @args '-c' $snapshot).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $after) { throw 'Snapshot production pasca-migrasi gagal.' }
  $a = $before | ConvertFrom-Json
  $b = $after | ConvertFrom-Json
  foreach ($name in @('profiles','wallets','balance','reserved','wallet_hash','orders','jobs','job_hash')) {
    if ("$($a.$name)" -ne "$($b.$name)") { throw "Integriti production berubah untuk ${name}: $($a.$name) -> $($b.$name)" }
  }

  $schemaSql = @"
SELECT json_build_object(
  'table',to_regclass('public.conversion_events'),
  'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.conversion_events'::regclass),
  'anon_select',has_table_privilege('anon','public.conversion_events','SELECT'),
  'authenticated_insert',has_table_privilege('authenticated','public.conversion_events','INSERT'),
  'service_select',has_table_privilege('service_role','public.conversion_events','SELECT'),
  'service_insert',has_table_privilege('service_role','public.conversion_events','INSERT'),
  'event_id_unique',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.conversion_events'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE 'UNIQUE (event_id)%'),
  'dedupe_unique',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.conversion_events'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE 'UNIQUE (event_name, dedupe_key)%')
)::text;
"@
  $schema = (& $psql @args '-c' $schemaSql).Trim() | ConvertFrom-Json
  if (-not $schema.rls -or $schema.anon_select -or $schema.authenticated_insert -or -not $schema.service_select -or -not $schema.service_insert -or -not $schema.event_id_unique -or -not $schema.dedupe_unique) {
    throw 'Semakan RLS, privilege atau idempotency conversion_events gagal.'
  }

  [pscustomobject]@{
    success = $true
    migration = '00028_conversion_events.sql'
    before = $a
    after = $b
    schema = $schema
    appliedAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json -Depth 5
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
