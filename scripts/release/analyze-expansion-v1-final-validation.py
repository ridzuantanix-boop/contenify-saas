import json
import os
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(os.environ.get("QA_ROOT", "output/expansion-v1-final-validation-retry-1"))
FRAMES = ROOT / "frames"


def analyze(directory: Path) -> dict:
    images = [
        np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
        for path in sorted(directory.glob("*.png"))
    ]
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
    neutral_mean = neutral_pixels.mean(axis=0) if neutral_pixels.size else np.array([np.nan] * 3)
    return {
        "sampledFrames": len(images),
        "meanRgb": [round(float(value), 3) for value in pixels.mean(axis=0)],
        "meanLuminance": round(float(luminance.mean()), 3),
        "meanSaturation": round(float(saturation.mean()), 4),
        "brightLowSaturationPixelShare": round(float(neutral_candidate.mean()), 4),
        "brightLowSaturationMeanRgb": [round(float(value), 3) for value in neutral_mean],
        "brightLowSaturationWarmBias": round(float((neutral_mean[0] + neutral_mean[1]) / 2 - neutral_mean[2]), 3),
        "note": "Signal proxy only; the source images are not calibrated neutral-white targets.",
    }


report = {
    style_id: {
        version: analyze(FRAMES / f"{style_id}-{version}")
        for version in ("baseline", "anti-ai", "final")
    }
    for style_id in ("NX23", "NX27")
}

target = ROOT / "color-signal-analysis.json"
target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
