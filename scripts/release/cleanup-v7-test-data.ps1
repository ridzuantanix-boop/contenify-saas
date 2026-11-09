$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secure = Get-Content -LiteralPath (Join-Path $repo 'output\release\secure\supabase-service-role-key.dpapi') -Raw | ConvertTo-SecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  Push-Location $repo
  try { & node scripts/release/cleanup-v7-test-data.mjs; if ($LASTEXITCODE -ne 0) { throw "Cleanup V7 QA gagal (exit $LASTEXITCODE)." } }
  finally { Pop-Location }
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
