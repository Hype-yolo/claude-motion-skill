"""成片 whisper 自检：从 mp4 抽音轨转写，逐句比对旁白与时间"""
import sys, json, re, subprocess, numpy as np, os
from faster_whisper import WhisperModel
H = os.path.dirname(os.path.abspath(__file__)); mp4 = sys.argv[1]
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp4, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
a = np.frombuffer(raw, np.float32)
m = WhisperModel('base.en', device='cpu', compute_type='int8')
segs, _ = m.transcribe(a, beam_size=5, language='en', word_timestamps=True)
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower()).split()
got = [(s.start, s.end, s.text.strip()) for s in segs]
for s in got: print(f'{s[0]:6.2f}-{s[1]:6.2f}  {s[2]}')
allw = ' '.join(norm(' '.join(g[2] for g in got)))
ok = 0
for L in json.load(open(f'{H}/lines.json')):
    w = ' '.join(norm(L['text'])); f = w in allw; ok += f; print('OK ' if f else 'MISS', L['id'], L['text'])
print(f'{ok}/5 lines found')
