param(
  [ValidateSet('database', 'storage', 'all')]
  [string]$Scope = 'all'
)

$ErrorActionPreference = 'Stop'
$secureDir = Join-Path $PSScriptRoot '..\..\output\release\secure'
New-Item -ItemType Directory -Path $secureDir -Force | Out-Null

function Save-Secret([string]$Name, [string]$Prompt) {
  $secret = Read-Host -Prompt $Prompt -AsSecureString
  if ($secret.Length -eq 0) { throw "$Name tidak boleh kosong." }
  $path = Join-Path $secureDir "$Name.dpapi"
  $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $path -NoNewline
  Write-Host "$Name disimpan secara terenkripsi untuk akaun Windows ini."
}

if ($Scope -in @('database', 'all')) {
  Save-Secret 'supabase-db-password' 'Kata laluan PostgreSQL projek affimatik-production (input tersembunyi)'
}
if ($Scope -in @('storage', 'all')) {
  Save-Secret 'supabase-service-role-key' 'Service-role key Supabase daripada Project Settings > API Keys (input tersembunyi)'
}
Write-Host "Fail rahsia berada dalam $secureDir dan tidak dimasukkan ke Git. Jangan kongsi fail ini."
