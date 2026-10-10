"""成片 whisper 自检：逐句在其时间窗内单独转写（成片里有配乐和拟音），和原文比对。python tools/final_asr.py woodcut.mp4"""
import sys, os, json, re, subprocess, numpy as np
from faster_whisper import WhisperModel
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mp4 = sys.argv[1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
y = np.frombuffer(raw, np.float32)
m = WhisperModel('small.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ').replace('five', '5')).split()
K = json.load(open(os.path.join(D, 'timeline.json')))['keys']; L = [dict(l, t=K[l['id']]) for l in json.load(open(os.path.join(D, 'lines.json')))]; dur = json.load(open(os.path.join(D, 'voices/dur.json')))
bad = 0
for l in L:
    if l.get('fx'): continue
    a, b = max(0, int((l['t'] - .15) * 16000)), int((l['t'] + dur[l['id']] + .25) * 16000)
    seg = np.concatenate([np.zeros(8000, np.float32), y[a:b], np.zeros(8000, np.float32)])
    got = ' '.join(s.text.strip() for s in m.transcribe(seg, language='en', beam_size=5)[0])
    want = l.get('trim', l['text'])
    ok = norm(want) == norm(got)[:len(norm(want))] and len(norm(got)) <= len(norm(want)) + 1
    bad += not ok; print('OK  ' if ok else 'DIFF', f"{l['t']:6.2f}", want, '→', got)
print('mismatches:', bad)
