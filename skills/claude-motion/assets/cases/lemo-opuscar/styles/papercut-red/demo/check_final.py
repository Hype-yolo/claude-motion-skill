"""成片复核：从 mp4 音轨按旁白时间段切片 → whisper 转写；blackdetect；ebur128 由 mux.sh 打印"""
import sys, os, json, re, subprocess, numpy as np, soundfile as sf, librosa
from faster_whisper import WhisperModel
D = os.path.dirname(os.path.abspath(__file__)); mp4 = os.path.join(D, '..', 'papercut-red.mp4'); tmp = os.path.join(D, 'out', 'final.wav')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-ac', '1', '-ar', '16000', tmp], check=True)
y, sr = sf.read(tmp); m = WhisperModel('base.en', device='cpu', compute_type='int8')
lines = {L['id']: L for L in json.load(open(os.path.join(D, 'lines.json')))}; dur = json.load(open(os.path.join(D, 'voices', 'dur.json')))
src = open(os.path.join(D, 'story.js')).read(); vo = re.findall(r"\{ id: '(L\d)', t: ([\d.]+)", src)
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ')).split()
bad = 0
for id_, t in vo:
    t = float(t); seg = y[int((t - .3) * sr): int((t + dur[id_] + .4) * sr)].astype(np.float32)
    got = ' '.join(s.text.strip() for s in m.transcribe(seg, beam_size=5, language='en')[0])
    want = lines[id_].get('asr', lines[id_]['text']); ok = norm(got) == norm(want); bad += not ok
    print('OK  ' if ok else 'DIFF', id_, '|', got)
print('final mismatches:', bad)
r = subprocess.run(['ffmpeg', '-i', mp4, '-vf', 'blackdetect=d=0.1:pix_th=0.06', '-an', '-f', 'null', '-'], capture_output=True, text=True)
print('blackdetect:', [l for l in r.stderr.split('\n') if 'black_start' in l] or 'none')
