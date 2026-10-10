"""自检：配乐卡点（music/score.json）↔ 画面事件（events.json）↔ 时间线（timeline.json）逐项对齐。python tools/cuecheck.py"""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = json.load(open(os.path.join(D, 'music/score.json')))['keys']; E = json.load(open(os.path.join(D, 'events.json')))['ev']
K = json.load(open(os.path.join(D, 'timeline.json')))['keys']
def ev(ty, i=0): xs = sorted(e['t'] for e in E if e['type'] == ty); return xs[i] if i < len(xs) else None
def mk(k, i=None): m = M[k]; return m[i] if i is not None else (m[0] if isinstance(m, list) else m)
pairs = [
 ('C1_bass_in', None, ev('gouge_u'), '第一组 U 刀刻山脊'),
 ('C1_frame', 2, ev('brayer'), '滚墨'),
 ('C2_motif_start', None, ev('paper_land'), '第一张印品落定'),
 ('C3_heartbeat', 0, K['cut_hands'], '切到手的特写'),
 ('C4_pizz', 0, ev('gift_pot'), '铜锅落进坩埚'),
 ('C4_pizz', 1, ev('gift_candle'), '烛台'),
 ('C4_pizz', 2, ev('gift_keys'), '钥匙'),
 ('C4_pizz', 3, ev('gift_spoon'), '勺子'),
 ('C4_woodblock_run', 1, ev('gift_bracelet'), '手镯'),
 ('C4_woodblock_run', 2, ev('cloth_grip'), '男孩攥住指南针'),
 ('C5_anvil_first', None, ev('bellows', 0), '作坊 · 风箱第一下'),
 ('C5_glow_swell', None, ev('molten_bubble', 0), '铜熔成橙色'),
 ('C5_forge_tang', 2, ev('pour', 0), '第一次倒铜'),
 ('C5_smash', None, ev('mould_smash'), '抡锤砸泥模'),
 ('C5_reveal_dominant', None, ev('dust'), '钟露出'),
 ('C5_cut', None, ev('clunk'), '死响 · 音乐断'),
 ('C8_cello_in', None, ev('compass_click'), '指南针盖"咔"'),
 ('C9_anvil16_start', None, ev('fire_roar', 1), '第二次风箱'),
 ('C9_roll_start', None, ev('tongs_clank', 1), '提坩埚'),
 ('C9_pour2_hit', None, ev('pour', 1), '第二次倒铜（最高点）'),
 ('C9_drop_drone', None, ev('steam'), '钟亮相 · 蒸汽'),
 ('C9_fade', 0, ev('peel', 1), '揭纸进钟楼'),
 ('H_strings_in', None, K['strings'], '弦乐进（钟的余韵）'),
 ('H_final_chord', None, ev('knife_bite', 1), '片尾最后一刀'),
 ('end', None, json.load(open(os.path.join(D, 'events.json')))['dur'], '片尾'),
]
mx = 0; print(f"{'配乐卡点':20s} {'配乐 s':>8s} {'画面 s':>8s} {'偏差 ms':>8s}  画面事件")
for k, i, t, name in pairs:
    m = mk(k, i); d = (t - m) * 1000; mx = max(mx, abs(d))
    print(f"{k + ('' if i is None else f'[{i}]'):20s} {m:8.3f} {t:8.3f} {d:+8.1f}  {name}")
# 静音段：配乐里不该有任何卡点
for a, b, nm in [(K['clunk'] + .05, K['click'] - .01, '静音 1'), (K['silence2'], K['bell'] - .01, '静音 2')]:
    bad = [(k, v) for k, v in M.items() for x in (v if isinstance(v, list) else [v]) if isinstance(x, (int, float)) and a < x < b and k != 'sr']
    print(f"{nm} {a:.2f}–{b:.2f}: 配乐卡点 {len(bad)} 个 {bad}")
print('最大偏差 %.1f ms，共 %d 项' % (mx, len(pairs)))
