import json
import os
import subprocess
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / os.environ.get("AFFIMATIK_QA_DIR", "output/provider-qa/v8-3-rh")


def probe(path: Path) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def main() -> None:
    model = WhisperModel("base", device="cpu", compute_type="int8")
    rows = []
    for path in sorted(QA.glob("*-candidate.mp4")):
        media = probe(path)
        decoded = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
            check=True,
            capture_output=True,
        ).stdout
        audio = np.frombuffer(decoded, dtype=np.int16).astype(np.float32) / 32768.0
        segments, info = model.transcribe(audio, language="ms", beam_size=5, vad_filter=True)
        transcript_segments = [
            {"start": round(segment.start, 2), "end": round(segment.end, 2), "text": segment.text.strip()}
            for segment in segments if segment.text.strip()
        ]
        rows.append({
            "candidate": path.stem.replace("-candidate", ""),
            "file": str(path.relative_to(ROOT)).replace("\\", "/"),
            "duration": round(float(media["format"]["duration"]), 3),
            "streams": media["streams"],
            "language": info.language,
            "languageProbability": round(info.language_probability, 4),
            "transcript": " ".join(item["text"] for item in transcript_segments),
            "speechEnd": transcript_segments[-1]["end"] if transcript_segments else None,
            "segments": transcript_segments,
        })
    (QA / "media-audio-analysis.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    frames_dir = QA / "frames"
    frames_dir.mkdir(exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 20)
    sheet = Image.new("RGB", (3 * 216, len(rows) * 404), "#111827")
    for row_index, row in enumerate(rows):
        path = ROOT / row["file"]
        for column, second in enumerate((1, 7, 13)):
            frame_path = frames_dir / f'{row["candidate"]}-{second:02d}s.jpg'
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(second), "-i", str(path), "-frames:v", "1", "-vf", "scale=216:384", str(frame_path)], check=True)
            frame = Image.open(frame_path).convert("RGB")
            sheet.paste(frame, (column * 216, row_index * 404))
            draw = ImageDraw.Draw(sheet)
            draw.text((column * 216 + 8, row_index * 404 + 382), f'{row["candidate"]} · {second}s', font=font, fill="white")
    sheet.save(frames_dir / "contact-sheet.jpg", quality=90)
    print(json.dumps(rows, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
