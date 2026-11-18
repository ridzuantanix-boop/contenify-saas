param([switch]$Apply)

$ErrorActionPreference = 'Stop'
if (-not $Apply) { throw 'Gunakan -Apply untuk migrasi production terkawal.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secureDir = Join-Path $repo 'output\release\secure'
$psql = Join-Path $repo 'output\release\tools\pgsql\bin\psql.exe'
$ca = Join-Path $repo 'output\release\tools\supabase-prod-ca-2021.crt'
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$base = 'https://oudxnvazrdmnxdndpgmy.supabase.co'
$bucket = 'affimatik-assets'
$limit = 1536 * 1024

function Read-LocalSecret([string]$Name) {
  $secure = Get-Content -LiteralPath (Join-Path $secureDir "$Name.dpapi") -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Encode-ObjectPath([string]$Path) { ($Path.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/' }

$work = Join-Path ([IO.Path]::GetTempPath()) "affimatik-provider-assets-$([Guid]::NewGuid())"
New-Item -ItemType Directory -Path $work | Out-Null
try {
  $env:PGPASSWORD = Read-LocalSecret 'supabase-db-password'
  $serviceRole = Read-LocalSecret 'supabase-service-role-key'
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $ca
  $args = @('-h','aws-0-ap-northeast-1.pooler.supabase.com','-p','5432','-U','postgres.oudxnvazrdmnxdndpgmy','-d','postgres','-v','ON_ERROR_STOP=1','-At')
  $snapshot = "SELECT json_build_object('wallets',count(*),'balance',coalesce(sum(balance),0),'reserved',coalesce(sum(reserved_balance),0),'spent',coalesce(sum(lifetime_spent),0))::text FROM public.credit_wallets;"
  $before = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  foreach ($migration in @('00038_capture_nexabot_dispatch_errors.sql','00039_provider_image_transport_assets.sql')) {
    & $psql @args '-1' '-f' (Join-Path $repo "supabase\migrations\$migration")
    if ($LASTEXITCODE -ne 0) { throw "Migration gagal: $migration" }
  }

  $assetSql = @"
SELECT coalesce(json_agg(x),'[]'::json)::text FROM (
  SELECT 'avatars' AS table_name,a.id,a.image_r2_key AS object_key,
    CASE WHEN image_r2_key LIKE '%.png' THEN 'image/png' WHEN image_r2_key LIKE '%.webp' THEN 'image/webp' ELSE 'image/jpeg' END AS mime_type,
    (o.metadata->>'size')::bigint AS size_bytes,1280 AS max_edge
  FROM public.avatars a JOIN storage.objects o ON o.bucket_id='$bucket' AND o.name=a.image_r2_key
  WHERE (o.metadata->>'size')::bigint>$limit AND a.provider_r2_key IS NULL
  UNION ALL
  SELECT 'background_assets',b.id,b.image_r2_key,b.mime_type,(o.metadata->>'size')::bigint,1280
  FROM public.background_assets b JOIN storage.objects o ON o.bucket_id='$bucket' AND o.name=b.image_r2_key
  WHERE (o.metadata->>'size')::bigint>$limit AND b.provider_r2_key IS NULL
  UNION ALL
  SELECT 'product_images',p.id,p.r2_key,p.mime_type,(o.metadata->>'size')::bigint,1600
  FROM public.product_images p JOIN storage.objects o ON o.bucket_id='$bucket' AND o.name=p.r2_key
  WHERE (o.metadata->>'size')::bigint>$limit AND p.provider_r2_key IS NULL
) x;
"@
  $assetJson = ((& $psql @args '-c' $assetSql) -join "`n").Trim()
  $assets = @($assetJson | ConvertFrom-Json)
  if ($LASTEXITCODE -ne 0) { throw 'Inventori aset besar gagal.' }
  $headers = @{ apikey = $serviceRole; Authorization = "Bearer $serviceRole" }
  $processed = @()
  foreach ($asset in $assets) {
    if (-not $asset.id) { continue }
    $input = Join-Path $work "$($asset.id)-input"
    $output = Join-Path $work "$($asset.id)-provider.jpg"
    $encodedSource = Encode-ObjectPath ([string]$asset.object_key)
    Invoke-WebRequest -Uri "$base/storage/v1/object/authenticated/$bucket/$encodedSource" -Headers $headers -OutFile $input | Out-Null
    $edge = [int]$asset.max_edge
    foreach ($attempt in @(@{edge=$edge;q=3},@{edge=[math]::Min($edge,1280);q=5},@{edge=1024;q=7})) {
      & $ffmpeg -hide_banner -loglevel error -y -i $input -vf "scale=$($attempt.edge):$($attempt.edge):force_original_aspect_ratio=decrease" -frames:v 1 -q:v $attempt.q $output
      if ($LASTEXITCODE -ne 0) { throw "Pemampatan imej gagal: $($asset.id)" }
      if ((Get-Item -LiteralPath $output).Length -le $limit) { break }
    }
    $newSize = (Get-Item -LiteralPath $output).Length
    if ($newSize -gt $limit) { throw "Aset masih melebihi had selepas pemampatan: $($asset.id)" }
    $newKey = "$($asset.object_key).provider.jpg"
    $encodedTarget = Encode-ObjectPath $newKey
    $uploadHeaders = @{ apikey=$serviceRole; Authorization="Bearer $serviceRole"; 'Content-Type'='image/jpeg'; 'x-upsert'='true' }
    Invoke-WebRequest -Method Post -Uri "$base/storage/v1/object/$bucket/$encodedTarget" -Headers $uploadHeaders -InFile $output | Out-Null
    $patchHeaders = @{ apikey=$serviceRole; Authorization="Bearer $serviceRole"; 'Content-Type'='application/json'; Prefer='return=minimal' }
    $patchBody = @{ provider_r2_key=$newKey; provider_mime_type='image/jpeg'; provider_size_bytes=$newSize } | ConvertTo-Json -Compress
    Invoke-WebRequest -Method Patch -Uri "$base/rest/v1/$($asset.table_name)?id=eq.$($asset.id)" -Headers $patchHeaders -Body $patchBody | Out-Null
    $processed += [pscustomobject]@{ table=$asset.table_name; id=$asset.id; originalBytes=[int64]$asset.size_bytes; providerBytes=$newSize; reductionPercent=[math]::Round((1-$newSize/[double]$asset.size_bytes)*100,2) }
  }
  $after = (& $psql @args '-c' $snapshot).Trim() | ConvertFrom-Json
  foreach ($field in @('wallets','balance','reserved','spent')) { if ("$($before.$field)" -ne "$($after.$field)") { throw "Wallet integrity berubah: $field" } }
  $schema = (& $psql @args '-c' "SELECT json_build_object('dispatch_error_capture',position('last_provider_error' in pg_get_functiondef('public.fail_nexabot_dispatch_atomic(uuid,uuid,text,text)'::regprocedure))>0,'avatar_transport',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='avatars' AND column_name='provider_r2_key'),'background_transport',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='background_assets' AND column_name='provider_r2_key'),'product_transport',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='provider_r2_key'))::text;").Trim() | ConvertFrom-Json
  [pscustomobject]@{ success=$true; migrations=@('00038','00039'); walletIntegrity=$true; before=$before; after=$after; schema=$schema; processed=$processed; appliedAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Depth 6
} finally {
  Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
  $serviceRole = $null
}
