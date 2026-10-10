"""自检：配乐（music/score.json）↔ 画面事件（events.json）逐项对齐。
① 关键卡点逐项对比；② "每个元素一个音"：每个生成元素的出现时间都要落在某个配乐音符上。
python styles/dark-keynote/demo/tools/cuecheck.py"""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = json.load(open(os.path.join(D, 'music/score.json'))); KEYS = S['keys']; NOTES = sorted(n[0] for n in S['notes'])
E = json.load(open(os.path.join(D, 'events.json')))['ev']
def ev(ty, i=0): xs = [e['t'] for e in E if e['type'] == ty]; return xs[i] if i < len(xs) else None
pairs = [('stop', ev('freeze'), '全屏冻结 / 静音 1 开始'), ('chord', ev('press'), '光标按下 = 全体和弦')] + \
  [(f'check{i+1}', ev('check', i), f'侧栏第 {i+1} 个勾') for i in range(3)] + \
  [(f'lock{i+1}', ev('lock', i), f'数字第 {i+1} 位锁定') for i in range(5)] + \
  [('num_chord', ev('files'), '"files." 落下'), ('line2_ping', ev('line2'), '"Sorted in 0.8 seconds."'), ('last_note', ev('to_caret'), '窗口压成光标'), ('final_chord', ev('end_card'), '片尾信息')]
mx = 0; print(f"{'配乐卡点':14s} {'配乐 s':>8s} {'画面 s':>8s} {'偏差 ms':>8s}  画面事件")
for k, t, name in pairs:
    m = KEYS[k]; m = m[0] if isinstance(m, list) else m; d = (t - m) * 1000; mx = max(mx, abs(d))
    print(f"{k:14s} {m:8.3f} {t:8.3f} {d:+8.1f}  {name}")
import bisect
sp = [e for e in E if e['type'] in ('spawn_file', 'spawn_photo', 'spawn_notif') and not e.get('fg')]
worst, miss = 0, 0
for e in sp:
    i = bisect.bisect_left(NOTES, e['t']); d = min(abs(e['t'] - NOTES[j]) for j in (i - 1, i) if 0 <= j < len(NOTES))
    worst = max(worst, d); miss += d > .006
print(f'关键卡点最大偏差 {mx:.1f} ms，共 {len(pairs)} 项')
print(f'元素 ↔ 音符：{len(sp)} 个元素，最大偏差 {worst * 1000:.1f} ms，超过 6 ms 的 {miss} 个')
