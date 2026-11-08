$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'

function Read-LocalSecret([string]$Name) {
  $path = Join-Path $secureDir "$Name.dpapi"
  $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $env:SUPABASE_URL = 'https://oudxnvazrdmnxdndpgmy.supabase.co'
  $env:SUPABASE_ANON_KEY = Read-LocalSecret 'supabase-anon-key'
  $env:SUPABASE_SERVICE_ROLE_KEY = Read-LocalSecret 'supabase-service-role-key'
  $env:SESSION_SECRET = Read-LocalSecret 'session-secret-smoke'
  $env:AFFIMATIK_VOICE_PUBLIC_ENABLED = 'false'
  $env:AFFIMATIK_MOTION_PUBLIC_ENABLED = 'false'
  $env:PUBLIC_CHECKOUT_ENABLED = 'false'
  $env:USE_MOCK_PROVIDERS = 'false'
  Push-Location $repo
  try { & node (Join-Path $repo 'node_modules\next\dist\bin\next') start -H 127.0.0.1 -p 3101 }
  finally { Pop-Location }
} finally {
  foreach ($name in @('SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SESSION_SECRET',
    'AFFIMATIK_VOICE_PUBLIC_ENABLED','AFFIMATIK_MOTION_PUBLIC_ENABLED','PUBLIC_CHECKOUT_ENABLED','USE_MOCK_PROVIDERS')) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
}
