# 从 story.js 的 VO 表 + voices/dur.json 导出 SRT
# 用法：.venv/bin/python styles/hd-2d/demo/tools/srt.py [out.srt]（默认写库交付物 styles/hd-2d/hd-2d.srt）
import sys
import re, json, os
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
s = open(os.path.join(H, 'story.js')).read(); D = json.load(open(os.path.join(H, 'voices/dur.json')))
f = lambda x: '%02d:%02d:%02d,%03d' % (x // 3600, x % 3600 // 60, int(x % 60), round((x % 1) * 1000) % 1000)
out = []
for i, m in enumerate(re.finditer(r"\{ id: '(\w+)', t: ([\d.]+).*?sub: '((?:[^'\\]|\\.)*)'", s)):
    k, t, sub = m.group(1), float(m.group(2)), m.group(3).replace("\\u2019", "’").replace("\\'", "'")
    who = 'OLD KEEPER: ' if k == 'k1' else ''
    out.append(f"{i + 1}\n{f(t)} --> {f(t + D[k] + .5)}\n{who}{sub}\n")
open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(H, '..', 'hd-2d.srt'), 'w').write('\n'.join(out)); print('\n'.join(out))
