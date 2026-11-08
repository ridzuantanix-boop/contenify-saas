import hashlib
import io
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'provider-qa' / 'v6-samples'
STYLES = ['NX01','NX02','NX03','NX05','NX07','NX09','NX10','RH01','RH02','RH03','RH04','RH17','RH19','NX11','NX12','NX13','NX14','NX15','NX16','NX17']
if len(sys.argv) > 1:
    STYLES = sys.argv[1:]


def probe(path: Path):
    raw = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=index,codec_type,codec_name,width,height,duration',
        '-of', 'json', str(path)
    ])
    return json.loads(raw)


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


model = WhisperModel('small', device='cpu', compute_type='int8')
results = {}

page_count = (len(STYLES) + 4) // 5
for page in range(page_count):
    page_styles = STYLES[page * 5:(page + 1) * 5]
    canvas = Image.new('RGB', (720, len(page_styles) * 350), 'white')
    draw = ImageDraw.Draw(canvas)
    for row, style in enumerate(page_styles):
        source = ROOT / 'public' / 'style-previews' / style / 'sample-v6.mp4'
        if not source.exists():
            raise FileNotFoundError(source)
        metadata = probe(source)
        streams = metadata['streams']
        video = next(item for item in streams if item['codec_type'] == 'video')
        audio = next((item for item in streams if item['codec_type'] == 'audio'), None)
        duration = float(metadata['format']['duration'])
        draw.text((8, row * 350 + 2), f'{style}  {duration:.2f}s  {video["codec_name"]} {video["width"]}x{video["height"]}', fill='black')
        for column, second in enumerate((1, 5, 9, 13)):
            frame = subprocess.check_output([
                'ffmpeg', '-v', 'error', '-ss', str(second), '-i', str(source),
                '-frames:v', '1', '-vf', 'scale=180:320', '-f', 'image2pipe', '-vcodec', 'png', '-'
            ])
            canvas.paste(Image.open(io.BytesIO(frame)).convert('RGB'), (column * 180, row * 350 + 24))
        wav = OUT / f'{style}.wav'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-ar', '16000', '-ac', '1', str(wav)], check=True)
        with wave.open(str(wav)) as track:
            samples = np.frombuffer(track.readframes(track.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        segments, info = model.transcribe(samples, language='ms', beam_size=5, vad_filter=False)
        transcript = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segments]
        results[style] = {
            'file': str(source.relative_to(ROOT)).replace('\\', '/'),
            'sha256': sha256(source), 'bytes': source.stat().st_size, 'duration': duration,
            'videoCodec': video['codec_name'], 'width': video.get('width'), 'height': video.get('height'),
            'audioCodec': audio['codec_name'] if audio else None,
            'detectedLanguage': info.language, 'languageProbability': round(info.language_probability, 4),
            'lastSpeechEnd': transcript[-1]['end'] if transcript else None, 'transcript': transcript,
            'mediaPass': 14.5 <= duration <= 15.6 and video['codec_name'] == 'h264' and audio is not None,
        }
        print(style, json.dumps(results[style], ensure_ascii=False), flush=True)
    canvas.save(OUT / f'contact-sheet-{page + 1}.jpg', quality=90)

results_name = 'qa-results.json' if len(STYLES) == 20 else 'qa-results-partial.json'
(OUT / results_name).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
summary = {
    'styles': len(results), 'mediaPass': sum(1 for value in results.values() if value['mediaPass']),
    'withAudio': sum(1 for value in results.values() if value['audioCodec']),
    'durationMin': min(value['duration'] for value in results.values()),
    'durationMax': max(value['duration'] for value in results.values()),
    'contactSheets': [f'contact-sheet-{index}.jpg' for index in range(1, page_count + 1)],
}
summary_name = 'qa-summary.json' if len(STYLES) == 20 else 'qa-summary-partial.json'
(OUT / summary_name).write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary), flush=True)
