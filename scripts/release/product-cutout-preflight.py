"""Deterministic product-reference cutout preflight.

This diagnostic tool applies an explicitly reviewed polygon mask to an original
image. It never calls an AI model, never edits the source, and never invents label
or packaging pixels. It is intentionally not connected to production uploads.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_inside_root(value: str) -> Path:
    candidate = (ROOT / value).resolve() if not Path(value).is_absolute() else Path(value).resolve()
    if candidate != ROOT and ROOT not in candidate.parents:
        raise ValueError(f"Path must stay inside repository root: {candidate}")
    return candidate


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", required=True, help="JSON mask specification")
    parser.add_argument("--output-dir", default="output/product-cutout-preflight")
    args = parser.parse_args()

    spec_path = resolve_inside_root(args.spec)
    output_dir = resolve_inside_root(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))

    source = resolve_inside_root(spec["source"])
    original = Image.open(source).convert("RGB")
    expected = tuple(spec["expectedSize"])
    if original.size != expected:
        raise ValueError(f"Expected {expected}, got {original.size} for {source}")

    mask = Image.new("L", original.size, 0)
    draw = ImageDraw.Draw(mask)
    for polygon in spec["includePolygons"]:
        if len(polygon) < 3:
            raise ValueError("Every include polygon must have at least three points")
        draw.polygon([tuple(point) for point in polygon], fill=255)
    for polygon in spec.get("excludePolygons", []):
        draw.polygon([tuple(point) for point in polygon], fill=0)

    alpha = np.asarray(mask)
    if not np.any(alpha):
        raise ValueError("Mask selected no pixels")

    source_pixels = np.asarray(original)
    cutout_pixels = np.dstack((source_pixels, alpha))
    cutout = Image.fromarray(cutout_pixels, "RGBA")

    slug = spec["id"]
    cutout_path = output_dir / f"{slug}-cutout.png"
    neutral_path = output_dir / f"{slug}-neutral.png"
    comparison_path = output_dir / f"{slug}-comparison.jpg"
    mask_path = output_dir / f"{slug}-mask.png"
    receipt_path = output_dir / f"{slug}-receipt.json"

    cutout.save(cutout_path, optimize=True)
    mask.save(mask_path, optimize=True)

    neutral = Image.new("RGB", original.size, tuple(spec.get("neutralRgb", [238, 238, 238])))
    neutral.paste(cutout, mask=cutout.getchannel("A"))
    neutral.save(neutral_path, optimize=True)

    comparison = Image.new("RGB", (original.width * 2, original.height), "white")
    comparison.paste(original, (0, 0))
    comparison.paste(neutral, (original.width, 0))
    comparison.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
    comparison.save(comparison_path, quality=92, optimize=True)

    selected = alpha > 0
    cutout_rgb = np.asarray(cutout)[:, :, :3]
    identity_pixels_unchanged = bool(np.array_equal(source_pixels[selected], cutout_rgb[selected]))
    receipt = {
        "id": slug,
        "source": str(source.relative_to(ROOT)).replace("\\", "/"),
        "sourceSha256": sha256(source),
        "sourceSize": list(original.size),
        "selectedPixelCount": int(selected.sum()),
        "selectedPixelPercent": round(float(selected.mean() * 100), 4),
        "identityPixelsUnchanged": identity_pixels_unchanged,
        "cutoutSha256": sha256(cutout_path),
        "maskSha256": sha256(mask_path),
        "limitations": [
            "Polygon boundaries require human review and may retain or omit edge pixels.",
            "Transparent or reflective packaging may still contain source-background pixels inside the product.",
            "A cutout does not guarantee provider identity-only conditioning or scene independence.",
        ],
    }
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
