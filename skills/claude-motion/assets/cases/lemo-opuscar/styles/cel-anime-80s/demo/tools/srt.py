"""导出字幕：python srt.py → ../cel-anime-80s.srt（与 hud.js 的显示区间一致：t-0.05 → t+max(dur+0.6, 1.9)）"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..')
src = open(os.path.join(D, 'story.js')).read()
BAR = 240 / 116; BEAT = BAR / 4
dur = json.load(open(os.path.join(D, 'voices', 'dur.json')))
lines = []
for m in re.finditer(r"\{ id: '(\w+)', t: ([^,]+), who: '(\w)', text: (['\"])(.*?)\4 \}", src):
    i, texpr, who, _, text = m.groups()
    t = eval(texpr.replace('bar(', '(BAR*').replace('BEAT', 'BEAT'))
    a, b = t - .05, t + max(dur[i] + .6, 1.9)
    lines.append((a, b, ('BASE: ' if who == 'D' else '') + text))
for k in range(len(lines) - 1):
    a, b, x = lines[k]; lines[k] = (a, min(b, lines[k + 1][0]), x)
fmt = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s % 1 * 1000)):03d}"
out = '\n'.join(f"{k + 1}\n{fmt(a)} --> {fmt(b)}\n{txt}\n" for k, (a, b, txt) in enumerate(lines))
open(os.path.join(D, '..', 'cel-anime-80s.srt'), 'w').write(out); print(out)
