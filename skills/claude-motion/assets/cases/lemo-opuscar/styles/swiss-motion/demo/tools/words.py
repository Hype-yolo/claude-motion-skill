"""whisper 逐词时间 → 字幕逐词出现时刻（相对句首）。python tools/words.py
字幕词数与 whisper 词数不同时（type face / typeface）按字母对齐合并。首词时间夹到 0（asr_check 补静音导致 −0.6）。"""
import json, os, re
D = os.path.dirname(os.path.abspath(__file__)) + '/..'
lines = json.load(open(f'{D}/lines.json')); words = json.load(open(f'{D}/voices/words.json'))
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
num = {'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5'}
out = {}
for L in lines:
    sub = L['text'].split(); ws = words[L['id']]; res = []; j = 0
    for w in sub:
        target = norm(w); target2 = num.get(target, target); acc = ''; t0 = None
        while j < len(ws) and acc not in (target, target2):
            if t0 is None: t0 = max(0.0, ws[j][1])
            acc += norm(ws[j][0]); j += 1
        assert acc in (target, target2), (L['id'], w, acc)
        res.append(round(t0, 3))
    out[L['id']] = res
json.dump(out, open(f'{D}/voices/words_rel.json', 'w'), indent=0)
print(out)
