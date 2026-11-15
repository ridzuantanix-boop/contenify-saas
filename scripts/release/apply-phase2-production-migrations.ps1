param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Gunakan -Apply hanya selepas backup dan restore rehearsal lulus.' }
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
 'profiles',(SELECT count(*) FROM profiles),'wallets',(SELECT count(*) FROM credit_wallets),
 'balance',(SELECT coalesce(sum(balance),0) FROM credit_wallets),'reserved',(SELECT coalesce(sum(reserved_balance),0) FROM credit_wallets),
 'wallet_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||balance::text||'|'||reserved_balance::text||'|'||lifetime_granted::text||'|'||lifetime_spent::text,'~' ORDER BY id),'')) FROM credit_wallets),
 'orders',(SELECT count(*) FROM orders),'jobs',(SELECT count(*) FROM video_jobs),
 'job_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||status||'|'||coalesce(provider_task_id,'')||'|'||required_credits::text,'~' ORDER BY id),'')) FROM video_jobs)
)::text;
"@

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'; $env:PGSSLROOTCERT = $ca; $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  foreach ($migration in @('00030_payment_first_checkout.sql','00031_review_reward_30_credits.sql')) {
    & $psql @args '-f' (Join-Path $repo "supabase\migrations\$migration")
    if ($LASTEXITCODE -ne 0) { throw "Migration production gagal: $migration" }
  }
  $after = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  foreach ($name in @('profiles','wallets','balance','reserved','wallet_hash','orders','jobs','job_hash')) {
    if ("$($before.$name)" -ne "$($after.$name)") { throw "Integriti production berubah untuk ${name}: $($before.$name) -> $($after.$name)" }
  }
  $schema = (& $psql @args '-c' "SELECT json_build_object('downloads',to_regclass('public.review_reward_downloads'),'claims',to_regclass('public.review_reward_claims'),'downloads_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.review_reward_downloads'::regclass),'claims_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.review_reward_claims'::regclass),'authenticated_grant',has_function_privilege('authenticated','public.grant_review_reward_atomic(uuid,uuid,text,text,boolean)','EXECUTE'),'service_grant',has_function_privilege('service_role','public.grant_review_reward_atomic(uuid,uuid,text,text,boolean)','EXECUTE'))::text;").Trim() | ConvertFrom-Json
  if (-not $schema.downloads -or -not $schema.claims -or -not $schema.downloads_rls -or -not $schema.claims_rls -or $schema.authenticated_grant -or -not $schema.service_grant) { throw 'Semakan schema/RLS/privilege reward gagal.' }
  [pscustomobject]@{success=$true;migrations=@('00030','00031');before=$before;after=$after;schema=$schema;appliedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json -Depth 5
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
