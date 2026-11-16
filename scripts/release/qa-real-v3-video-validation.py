import hashlib
import json
import os
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "affimatik-real-v3-video-validation"
BASE = ROOT / "output" / "affimatik-real-v2-release"
VIDEOS = OUT / "videos"
AUDIO = OUT / "audio"
TRANSCRIPTS = OUT / "transcripts"
FRAMES = OUT / "frames"
SHEETS = OUT / "contact-sheets"
COMPARISONS = OUT / "comparisons"
for directory in (AUDIO, TRANSCRIPTS, FRAMES, SHEETS, COMPARISONS):
    directory.mkdir(parents=True, exist_ok=True)

manifest = json.loads((OUT / "preflight-manifest.json").read_text(encoding="utf-8"))
ledger = json.loads((OUT / "submission-ledger.json").read_text(encoding="utf-8"))
model = WhisperModel(os.environ.get("WHISPER_MODEL", "base"), device="cpu", compute_type="int8")
times = (0.4, 2.5, 5.0, 7.5, 10.0, 12.5, 14.5)
results = {}

def run(*args):
    subprocess.run(list(args), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=codec_type,codec_name,width,height,sample_rate,channels",
        "-of", "json", str(path),
    ], text=True))

def frame(source, target, second):
    run("ffmpeg", "-y", "-v", "error", "-ss", str(second), "-i", str(source), "-frames:v", "1", "-vf", "scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:black", str(target))

def color_sample(path, second):
    image = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    nonblack = image[np.max(image, axis=2) > 15]
    bright = nonblack[np.mean(nonblack, axis=1) > 180] if len(nonblack) else nonblack
    mean = np.mean(nonblack, axis=0) if len(nonblack) else (0, 0, 0)
    bright_mean = np.mean(bright, axis=0) if len(bright) else (0, 0, 0)
    return {"second": second, "meanRgb": [round(float(v), 2) for v in mean], "brightMeanRgb": [round(float(v), 2) for v in bright_mean]}

for spec in manifest["jobs"]:
    style_id = spec["styleId"]
    entry = ledger["jobs"][style_id]
    source = Path(entry["outputPath"])
    baseline = Path(spec["baseline"]["mp4Path"])
    if not source.exists() or not baseline.exists():
        raise FileNotFoundError(f"{style_id}: MP4 evidence missing")
    media_probe = probe(source)
    wav = AUDIO / f"{style_id}.wav"
    run("ffmpeg", "-y", "-v", "error", "-i", str(source), "-ar", "16000", "-ac", "1", str(wav))
    with wave.open(str(wav), "rb") as track:
        samples = np.frombuffer(track.readframes(track.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    segments, info = model.transcribe(samples, language="ms", beam_size=5, vad_filter=True, word_timestamps=True, condition_on_previous_text=False)
    segment_rows, words = [], []
    for segment in segments:
        segment_rows.append({"start": round(float(segment.start), 3), "end": round(float(segment.end), 3), "text": segment.text.strip()})
        for word in segment.words or []:
            words.append({"start": round(float(word.start), 3), "end": round(float(word.end), 3), "word": word.word.strip(), "probability": round(float(word.probability), 4)})

    new_frames, old_frames, colors = [], [], []
    for index, second in enumerate(times):
        new_target = FRAMES / f"{style_id}-v3-{index + 1:02d}-{str(second).replace('.', '_')}s.jpg"
        old_target = FRAMES / f"{style_id}-v2-{index + 1:02d}-{str(second).replace('.', '_')}s.jpg"
        frame(source, new_target, second)
        frame(baseline, old_target, second)
        new_frames.append(new_target)
        old_frames.append(old_target)
        colors.append(color_sample(new_target, second))

    sheet = Image.new("RGB", (360 * 4, 640 * 2), "white")
    for index, item in enumerate(new_frames):
        sheet.paste(Image.open(item).convert("RGB"), ((index % 4) * 360, (index // 4) * 640))
    draw = ImageDraw.Draw(sheet)
    draw.rectangle((1080, 640, 1440, 1280), fill=(245, 245, 250))
    draw.multiline_text((1100, 680), f"REAL V3\n{style_id}\n\nTask\n{entry['taskId']}\n\nCTA\n{spec['cta']}", fill=(25, 25, 40), spacing=10)
    sheet_path = SHEETS / f"{style_id}.jpg"
    sheet.save(sheet_path, quality=92)

    comparison = Image.new("RGB", (360 * 4, 640 * 4), "white")
    comparison_draw = ImageDraw.Draw(comparison)
    for index, item in enumerate(old_frames):
        comparison.paste(Image.open(item).convert("RGB"), ((index % 4) * 360, (index // 4) * 640))
    for index, item in enumerate(new_frames):
        comparison.paste(Image.open(item).convert("RGB"), ((index % 4) * 360, 1280 + (index // 4) * 640))
    comparison_draw.rectangle((1080, 640, 1440, 1280), fill=(25, 25, 40))
    comparison_draw.multiline_text((1100, 680), f"{style_id}\nREAL V2\nTOP", fill="white", spacing=10)
    comparison_draw.rectangle((1080, 1920, 1440, 2560), fill=(70, 45, 140))
    comparison_draw.multiline_text((1100, 1960), f"{style_id}\nREAL V3\nBOTTOM", fill="white", spacing=10)
    comparison_path = COMPARISONS / f"{style_id}-v2-v3.jpg"
    comparison.save(comparison_path, quality=92)

    transcript = " ".join(row["text"] for row in segment_rows).strip()
    result = {
        "styleId": style_id, "styleName": spec["styleName"], "ctaTarget": spec["cta"],
        "taskId": entry["taskId"], "supplierCredit": entry["reportedCreditCost"], "sourceMp4": str(source),
        "mp4Sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "probe": media_probe,
        "language": info.language, "languageProbability": round(float(info.language_probability), 4),
        "transcript": transcript, "segments": segment_rows, "words": words,
        "speechStart": words[0]["start"] if words else None, "speechEnd": words[-1]["end"] if words else None,
        "ctaTimingCandidate": segment_rows[-1] if segment_rows else None,
        "contactSheet": str(sheet_path), "comparisonSheet": str(comparison_path), "frameTimes": times, "colorSamples": colors,
        "baseline": spec["baseline"],
    }
    (TRANSCRIPTS / f"{style_id}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    results[style_id] = result
    print(f"{style_id}: {transcript} [{result['speechStart']}–{result['speechEnd']}]")

(OUT / "media-qa.json").write_text(json.dumps({"generatedAt": ledger.get("finishedAt"), "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
lines = ["# REAL V3 automated media evidence", "", "Machine-assisted transcripts and CTA boundaries require human review.", "", "| Style | Task | Duration | Resolution | Speech end | Transcript |", "|---|---|---:|---|---:|---|"]
for style_id, item in results.items():
    video = next(stream for stream in item["probe"]["streams"] if stream["codec_type"] == "video")
    lines.append(f"| {style_id} | `{item['taskId']}` | {float(item['probe']['format']['duration']):.2f}s | {video.get('width')}×{video.get('height')} | {item['speechEnd']} | {item['transcript'].replace('|', '/')} |")
(OUT / "MEDIA-QA.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(json.dumps({"videos": len(results), "contactSheets": len(results), "comparisonSheets": len(results)}, indent=2))
