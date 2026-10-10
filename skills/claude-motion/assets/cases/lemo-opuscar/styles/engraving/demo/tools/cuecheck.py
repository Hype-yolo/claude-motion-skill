# cue check: every scored accent (music/cues.json) against the picture event it is written for (events.json). Tolerance: 1 frame @24.
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
W = os.environ.get('ENG_WORK') or D
E = json.load(open(os.path.join(W, 'events.json'))); ev = E['ev']; M = json.load(open(os.path.join(W, 'music', 'cues.json')))
def f(typ, i=None, key='t'):
    for e in ev:
        if e['type'] == typ and (i is None or e.get('i') == i): return e[key]
# pairs are built from the picture events, so the check works for any number of details
pairs = [(f('peel'), 'peel', f('peel')), (f('title'), 'title engraved', f('title'))]
for e in [x for x in ev if x['type'] == 'push']:
    i, role = e['i'], e.get('role', 'A' if e['i'] == 0 else 'C')
    pairs += [(e['t'], f'detail {i + 1} ({role}) starts', e['t']), (f('ring', i), f'ring {i + 1}', f('ring', i))]
    if role in 'AB': pairs.append((f('travel', i), f'roundel {i + 1} lifts', f('travel', i)))
    pairs.append((f('land', i), f'roundel {i + 1} lands', f('land', i)))
pairs += [(f('natsize'), 'natural-size figure', f('natsize')), (f('silence'), 'silence begins', f('silence')),
          (f('silence', key='until'), 'silence ends', f('silence', key='until')), (f('landing'), 'plate lands (cadence)', f('landing'))]
# every picture beat must have a scored accent within one frame
pairs = [(min(M, key=lambda c: abs(c['t'] - p))['t'] if not w.startswith('silence') else p, w, p) for m, w, p in pairs]
mt = {round(c['t'], 4) for c in M}; bad = 0
for m, what, p in pairs:
    ok = abs(m - p) <= 1 / 24 + 1e-6 and (what.startswith('silence') or any(abs(m - x) < 1e-3 for x in mt)); bad += not ok
    print(f"{'OK ' if ok else 'BAD'} {what:24s} music {m:7.3f}  picture {p:7.3f}  Δ {1000 * (p - m):+6.1f} ms")
print('mismatches:', bad)
# the silence must really be silent in the final mix
import soundfile as sf, numpy as np
y, sr = sf.read(os.path.join(W, 'mix.wav')); a, b = f('silence'), f('silence', key='until')
seg = y[int((a + 0.05) * sr):int((b - 0.05) * sr)]
print(f"silence {a:.2f}-{b:.2f}: peak {20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS")
