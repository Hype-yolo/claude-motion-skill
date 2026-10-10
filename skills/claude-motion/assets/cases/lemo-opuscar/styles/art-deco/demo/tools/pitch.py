"""Pitch-shift lines that carry a "pitch" (semitones) field: resample (voice gets younger + a little faster). python tools/pitch.py lines.json voices_dir"""
import sys, json, os, numpy as np, soundfile as sf, soxr
lines, vd = json.load(open(sys.argv[1])), sys.argv[2]
dur = json.load(open(os.path.join(vd, 'dur.json')))
for L in lines:
    st = L.get('pitch')
    if not st: continue
    f = os.path.join(vd, L['id'] + '.wav'); x, sr = sf.read(f)
    k = 2 ** (st / 12); y = soxr.resample(x, sr * k, sr)          # play faster by k → pitch up by st
    sf.write(f, y.astype(np.float32), sr); dur[L['id']] = round(len(y) / sr, 3); print(L['id'], 'pitched', st, dur[L['id']])
json.dump(dur, open(os.path.join(vd, 'dur.json'), 'w'), indent=1)
