"""Build the 20 AffiMatik 720x1280 WebP posters from real V6 sample frames."""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "style-posters"
META_SOURCE = ROOT / "src" / "lib" / "styles" / "marketing-metadata.ts"

# Representative moments selected after reviewing each real sample contact sheet.
FRAMES = {
    "NX01": 8.0, "NX02": 8.0, "NX03": 7.0, "NX05": 8.0, "NX07": 8.0,
    "NX09": 6.0, "NX10": 4.0, "RH01": 6.0, "RH02": 6.0, "RH03": 5.0,
    "RH04": 6.0, "RH17": 8.0, "RH19": 8.0, "NX11": 6.0, "NX12": 8.0,
    "NX13": 7.0, "NX14": 8.0, "NX15": 7.0, "NX16": 7.0, "NX17": 8.0,
}

POSTER_COPY = {
    "NX01": ("Sembang Kawan Santai", "Mesra, natural, mudah percaya", "Review & Creator"),
    "NX02": ("Review Sambil Pegang", "Fungsi utama, terus jelas", "Review & Creator"),
    "NX03": ("Reaksi Pandang Pertama", "Rasa ingin tahu yang jujur", "Review & Creator"),
    "NX05": ("Masalah Harian & Produk", "Masalah relatable, pilihan relevan", "Cerita & Masalah"),
    "NX07": ("Soalan Buyer, Jawapan Ringkas", "Satu soalan, satu jawapan jelas", "Review & Creator"),
    "NX09": ("Produk Bergerak + Voiceover", "Produk fokus, suara santai", "Demo & Produk"),
    "NX10": ("Fakta Pada Label", "Fakta terlihat, penerangan tepat", "Demo & Produk"),
    "RH01": ("Goyang Produk Natural", "Gerakan kecil, fokus maksimum", "Demo & Produk"),
    "RH02": ("Putar Sudut Produk Perlahan", "Lihat bentuk dari sudut natural", "Demo & Produk"),
    "RH03": ("Ambil, Pegang & Letak", "Skala sebenar melalui gerakan tangan", "Demo & Produk"),
    "RH04": ("Ambil Produk Dari Rak", "Rutin rak yang terasa nyata", "Lifestyle"),
    "RH17": ("Produk Dalam Setup Meja", "Produk menyatu dalam ruang kerja", "Lifestyle"),
    "RH19": ("Produk Dalam Cahaya Tingkap", "Rupa jujur dalam cahaya natural", "Demo & Produk"),
    "NX11": ("POV Tengok Produk", "Lihat produk dari mata buyer", "POV"),
    "NX12": ("Jumpa Barang Menarik", "Tenaga discovery yang genuine", "Review & Creator"),
    "NX13": ("Borak Santai Di Dapur", "Cerita dapur yang terasa dekat", "Lifestyle"),
    "NX14": ("Review Di Meja Kerja", "Review fokus untuk rutin produktif", "Lifestyle"),
    "NX15": ("Cerita Masalah Pendek", "Cerita pendek, penyelesaian relevan", "Cerita & Masalah"),
    "NX16": ("Soft Sell Tanpa Paksa", "Cadangan ringan, tiada tekanan", "Soft Sell"),
    "NX17": ("Recommend Secara Spontan", "Cadangan spontan yang product-specific", "Review & Creator"),
}

ACCENTS = {
    "Review & Creator": "#45E0B7", "Demo & Produk": "#69C7FF", "POV": "#B8A7FF",
    "Lifestyle": "#FFD17B", "Cerita & Masalah": "#FF9F9F", "Soft Sell": "#9CE19B",
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size=size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=face)[2] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def extract_frame(style_id: str, timestamp: float, destination: Path) -> None:
    source = ROOT / "public" / "style-previews" / style_id / "sample-v6.mp4"
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(timestamp),
        "-i", str(source), "-frames:v", "1", str(destination),
    ], check=True)


def build_poster(style_id: str, frame_path: Path) -> Path:
    title, tagline, category = POSTER_COPY[style_id]
    frame = Image.open(frame_path).convert("RGB")
    frame = frame.resize((720, 1280), Image.Resampling.LANCZOS)

    # A restrained colour treatment keeps the real provider output representative.
    base = frame.filter(ImageFilter.GaussianBlur(0.25)).convert("RGBA")
    shade = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shade_pixels = shade.load()
    for y in range(1280):
        top_alpha = max(0, int(72 * (1 - y / 250)))
        bottom_alpha = 0 if y < 690 else min(226, int((y - 690) / 510 * 226))
        alpha = max(top_alpha, bottom_alpha)
        for x in range(720):
            shade_pixels[x, y] = (3, 12, 20, alpha)
    base = Image.alpha_composite(base, shade)
    draw = ImageDraw.Draw(base)

    bold = font("arialbd.ttf", 58)
    regular = font("arial.ttf", 27)
    small_bold = font("arialbd.ttf", 22)
    micro = font("arialbd.ttf", 18)
    accent = ACCENTS[category]

    # Top brand and ID stay inside the 48/80 safe area.
    draw.rounded_rectangle((48, 80, 242, 126), radius=23, fill=(5, 19, 28, 190), outline=accent, width=2)
    draw.text((68, 91), "AFFIMATIK", font=small_bold, fill="white")
    id_box = draw.textbbox((0, 0), style_id, font=micro)
    id_width = id_box[2] - id_box[0]
    draw.rounded_rectangle((624 - id_width, 80, 672, 126), radius=23, fill=accent)
    draw.text((648 - id_width / 2, 93), style_id, font=micro, fill="#07131A", anchor="ma")

    title_lines = wrap(draw, title, bold, 624)
    title_y = 870 if len(title_lines) <= 2 else 820
    for line in title_lines:
        draw.text((48, title_y), line, font=bold, fill="white", stroke_width=1, stroke_fill=(0, 0, 0, 90))
        title_y += 66

    draw.rounded_rectangle((48, title_y + 15, 60, title_y + 53), radius=6, fill=accent)
    draw.text((80, title_y + 17), tagline, font=regular, fill="#F4FAFC")

    cat_box = draw.textbbox((0, 0), category.upper(), font=micro)
    cat_width = cat_box[2] - cat_box[0] + 40
    draw.rounded_rectangle((48, 1130, 48 + cat_width, 1180), radius=25, fill=(6, 20, 29, 218), outline=(255, 255, 255, 150), width=1)
    draw.text((68, 1145), category.upper(), font=micro, fill="white")
    draw.text((672, 1154), "SAMPLE 15S", font=micro, fill=accent, anchor="ra")

    output = OUTPUT / f"{style_id}.webp"
    base.convert("RGB").save(output, "WEBP", quality=88, method=6)
    return output


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if not META_SOURCE.exists():
        raise SystemExit("Canonical marketing metadata is missing")
    receipt = []
    with tempfile.TemporaryDirectory(prefix="affimatik-posters-") as folder:
        temp = Path(folder)
        for style_id, timestamp in FRAMES.items():
            frame = temp / f"{style_id}.png"
            extract_frame(style_id, timestamp, frame)
            output = build_poster(style_id, frame)
            with Image.open(output) as poster:
                if poster.size != (720, 1280) or poster.format != "WEBP":
                    raise RuntimeError(f"Invalid poster output: {output}")
                receipt.append({"id": style_id, "timestamp": timestamp, "path": str(output.relative_to(ROOT)), "size": poster.size})
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
