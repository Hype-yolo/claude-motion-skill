"""Cue check: every named picture hit (timeline.json HIT) against the sync keys the score actually wrote (music/score.json)."""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = json.load(open(os.path.join(D, 'timeline.json')))['HIT']; K = json.load(open(os.path.join(D, 'music/score.json')))['keys']
worst = 0
for k, t in sorted(H.items(), key=lambda kv: kv[1]):
    if k in K: d = (K[k] - t) * 1000; worst = max(worst, abs(d)); print(f'{k:10s} {t:7.3f}  score {K[k]:7.3f}  {d:+6.1f} ms')
    else: print(f'{k:10s} {t:7.3f}  (picture only)')
print(f'{sum(k in K for k in H)} of {len(H)} hits carry a musical cue · max offset {worst:.1f} ms')
