"""字幕区间（与 film.js 的 setLines/subtitle 同一规则）→ out/subs.json，再交给 core/render/srt.py"""
import json, os, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
L = json.load(open(os.path.join(D, 'lines.json'))); dur = json.load(open(os.path.join(D, 'voices', 'dur.json')))
out = []
for i, l in enumerate(L):
    nx = L[i + 1]['t'] if i + 1 < len(L) else 1e9
    t1 = min(nx - .05, max(l['t'] + dur[l['id']] + .7, l['t'] + 1.8), 36)
    out.append({'t0': l['t'], 't1': round(t1, 3), 'text': l['text']})
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump(out, open(os.path.join(D, 'out', 'subs.json'), 'w'), indent=1)
for c in out: print(c)
