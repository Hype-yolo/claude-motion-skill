"""成片自检：从 mp4 抽出音轨，按字幕区间逐句 whisper 转写并比对。python check_mix.py film.mp4"""
import sys, json, os, re, subprocess, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.abspath(__file__))
wav = os.path.join(HERE, 'out', 'final16k.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', '16000', wav], check=True)
y, sr = sf.read(wav); m = WhisperModel('base.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower()).split()
bad = 0
HOMO = {'here': 'hear'}
D = list(json.load(open(os.path.join(HERE, 'voices', 'dur.json'))).values())
for k, c in enumerate(json.load(open(os.path.join(HERE, 'cues.json')))):
    a, b = int((c['t0'] - .15) * sr), int((c['t0'] + D[k] + .3) * sr)
    seg = np.concatenate([np.zeros(int(.5 * sr)), y[a:b], np.zeros(int(.5 * sr))]).astype(np.float32)
    got = ' '.join(s.text.strip() for s in m.transcribe(seg, beam_size=5, language='en')[0])
    ok = norm(got) == norm(c['text'])
    homo = not ok and [HOMO.get(w, w) for w in norm(got)] == [HOMO.get(w, w) for w in norm(c['text'])]   # 同音误听（hear/here）人工判定通过
    bad += not (ok or homo)
    print('OK  ' if ok else 'OK~ (同音)' if homo else 'DIFF', c['t0'], c['text'], '→', got)
print('mismatches:', bad)
