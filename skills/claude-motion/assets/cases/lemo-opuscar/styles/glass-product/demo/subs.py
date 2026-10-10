"""字幕导出：与页面烧录同一规则（显示 = max(1.9 s, 语音 + 0.7 s)），旁白时间取自 story.js
python styles/glass-product/demo/subs.py → demo/cues.json（再用 core/render/srt.py 转 .srt）"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'story.js')).read()
vo = re.findall(r"\{ id: '(v\d)', t: ([\d.]+), text: '([^']+)' \}", src)
dur = json.load(open(os.path.join(HERE, 'voices', 'dur.json')))
cues = [{'t0': float(t), 't1': round(float(t) + max(1.9, dur[i] + .7), 3), 'text': txt} for i, t, txt in vo]
json.dump(cues, open(os.path.join(HERE, 'cues.json'), 'w'), indent=1); print(cues)
