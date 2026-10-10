# 成片逐句 whisper：从成片音轨按字幕区间截取每句再转写，对照 lines.json 的 asr/text
import sys, json, os, re, subprocess, numpy as np
from faster_whisper import WhisperModel
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); MP4 = sys.argv[1]
wav = os.path.join(D, 'out', 'final16k.wav')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', MP4, '-ac', '1', '-ar', '16000', wav], check=True)
import soundfile as sf
y, sr = sf.read(wav); m = WhisperModel('base.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ')).split()
dur = json.load(open(os.path.join(D, 'voices/dur.json'))); bad = 0
for L in json.load(open(os.path.join(D, 'lines.json'))):
    a, b = int((L['t'] - .15) * sr), int((L['t'] + dur[L['id']] + .25) * sr)
    segs, _ = m.transcribe(y[a:b].astype(np.float32), beam_size=5, language='en')
    got = ' '.join(s.text.strip() for s in segs); ok = norm(got) == norm(L.get('asr', L['text'])); bad += not ok
    print('OK  ' if ok else 'DIFF', L['id'], '|', got)
print('final mismatches:', bad)
