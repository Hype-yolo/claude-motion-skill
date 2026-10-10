# whisper 逐词时间 → 原文逐词时间（字幕逐词出现用）。按字符位置比例把 whisper 词起点映射到原文单词上
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
lines = json.load(open(os.path.join(D, 'lines.json'))); W = json.load(open(os.path.join(D, 'voices/words.json')))
out = {}
for L in lines:
    ws = W[L['id']]; src = ' '.join(w[0] for w in ws)
    # whisper word starts at their char fraction
    pts, acc = [], 0
    for w in ws: pts.append((acc / max(1, len(src)), max(0, w[1]))); acc += len(w[0]) + 1
    pts.append((1.0, ws[-1][2]))
    toks = L['text'].split(' '); tot = len(L['text']); acc = 0; res = []
    for tk in toks:
        f = acc / tot; j = 0
        while j < len(pts) - 2 and pts[j + 1][0] <= f: j += 1
        (f0, t0), (f1, t1) = pts[j], pts[j + 1]
        res.append({'w': tk, 't': round(t0 + (t1 - t0) * (f - f0) / max(1e-6, f1 - f0), 3)}); acc += len(tk) + 1
    out[L['id']] = res
json.dump(out, open(os.path.join(D, 'voices/words_rel.json'), 'w'), indent=0)
print({k: [(r['w'], r['t']) for r in v][:4] for k, v in out.items()})
