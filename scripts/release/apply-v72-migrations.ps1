$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir=Join-Path $repo 'output\release\secure'
$psql=Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca=Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'
function Read-LocalSecret([string]$Name){$secure=Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw|ConvertTo-SecureString;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}}
$snapshot=@"
SELECT json_build_object(
 'wallets',(SELECT count(*) FROM credit_wallets),
 'balance',(SELECT coalesce(sum(balance),0) FROM credit_wallets),
 'reserved',(SELECT coalesce(sum(reserved_balance),0) FROM credit_wallets),
 'wallet_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||balance::text||'|'||reserved_balance::text||'|'||lifetime_granted::text||'|'||lifetime_spent::text,'~' ORDER BY id),'')) FROM credit_wallets),
 'jobs',(SELECT count(*) FROM video_jobs),
 'job_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||status||'|'||coalesce(provider_task_id,'')||'|'||required_credits::text,'~' ORDER BY id),'')) FROM video_jobs),
 'orders',(SELECT count(*) FROM orders),
 'subscriptions',(SELECT count(*) FROM subscriptions),
 'pending_reservations',(SELECT count(*) FROM credit_reservations WHERE status='PENDING'),
 'active_jobs',(SELECT count(*) FROM video_jobs WHERE status IN('QUEUED','SUBMITTING','PROCESSING'))
)::text;
"@
try{
 $env:PGPASSWORD=Read-LocalSecret 'supabase-db-password';$env:PGSSLMODE='verify-full';$env:PGSSLROOTCERT=$ca
 $args=@('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
 $before=(& $psql @args '-c' $snapshot).Trim();if ($LASTEXITCODE -ne 0 -or -not $before){throw 'Snapshot pra-migrasi gagal.'}
 & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00022_smart_nexabot_queue_and_costs.sql');if ($LASTEXITCODE -ne 0){throw 'Migrasi 00022 gagal.'}
 & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00023_v72_pricing_and_credit_buckets.sql');if ($LASTEXITCODE -ne 0){throw 'Migrasi 00023 gagal. Migrasi 00022 kekal backward-compatible; hentikan release dan gunakan recovery runbook.'}
 $after=(& $psql @args '-c' $snapshot).Trim();if ($LASTEXITCODE -ne 0){throw 'Snapshot pasca-migrasi gagal.'}
 $schema=(& $psql @args '-c' "SELECT to_regclass('public.provider_cost_registry'),to_regclass('public.credit_buckets'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='video_jobs' AND column_name='dispatch_lease_until');").Trim()
 $beforeObject=$before|ConvertFrom-Json;$afterObject=$after|ConvertFrom-Json
 foreach($key in @('wallets','balance','reserved','wallet_hash','jobs','job_hash','orders','subscriptions','pending_reservations','active_jobs')){if ("$($beforeObject.$key)" -ne "$($afterObject.$key)"){throw "Customer integrity changed for ${key}: $($beforeObject.$key) -> $($afterObject.$key)"}}
 if ($schema -notmatch 'provider_cost_registry.*credit_buckets.*t'){throw "Semakan skema V7.2 gagal: $schema"}
 [pscustomobject]@{success=$true;applied=@('00022','00023');before=$beforeObject;after=$afterObject;schema=$schema;appliedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json -Depth 5
}finally{Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue}
