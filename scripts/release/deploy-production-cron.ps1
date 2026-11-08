param([switch]$Deploy, [switch]$OwnerApproved)

$ErrorActionPreference = 'Stop'
if ($Deploy -and -not $OwnerApproved) { throw 'Production cron secret rotation requires explicit owner cutover authorisation.' }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$secretPath = Join-Path $secureDir 'worker-cron-secret.dpapi'
$tempFile = Join-Path $secureDir ("cron-secrets-" + [guid]::NewGuid().ToString('N') + '.json')
if (-not (Test-Path -LiteralPath $secretPath)) { throw 'Rahsia cron production tidak tersedia.' }

try {
  $secure = Get-Content -LiteralPath $secretPath -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  [IO.File]::WriteAllText($tempFile, (@{ CRON_SECRET = $secret } | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  $wrangler = Join-Path $repo 'node_modules\.bin\wrangler.cmd'
  $arguments = @('deploy', '--config', (Join-Path $repo 'workers\cron-reconciler\wrangler.toml'), '--secrets-file', $tempFile)
  if (-not $Deploy) { $arguments += '--dry-run' }
  Push-Location $repo
  try {
    & $wrangler @arguments
    if ($LASTEXITCODE -ne 0) { throw "Wrangler cron gagal (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
} finally {
  if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force }
  Remove-Variable secret -ErrorAction SilentlyContinue
}
