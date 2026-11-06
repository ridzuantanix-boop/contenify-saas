$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'

function Read-LocalSecret([string]$Name) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path)) { throw "Rahsia $Name belum disimpan. Jalankan set-local-credentials.ps1 dahulu." }
  $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$pushed = $false
try {
  $env:AFFIMATIK_BACKUP_DB_PASSWORD = Read-LocalSecret 'supabase-db-password'
  $env:AFFIMATIK_BACKUP_SERVICE_KEY = Read-LocalSecret 'supabase-service-role-key'
  $keyPath = Join-Path $secureDir 'backup-aes-key.dpapi'
  if (-not (Test-Path -LiteralPath $keyPath)) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $encoded = [Convert]::ToBase64String($bytes)
    ConvertTo-SecureString -String $encoded -AsPlainText -Force |
      ConvertFrom-SecureString | Set-Content -LiteralPath $keyPath -NoNewline
    [Array]::Clear($bytes, 0, $bytes.Length)
    Write-Host 'Kunci AES backup baharu disimpan dengan perlindungan DPAPI akaun Windows ini.'
  }
  $env:AFFIMATIK_BACKUP_AES_KEY = Read-LocalSecret 'backup-aes-key'
  $env:PG_DUMP_BIN = Join-Path $repo 'output\release\tools\pgsql\bin\pg_dump.exe'
  $env:AFFIMATIK_SUPABASE_CA = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'
  if (-not (Test-Path -LiteralPath $env:PG_DUMP_BIN)) { throw 'pg_dump 18.6 belum dipasang dalam output/release/tools.' }
  if (-not (Test-Path -LiteralPath $env:AFFIMATIK_SUPABASE_CA)) { throw 'Sijil CA Supabase belum dimuat turun.' }
  Push-Location $repo
  $pushed = $true
  & node scripts/release/backup-production.mjs
  if ($LASTEXITCODE -ne 0) { throw "Backup gagal (exit $LASTEXITCODE)." }
} finally {
  if ($pushed) { Pop-Location }
  Remove-Item Env:AFFIMATIK_BACKUP_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:AFFIMATIK_BACKUP_SERVICE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:AFFIMATIK_BACKUP_AES_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:PG_DUMP_BIN -ErrorAction SilentlyContinue
  Remove-Item Env:AFFIMATIK_SUPABASE_CA -ErrorAction SilentlyContinue
}
