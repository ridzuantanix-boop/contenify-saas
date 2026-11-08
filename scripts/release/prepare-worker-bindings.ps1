$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
New-Item -ItemType Directory -Path $secureDir -Force | Out-Null

function Ensure-GeneratedSecret([string]$Name, [int]$ByteCount) {
  $path = Join-Path $secureDir "$Name.dpapi"
  if (Test-Path -LiteralPath $path) {
    Write-Host "$Name tersedia. Nilai sedia ada dikekalkan."
    return
  }
  $bytes = New-Object byte[] $ByteCount
  try {
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $value = [Convert]::ToBase64String($bytes)
    ConvertTo-SecureString -String $value -AsPlainText -Force |
      ConvertFrom-SecureString | Set-Content -LiteralPath $path -NoNewline
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  Write-Host "$Name dijana dan disimpan dengan DPAPI."
}

Ensure-GeneratedSecret 'worker-session-secret' 48
Ensure-GeneratedSecret 'worker-admin-access-key' 32
Ensure-GeneratedSecret 'worker-cron-secret' 32
Ensure-GeneratedSecret 'staging-gate-secret' 32
Ensure-GeneratedSecret 'staging-session-secret' 48
Ensure-GeneratedSecret 'staging-admin-access-key' 32
Ensure-GeneratedSecret 'staging-cron-secret' 32

foreach ($name in @('supabase-anon-key', 'supabase-service-role-key', 'nexabot-api-key')) {
  if (Test-Path -LiteralPath (Join-Path $secureDir "$name.dpapi")) {
    Write-Host "$name tersedia."
  } else {
    Write-Host "$name BELUM tersedia."
  }
}
Write-Host 'Tiada rahsia dimuat naik ke Cloudflare oleh skrip ini.'
