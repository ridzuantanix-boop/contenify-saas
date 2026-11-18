param([Parameter(Mandatory = $true)][Guid]$AvatarId)

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

$temporary = Join-Path ([IO.Path]::GetTempPath()) "affimatik-provider-copy-$([Guid]::NewGuid()).jpg"
try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $serviceRole = Read-LocalSecret 'supabase-service-role-key'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At','-F','|')
  $sql = "SELECT a.image_r2_key,coalesce(o.metadata->>'size','0'),a.provider_r2_key,coalesce(a.provider_size_bytes,0) FROM public.avatars a LEFT JOIN storage.objects o ON o.bucket_id='affimatik-assets' AND o.name=a.image_r2_key WHERE a.id='$AvatarId';"
  $row = (& $psql @args '-c' $sql).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $row) { throw 'Avatar verification fixture tidak ditemui.' }
  $parts = $row.Split('|')
  if (-not $parts[2]) { throw 'Provider transport copy belum tersedia.' }
  $encoded = ($parts[2].Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
  $url = "https://oudxnvazrdmnxdndpgmy.supabase.co/storage/v1/object/authenticated/affimatik-assets/$encoded"
  $response = Invoke-WebRequest -Uri $url -Headers @{ apikey = $serviceRole; Authorization = "Bearer $serviceRole"; Accept = 'image/jpeg' } -OutFile $temporary -PassThru
  $transportBytes = (Get-Item -LiteralPath $temporary).Length
  $originalBytes = [int64]$parts[1]
  [pscustomobject]@{
    success = $true
    http = [int]$response.StatusCode
    contentType = $response.Headers.'Content-Type'
    originalBytes = $originalBytes
    transportBytes = $transportBytes
    recordedTransportBytes = [int64]$parts[3]
    reductionPercent = [math]::Round((1 - $transportBytes / [double]$originalBytes) * 100, 2)
    transportSha256 = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLower()
  } | ConvertTo-Json -Compress
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
  $serviceRole = $null
}
