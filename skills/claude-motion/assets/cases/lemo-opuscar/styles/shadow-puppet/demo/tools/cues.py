"""字幕区间 → cues.json（与页面 main.js 的 SUBS 规则一致：显示到 语音+0.8 s（≥1.8 s），并截到下一句前 0.3 s）"""
import json, os, re, sys
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(D, 'story.js')).read()
vo = re.findall(r"\{ id: '(L\d)', t: ([\d.]+), text: '([^']+)' \}", src)
dur = json.load(open(os.path.join(D, 'voices', 'dur.json')))
cues = []
for i, (id_, t, text) in enumerate(vo):
    t = float(t); t1 = t + max(1.8, dur[id_] + .8)
    if i + 1 < len(vo): t1 = min(t1, float(vo[i + 1][1]) - .3)
    else: t1 = min(t1, float(re.search(r'clap2: ([\d.]+)', src).group(1)) - .15)
    cues.append(dict(t0=t, t1=round(t1, 3), text=text))
json.dump(cues, open(os.path.join(D, 'out', 'cues.json'), 'w'), indent=1)
print(len(cues), 'cues')
