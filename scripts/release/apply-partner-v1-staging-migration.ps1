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
  $before = (& $psql @args '-At' '-c' "SELECT json_build_object('wallets',count(*),'balance',coalesce(sum(balance),0),'reserved',coalesce(sum(reserved_balance),0))::text FROM public.credit_wallets;").Trim()
  if ($LASTEXITCODE -ne 0 -or -not $before) { throw 'Snapshot wallet staging pra-migrasi gagal.' }
  & $psql @args '-1' '-f' (Join-Path $repo 'supabase\migrations\00033_affimatik_partner_v1.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi Partner V1 staging gagal.' }
  $after = (& $psql @args '-At' '-c' "SELECT json_build_object('wallets',count(*),'balance',coalesce(sum(balance),0),'reserved',coalesce(sum(reserved_balance),0))::text FROM public.credit_wallets;").Trim()
  if ($LASTEXITCODE -ne 0 -or $before -ne $after) { throw "Integriti wallet staging berubah: $before -> $after" }
  $check = (& $psql @args '-At' '-c' "SELECT json_build_object('aliases',to_regclass('public.affiliate_referral_aliases'),'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.affiliate_referral_aliases'::regclass),'apply_rpc',to_regprocedure('public.apply_affiliate_partner_v1(uuid,text,boolean)')::text,'state_rpc',to_regprocedure('public.affiliate_partner_state_v1(uuid)')::text,'resolve_rpc',to_regprocedure('public.resolve_affiliate_partner_v1(text)')::text,'commission_default',(SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliate_partners' AND column_name='commission_rate'))::text;").Trim()
  if ($LASTEXITCODE -ne 0 -or -not $check) { throw 'Semakan schema Partner V1 staging gagal.' }
  Write-Output $check
  Write-Output $after
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
