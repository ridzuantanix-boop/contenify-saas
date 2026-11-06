param([Parameter(Mandatory = $true)][string]$BackupDirectory)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$binDir = Join-Path $repo 'output\release\tools\pgsql\bin'
$cluster = Join-Path $repo 'output\release\isolated-restore-secure'
$pushed = $false

function Read-LocalSecret([string]$Name) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path)) { throw "Rahsia $Name tidak ditemui." }
  $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $env:AFFIMATIK_BACKUP_AES_KEY = Read-LocalSecret 'backup-aes-key'
  $restorePasswordPath = Join-Path $secureDir 'restore-db-password.dpapi'
  if (-not (Test-Path -LiteralPath $restorePasswordPath)) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    ConvertTo-SecureString -String ([Convert]::ToBase64String($bytes)) -AsPlainText -Force |
      ConvertFrom-SecureString | Set-Content -LiteralPath $restorePasswordPath -NoNewline
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  $env:AFFIMATIK_RESTORE_DB_PASSWORD = Read-LocalSecret 'restore-db-password'
  $env:PGPASSWORD = $env:AFFIMATIK_RESTORE_DB_PASSWORD
  $env:PG_RESTORE_BIN = Join-Path $binDir 'pg_restore.exe'
  $env:PSQL_BIN = Join-Path $binDir 'psql.exe'
  $initdb = Join-Path $binDir 'initdb.exe'
  $pgctl = Join-Path $binDir 'pg_ctl.exe'
  if (-not (Test-Path -LiteralPath $env:PG_RESTORE_BIN) -or -not (Test-Path -LiteralPath $initdb)) { throw 'Alat PostgreSQL 18.6 tempatan tiada.' }
  if (-not (Test-Path -LiteralPath (Join-Path $cluster 'PG_VERSION'))) {
    $tempPassword = Join-Path $secureDir 'restore-password.tmp'
    try {
      [IO.File]::WriteAllText($tempPassword, $env:AFFIMATIK_RESTORE_DB_PASSWORD)
      & $initdb -D $cluster -U postgres -A scram-sha-256 "--pwfile=$tempPassword" --encoding=UTF8 --locale=C --no-instructions
      if ($LASTEXITCODE -ne 0) { throw "initdb gagal (exit $LASTEXITCODE)." }
    } finally {
      if (Test-Path -LiteralPath $tempPassword) { Remove-Item -LiteralPath $tempPassword }
    }
  }
  & $pgctl -D $cluster status *> $null
  if ($LASTEXITCODE -ne 0) {
    & $pgctl -D $cluster -l (Join-Path $repo 'output\release\isolated-restore-secure.log') -o '-h 127.0.0.1 -p 55434' start
    if ($LASTEXITCODE -ne 0) { throw "Kluster restore tempatan gagal dimulakan (exit $LASTEXITCODE)." }
  }
  Push-Location $repo
  $pushed = $true
  & node scripts/release/restore-rehearsal.mjs (Resolve-Path -LiteralPath $BackupDirectory).Path
  if ($LASTEXITCODE -ne 0) { throw "Ujian restore gagal (exit $LASTEXITCODE)." }
} finally {
  if ($pushed) { Pop-Location }
  foreach ($name in @('AFFIMATIK_BACKUP_AES_KEY','AFFIMATIK_RESTORE_DB_PASSWORD','PGPASSWORD','PG_RESTORE_BIN','PSQL_BIN')) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
}
