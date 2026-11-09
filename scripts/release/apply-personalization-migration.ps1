$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path)) { throw "Rahsia $Name tidak tersedia." }
  $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (-not (Test-Path -LiteralPath $psql) -or -not (Test-Path -LiteralPath $ca)) { throw 'Alat PostgreSQL atau sijil CA tiada.' }
$snapshotSql = "SELECT count(*) AS wallets, coalesce(sum(balance),0) AS balance, coalesce(sum(reserved_balance),0) AS reserved, md5(coalesce(string_agg(id::text||'|'||balance::text||'|'||reserved_balance::text,'~' ORDER BY id),'')) AS wallet_hash FROM public.credit_wallets;"
try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:PGSSLMODE = 'verify-full'; $env:PGSSLROOTCERT = $ca
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $before = (& $psql @args '-c' $snapshotSql).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $before) { throw 'Snapshot wallet sebelum migrasi gagal.' }
  & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00019_personalization_studio.sql')
  if ($LASTEXITCODE -ne 0) { throw "Migrasi 00019 gagal (exit $LASTEXITCODE)." }
  $after = (& $psql @args '-c' $snapshotSql).Trim()
  if ($LASTEXITCODE -ne 0 -or $before -ne $after) { throw "Integriti wallet berubah: sebelum=$before selepas=$after" }
  $schema = (& $psql @args '-c' "SELECT to_regclass('public.background_assets'),to_regclass('public.creator_presets');").Trim()
  if ($schema -notmatch 'background_assets.*creator_presets') { throw "Semakan skema V7 gagal: $schema" }
  Write-Host "Migrasi 00019 lulus; snapshot wallet kekal: $after"
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
}
