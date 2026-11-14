param(
    [string]$EvidenceDirectory = "output/provider-qa/sales-demo-final-v10-2"
)

$ErrorActionPreference = "Stop"

# Diagnostic-only repair for the two rejected V10.2 sales-demo candidates.
# This deliberately uses fixed, manually verified speech boundaries. It must not
# be generalized to customer videos or run as an automatic production step.
$repairs = @(
    @{
        Name = "NX01"
        CutoffSeconds = 8.30
        FadeStartSeconds = 8.18
        RoomStartSeconds = 13.40
        RoomEndSeconds = 14.70
    },
    @{
        Name = "NX17"
        CutoffSeconds = 9.50
        FadeStartSeconds = 9.38
        RoomStartSeconds = 13.10
        RoomEndSeconds = 15.00
    }
)

$outputDirectory = Join-Path $EvidenceDirectory "repaired-copies"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

foreach ($repair in $repairs) {
    $input = Join-Path $EvidenceDirectory "$($repair.Name)-candidate.mp4"
    $output = Join-Path $outputDirectory "$($repair.Name)-audio-tail-repair.mp4"

    if (-not (Test-Path -LiteralPath $input)) {
        throw "Missing diagnostic input: $input"
    }

    $cutoffMs = [int][math]::Round($repair.CutoffSeconds * 1000)
    $remainingSeconds = 15.04 - $repair.CutoffSeconds
    $roomSamples = [int][math]::Round(($repair.RoomEndSeconds - $repair.RoomStartSeconds) * 48000)

    $filter = "[0:a]asplit=2[dialog_source][room_source];" +
        "[dialog_source]afade=t=out:st=$($repair.FadeStartSeconds):d=0.12," +
        "volume='if(lt(t,$($repair.CutoffSeconds)),1,0)':eval=frame[dialog];" +
        "[room_source]atrim=start=$($repair.RoomStartSeconds):end=$($repair.RoomEndSeconds)," +
        "asetpts=PTS-STARTPTS,aloop=loop=-1:size=$roomSamples," +
        "atrim=duration=$remainingSeconds,afade=t=in:st=0:d=0.12," +
        "adelay=$cutoffMs|$cutoffMs[room];" +
        "[dialog][room]amix=inputs=2:duration=first:normalize=0[audio]"

    & ffmpeg -hide_banner -loglevel error -y -i $input `
        -filter_complex $filter -map 0:v:0 -map "[audio]" `
        -c:v copy -c:a aac -b:a 192k -movflags +faststart -t 15.04 $output

    if ($LASTEXITCODE -ne 0) {
        throw "ffmpeg failed for $($repair.Name)"
    }

    Write-Output $output
}
