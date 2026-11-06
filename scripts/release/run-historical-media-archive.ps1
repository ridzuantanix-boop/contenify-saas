param([Parameter(Mandatory = $true)][string]$CsvPath)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$keyPath = Join-Path $repo 'output\release\secure\backup-aes-key.dpapi'
if (-not (Test-Path -LiteralPath $keyPath)) { throw 'Kunci AES backup tempatan tiada.' }
$secure = Get-Content -LiteralPath $keyPath -Raw | ConvertTo-SecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:AFFIMATIK_BACKUP_AES_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
try {
  Push-Location $repo
  & node scripts/release/archive-historical-media.mjs (Resolve-Path -LiteralPath $CsvPath).Path
  if ($LASTEXITCODE -ne 0) { throw "Arkib media sejarah gagal (exit $LASTEXITCODE)." }
} finally {
  Pop-Location
  Remove-Item Env:AFFIMATIK_BACKUP_AES_KEY -ErrorAction SilentlyContinue
}
