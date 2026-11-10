param([int]$StartAt=1)
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

$files=@(
 '00001_initial_schema.sql','00002_atomic_credit_and_job_security.sql','00003_secure_financial_rpc_and_job_admission.sql',
 '00004_fix_migration_compatibility_and_concurrency.sql','00005_workspace_status_and_alignment.sql','00006_billing_affiliates_and_financial_safety.sql',
 '00007_fix_admin_credit_adjustment_uuid.sql','00008_soft_launch_50_credits.sql','00009_add_whatsapp_to_profiles.sql',
 '00010_fix_welcome_credit_ledger.sql','00011_affiliate_application_policy.sql','00012_affiliate_ledger_and_assets.sql',
 '00013_verified_account_provisioning.sql','00014_close_public_data_access.sql','00015_customer_dashboard_metrics.sql',
 '00016_verified_video_metadata.sql','00017_refund_credit_integrity.sql','00018_affiliate_service_role_permissions.sql',
 '00019_personalization_studio.sql','00020_qr_express_checkout.sql','00020_seed_creative_v6_prompt_presets.sql',
 '00021_nexabot_provider_retry.sql','00022_smart_nexabot_queue_and_costs.sql','00023_v72_pricing_and_credit_buckets.sql',
 '00024_instant_qr_full_access.sql','00025_restore_provider_retry_scheduler.sql','00026_cloud_auto_factory.sql'
)
if($StartAt -lt 1 -or $StartAt -gt $files.Count){throw 'StartAt di luar julat migrasi.'}
$files=$files|Select-Object -Skip ($StartAt-1)

try{
 $env:PGPASSWORD=Read-LocalSecret 'supabase-v9-staging-db-password'
 $env:PGSSLMODE='verify-full';$env:PGSSLROOTCERT=$ca;$env:PGCONNECT_TIMEOUT='20'
 $args=@('-h','aws-0-ap-southeast-2.pooler.supabase.com','-p','5432','-U','postgres.bymorrozeokshzuzcdro','-d','postgres','-v','ON_ERROR_STOP=1')
 foreach($file in $files){
  & $psql @args '-f' (Join-Path $repo "supabase\migrations\$file")
  if($LASTEXITCODE -ne 0){throw "Migrasi staging gagal: $file"}
 }
 $check=(& $psql @args '-At' '-c' "SELECT json_build_object('creator_profiles',to_regclass('public.creator_profiles'),'batches',to_regclass('public.auto_factory_batches'),'schedules',to_regclass('public.daily_auto_schedules'),'wallets',(SELECT count(*) FROM credit_wallets),'jobs',(SELECT count(*) FROM video_jobs))::text;").Trim()
 if($LASTEXITCODE -ne 0 -or -not $check){throw 'Semakan skema staging gagal.'}
 Write-Output $check
}finally{Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue}
