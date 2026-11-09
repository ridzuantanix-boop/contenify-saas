$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secretPath = Join-Path $repo 'output\release\secure\nexabot-api-key.dpapi'
$secure = Get-Content -LiteralPath $secretPath -Raw | ConvertTo-SecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:NEXABOT_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  Push-Location $repo
  try {
    & node scripts/release/nexabot-two-identical-ingredient-test.mjs
    if ($LASTEXITCODE -ne 0) { throw "Ujian Nexabot dua reference gagal (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  Remove-Item Env:NEXABOT_API_KEY -ErrorAction SilentlyContinue
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
