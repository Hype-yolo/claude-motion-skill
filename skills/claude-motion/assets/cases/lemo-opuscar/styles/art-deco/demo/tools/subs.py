"""Subtitle cues (same rule as film.js drawSubs: hold = max(1.8 s, speech + 0.6 s)) → out/srt.json for core/render/srt.py"""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tl = json.load(open(os.path.join(D, 'timeline.json'))); lines = {l['id']: l for l in json.load(open(os.path.join(D, 'lines.json')))}
dur = json.load(open(os.path.join(D, 'voices/dur.json')))
cues = []
for L in tl['LINES']:
    l = lines[L['id']]; t0 = L['t']; t1 = t0 + max(1.8, dur[L['id']] + .6)
    cues.append({'t0': round(t0, 3), 't1': round(t1, 3), 'text': l.get('sub', l['text'])})
for a, b in zip(cues, cues[1:]): assert a['t1'] <= b['t0'], (a, b)
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump(cues, open(os.path.join(D, 'out/srt.json'), 'w'), indent=1); print(len(cues), 'cues')
