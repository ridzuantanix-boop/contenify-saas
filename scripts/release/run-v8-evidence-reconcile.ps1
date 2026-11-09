$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$securePath = Join-Path $repo 'output\release\secure\supabase-service-role-key.dpapi'
try {
  $secure = Get-Content -LiteralPath $securePath -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Push-Location $repo
  try {
    & node scripts/release/v8-reconcile-evidence.mjs
    if ($LASTEXITCODE -ne 0) { throw "V8 evidence reconciliation gagal (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
}
