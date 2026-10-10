"""Cue check: every sync point of the score (music/score.json keys) against the picture timeline (timeline.json, which the picture code reads).
python tools/cuecheck.py"""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = json.load(open(os.path.join(D, 'music/score.json')))['keys']; tl = json.load(open(os.path.join(D, 'timeline.json'))); T = tl['T']
KB = 60 / tl['K_BPM']
pic = {'titleHit': (T['titleHit'], 'title bar blooms'), 'archOpen': (T['archOpen'], 'arch splits open'), 'sealGlint': (T['sealGlint'], 'wax seal glint'),
       'plaque': (T['plaque'], 'OUT OF ORDER plaque drops'), 'snare': (T['snare'], 'stair doors burst'), 'trays': (T['trays'], 'slide under the trays'),
       'capHit': (T['capHit'], 'cap knocked off'), 'capLand': (T['capLand'], 'cap lands'), 'doors': (T['doors'], 'kitchen doors burst'),
       'stop': (T['clock'], 'tower clock hits XII'), 'tutti': (T['tutti'], 'ballroom downbeat'), 'clockForm': (T['clockForm'], 'dancers lock into a clock'),
       'final': (T['final'], 'final chord / cut to the dial')}
for k in range(16): pic[f'stair_{k}'] = (tl['STAIR_BEATS'][k], f'stair beat {k} (step / floor)')
for k in range(4): pic[f'whistle_{k}'] = (T['whistle'] + k * KB / 2, f'whistle note {k + 1} (♪ glyph)')
for k in range(12): pic[f'strike_{k + 1}'] = (tl['STRIKES'][k], f'bell {k + 1} → letter {k + 1} lights')
for k in range(8): pic[f'fan_{k}'] = (T['tutti'] + k * tl['B'] / 2, f'dancer {k + 1} opens her fan')
mx = 0; print(f"{'cue':12s} {'score s':>9s} {'picture s':>9s} {'Δ ms':>7s}  event")
for k, (t, name) in pic.items():
    m = K[k]; m = m[0] if isinstance(m, list) else m; d = (t - m) * 1000; mx = max(mx, abs(d))
    print(f"{k:12s} {m:9.3f} {t:9.3f} {d:+7.1f}  {name}")
print(f'max offset {mx:.1f} ms over {len(pic)} cues')
