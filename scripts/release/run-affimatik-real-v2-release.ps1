$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secretPath = Join-Path $repo 'output\release\secure\nexabot-api-key.dpapi'
if (-not (Test-Path -LiteralPath $secretPath)) { throw 'Rahsia Nexabot tempatan tidak tersedia.' }
$secure = Get-Content -LiteralPath $secretPath -Raw | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:NEXABOT_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  Push-Location $repo
  try {
    & node scripts/release/run-affimatik-real-v2-release.mjs
    if ($LASTEXITCODE -ne 0) { throw "REAL V2 provider campaign gagal (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  Remove-Item Env:NEXABOT_API_KEY -ErrorAction SilentlyContinue
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
