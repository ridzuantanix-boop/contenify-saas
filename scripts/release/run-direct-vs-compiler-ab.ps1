param(
  [string]$OutputRelativePath = 'output\provider-qa\direct-vs-compiler-ab',
  [decimal]$ExpectedCostPerJob = 0.30,
  [decimal]$MaximumTotalDebit = 0.60,
  [int]$PollSeconds = 12,
  [int]$TimeoutMinutes = 20
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outDir = Join-Path $repo $OutputRelativePath
$manifestPath = Join-Path $outDir 'experiment-manifest.json'
$statePath = Join-Path $outDir 'provider-state.json'
$receiptPath = Join-Path $outDir 'provider-receipt.json'
$securePath = Join-Path $repo 'output\release\secure\nexabot-api-key.dpapi'
$pricingEvidencePath = Join-Path $repo 'output\provider-qa\sales-demo-final-v10-2\receipt.json'

function Read-LocalSecret([string]$Path) {
  $secure = Get-Content -LiteralPath $Path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Save-Json([string]$Path, $Value) {
  $temp = "$Path.tmp"
  [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 40), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Get-Credits([string]$Key) {
  $result = Invoke-RestMethod -Uri 'https://nexabot.id/api/v1/credits' -Headers @{ Authorization = "Bearer $Key"; 'X-API-Key' = $Key } -TimeoutSec 45
  if (-not $result.ok -or $null -eq $result.credit) { throw 'Nexabot credit lookup failed.' }
  [decimal]$result.credit
}

function Get-Mime([string]$Path) {
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    default { throw "Unsupported reference-image type: $Path" }
  }
}

function Get-ProviderJob([string]$TaskId, [hashtable]$Headers) {
  $response = Invoke-RestMethod -Uri "https://nexabot.id/api/v1/jobs/$TaskId" -Headers $Headers -TimeoutSec 45
  if ($response.job) { return $response.job }
  $response
}

if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'A/B experiment manifest is missing; run build-direct-vs-compiler-ab.ts first.' }
if (-not (Test-Path -LiteralPath $securePath)) { throw 'Nexabot DPAPI credential is missing.' }
if (-not (Test-Path -LiteralPath $pricingEvidencePath)) { throw 'Latest actual 0.30-credit pricing receipt is missing.' }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.paidSubmissionLimit -ne 2 -or @($manifest.arms).Count -ne 2) { throw 'Hard guard: experiment must contain exactly two arms.' }
if ([decimal]$manifest.maximumProviderDebit -ne $MaximumTotalDebit) { throw 'Hard guard: manifest debit ceiling differs from script ceiling.' }

$pricingEvidence = Get-Content -LiteralPath $pricingEvidencePath -Raw | ConvertFrom-Json
$observedDebits = @($pricingEvidence.jobs.PSObject.Properties.Value | ForEach-Object { [decimal]$_.supplierCreditDebit })
if ($observedDebits.Count -lt 1 -or @($observedDebits | Where-Object { $_ -ne $ExpectedCostPerJob }).Count -gt 0) {
  throw 'Latest actual provider receipt does not support the expected 0.30-credit price; stop before submission.'
}
if (($ExpectedCostPerJob * 2) -gt $MaximumTotalDebit) { throw 'Expected experiment cost exceeds the owner-authorized ceiling.' }

$imagePath = [string]$manifest.shared.referencePath
if (-not (Test-Path -LiteralPath $imagePath)) { throw 'Authorized product reference is missing.' }
$actualImageHash = (Get-FileHash -LiteralPath $imagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualImageHash -ne [string]$manifest.shared.referenceSha256) { throw 'Reference bytes changed after preflight.' }

$state = if (Test-Path -LiteralPath $statePath) {
  Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -AsHashtable
} else {
  [ordered]@{ experiment = [string]$manifest.experiment; jobs = [ordered]@{}; submissionIntents = 0 }
}
$existingTaskIds = @($state.jobs.Values | Where-Object { $_.taskId } | ForEach-Object { $_.taskId })
if ($existingTaskIds.Count -gt 2) { throw 'Hard guard: more than two provider task IDs already exist.' }

