"""字幕 cues（.srt 用，含命令词；规则同 film.js：停留 ≥ max(1.8s, 语音 + 0.6s)，命令词 ≥ 0.9s，不与下一句重叠）→ out/srt.json"""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = [l for l in json.load(open(os.path.join(D, 'lines.json'))) if not l.get('fx')]
dur = json.load(open(os.path.join(D, 'voices/dur.json')))
out = []
for i, l in enumerate(L):
    t1 = l['t'] + max(.9 if l.get('cmd') else 1.8, dur[l['id']] + .6)
    if i + 1 < len(L): t1 = min(t1, L[i + 1]['t'] - .05)
    out.append({'t0': l['t'], 't1': round(t1, 3), 'text': (l.get('trim', l['text']).rstrip('.!') + '!').upper() if l.get('cmd') else l['text']})
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump(out, open(os.path.join(D, 'out/srt.json'), 'w'), indent=1); print(len(out), 'cues')
