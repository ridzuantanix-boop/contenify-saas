import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path("output/expansion-v1-anti-ai-ab")
FRAMES = ROOT / "frames"


def analyze(directory: Path) -> dict:
    images = []
    for image_path in sorted(directory.glob("*.png")):
        image = np.asarray(Image.open(image_path).convert("RGB"), dtype=np.float32)
        images.append(image)
    if not images:
        raise RuntimeError(f"No frames in {directory}")

    pixels = np.concatenate([image.reshape(-1, 3) for image in images], axis=0)
    red, green, blue = pixels[:, 0], pixels[:, 1], pixels[:, 2]
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    maximum = pixels.max(axis=1)
    minimum = pixels.min(axis=1)
    saturation = np.divide(maximum - minimum, maximum, out=np.zeros_like(maximum), where=maximum > 0)

    neutral_candidate = (luminance >= 175) & (saturation <= 0.18)
    neutral_pixels = pixels[neutral_candidate]
    neutral_mean = neutral_pixels.mean(axis=0) if neutral_pixels.size else np.array([np.nan, np.nan, np.nan])

    return {
        "sampledFrames": len(images),
        "meanRgb": [round(float(value), 3) for value in pixels.mean(axis=0)],
        "meanLuminance": round(float(luminance.mean()), 3),
        "luminanceStdDev": round(float(luminance.std()), 3),
        "meanSaturation": round(float(saturation.mean()), 4),
        "brightLowSaturationPixelShare": round(float(neutral_candidate.mean()), 4),
        "brightLowSaturationMeanRgb": [round(float(value), 3) for value in neutral_mean],
        "brightLowSaturationWarmBias": round(float((neutral_mean[0] + neutral_mean[1]) / 2 - neutral_mean[2]), 3),
        "note": "Bright low-saturation pixels are a signal proxy, not proof that a surface is physically neutral white.",
    }


report = {}
for style_id in ("NX23", "NX27"):
    report[style_id] = {
        "baseline": analyze(FRAMES / f"{style_id}-baseline"),
        "refined": analyze(FRAMES / f"{style_id}-refined"),
    }

target = ROOT / "color-signal-analysis.json"
target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
