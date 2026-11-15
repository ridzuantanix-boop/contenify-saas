import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'provider-qa' / 'direct-vs-compiler-ab'
CASES = {
    'A': OUT / 'test-a-final.mp4',
    'B': OUT / 'test-b-final.mp4',
}
FRAME_TIMES = (0.3, 2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5)

model = WhisperModel('small', device='cpu', compute_type='int8')
results = {}

for arm, source in CASES.items():
    if not source.exists():
        raise FileNotFoundError(source)
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration,size:stream=codec_type,codec_name,width,height,sample_rate,channels',
        '-of', 'json', str(source),
    ], text=True))
    wav = OUT / f'test-{arm.lower()}-audio.wav'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-ar', '16000', '-ac', '1', str(wav)], check=True)
    with wave.open(str(wav)) as track:
        sample_rate = track.getframerate()
        audio = np.frombuffer(track.readframes(track.getnframes()), dtype=np.int16).astype(np.float32) / 32768

    segments, info = model.transcribe(audio, language='ms', beam_size=5, vad_filter=True, word_timestamps=True)
    transcript = []
    words = []
    for segment in segments:
        transcript.append({'start': round(segment.start, 3), 'end': round(segment.end, 3), 'text': segment.text.strip()})
        for word in segment.words or []:
            words.append({'start': round(word.start, 3), 'end': round(word.end, 3), 'word': word.word.strip(), 'probability': round(word.probability, 4)})

    window = max(1, int(sample_rate * 0.05))
    rms = []
    for start in range(0, len(audio), window):
        chunk = audio[start:start + window]
        value = float(np.sqrt(np.mean(chunk * chunk))) if len(chunk) else 0.0
        rms.append({'time': round(start / sample_rate, 3), 'rms': round(value, 6)})

    frame_paths = []
    for index, second in enumerate(FRAME_TIMES, start=1):
        frame = OUT / f'test-{arm.lower()}-frame-{index:02d}-{str(second).replace(".", "_")}s.jpg'
        subprocess.run([
            'ffmpeg', '-y', '-v', 'error', '-ss', str(second), '-i', str(source),
            '-frames:v', '1', '-vf', 'scale=360:640', str(frame),
        ], check=True)
        frame_paths.append(str(frame))

    contact_sheet = OUT / f'test-{arm.lower()}-contact-sheet.jpg'
    inputs = []
    for frame in frame_paths:
        inputs.extend(['-i', frame])
    filter_graph = ''.join(f'[{i}:v]' for i in range(len(frame_paths))) + 'xstack=inputs=8:layout=0_0|360_0|720_0|1080_0|0_640|360_640|720_640|1080_640[v]'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', filter_graph, '-map', '[v]', '-q:v', '2', str(contact_sheet)], check=True)

    results[arm] = {
        'source': str(source),
        'duration': round(float(probe['format']['duration']), 3),
        'size': int(probe['format']['size']),
        'streams': probe['streams'],
        'detectedLanguage': info.language,
        'languageProbability': round(info.language_probability, 4),
        'speechStartSeconds': transcript[0]['start'] if transcript else None,
        'speechEndSeconds': transcript[-1]['end'] if transcript else None,
        'transcript': transcript,
        'words': words,
        'rms50ms': rms,
        'contactSheet': str(contact_sheet),
        'frameTimes': FRAME_TIMES,
    }

(OUT / 'audio-visual-qa.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
for arm, result in results.items():
    transcript_text = ' '.join(segment['text'] for segment in result['transcript'])
    (OUT / f'test-{arm.lower()}-transcript.txt').write_text(transcript_text + '\n', encoding='utf8')
print(json.dumps({arm: {k: v for k, v in result.items() if k not in ('rms50ms', 'words')} for arm, result in results.items()}, ensure_ascii=False, indent=2))
