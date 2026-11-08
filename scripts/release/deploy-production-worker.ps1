param([switch]$Deploy, [switch]$OwnerApproved)

$ErrorActionPreference = 'Stop'
if ($Deploy -and -not $OwnerApproved) { throw 'Production Worker deployment requires explicit owner cutover authorisation.' }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$tempFile = Join-Path $secureDir ("production-secrets-" + [guid]::NewGuid().ToString('N') + '.json')

function Read-LocalSecret([string]$Name) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path)) { throw "Rahsia $Name tidak tersedia." }
  $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $secrets = @{
    SUPABASE_ANON_KEY = Read-LocalSecret 'supabase-anon-key'
    SUPABASE_SERVICE_ROLE_KEY = Read-LocalSecret 'supabase-service-role-key'
    SESSION_SECRET = Read-LocalSecret 'worker-session-secret'
    ADMIN_ACCESS_KEY = Read-LocalSecret 'worker-admin-access-key'
    CRON_SECRET = Read-LocalSecret 'worker-cron-secret'
    NEXABOT_API_KEY = Read-LocalSecret 'nexabot-api-key'
  }
  [IO.File]::WriteAllText($tempFile, ($secrets | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  $wrangler = Join-Path $repo 'node_modules\.bin\wrangler.cmd'
  $arguments = @('deploy', '--config', (Join-Path $repo 'wrangler.production.toml'), '--secrets-file', $tempFile)
  if (-not $Deploy) { $arguments += '--dry-run' }
  Push-Location $repo
  try {
    & $wrangler @arguments
    if ($LASTEXITCODE -ne 0) { throw "Wrangler production gagal (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force }
  if ($secrets) { $secrets.Clear() }
}
