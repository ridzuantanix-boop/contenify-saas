import hashlib
import json
import os
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
BASE_OUT = ROOT / "output" / "affimatik-real-v2-release"
OUT = BASE_OUT / "retries" if os.environ.get("REAL_V2_QA_VARIANT") == "retries" else BASE_OUT
VIDEOS = OUT / "videos"
AUDIO = OUT / "audio"
TRANSCRIPTS = OUT / "transcripts"
SHEETS = OUT / "contact-sheets"
FRAMES = OUT / "frames"
for directory in (AUDIO, TRANSCRIPTS, SHEETS, FRAMES):
    directory.mkdir(parents=True, exist_ok=True)

manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
state = json.loads((OUT / "provider-state.json").read_text(encoding="utf-8"))
model = WhisperModel("base", device="cpu", compute_type="int8")
times = (0.4, 2.5, 5.0, 7.5, 10.0, 12.5, 14.5)
results = {}

def run(*args):
    subprocess.run(list(args), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for spec in manifest["jobs"]:
    style_id = spec["styleId"]
    entry = state["jobs"][style_id]
    source = Path(entry["outputPath"])
    if not source.exists():
        raise FileNotFoundError(source)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=codec_type,codec_name,width,height,sample_rate,channels",
        "-of", "json", str(source),
    ], text=True))
    wav = AUDIO / f"{style_id}.wav"
    run("ffmpeg", "-y", "-v", "error", "-i", str(source), "-ar", "16000", "-ac", "1", str(wav))
    with wave.open(str(wav), "rb") as track:
        samples = np.frombuffer(track.readframes(track.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    segments, info = model.transcribe(samples, language="ms", beam_size=3, vad_filter=True, word_timestamps=True, condition_on_previous_text=False)
    segment_rows, words = [], []
    for segment in segments:
        row = {"start": round(float(segment.start), 3), "end": round(float(segment.end), 3), "text": segment.text.strip()}
        segment_rows.append(row)
        for word in segment.words or []:
            words.append({"start": round(float(word.start), 3), "end": round(float(word.end), 3), "word": word.word.strip(), "probability": round(float(word.probability), 4)})
    frame_paths, color_rows = [], []
    for index, second in enumerate(times):
        target = FRAMES / f"{style_id}-{index + 1:02d}-{str(second).replace('.', '_')}s.jpg"
        run("ffmpeg", "-y", "-v", "error", "-ss", str(second), "-i", str(source), "-frames:v", "1", "-vf", "scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:black", str(target))
        frame_paths.append(target)
        image = np.asarray(Image.open(target).convert("RGB"), dtype=np.float32)
        nonblack = image[np.max(image, axis=2) > 15]
        bright = nonblack[np.mean(nonblack, axis=1) > 180] if len(nonblack) else nonblack
        color_rows.append({
            "second": second,
            "meanRgb": [round(float(value), 2) for value in (np.mean(nonblack, axis=0) if len(nonblack) else (0,0,0))],
            "brightMeanRgb": [round(float(value), 2) for value in (np.mean(bright, axis=0) if len(bright) else (0,0,0))],
        })
    sheet = Image.new("RGB", (360 * 4, 640 * 2), "white")
    for index, frame in enumerate(frame_paths):
        image = Image.open(frame).convert("RGB")
        sheet.paste(image, ((index % 4) * 360, (index // 4) * 640))
    draw = ImageDraw.Draw(sheet)
    draw.rectangle((1080, 640, 1440, 1280), fill=(245, 245, 250))
    draw.multiline_text((1100, 680), f"{style_id}\n{spec['styleName']}\n\nTask\n{entry['taskId']}\n\nCTA\n{spec['cta']}", fill=(25,25,40), spacing=10)
    sheet_path = SHEETS / f"{style_id}.jpg"
    sheet.save(sheet_path, quality=90)
    transcript_text = " ".join(row["text"] for row in segment_rows).strip()
    result = {
        "styleId": style_id, "styleName": spec["styleName"], "productLabel": spec["productLabel"], "ctaTarget": spec["cta"],
        "taskId": entry["taskId"], "supplierCredit": entry["reportedCreditCost"], "sourceMp4": str(source),
        "mp4Sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "probe": probe,
        "language": info.language, "languageProbability": round(float(info.language_probability), 4),
        "transcript": transcript_text, "segments": segment_rows, "words": words,
        "speechStart": words[0]["start"] if words else None, "speechEnd": words[-1]["end"] if words else None,
        "contactSheet": str(sheet_path), "frameTimes": times, "colorSamples": color_rows,
    }
    (TRANSCRIPTS / f"{style_id}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    results[style_id] = result
    print(f"{style_id}: {transcript_text} [{result['speechStart']}–{result['speechEnd']}]")

# Six styles per overview page, using representative 7.5-second frames.
ids = [spec["styleId"] for spec in manifest["jobs"]]
overview_paths = []
for page_index in range(0, len(ids), 6):
    page_ids = ids[page_index:page_index + 6]
    page = Image.new("RGB", (360 * 3, 700 * 2), "white")
    draw = ImageDraw.Draw(page)
    for index, style_id in enumerate(page_ids):
        frame = Image.open(FRAMES / f"{style_id}-04-7_5s.jpg").convert("RGB")
        x, y = (index % 3) * 360, (index // 3) * 700
        page.paste(frame, (x, y))
        draw.rectangle((x, y + 640, x + 360, y + 700), fill=(20,20,30))
        draw.text((x + 12, y + 651), f"{style_id} · {results[style_id]['styleName']}", fill="white")
    path = SHEETS / f"overview-{page_index // 6 + 1}.jpg"
    page.save(path, quality=90)
    overview_paths.append(str(path))

(OUT / "media-qa.json").write_text(json.dumps({"generatedAt": state.get("finishedAt"), "overviewSheets": overview_paths, "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
lines = ["# AffiMatik REAL V2 — automated media evidence", "", "Transcripts are machine-assisted evidence and require human listening before public creative acceptance.", "", "| Style | Task | Duration | Resolution | Speech end | Transcript |", "|---|---|---:|---|---:|---|"]
for style_id in ids:
    item = results[style_id]
    video = next(stream for stream in item["probe"]["streams"] if stream["codec_type"] == "video")
    lines.append(f"| {style_id} | `{item['taskId']}` | {float(item['probe']['format']['duration']):.2f}s | {video.get('width')}×{video.get('height')} | {item['speechEnd']} | {item['transcript'].replace('|','/')} |")
(OUT / "MEDIA-QA.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(json.dumps({"videos": len(results), "overviewSheets": overview_paths}, indent=2))
