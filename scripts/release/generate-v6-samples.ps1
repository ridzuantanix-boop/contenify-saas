param(
  [int]$MaxNewSubmissions = 20,
  [int]$PollSeconds = 20,
  [int]$TimeoutMinutes = 35,
  [string[]]$RetryStyles = @(),
  [string]$AttemptLabel = 'a1',
  [string]$ManifestRelativePath = 'output\provider-qa\v6-sample-manifest.json',
  [string]$QaRelativePath = 'output\provider-qa\v6-samples',
  [string]$IdempotencyNamespace = 'affimatik-v6'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$securePath = Join-Path $repo 'output\release\secure\nexabot-api-key.dpapi'
$manifestPath = Join-Path $repo $ManifestRelativePath
$qaDir = Join-Path $repo $QaRelativePath
$statePath = Join-Path $qaDir 'generation-state.json'
$receiptPath = Join-Path $qaDir 'receipt.json'

if (-not (Test-Path -LiteralPath $securePath)) { throw 'Nexabot DPAPI credential is missing.' }
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'V6 sample manifest is missing. Run the gated prompt export first.' }
New-Item -ItemType Directory -Path $qaDir -Force | Out-Null

function Read-LocalSecret([string]$Path) {
  $secure = Get-Content -LiteralPath $Path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Save-Json([string]$Path, $Value) {
  $temp = "$Path.tmp"
  [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Get-Credits([string]$Key) {
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      $value = Invoke-RestMethod -Uri 'https://nexabot.id/api/v1/credits' -Headers @{ Authorization = "Bearer $Key"; 'X-API-Key' = $Key } -TimeoutSec 45
      if (-not $value.ok) { throw 'Nexabot credit lookup failed.' }
      return [decimal]$value.credit
    } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

function Get-Mime([string]$Path) {
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.png' { 'image/png' }
    default { throw "Unsupported sample image: $Path" }
  }
}

function Get-ProviderJob([string]$TaskId, [hashtable]$Headers) {
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try { return Invoke-RestMethod -Uri "https://nexabot.id/api/v1/jobs/$TaskId" -Headers $Headers -TimeoutSec 45 }
    catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

$key = Read-LocalSecret $securePath
try {
  $manifest = @(Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json)
  if ($manifest.Count -ne 20) { throw "Expected 20 V6 styles, found $($manifest.Count)." }
  $state = if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
  if ($RetryStyles.Count -gt 0) {
    if (Test-Path -LiteralPath $receiptPath) {
      $archiveReceipt = Join-Path $qaDir "receipt-before-$AttemptLabel.json"
      if (-not (Test-Path -LiteralPath $archiveReceipt)) { Copy-Item -LiteralPath $receiptPath -Destination $archiveReceipt }
    }
    foreach ($styleId in $RetryStyles) {
      if (-not ($manifest.styleId -contains $styleId)) { throw "Unknown retry style: $styleId" }
      $raw = Join-Path $qaDir "$styleId-provider.mp4"
      if (Test-Path -LiteralPath $raw) { Move-Item -LiteralPath $raw -Destination (Join-Path $qaDir "$styleId-provider-before-$AttemptLabel.mp4") -Force }
      $public = Join-Path $repo "public\style-previews\$styleId\sample-v6.mp4"
      if (Test-Path -LiteralPath $public) { Copy-Item -LiteralPath $public -Destination (Join-Path $qaDir "$styleId-public-before-$AttemptLabel.mp4") -Force }
      $state.Remove($styleId)
    }
    Save-Json $statePath $state
  }
  $creditsBefore = Get-Credits $key
  $pendingNew = @($manifest | Where-Object { -not $state.ContainsKey($_.styleId) }).Count
  if ($pendingNew -gt $MaxNewSubmissions) { throw "Submission budget exceeded: $pendingNew new jobs requested, limit is $MaxNewSubmissions." }
  if ($creditsBefore -lt ([decimal]$pendingNew * [decimal]'0.15' + [decimal]'1')) { throw "Insufficient guarded balance for $pendingNew samples." }

  $submitted = 0
  foreach ($item in $manifest) {
    if ($state.ContainsKey($item.styleId)) { continue }
    $imagePath = Join-Path $repo $item.imagePath
    if (-not (Test-Path -LiteralPath $imagePath)) { throw "Reference image missing for $($item.styleId)." }
    $bytes = [IO.File]::ReadAllBytes($imagePath)
    $media = "$(Get-Mime $imagePath);base64,$([Convert]::ToBase64String($bytes))"
    $media = "data:$media"
    $payload = @{
      mode = 'i2v'; prompt = [string]$item.prompt; telegram_id = 'web'; media = @($media, $media)
      ratio = 2; resolution = 720; duration = 15; use_unlimited = $false
    } | ConvertTo-Json -Depth 8 -Compress
    $headers = @{ Authorization = "Bearer $key"; 'X-API-Key' = $key; 'X-Idempotency-Key' = "$IdempotencyNamespace-$($item.styleId.ToLowerInvariant())-$AttemptLabel" }
    $response = Invoke-RestMethod -Method Post -Uri 'https://nexabot.id/api/v1/api' -Headers $headers -ContentType 'application/json' -Body $payload
    $taskId = [string]($response.id ?? $response.job_id ?? $response.task_id)
    if (-not $response.ok -or -not $taskId) { throw "Provider rejected $($item.styleId): $($response | ConvertTo-Json -Compress)" }
    $state[$item.styleId] = @{ styleId = $item.styleId; productName = $item.productName; taskId = $taskId; status = 'queued'; submittedAt = [DateTime]::UtcNow.ToString('o') }
    Save-Json $statePath $state
    $submitted++
    Write-Output "Submitted $($item.styleId) ($submitted/$pendingNew) task $taskId"
  }

  $deadline = [DateTime]::UtcNow.AddMinutes($TimeoutMinutes)
  do {
    $remaining = 0
    foreach ($item in $manifest) {
      $entry = $state[$item.styleId]
      if ($entry.status -in @('downloaded', 'failed')) { continue }
      $response = Get-ProviderJob $entry.taskId @{ Authorization = "Bearer $key"; 'X-API-Key' = $key }
      $job = if ($response.job) { $response.job } else { $response }
      $status = [string]($job.status ?? $response.status ?? 'unknown')
      $entry.status = $status.ToLowerInvariant()
      $entry.lastCheckedAt = [DateTime]::UtcNow.ToString('o')
      if ($entry.status -in @('failed', 'error')) {
        $entry.status = 'failed'
        $entry.error = [string]($job.error ?? $response.error ?? $response.message ?? 'Provider failed')
        Write-Output "FAILED $($item.styleId): $($entry.error)"
      } elseif ($entry.status -in @('done', 'completed', 'succeeded')) {
        $videoUrl = [string]($job.storage_url ?? $job.video_url)
        if (-not $videoUrl) { $videoUrl = "https://nexabot.id/api/v1/jobs/$($entry.taskId)/download" }
        $rawPath = Join-Path $qaDir "$($item.styleId)-provider.mp4"
        Invoke-WebRequest -Uri $videoUrl -Headers @{ Authorization = "Bearer $key"; 'X-API-Key' = $key } -OutFile $rawPath -UseBasicParsing
        if ((Get-Item -LiteralPath $rawPath).Length -lt 100000) { throw "Downloaded media for $($item.styleId) is unexpectedly small." }
        $publicDir = Join-Path $repo "public\style-previews\$($item.styleId)"
        New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
        $publicPath = Join-Path $publicDir 'sample-v6.mp4'
        & ffmpeg -y -v error -i $rawPath -map 0:v:0 -map '0:a?' -c copy -movflags +faststart $publicPath
        if ($LASTEXITCODE -ne 0) { throw "MP4 normalization failed for $($item.styleId)." }
        $entry.status = 'downloaded'
        $entry.videoUrl = $videoUrl
        $entry.publicPath = "public/style-previews/$($item.styleId)/sample-v6.mp4"
        $entry.bytes = (Get-Item -LiteralPath $publicPath).Length
        $entry.completedAt = [DateTime]::UtcNow.ToString('o')
        Write-Output "Downloaded $($item.styleId) ($($entry.bytes) bytes)"
      } else {
        $remaining++
      }
      $state[$item.styleId] = $entry
      Save-Json $statePath $state
    }
    if ($remaining -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
      Write-Output "Waiting for $remaining provider jobs..."
      Start-Sleep -Seconds $PollSeconds
    }
  } while ($remaining -gt 0 -and [DateTime]::UtcNow -lt $deadline)

  $creditsAfter = Get-Credits $key
  $downloaded = @($state.Values | Where-Object { $_.status -eq 'downloaded' }).Count
  $failed = @($state.Values | Where-Object { $_.status -eq 'failed' }).Count
  $receipt = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o'); promptVersion = 'affimatik-human-realism-v8.1-reference-lock'
    requested = 20; submittedThisRun = $submitted; downloaded = $downloaded; failed = $failed
    creditsBefore = $creditsBefore; creditsAfter = $creditsAfter; creditsUsed = $creditsBefore - $creditsAfter
    jobs = $state
  }
  Save-Json $receiptPath $receipt
  Write-Output "V6 samples: $downloaded downloaded, $failed failed, credits used $($receipt.creditsUsed)."
  if ($downloaded -ne 20 -or $failed -ne 0) { throw 'Not all V6 provider samples completed successfully.' }
} finally {
  Remove-Variable key -ErrorAction SilentlyContinue
}
