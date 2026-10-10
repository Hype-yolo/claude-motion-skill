"""把 EMS 单线 SVG 字体转成引擎用的 JSON：{meta, glyphs:{char:{w, s:[[x,y,x,y...],...]}}}（y 向上，单位 1/1000 em）"""
import re, json, sys, html
src, dst = sys.argv[1], sys.argv[2]
t = open(src, encoding='utf8').read()
meta = re.search(r'<metadata>(.*?)</metadata>', t, re.S).group(1).strip()
dflt = float(re.search(r'<font [^>]*horiz-adv-x="([\d.]+)"', t).group(1))
out = {}
for m in re.finditer(r'<glyph ([^>]*)/>', t):
    a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
    if 'unicode' not in a: continue
    ch = html.unescape(a['unicode'])
    strokes, cur = [], None
    for cmd, x, y in re.findall(r'([ML])\s*([-\d.]+)\s+([-\d.]+)', a.get('d', '')):
        if cmd == 'M': cur = []; strokes.append(cur)
        cur += [round(float(x), 1), round(float(y), 1)]
    out[ch] = {'w': float(a.get('horiz-adv-x', dflt)), 's': strokes}
json.dump({'meta': meta, 'glyphs': out}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print(dst, len(out))
