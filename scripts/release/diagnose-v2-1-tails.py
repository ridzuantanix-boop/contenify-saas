import io
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

root = Path('output/v2-1-real-creative-validation')
ranges = {'A': (11.0, 14.8), 'B': (8.4, 13.2), 'C': (8.3, 12.7), 'D': (10.8, 14.0)}
for slot, (start, end) in ranges.items():
    mp4 = next(root.glob(f'{slot}-*.mp4'))
    wav = mp4.with_suffix('.wav')
    sheet = Image.new('RGB', (1320, 1700), 'white')
    draw = ImageDraw.Draw(sheet)
    times = np.linspace(start, end, 12)
    for i, time in enumerate(times):
        frame = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{time:.3f}', '-i', str(mp4), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True)
        image = Image.open(io.BytesIO(frame.stdout)).convert('RGB')
        face = image.crop((160, 180, 560, 720))
        face.thumbnail((310, 380))
        x = 10 + (i % 4) * 330
        y = 30 + (i // 4) * 420
        sheet.paste(face, (x, y))
        draw.text((x, y - 20), f'{time:.2f}s', fill='black')
    target = root / f'{slot}-tail-frames.jpg'
    sheet.crop((0, 0, 1320, 1270)).save(target, quality=92)
    with wave.open(str(wav), 'rb') as audio_file:
        rate = audio_file.getframerate()
        samples = np.frombuffer(audio_file.readframes(audio_file.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    windows = []
    for time in np.arange(start, end, .25):
        chunk = samples[int(time * rate):int((time + .25) * rate)]
        windows.append({'start': round(float(time), 2), 'rmsDbfs': round(float(20 * np.log10(max(np.sqrt(np.mean(chunk * chunk)), 1e-8))), 1)})
    (root / f'{slot}-tail-rms.json').write_text(json.dumps(windows, indent=2), encoding='utf8')
    print(f'{slot}: {target}')
