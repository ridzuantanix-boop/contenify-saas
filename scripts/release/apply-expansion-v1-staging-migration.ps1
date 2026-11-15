$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-v9-staging-db-password'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $env:PGCONNECT_TIMEOUT = '20'
  $args = @('-h','aws-0-ap-southeast-2.pooler.supabase.com','-p','5432','-U','postgres.bymorrozeokshzuzcdro','-d','postgres','-v','ON_ERROR_STOP=1')
  & $psql @args '-f' (Join-Path $repo 'supabase\migrations\00032_expansion_v1_styles.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi staging 00032 gagal.' }
  $check = (& $psql @args '-At' '-c' "SELECT json_build_object('count',count(*),'ids',array_agg(id ORDER BY id))::text FROM public.prompt_presets WHERE id BETWEEN 'NX21' AND 'NX30';").Trim()
  if ($LASTEXITCODE -ne 0 -or -not $check) { throw 'Semakan Expansion V1 staging gagal.' }
  Write-Output $check
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}

