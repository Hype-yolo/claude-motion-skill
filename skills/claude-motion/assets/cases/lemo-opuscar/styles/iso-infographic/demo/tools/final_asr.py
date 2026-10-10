"""成片 whisper 抽查：逐句在各自时间窗内单独转写（成片里有配乐和拟音），与期望文本比对。python tools/final_asr.py iso-infographic.mp4"""
import sys, os, json, re, subprocess, numpy as np
from faster_whisper import WhisperModel
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
y = np.frombuffer(raw, np.float32)
m = WhisperModel('small.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ').replace(',', '')).split()
L = json.load(open(os.path.join(D, 'lines.json'))); dur = json.load(open(os.path.join(D, 'voices/dur.json'))); bad = 0
for l in L:
    a, b = max(0, int((l['t'] - .15) * 16000)), int((l['t'] + dur[l['id']] + .25) * 16000)
    seg = np.concatenate([np.zeros(8000, np.float32), y[a:b], np.zeros(8000, np.float32)])
    got = ' '.join(s.text.strip() for s in m.transcribe(seg, language='en', beam_size=5)[0]); want = l.get('asr', l['text'])
    ok = norm(want) == norm(got); bad += not ok; print('OK  ' if ok else 'DIFF', f"{l['t']:6.2f}", want, '→', got)
print('mismatches:', bad)
