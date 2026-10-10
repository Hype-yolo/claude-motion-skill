"""Cue check: picture events (events.json) vs the 132 BPM grid and the score's hits (music/hits.json).
python styles/midcentury-toon/demo/tools/cuecheck.py   (after events.mjs + music/score.py)"""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
E = json.load(open(os.path.join(D, 'events.json')))['ev']; H = json.load(open(os.path.join(D, 'music', 'hits.json')))
beat = 60 / 132; hits = [h['t'] for h in H['hits']]
KEY = {'box_thump', 'box_fall', 'ding', 'stamp', 'plastic_thock', 'plug_click', 'tap', 'beep', 'btn_soft', 'click_big', 'zone', 'dock', 'wood_block', 'iris'}
bad = 0
for e in E:
    if e['type'] not in KEY: continue
    g = round(e['t'] / (beat / 2)) * beat / 2; eg = (e['t'] - g) * 1000
    nh = min(hits, key=lambda h: abs(h - e['t'])); eh = (e['t'] - nh) * 1000
    ok = abs(eg) <= 42 or abs(eh) <= 42         # within one frame of the half-beat grid or a score hit
    bad += not ok
    print(f"{'OK ' if ok else 'OFF'} {e['t']:7.3f} {e['type']:14s} grid {eg:+6.1f} ms   nearest hit {nh:7.3f} ({eh:+6.1f} ms)")
sil = H.get('silences', [])
print('silences in score:', sil)
print('off-grid:', bad)
