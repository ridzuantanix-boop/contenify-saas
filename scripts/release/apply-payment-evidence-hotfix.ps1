param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Gunakan -Apply selepas backup dan rehearsal disahkan.' }
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
  'wallets',(SELECT count(*) FROM credit_wallets),
  'balance',(SELECT coalesce(sum(balance),0) FROM credit_wallets),
  'reserved',(SELECT coalesce(sum(reserved_balance),0) FROM credit_wallets),
  'orders',(SELECT count(*) FROM orders),
  'jobs',(SELECT count(*) FROM video_jobs)
)::text;
"@

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @args '-c' $snapshot).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $before) { throw 'Snapshot integriti sebelum migrasi gagal.' }
  & $psql @args '-1' '-f' (Join-Path $repo 'supabase\migrations\00029_payment_evidence_mobile_formats.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi 00029 gagal.' }
  $after = (& $psql @args '-c' $snapshot).Trim()
  if ($before -ne $after) { throw "Integriti data berubah: $before -> $after" }
  $contract = (& $psql @args '-c' "SELECT json_build_object('size_limit',pg_get_constraintdef(oid),'heic',position('image/heic' in pg_get_functiondef('public.provision_qr_order_atomic(uuid,text,text,text,bigint)'::regprocedure))>0) FROM pg_constraint WHERE conname='orders_receipt_size_check';").Trim()
  Write-Output "Migrasi 00029 lulus. Snapshot kekal: $after"
  Write-Output "Kontrak upload: $contract"
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
}
