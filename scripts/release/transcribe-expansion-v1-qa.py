import json
import os
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel


ROOT = Path(os.environ.get("QA_ROOT", "output/expansion-v1-real-qa"))
AUDIO = ROOT / "audio"
OUT = ROOT / "transcripts"
OUT.mkdir(parents=True, exist_ok=True)

model = WhisperModel("base", device="cpu", compute_type="int8")

for audio_path in sorted(AUDIO.glob("NX*.wav")):
    with wave.open(str(audio_path), "rb") as wav_file:
        if wav_file.getnchannels() != 1 or wav_file.getframerate() != 16000 or wav_file.getsampwidth() != 2:
            raise RuntimeError(f"Unexpected WAV format: {audio_path}")
        samples = np.frombuffer(wav_file.readframes(wav_file.getnframes()), dtype=np.int16)
        audio = samples.astype(np.float32) / 32768.0
    segments, info = model.transcribe(
        audio,
        language="ms",
        beam_size=3,
        vad_filter=True,
        word_timestamps=True,
        condition_on_previous_text=False,
    )
    rows = []
    words = []
    for segment in segments:
        segment_words = []
        for word in segment.words or []:
            item = {
                "start": round(float(word.start), 3),
                "end": round(float(word.end), 3),
                "word": word.word,
                "probability": round(float(word.probability), 4),
            }
            segment_words.append(item)
            words.append(item)
        rows.append(
            {
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": segment.text.strip(),
                "words": segment_words,
            }
        )
    result = {
        "audio": str(audio_path.resolve()),
        "language": info.language,
        "language_probability": round(float(info.language_probability), 4),
        "duration": round(float(info.duration), 3),
        "duration_after_vad": round(float(info.duration_after_vad), 3),
        "transcript": " ".join(row["text"] for row in rows).strip(),
        "speech_start": words[0]["start"] if words else None,
        "speech_end": words[-1]["end"] if words else None,
        "segments": rows,
    }
    target = OUT / f"{audio_path.stem}.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{audio_path.stem}: {result['transcript']} [{result['speech_start']}–{result['speech_end']}s]")
