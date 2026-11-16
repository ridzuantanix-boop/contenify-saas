"""Build a zero-cost forensic inventory for the existing AffiMatik REAL V2 media.

This script never calls Nexabot. It reads preserved campaign evidence, computes
reproducible media proxies, and creates side-by-side POC images from copies.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import statistics
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path("output/affimatik-real-v2-release").resolve()
FORENSICS = ROOT / "forensics"
POC = FORENSICS / "poc"

CLAIM_SAFE_INITIAL = {"NX22"}
REPEATED_CTA = {("retry", "NX14"), ("retry", "NX17"), ("initial", "NX13"), ("initial", "NX15")}


def load_results(relative: str) -> dict:
    payload = json.loads((ROOT / relative).read_text(encoding="utf-8"))["results"]
    return payload[0] if isinstance(payload, list) else payload


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower())


def category(label: str, style_id: str) -> str:
    value = label.lower()
    if style_id in {"NX21", "NX22", "NX23", "NX24", "NX25", "NX26"}:
        return "fashion"
    if any(word in value for word in ("chopper", "wok", "air fryer", "microwave")) or style_id in {"NX27", "NX28", "NX29", "NX30", "RH17", "NX13"}:
        return "kitchen"
    if any(word in value for word in ("serum", "sun fluid", "sunscreen")):
        return "beauty"
    if any(word in value for word in ("home mist", "aroma")):
        return "home-fragrance"
    return "supplement-or-wellness"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_frame(video: Path, second: float, target: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(second), "-i", str(video), "-frames:v", "1", str(target)],
        check=True,
    )


def bright_rgb(image_path: Path) -> tuple[float, float, float]:
    image = Image.open(image_path).convert("RGB")
    pixels = list(image.getdata())
    bright = [pixel for pixel in pixels if sum(pixel) / 3 >= 180]
    sample = bright or pixels
    return tuple(round(statistics.mean(pixel[channel] for pixel in sample), 2) for channel in range(3))


def comparison_sheet(original: Path, processed: Path, style_id: str) -> dict:
    frames = []
    metrics = []
    for second in (2.5, 7.5, 12.5):
        original_frame = POC / f"{style_id}-original-{second}.jpg"
        processed_frame = POC / f"{style_id}-processed-{second}.jpg"
        extract_frame(original, second, original_frame)
        extract_frame(processed, second, processed_frame)
        before = bright_rgb(original_frame)
        after = bright_rgb(processed_frame)
        metrics.append({"second": second, "beforeBrightRgb": before, "afterBrightRgb": after, "beforeRedBlueDelta": round(before[0] - before[2], 2), "afterRedBlueDelta": round(after[0] - after[2], 2)})
        frames.append((Image.open(original_frame).convert("RGB"), Image.open(processed_frame).convert("RGB"), second))
    width = 720 * 2
    height = 90 + 1280 * len(frames)
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 20), f"{style_id}: ORIGINAL", fill="black")
    draw.text((740, 20), f"{style_id}: LIMITED NEUTRAL COPY", fill="black")
    for index, (before, after, second) in enumerate(frames):
        y = 90 + 1280 * index
        canvas.paste(before, (0, y))
        canvas.paste(after, (720, y))
        draw.text((10, y + 10), f"{second:.1f}s", fill="white", stroke_width=2, stroke_fill="black")
    output = POC / f"{style_id}-before-after.jpg"
    canvas.save(output, quality=92)
    return {"sheet": str(output), "samples": metrics}


def main() -> None:
    FORENSICS.mkdir(parents=True, exist_ok=True)
    POC.mkdir(parents=True, exist_ok=True)
    initial = load_results("media-qa.json")
    retries = load_results("retries/media-qa.json")
    initial_manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    retry_manifest = json.loads((ROOT / "retries/manifest.json").read_text(encoding="utf-8"))
    specs = {
        ("initial", item["styleId"]): item for item in initial_manifest["jobs"]
    } | {
        ("retry", item["styleId"]): item for item in retry_manifest["jobs"]
    }
    rows = []
    for variant, results in (("initial", initial), ("retry", retries)):
        for style_id, result in results.items():
            spec = specs[(variant, style_id)]
            bright_delta = statistics.mean(sample["brightMeanRgb"][0] - sample["brightMeanRgb"][2] for sample in result["colorSamples"])
            low_confidence = sum(word["probability"] < 0.60 for word in result["words"])
            cta_exact = normalize(result["ctaTarget"]) in normalize(result["transcript"])
            cta_complete = cta_exact and result["speechEnd"] < 14.90 and (variant, style_id) not in REPEATED_CTA
            unsupported_claim = variant == "retry" or style_id not in CLAIM_SAFE_INITIAL
            mp4 = Path(result["sourceMp4"])
            prompt = Path(spec["promptPath"]).read_text(encoding="utf-8")
            rows.append({
                "variant": variant,
                "style_id": style_id,
                "style_name": result["styleName"],
                "category": category(result["productLabel"], style_id),
                "product_label": result["productLabel"],
                "task_id": result["taskId"],
                "input_sha256": spec["imageSha256"],
                "prompt_sha256": spec["promptSha256"],
                "prompt_chars": len(prompt),
                "prompt_words": len(prompt.split()),
                "strong_directives": len(re.findall(r"\b(?:do not|never|must|jangan|wajib)\b", prompt, re.I)),
                "mp4_path": str(mp4),
                "mp4_sha256": sha256(mp4),
                "transcript_path": str(ROOT / ("retries/transcripts" if variant == "retry" else "transcripts") / f"{style_id}.json"),
                "speech_end": result["speechEnd"],
                "bright_red_blue_delta": round(bright_delta, 2),
                "warm_cast_proxy": bright_delta >= 15,
                "low_confidence_words": low_confidence,
                "pronunciation_risk_proxy": low_confidence >= 3,
                "cta_exact_and_complete": cta_complete,
                "unsupported_claim_observed": unsupported_claim,
                "physics_hard_failure_in_sampled_frames": False,
                "shariah_hard_failure_in_sampled_frames": False,
            })
    with (FORENSICS / "inventory-50.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "totalVideos": len(rows),
        "defects": {
            "warmCastProxy": {"count": sum(row["warm_cast_proxy"] for row in rows), "rate": sum(row["warm_cast_proxy"] for row in rows) / len(rows)},
            "pronunciationRiskProxy": {"count": sum(row["pronunciation_risk_proxy"] for row in rows), "rate": sum(row["pronunciation_risk_proxy"] for row in rows) / len(rows)},
            "ctaBlocking": {"count": sum(not row["cta_exact_and_complete"] for row in rows), "rate": sum(not row["cta_exact_and_complete"] for row in rows) / len(rows)},
            "unsupportedClaimObserved": {"count": sum(row["unsupported_claim_observed"] for row in rows), "rate": sum(row["unsupported_claim_observed"] for row in rows) / len(rows)},
            "sampledPhysicsHardFailure": {"count": 0, "rate": 0, "scope": "350 sampled contact-sheet frames; not a substitute for complete motion review"},
            "sampledShariahHardFailure": {"count": 0, "rate": 0, "scope": "350 sampled contact-sheet frames; not a substitute for complete motion review"},
        },
        "byCategory": {},
        "promptComplexity": {
            "characterRange": [min(row["prompt_chars"] for row in rows), max(row["prompt_chars"] for row in rows)],
            "meanCharacters": round(statistics.mean(row["prompt_chars"] for row in rows)),
            "wordRange": [min(row["prompt_words"] for row in rows), max(row["prompt_words"] for row in rows)],
            "meanWords": round(statistics.mean(row["prompt_words"] for row in rows)),
            "meanStrongDirectives": round(statistics.mean(row["strong_directives"] for row in rows), 1),
        },
    }
    for name in sorted({row["category"] for row in rows}):
        group = [row for row in rows if row["category"] == name]
        summary["byCategory"][name] = {
            "videos": len(group),
            "warmCast": sum(row["warm_cast_proxy"] for row in group),
            "pronunciationRisk": sum(row["pronunciation_risk_proxy"] for row in group),
            "ctaBlocking": sum(not row["cta_exact_and_complete"] for row in group),
            "unsupportedClaim": sum(row["unsupported_claim_observed"] for row in group),
        }
    poc_metrics = {
        "NX22": comparison_sheet(Path(initial["NX22"]["sourceMp4"]), POC / "NX22-neutral-copy.mp4", "NX22"),
        "NX25": comparison_sheet(Path(initial["NX25"]["sourceMp4"]), POC / "NX25-neutral-copy.mp4", "NX25"),
        "NX29Audio": {
            "original": retries["NX29"]["sourceMp4"],
            "processed": str(POC / "NX29-loudnorm-copy.mp4"),
            "finding": "Loudness normalization changes level/dynamics only; dialogue words and pronunciation remain unchanged.",
        },
    }
    summary["poc"] = poc_metrics
    (FORENSICS / "defect-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

