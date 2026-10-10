"""字幕区间（与 film.js 的 LAYOUT 同源规则）→ out/subs.json，供 core/render/srt.py 导出 .srt"""
import json, os
D = os.path.dirname(os.path.abspath(__file__)) + '/..'
END = {'l1': 7.8, 'l2': 11.8, 'l3': 15.8, 'l4': 19.85, 'l4b': 22.15, 'l5': 24.5, 'l5b': 27.4, 'l6': 39.95}
lines = json.load(open(f'{D}/lines.json')); dur = json.load(open(f'{D}/voices/dur.json'))
cues = []
for L in lines:
    t1 = END[L['id']]
    assert t1 - L['t'] >= max(1.8, dur[L['id']] + .6) - 1e-6, (L['id'], t1 - L['t'], dur[L['id']])
    cues.append({'t0': L['t'], 't1': t1, 'text': L['text']})
os.makedirs(f'{D}/out', exist_ok=True); json.dump(cues, open(f'{D}/out/subs.json', 'w'), indent=1); print(len(cues), 'cues ok')
