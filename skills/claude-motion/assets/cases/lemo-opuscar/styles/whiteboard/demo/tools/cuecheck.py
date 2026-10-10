"""卡点核对：列出关键动作，报告它离 120 BPM 网格（T0 起每 0.5s）的偏差；VO 驱动的动作标注所卡的词。"""
import json, os
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = json.load(open(os.path.join(H, 'events.json')))['ev']; C = next(e for e in E if e['type'] == 'cues')
T0, B = C['T0'], C['BEAT']
W = json.load(open(os.path.join(H, 'voices/words.json'))); VO = {e['id']: e['t'] for e in E if e['type'] == 'vo'}
def near_word(t):
    best = None
    for k, ws in W.items():
        for w, a, b in ws:
            d = abs(VO[k] + max(0, a) - t)
            if best is None or d < best[0]: best = (d, f'{k}:"{w}"')
    return best
rows = [(C['T0'], 'title downbeat')] + [(e['t'], e['type'] + (' (big)' if e.get('big') else '')) for e in E if e['type'] in ('magnet', 'splash', 'tray', 'trayEraser', 'rewind', 'magnetOff')]
rows += [(C['duet0'], 'duet start'), (C['duetEnd'], 'duet end'), (C['fix0'], 'retune snap'), (C['fixEnd'], 'retune ✓')] + [(t, f'day {i}') for i, t in enumerate(C['dayT'])]
ok = bad = 0
for t, name in sorted(rows):
    off = (t - T0) / B; d = (off - round(off)) * B
    w = near_word(t); on = abs(d) <= .04
    ok += on; bad += not on
    print(f'{t:7.2f}  {name:18s}  grid {"ON " if on else "off"} {d*1000:+5.0f}ms   nearest word {w[1]} ({w[0]*1000:.0f}ms)')
tg = [e['t'] for e in E if e['type'] == 'tickG']; to = [e['t'] for e in E if e['type'] == 'tickO']
print(f'duet: ground ticks on grid {sum(abs(((t - T0) / B) - round((t - T0) / B)) * B <= .005 for t in tg)}/{len(tg)}; orbit drift at last tick {(tg[-1] - to[-1]) * 1000:.0f} ms ahead')
print('on grid', ok, '/ off grid (word-driven)', bad)
