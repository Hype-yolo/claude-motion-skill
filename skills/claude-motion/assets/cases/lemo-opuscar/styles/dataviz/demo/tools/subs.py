# 字幕时间（与 film.js setCaptions 同一公式）→ out/subs.json；断言 停留 ≥ max(1.8, 语音 + 0.6) 且不重叠
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
L = json.load(open(os.path.join(D, 'lines.json'))); dur = json.load(open(os.path.join(D, 'voices/dur.json')))
out = []
for l in L:
    d = dur[l['id']]; t0 = l['t'] - .05
    t1 = l['t'] + l['hold'] if 'hold' in l else max(l['t'] + 1.8, l['t'] + d + .6) + .5
    assert t1 - l['t'] >= max(1.8, d + .6) - 1e-6, (l['id'], t1 - l['t'], d)
    out.append({'t0': round(t0, 3), 't1': round(t1, 3), 'text': l['text']})
for a, b in zip(out, out[1:]): assert a['t1'] <= b['t0'], (a, b)
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump(out, open(os.path.join(D, 'out/subs.json'), 'w'), indent=1)
for s in out: print(s)
