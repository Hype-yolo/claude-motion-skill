# 配乐卡点 ↔ 画面事件对齐表：music/score.json keys vs events.json（画面事件），并报告 24fps 取整误差
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
S = json.load(open(os.path.join(D, 'music/score.json')))['keys']; EV = json.load(open(os.path.join(D, 'events.json')))['ev']
pic = {}
for e in EV:
    if e['type'] == 'dot': pic[f"dot_{e['year']}"] = (e['t'], f"{e['year']} 点落下")
b = [e for e in EV if e['type'] == 'break']; pic['break1'] = (b[0]['t'], '1998 破顶'); pic['break2'] = (b[1]['t'], '2024 破顶')
for ty, nm, lab in [('stop', 'stop', '硬切 / 静音开始'), ('tap2026', 'tap2026', '2026 落点'), ('end', 'final_note', '片尾卡 / 1926 的音')]:
    pic[nm] = ([e for e in EV if e['type'] == ty][0]['t'], lab)
pic['morph_start'] = (min(e['t'] for e in EV if e['type'] == 'morph'), '变形开始')
worst, worstf, n = 0, 0, 0
rows = []
for k, (tp, lab) in pic.items():
    if k not in S: continue
    d = (S[k] - tp) * 1000; fr = (round(tp * 24) / 24 - tp) * 1000
    worst = max(worst, abs(d)); worstf = max(worstf, abs(fr)); n += 1
    rows.append((tp, k, S[k], d, fr, lab))
rows.sort()
for tp, k, s, d, fr, lab in rows:
    if not k.startswith('dot_') or k in ('dot_1926', 'dot_1933', 'dot_1958', 'dot_1998', 'dot_2024', 'dot_2025', 'dot_2026'):
        print(f'{k:12s} 配乐 {s:8.3f}  画面 {tp:8.3f}  偏差 {d:+6.2f} ms  帧取整 {fr:+6.1f} ms  {lab}')
print(f'共 {n} 项（含 101 个数据点），配乐↔画面最大偏差 {worst:.2f} ms；24fps 帧取整最大 {worstf:.1f} ms')
