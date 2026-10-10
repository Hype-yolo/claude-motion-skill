"""字幕 cues（与 main.js 的 SUBS 同一规则）→ subs.json → core/render/srt.py 导出 .srt"""
import json, os, re
H = os.path.dirname(os.path.abspath(__file__))
L = {l['id']: l for l in json.load(open(f'{H}/lines.json'))}; D = json.load(open(f'{H}/voices/dur.json'))
VO = dict(re.findall(r'(L\d): ([\d.]+)', re.search(r'export const VO = \{([^}]*)\}', open(f'{H}/story.js').read()).group(1)))
cues = [{'t0': float(t), 't1': float(t) + max(1.8, D[i] + .75), 'text': L[i].get('sub', L[i]['text'])} for i, t in VO.items()]
for a, b in zip(cues, cues[1:]): a['t1'] = min(a['t1'], b['t0'] - .1)
json.dump(cues, open(f'{H}/out/subs.json', 'w'), indent=1); print(cues)
