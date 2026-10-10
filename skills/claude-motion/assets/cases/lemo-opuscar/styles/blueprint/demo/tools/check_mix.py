"""成片旁白可懂度自检：从 mix.wav 按字幕区间切段，whisper 转写对比原文
.venv/bin/python styles/blueprint/demo/tools/check_mix.py"""
import os, json, re, numpy as np, soundfile as sf, librosa
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
m = WhisperModel('base.en', device='cpu', compute_type='int8')
y, sr = sf.read(os.path.join(HERE, 'mix.wav')); y = y.mean(1)
y = librosa.resample(y, orig_sr=sr, target_sr=16000)
subs = json.load(open(os.path.join(HERE, 'subs.json')))
L = {l['id']: l for l in json.load(open(os.path.join(HERE, 'lines.json')))}
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ')).split()
bad = 0
for s in subs:
    seg = y[int(max(0, s['t0'] - .2) * 16000): int((s['t1'] + .2) * 16000)].astype(np.float32)
    got = ' '.join(x.text.strip() for x in m.transcribe(seg, beam_size=5, language='en')[0])
    want = L[s['id']].get('asr', L[s['id']]['text']); ok = norm(got) == norm(want); bad += not ok
    print('OK  ' if ok else 'DIFF', s['id'], '|', got)
print('mismatches:', bad)
