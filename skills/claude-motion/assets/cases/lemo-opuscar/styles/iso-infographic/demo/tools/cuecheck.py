"""Score cue points (music/score.json) ↔ picture events (events.json). Run from the repo root."""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = json.load(open(os.path.join(D, 'music/score.json')))['keys']; E = json.load(open(os.path.join(D, 'events.json')))['ev']
ev = lambda ty: [e['t'] for e in E if e['type'] == ty]
pairs = [('land', ev('palm'), '红果落进手心'), ('title', ev('title_word'), '片名四个词立起'), ('cut', ev('cherry_cut'), '红果剖开'),
         ('rakes', ev('rake'), '耙子四下'), ('suns', ev('sun'), '21 个太阳'), ('load', ev('box_hold') + [e['t'] for e in E if e['type'] == 'box_land' and not e.get('wave')], '集装箱落下 ×6'),
         ('depart', [e['t'] for e in E if e['type'] == 'ship_engine'], '离港'), ('ff', ev('whoosh_ff'), '快进开始'), ('dive', ev('knife')[1:2] + ev('slide_steel')[:1] + ev('slide_steel')[1:2] + ev('tear'), '剖面三层'),
         ('silence', ev('silence')[:1], '静音 1'), ('horn', ev('horn'), '船笛'), ('pour', ev('beans_metal'), '生豆倒进滚筒'), ('cracks', ev('crack'), '一爆 ×8'),
         ('grind', ev('grinder'), '磨豆'), ('tamp', ev('tamp'), '压粉'), ('stop', ev('silence')[1:2], '静音 2'), ('drop', ev('drip'), '第一滴'), ('clink', ev('clink'), '杯碟叮'),
         ('hand', ev('tag')[1:2], '11,000 km 标签'), ('stations', ev('station'), '全图七站'), ('card', ev('card'), '片尾卡')]
mx, n = 0, 0
print(f"{'配乐卡点':10s} {'配乐 s':>8s} {'画面 s':>8s} {'偏差 ms':>8s}  画面事件")
for k, ts, name in pairs:
    ms = K[k] if isinstance(K[k], list) else [K[k]]
    if k == 'dive': ms = ms[:4]
    for i, (m, t) in enumerate(zip(ms, ts)):
        d = (t - m) * 1000; mx = max(mx, abs(d)); n += 1
        print(f"{k + ('' if len(ms) == 1 else str(i + 1)):10s} {m:8.3f} {t:8.3f} {d:+8.1f}  {name}")
    if len(ms) != len(ts): print(f"  ! {k}: score {len(ms)} vs picture {len(ts)}")
print('最大偏差 %.1f ms，共 %d 项' % (mx, n))
