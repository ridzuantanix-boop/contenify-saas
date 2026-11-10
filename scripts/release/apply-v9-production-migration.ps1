$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir=Join-Path $repo 'output\release\secure'
$psql=Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca=Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name){
 $secure=Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw|ConvertTo-SecureString
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}

$snapshot=@"
SELECT json_build_object(
 'profiles',(SELECT count(*) FROM profiles),
 'wallets',(SELECT count(*) FROM credit_wallets),
 'balance',(SELECT coalesce(sum(balance),0) FROM credit_wallets),
 'reserved',(SELECT coalesce(sum(reserved_balance),0) FROM credit_wallets),
 'wallet_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||balance::text||'|'||reserved_balance::text||'|'||lifetime_granted::text||'|'||lifetime_spent::text,'~' ORDER BY id),'')) FROM credit_wallets),
 'jobs',(SELECT count(*) FROM video_jobs),
 'job_hash',(SELECT md5(coalesce(string_agg(id::text||'|'||workspace_id::text||'|'||status||'|'||coalesce(provider_task_id,'')||'|'||required_credits::text,'~' ORDER BY id),'')) FROM video_jobs),
 'products',(SELECT count(*) FROM products),
 'presets',(SELECT count(*) FROM creator_presets),
 'active_jobs',(SELECT count(*) FROM video_jobs WHERE status IN('QUEUED','SUBMITTING','PROCESSING','QA_PENDING')),
 'pending_reservations',(SELECT count(*) FROM credit_reservations WHERE status='PENDING')
)::text;
"@
try{
 $env:PGPASSWORD=Read-LocalSecret 'supabase-db-password';$env:PGSSLMODE='verify-full';$env:PGSSLROOTCERT=$ca;$env:PGCONNECT_TIMEOUT='20'
 $args=@('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
 $before=(& $psql @args '-c' $snapshot).Trim();if($LASTEXITCODE -ne 0 -or -not $before){throw 'Snapshot production pra-migrasi gagal.'}
 & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00026_cloud_auto_factory.sql');if($LASTEXITCODE -ne 0){throw 'Migration 00026 production gagal.'}
 $after=(& $psql @args '-c' $snapshot).Trim();if($LASTEXITCODE -ne 0 -or -not $after){throw 'Snapshot production pasca-migrasi gagal.'}
 $a=$before|ConvertFrom-Json;$b=$after|ConvertFrom-Json
 foreach($name in @('profiles','wallets','balance','reserved','wallet_hash','jobs','job_hash','products','presets','active_jobs','pending_reservations')){if("$($a.$name)" -ne "$($b.$name)"){throw "Integriti production berubah untuk ${name}: $($a.$name) -> $($b.$name)"}}
 $schema=(& $psql @args '-c' "SELECT to_regclass('public.creator_profiles'),to_regclass('public.product_folders'),to_regclass('public.auto_factory_batches'),to_regclass('public.daily_auto_schedules'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='video_jobs' AND column_name='generation_snapshot');").Trim()
 if($schema -notmatch 'creator_profiles.*product_folders.*auto_factory_batches.*daily_auto_schedules.*t'){throw "Semakan skema V9 gagal: $schema"}
 [pscustomobject]@{success=$true;migration='00026_cloud_auto_factory.sql';before=$a;after=$b;schema=$schema;appliedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json -Depth 5
}finally{Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue}
