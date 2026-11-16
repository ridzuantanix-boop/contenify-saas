import json
import wave
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path("output/expansion-v1-anti-ai-ab")
FRAMES = ROOT / "frames"
AUDIO = ROOT / "audio"


def frame_metrics(path: Path) -> dict:
    pixels = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32).reshape(-1, 3)
    red, green, blue = pixels[:, 0], pixels[:, 1], pixels[:, 2]
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    maximum = pixels.max(axis=1)
    minimum = pixels.min(axis=1)
    saturation = np.divide(maximum - minimum, maximum, out=np.zeros_like(maximum), where=maximum > 0)
    candidate = (luminance >= 175) & (saturation <= 0.18)
    candidate_pixels = pixels[candidate]
    candidate_mean = candidate_pixels.mean(axis=0) if candidate_pixels.size else np.array([np.nan] * 3)
    return {
        "meanLuminance": round(float(luminance.mean()), 3),
        "meanSaturation": round(float(saturation.mean()), 4),
        "brightLowSaturationShare": round(float(candidate.mean()), 4),
        "brightLowSaturationMeanRgb": [round(float(value), 3) for value in candidate_mean],
        "brightLowSaturationWarmBias": round(
            float((candidate_mean[0] + candidate_mean[1]) / 2 - candidate_mean[2]), 3
        ),
    }


def frame_series(directory: Path) -> list[dict]:
    series = []
    paths = sorted(directory.glob("*.png"), key=lambda path: float(path.stem.replace("_", ".")))
    for path in paths:
        timestamp = float(path.stem.replace("_", "."))
        series.append({"timestamp": timestamp, "file": path.name, **frame_metrics(path)})
    return series


def audio_metrics(path: Path) -> dict:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())
    if sample_width != 2:
        raise RuntimeError(f"Expected 16-bit PCM WAV: {path}")
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    window_seconds = 0.25
    window_samples = int(sample_rate * window_seconds)
    windows = []
    for start in range(0, len(samples), window_samples):
        chunk = samples[start : start + window_samples]
        if not chunk.size:
            continue
        rms = float(np.sqrt(np.mean(np.square(chunk))))
        peak = float(np.max(np.abs(chunk)))
        windows.append(
            {
                "start": round(start / sample_rate, 2),
                "end": round(min(start + len(chunk), len(samples)) / sample_rate, 2),
                "rms": round(rms, 6),
                "peak": round(peak, 6),
            }
        )
    return {
        "sampleRate": sample_rate,
        "channels": channels,
        "duration": round(len(samples) / sample_rate, 3),
        "lastTwoSeconds": [entry for entry in windows if entry["end"] > 13.0],
    }


source = Path("output/expansion-v1-real-qa/fixtures/NX23-tudung.jpg")
report = {
    "methodNote": (
        "Bright low-saturation pixels are only a colour signal proxy. The source image has no calibrated "
        "neutral-white target, so these values must not be presented as a white-balance score."
    ),
    "NX23": {
        "source": {"file": str(source), **frame_metrics(source)},
        "baselineFrames": frame_series(FRAMES / "NX23-baseline"),
        "refinedFrames": frame_series(FRAMES / "NX23-refined"),
    },
    "NX27": {
        "baselineAudio": audio_metrics(AUDIO / "NX27-baseline.wav"),
        "refinedAudio": audio_metrics(AUDIO / "NX27-refined.wav"),
    },
}

target = ROOT / "targeted-root-cause-signals.json"
target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
