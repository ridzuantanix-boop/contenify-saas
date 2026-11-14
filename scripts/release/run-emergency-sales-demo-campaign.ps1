param(
  [string]$ManifestRelativePath = 'output\provider-qa\emergency-sales-demo-manifest.json',
  [string]$OutputRelativePath = 'output\provider-qa\emergency-sales-demo-v10-2',
  [string]$CampaignLabel = 'emergency-sales-demo-v10-2',
  [decimal]$ExpectedCostPerJob = 0.30,
  [decimal]$MaximumCostPerJob = 0.35,
  [int]$PollSeconds = 12,
  [int]$TimeoutMinutes = 20
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$securePath = Join-Path $repo 'output\release\secure\nexabot-api-key.dpapi'
$manifestPath = Join-Path $repo $ManifestRelativePath
$outDir = Join-Path $repo $OutputRelativePath
$statePath = Join-Path $outDir 'campaign-state.json'
$receiptPath = Join-Path $outDir 'receipt.json'

if (-not (Test-Path -LiteralPath $securePath)) { throw 'Nexabot DPAPI credential is missing.' }
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Emergency demo manifest is missing.' }
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function Read-LocalSecret([string]$Path) {
  $secure = Get-Content -LiteralPath $Path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Save-Json([string]$Path, $Value) {
  $temp = "$Path.tmp"
  [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 30), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Get-Credits([string]$Key) {
  $value = Invoke-RestMethod -Uri 'https://nexabot.id/api/v1/credits' -Headers @{ Authorization = "Bearer $Key"; 'X-API-Key' = $Key } -TimeoutSec 45
  if (-not $value.ok -or $null -eq $value.credit) { throw 'Nexabot credit lookup failed.' }
  return [decimal]$value.credit
}

function Get-Mime([string]$Path) {
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.png' { 'image/png' }
    default { throw "Unsupported image: $Path" }
  }
}

function Get-ProviderJob([string]$TaskId, [hashtable]$Headers) {
  $response = Invoke-RestMethod -Uri "https://nexabot.id/api/v1/jobs/$TaskId" -Headers $Headers -TimeoutSec 45
  if ($response.job) { return $response.job }
  return $response
}

$key = Read-LocalSecret $securePath
try {
  $manifest = @(Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json)
  $expectedOrder = @('NX01', 'NX17', 'NX09')
  if ($manifest.Count -ne 3) { throw "Expected exactly three bounded jobs, found $($manifest.Count)." }
  for ($i = 0; $i -lt 3; $i++) {
    if ($manifest[$i].styleId -ne $expectedOrder[$i]) { throw "Manifest order must be NX01, NX17, NX09." }
    if ([string]$manifest[$i].prompt -notmatch '\[AUTHORITATIVE EFFECTIVE AUDIO MODE\]') { throw "Missing audio contract for $($manifest[$i].styleId)." }
    if ([string]$manifest[$i].prompt -match 'AffiMatik supplied spoken script|approved spoken script|exact spoken script') { throw "Stale script metadata in $($manifest[$i].styleId)." }
    if ($manifest[$i].styleId -in @('NX01','NX09') -and [string]$manifest[$i].prompt -notmatch 'Beg Kuning') { throw "Beg Kuning CTA missing for $($manifest[$i].styleId)." }
    if ($manifest[$i].styleId -eq 'NX17' -and [string]$manifest[$i].prompt -notmatch 'Tekan butang di bawah') { throw 'NX17 CTA missing.' }
  }

  $state = if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
  $campaignOpeningCredit = Get-Credits $key
  if ($campaignOpeningCredit -lt (($ExpectedCostPerJob * 3) + 1)) { throw "Guarded supplier balance is insufficient: $campaignOpeningCredit." }
  Write-Output "Supplier balance verified: $campaignOpeningCredit credits. Expected bounded spend: $($ExpectedCostPerJob * 3)."

  foreach ($item in $manifest) {
    $styleId = [string]$item.styleId
    $entry = if ($state.ContainsKey($styleId)) { $state[$styleId] } else { @{} }
    if ($entry.status -eq 'downloaded') {
      Write-Output "$styleId already downloaded; no resubmission."
      continue
    }

    $imagePath = Join-Path $repo ([string]$item.imagePath)
    if (-not (Test-Path -LiteralPath $imagePath)) { throw "Reference image missing for $styleId." }
    $imageBytes = [IO.File]::ReadAllBytes($imagePath)
    $imageHash = (Get-FileHash -LiteralPath $imagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $promptBytes = [Text.Encoding]::UTF8.GetBytes([string]$item.prompt)
    $promptHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($promptBytes)).ToLowerInvariant()
    $headers = @{ Authorization = "Bearer $key"; 'X-API-Key' = $key }

    if (-not $entry.taskId) {
      $before = Get-Credits $key
      $media = "data:$(Get-Mime $imagePath);base64,$([Convert]::ToBase64String($imageBytes))"
      $payload = @{
        mode = 'i2v'; prompt = [string]$item.prompt; telegram_id = 'web'; media = @($media, $media)
        ratio = 2; resolution = 720; duration = 15; use_unlimited = $false
      } | ConvertTo-Json -Depth 8 -Compress
      $safeCampaignLabel = ($CampaignLabel.ToLowerInvariant() -replace '[^a-z0-9-]', '-').Trim('-')
      $idempotency = "affimatik-$safeCampaignLabel-$($styleId.ToLowerInvariant())-$($promptHash.Substring(0,12))"
      $submittedAt = [DateTime]::UtcNow.ToString('o')
      $response = Invoke-RestMethod -Method Post -Uri 'https://nexabot.id/api/v1/api' -Headers ($headers + @{ 'X-Idempotency-Key' = $idempotency }) -ContentType 'application/json' -Body $payload -TimeoutSec 90
      $taskId = [string]($response.id ?? $response.job_id ?? $response.task_id)
      if (-not $response.ok -or -not $taskId) { throw "Provider rejected ${styleId}: $($response | ConvertTo-Json -Compress)" }
      $entry = @{
        styleId = $styleId; productName = [string]$item.productName; taskId = $taskId; status = 'submitted'
        submittedAt = $submittedAt; idempotencyKey = $idempotency; referenceSha256 = $imageHash
        referenceBytes = $imageBytes.Length; promptLength = ([string]$item.prompt).Length; promptSha256 = $promptHash
        supplierCreditBefore = $before; pollHistory = @()
      }
      $state[$styleId] = $entry
      Save-Json $statePath $state
      Write-Output "Submitted $styleId task $taskId."
    }

    $deadline = [DateTime]::UtcNow.AddMinutes($TimeoutMinutes)
    $job = $null
    do {
      $job = Get-ProviderJob ([string]$entry.taskId) $headers
      $status = [string]($job.status ?? 'unknown').ToLowerInvariant()
      $entry.status = $status
      $entry.pollHistory = @($entry.pollHistory) + @(@{ at = [DateTime]::UtcNow.ToString('o'); status = $status })
      $state[$styleId] = $entry
      Save-Json $statePath $state
      if ($status -in @('failed', 'error')) {
        $entry.error = [string]($job.error ?? $job.message ?? 'Provider generation failed')
        $state[$styleId] = $entry
        Save-Json $statePath $state
        throw "Provider failed ${styleId}: $($entry.error). No retry submitted."
      }
      if ($status -notin @('done', 'completed', 'succeeded')) { Start-Sleep -Seconds $PollSeconds }
    } while ($status -notin @('done', 'completed', 'succeeded') -and [DateTime]::UtcNow -lt $deadline)
    if ($status -notin @('done', 'completed', 'succeeded')) { throw "Provider timed out for $styleId. No retry submitted." }

    $videoUrl = [string]($job.storage_url ?? $job.video_url)
    if (-not $videoUrl) { $videoUrl = "https://nexabot.id/api/v1/jobs/$($entry.taskId)/download" }
    $rawPath = Join-Path $outDir "$styleId-provider.mp4"
    Invoke-WebRequest -Uri $videoUrl -Headers $headers -OutFile $rawPath -UseBasicParsing -TimeoutSec 180
    if ((Get-Item -LiteralPath $rawPath).Length -lt 100000) { throw "Downloaded media for $styleId is unexpectedly small." }
    $candidatePath = Join-Path $outDir "$styleId-candidate.mp4"
    & ffmpeg -y -v error -i $rawPath -map 0:v:0 -map '0:a?' -c copy -movflags +faststart $candidatePath
    if ($LASTEXITCODE -ne 0) { throw "MP4 normalization failed for $styleId." }
    $probe = & ffprobe -v error -show_entries 'format=duration,size:stream=codec_name,codec_type,width,height' -of json $candidatePath | ConvertFrom-Json
    $after = Get-Credits $key
    $debit = [decimal]$entry.supplierCreditBefore - $after
    $entry.status = 'downloaded'
    $entry.completedAt = [DateTime]::UtcNow.ToString('o')
    $entry.supplierCreditAfter = $after
    $entry.supplierCreditDebit = $debit
    $entry.outputPath = $candidatePath
    $entry.outputSha256 = (Get-FileHash -LiteralPath $candidatePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $entry.mediaProbe = $probe
    $state[$styleId] = $entry
    Save-Json $statePath $state
    Write-Output "Downloaded $styleId task $($entry.taskId); supplier debit $debit."
    if ($debit -gt $MaximumCostPerJob) {
      throw "Observed supplier debit $debit exceeded guarded maximum $MaximumCostPerJob after $styleId. Remaining jobs were not submitted."
    }
  }

  $campaignClosingCredit = Get-Credits $key
  $receipt = [ordered]@{
    createdAt = [DateTime]::UtcNow.ToString('o')
    promptVersion = 'pawarna-masterprompt-director-v10.2-quality-audit'
    campaignLabel = $CampaignLabel
    boundedPaidSubmissionLimit = 3
    supplierCreditBefore = $campaignOpeningCredit
    supplierCreditAfter = $campaignClosingCredit
    supplierCreditsUsed = $campaignOpeningCredit - $campaignClosingCredit
    jobs = $state
  }
  Save-Json $receiptPath $receipt
  Write-Output "Campaign complete. Supplier credits used: $($receipt.supplierCreditsUsed)."
} finally {
  Remove-Variable key -ErrorAction SilentlyContinue
}