$key = Read-LocalSecret $securePath
try {
  $headers = @{ Authorization = "Bearer $key"; 'X-API-Key' = $key }
  if (-not $state.Contains('supplierCreditBefore')) {
    $state.supplierCreditBefore = Get-Credits $key
    $state.pricingEvidence = [ordered]@{
      source = $pricingEvidencePath
      observedDebitPerCompletedJob = $ExpectedCostPerJob
      observedAt = [string]$pricingEvidence.createdAt
      currentBalanceVerifiedAt = [DateTime]::UtcNow.ToString('o')
    }
    if ([decimal]$state.supplierCreditBefore -lt $MaximumTotalDebit) { throw 'Provider balance is below the authorized experiment ceiling.' }
    Save-Json $statePath $state
  }
  Write-Output "Provider balance verified: $($state.supplierCreditBefore). Latest actual price evidence: $ExpectedCostPerJob per completed 15s job."

  $imageBytes = [IO.File]::ReadAllBytes($imagePath)
  $media = "data:$(Get-Mime $imagePath);base64,$([Convert]::ToBase64String($imageBytes))"

  foreach ($arm in @($manifest.arms)) {
    $armId = [string]$arm.id
    if ($state.jobs.Contains($armId)) { continue }
    if ([int]$state.submissionIntents -ge 2) { throw 'Hard guard: two submission intents already recorded; no additional call allowed.' }
    $promptPath = [string]$arm.promptPath
    $prompt = Get-Content -LiteralPath $promptPath -Raw
    $promptHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($prompt))).ToLowerInvariant()
    if ($promptHash -ne [string]$arm.promptSha256) { throw "Prompt bytes changed after preflight for arm $armId." }
    $idempotency = "affimatik-direct-vs-compiler-ab-$($armId.ToLowerInvariant())-$($promptHash.Substring(0,12))"
    $entry = [ordered]@{
      arm = $armId
      label = [string]$arm.label
      status = 'submission-intent-recorded'
      idempotencyKey = $idempotency
      promptSha256 = $promptHash
      promptLength = $prompt.Length
      referenceSha256 = $actualImageHash
      submissionIntentAt = [DateTime]::UtcNow.ToString('o')
      pollHistory = @()
    }
    $state.jobs[$armId] = $entry
    $state.submissionIntents = [int]$state.submissionIntents + 1
    Save-Json $statePath $state

    $payload = [ordered]@{
      mode = 'i2v'
      prompt = $prompt
      telegram_id = 'web'
      media = @($media, $media)
      ratio = 2
      resolution = 720
      duration = 15
      use_unlimited = $false
    }
    $submittedAt = [DateTime]::UtcNow.ToString('o')
    try {
      $response = Invoke-RestMethod -Method Post -Uri 'https://nexabot.id/api/v1/api' -Headers ($headers + @{ 'X-Idempotency-Key' = $idempotency }) -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 90
      $taskId = [string]($response.id ?? $response.job_id ?? $response.task_id)
      if (-not $response.ok -or -not $taskId) { throw "Provider response did not contain an accepted task ID: $($response | ConvertTo-Json -Compress)" }
      $entry.taskId = $taskId
      $entry.status = [string]($response.status ?? 'queued')
      $entry.submittedAt = $submittedAt
      $entry.sanitizedSubmitResponse = [ordered]@{ ok = [bool]$response.ok; id = $taskId; status = [string]$response.status }
      $state.jobs[$armId] = $entry
      Save-Json $statePath $state
      Write-Output "Submitted arm $armId exactly once: task $taskId."
    } catch {
      $entry.status = 'ambiguous-or-rejected-submission'
      $entry.submissionError = $_.Exception.Message
      $state.jobs[$armId] = $entry
      Save-Json $statePath $state
      throw "Arm $armId submission did not return a safe task ID. No retry will be made. $($_.Exception.Message)"
    }
  }

  if ([int]$state.submissionIntents -ne 2 -or @($state.jobs.Keys).Count -ne 2) { throw 'Experiment did not record exactly two bounded submissions.' }

  $deadline = [DateTime]::UtcNow.AddMinutes($TimeoutMinutes)
  do {
    $allTerminal = $true
    foreach ($armId in @('A', 'B')) {
      $entry = $state.jobs[$armId]
      if (-not $entry.taskId -or $entry.status -in @('downloaded', 'failed', 'error', 'timed-out')) { continue }
      $job = Get-ProviderJob ([string]$entry.taskId) $headers
      $status = [string]($job.status ?? 'unknown').ToLowerInvariant()
      $entry.status = $status
      $entry.pollHistory = @($entry.pollHistory) + @([ordered]@{ at = [DateTime]::UtcNow.ToString('o'); status = $status })
      if ($status -in @('failed', 'error')) {
        $entry.error = [string]($job.error ?? $job.message ?? 'Provider generation failed')
      } elseif ($status -in @('done', 'completed', 'succeeded')) {
        $videoUrl = [string]($job.storage_url ?? $job.video_url)
        if (-not $videoUrl) { $videoUrl = "https://nexabot.id/api/v1/jobs/$($entry.taskId)/download" }
        $rawPath = Join-Path $outDir "test-$($armId.ToLowerInvariant())-provider.mp4"
        Invoke-WebRequest -Uri $videoUrl -Headers $headers -OutFile $rawPath -UseBasicParsing -TimeoutSec 180
        if ((Get-Item -LiteralPath $rawPath).Length -lt 100000) { throw "Downloaded MP4 for arm $armId is unexpectedly small." }
        $finalPath = Join-Path $outDir "test-$($armId.ToLowerInvariant())-final.mp4"
        & ffmpeg -y -v error -i $rawPath -map 0:v:0 -map '0:a?' -c copy -movflags +faststart $finalPath
        if ($LASTEXITCODE -ne 0) { throw "MP4 normalization failed for arm $armId." }
        $entry.status = 'downloaded'
        $entry.completedAt = [DateTime]::UtcNow.ToString('o')
        $entry.outputPath = $finalPath
        $entry.outputSha256 = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $entry.mediaProbe = (& ffprobe -v error -show_entries 'format=duration,size:stream=codec_name,codec_type,width,height' -of json $finalPath | ConvertFrom-Json)
      } else {
        $allTerminal = $false
      }
      $state.jobs[$armId] = $entry
      Save-Json $statePath $state
    }
    if (-not $allTerminal) { Start-Sleep -Seconds $PollSeconds }
  } while (-not $allTerminal -and [DateTime]::UtcNow -lt $deadline)

  foreach ($armId in @('A', 'B')) {
    $entry = $state.jobs[$armId]
    if ($entry.status -notin @('downloaded', 'failed', 'error')) {
      $entry.status = 'timed-out'
      $entry.error = 'Polling deadline reached; no retry or resubmission was made.'
      $state.jobs[$armId] = $entry
    }
  }
  $state.supplierCreditAfter = Get-Credits $key
  $state.supplierCreditsUsed = [decimal]$state.supplierCreditBefore - [decimal]$state.supplierCreditAfter
  $state.finishedAt = [DateTime]::UtcNow.ToString('o')
  Save-Json $statePath $state
  Save-Json $receiptPath ([ordered]@{
    experiment = [string]$manifest.experiment
    paidSubmissionLimit = 2
    actualSubmissionIntents = [int]$state.submissionIntents
    supplierCreditBefore = [decimal]$state.supplierCreditBefore
    supplierCreditAfter = [decimal]$state.supplierCreditAfter
    supplierCreditsUsed = [decimal]$state.supplierCreditsUsed
    maximumAuthorizedDebit = $MaximumTotalDebit
    jobs = $state.jobs
    createdAt = [DateTime]::UtcNow.ToString('o')
  })
  if ([decimal]$state.supplierCreditsUsed -gt $MaximumTotalDebit) { throw 'Provider debit exceeded the authorized ceiling; no further submission was made.' }
  Write-Output "Experiment finished. Exact submissions: $($state.submissionIntents). Supplier debit: $($state.supplierCreditsUsed)."
} finally {
  Remove-Variable key -ErrorAction SilentlyContinue
}
