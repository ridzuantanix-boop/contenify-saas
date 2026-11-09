import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'provider-qa' / 'v8-1-audio-qa'
OUT.mkdir(parents=True, exist_ok=True)

CASES = {
    'supplement_beg_kuning': ROOT / 'output/provider-qa/v8-1-beg-kuning-retest/SUPPLEMENT_NX07_V81_BEG_KUNING.mp4',
    'beauty_klik_button': ROOT / 'output/provider-qa/v8-1-cta-final/BEAUTY_NX16_V81_KLIK.mp4',
    'kitchen_no_cta': ROOT / 'output/provider-qa/v8-1-cta-final/KITCHEN_NX17_V81_NONE.mp4',
}

model = WhisperModel('small', device='cpu', compute_type='int8')
results = {}

for row, (name, source) in enumerate(CASES.items()):
    if not source.exists():
        raise FileNotFoundError(source)
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name',
        '-of', 'json', str(source),
    ], text=True))
    wav = OUT / f'{name}.wav'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-ar', '16000', '-ac', '1', str(wav)], check=True)
    with wave.open(str(wav)) as track:
        audio = np.frombuffer(track.readframes(track.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    segments, _ = model.transcribe(audio, language='ms', beam_size=5, vad_filter=False)
    transcript = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segments]
    results[name] = {
        'source': str(source),
        'duration': round(float(probe['format']['duration']), 2),
        'streams': probe['streams'],
        'speechEndSeconds': transcript[-1]['end'] if transcript else None,
        'transcript': transcript,
    }

    for second in (1, 7, 13.5):
        frame_path = OUT / f'{name}-{str(second).replace(".", "_")}s.jpg'
        subprocess.run([
            'ffmpeg', '-y', '-v', 'error', '-ss', str(second), '-i', str(source), '-frames:v', '1',
            '-vf', 'scale=360:640', str(frame_path),
        ], check=True)

(OUT / 'qa-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(results, ensure_ascii=False, indent=2))
