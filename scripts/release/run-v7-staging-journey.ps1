$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Ensure-LocalSecret([string]$Name, [string]$Value) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path)) {
    ConvertTo-SecureString -String $Value -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $path -NoNewline
  }
}
try {
  Ensure-LocalSecret 'v7-qa-email' 'codex.v7.qa@affimatik.online'
  $qaPasswordPath = Join-Path $secureDir 'v7-qa-password.dpapi'
  if (-not (Test-Path -LiteralPath $qaPasswordPath)) {
    $bytes = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    try { Ensure-LocalSecret 'v7-qa-password' ('V7-QA-' + [Convert]::ToBase64String($bytes).Replace('/','_').Replace('+','-') + '!') }
    finally { [Array]::Clear($bytes,0,$bytes.Length) }
  }
  $env:SUPABASE_SERVICE_ROLE_KEY = Read-LocalSecret 'supabase-service-role-key'
  $env:SUPABASE_ANON_KEY = Read-LocalSecret 'supabase-anon-key'
  $env:STAGING_GATE_SECRET = Read-LocalSecret 'staging-gate-secret'
  $env:V7_QA_EMAIL = Read-LocalSecret 'v7-qa-email'
  $env:V7_QA_PASSWORD = Read-LocalSecret 'v7-qa-password'
  Push-Location $repo
  try { & node scripts/release/v7-staging-journey.mjs; if ($LASTEXITCODE -ne 0) { throw "V7 staging journey gagal (exit $LASTEXITCODE)." } }
  finally { Pop-Location }
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY,Env:SUPABASE_ANON_KEY,Env:STAGING_GATE_SECRET,Env:V7_QA_EMAIL,Env:V7_QA_PASSWORD -ErrorAction SilentlyContinue
}
