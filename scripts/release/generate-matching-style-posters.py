import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PREVIEWS = ROOT / "public" / "style-previews"
POSTERS = ROOT / "public" / "style-posters"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"

STYLES = {
    "NX01": ("Sembang Kawan Santai", "Mesra, natural, mudah percaya"),
    "NX02": ("Review Sambil Pegang", "Fungsi utama, terus jelas"),
    "NX03": ("Reaksi Pandang Pertama", "Rasa ingin tahu yang jujur"),
    "NX05": ("Masalah Harian & Produk", "Masalah relatable, pilihan relevan"),
    "NX07": ("Soalan Buyer, Jawapan Ringkas", "Satu soalan, satu jawapan jelas"),
    "NX09": ("Produk Bergerak + Voiceover", "Produk fokus, suara santai"),
    "NX10": ("Fakta Pada Label", "Fakta terlihat, penerangan tepat"),
    "RH01": ("Goyang Produk Natural", "Gerakan kecil, fokus maksimum"),
    "RH02": ("Putar Sudut Produk Perlahan", "Sudut natural, skala sebenar"),
    "RH03": ("Ambil, Pegang & Letak", "Graviti dan gerakan tangan nyata"),
    "RH04": ("Ambil Produk Dari Rak", "Rutin rak yang terasa nyata"),
    "RH17": ("Produk Dalam Setup Meja", "Produk menyatu dalam ruang kerja"),
    "RH19": ("Produk Dalam Cahaya Tingkap", "Rupa jujur dalam cahaya natural"),
    "NX11": ("POV Tengok Produk", "Lihat produk dari mata buyer"),
    "NX12": ("Jumpa Barang Menarik", "Tenaga discovery yang genuine"),
    "NX13": ("Borak Santai Di Dapur", "Cerita dapur yang terasa dekat"),
    "NX14": ("Review Di Meja Kerja", "Review fokus untuk rutin produktif"),
    "NX15": ("Cerita Masalah Pendek", "Cerita pendek, pilihan relevan"),
    "NX16": ("Soft Sell Tanpa Paksa", "Cadangan ringan, tiada tekanan"),
    "NX17": ("Recommend Secara Spontan", "Cadangan spontan dan spesifik"),
}


def frame_from_video(style_id: str) -> Image.Image:
    video = PREVIEWS / style_id / "sample-v6.mp4"
    output = POSTERS / f".{style_id}-frame.png"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-ss", "7", "-i", str(video), "-frames:v", "1",
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", str(output),
    ], check=True)
    image = Image.open(output).convert("RGB")
    output.unlink()
    return image


def draw_poster(style_id: str, title: str, tagline: str) -> None:
    image = frame_from_video(style_id)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(760, 1280):
        alpha = int(225 * ((y - 760) / 520) ** 0.72)
        for x in range(720):
            pixels[x, y] = (7, 13, 28, alpha)
    image = Image.alpha_composite(image.convert("RGBA"), overlay)
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.truetype(FONT_BOLD, 58)
    tagline_font = ImageFont.truetype(FONT_REGULAR, 28)
    badge_font = ImageFont.truetype(FONT_BOLD, 23)
    draw.rounded_rectangle((38, 38, 236, 91), radius=24, fill=(12, 18, 35, 215))
    draw.text((61, 52), f"15s · VOICE", font=badge_font, fill="white")
    draw.rounded_rectangle((584, 40, 682, 91), radius=24, fill=(51, 214, 158, 230))
    draw.text((604, 52), style_id, font=badge_font, fill=(5, 45, 36))
    wrapped_title = textwrap.wrap(title, width=22)
    title_y = 950 - (len(wrapped_title) - 1) * 58
    for line in wrapped_title:
        draw.text((42, title_y), line, font=title_font, fill="white", stroke_width=1, stroke_fill=(0, 0, 0, 90))
        title_y += 64
    draw.rounded_rectangle((43, title_y + 14, 53, title_y + 52), radius=5, fill=(43, 224, 157, 255))
    for index, line in enumerate(textwrap.wrap(tagline, width=36)):
        draw.text((72, title_y + 12 + index * 34), line, font=tagline_font, fill=(225, 231, 239, 255))
    image.convert("RGB").save(POSTERS / f"{style_id}.webp", "WEBP", quality=90, method=6)


def main() -> None:
    POSTERS.mkdir(parents=True, exist_ok=True)
    for style_id, (title, tagline) in STYLES.items():
        draw_poster(style_id, title, tagline)
        print(f"Generated matching poster {style_id}")


if __name__ == "__main__":
    main()
