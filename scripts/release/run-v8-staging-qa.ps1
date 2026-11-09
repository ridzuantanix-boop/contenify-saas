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
  Ensure-LocalSecret 'v8-qa-email' 'codex.v8.qa@affimatik.online'
  if (-not (Test-Path -LiteralPath (Join-Path $secureDir 'v8-qa-password.dpapi'))) {
    $bytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $rng.GetBytes($bytes)
      Ensure-LocalSecret 'v8-qa-password' ('V8-QA-' + [Convert]::ToBase64String($bytes).Replace('/','_').Replace('+','-') + '!')
    } finally {
      $rng.Dispose()
      [Array]::Clear($bytes, 0, $bytes.Length)
    }
  }
  $env:SUPABASE_SERVICE_ROLE_KEY = Read-LocalSecret 'supabase-service-role-key'
  $env:STAGING_GATE_SECRET = Read-LocalSecret 'staging-gate-secret'
  $env:V8_QA_EMAIL = Read-LocalSecret 'v8-qa-email'
  $env:V8_QA_PASSWORD = Read-LocalSecret 'v8-qa-password'
  Push-Location $repo
  try {
    & node scripts/release/v8-staging-qa.mjs
    if ($LASTEXITCODE -ne 0) { throw "V8 staging QA gagal (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY,Env:STAGING_GATE_SECRET,Env:V8_QA_EMAIL,Env:V8_QA_PASSWORD -ErrorAction SilentlyContinue
}
