"""自检：配乐卡点（music/score.json）↔ 画面事件（events.json）逐项对齐。python tools/cuecheck.py"""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = json.load(open(os.path.join(D, 'music/score.json')))['keys']; E = json.load(open(os.path.join(D, 'events.json')))['ev']
def ev(ty, i=0): xs = [e['t'] for e in E if e['type'] == ty]; return xs[i] if i < len(xs) else None
seg = {s['id']: s for s in json.load(open(os.path.join(D, 'timeline.json')))['segs']}
pairs = [('G1_cmd', seg['G1']['t0'], '命令词 PUMP!')] + [(f'G1_pump{i+1}', ev('pump', i), f'打气第{i+1}下') for i in range(4)] + [
 ('G1_float', ev('float_up'), '火箭浮起'), ('S1_click_gap', ev('crown', 0), 'Tick 拍表冠'), ('G2_cmd', seg['G2']['t0'], "命令词 DON'T SNEEZE!"), ('G2_dust', ev('dust', 0), '灰尘飘入'),
 ('G2_achoo', ev('sneeze'), 'ACHOO 墨喷满面罩'), ('S2_click_gap', ev('crown', 1), '拍表冠'), ('G3_cmd', seg['G3']['t0'], '命令词 STRAP IN!')] + [(f'G3_belt{i+1}', ev('ratchet', i), f'安全带第{i+1}段') for i in range(3)] + [
 ('G3_buckle', ev('buckle'), '扣上 [##]'), ('S3_click_gap', ev('crown', 2), '拍表冠'), ('G4_cmd', seg['G4']['t0'], '命令词 CATCH!'), ('G4_catch', ev('grab'), '抓住三明治'), ('G4_chomp_gap', ev('chomp'), 'CHOMP'),
 ('S4_button', ev('button'), '按钮特写砸下')] + [(f'SPEED_reel{k}', ev('reel_stop', k - 1), f'老虎机第{k}条停') for k in (1, 2, 3)] + [
 ('G5_cmd', seg['G5']['t0'], '命令词 DODGE!')] + [(f'G5_over{i+1}', ev('jump', i) + .2, f'第{i+1}颗陨石越过') for i in range(3)] + [
 ('S5_click_gap', ev('crown', 3), '拍表冠'), ('G6_cmd', seg['G6']['t0'], '命令词 ZIP!')] + [(f'G6_zip{i+1}', ev('zip', i), f'拉链第{i+1}格') for i in range(6)] + [
 ('G6_stamp', ev('red_stamp'), '红章 OK'), ('S6_click_gap', ev('crown', 4), '拍表冠'), ('G7_cmd', seg['G7']['t0'], '命令词 SALUTE!'), ('G7_swing', ev('swing'), '手臂开始转'), ('G7_bonk', ev('bonk'), '敲飞红球'),
 ('G7_bounce1', ev('bounce', 0), '红球第1次落地'), ('G7_bounce2', ev('bounce', 1), '红球第2次落地'), ('G7_resume', ev('replay_out'), '回放结束'), ('S7_lightsoff', ev('lights_off'), '灯灭'),
 ('BOSS_land', seg['BOSS']['t0'], '命令词 LAND IT!'), ('BOSS_pull', ev('lever'), 'PULL! 拉杆'), ('BOSS_chute', ev('chute_pop'), '像素小伞弹出'), ('BOSS_err', ev('err'), 'ERR'), ('BOSS_dust', ev('dust', 1), '水墨灰尘飘进舷窗'),
 ('BOSS_achoo', ev('sneeze_big'), 'ACHOO → 墨滴喷出'), ('BOSS_splash', ev('splash'), '落进红圆'), ('BOSS_clear', ev('clear'), 'CLEAR!'), ('RESULT_salute', ev('salute'), '结尾敬礼'), ('RESULT_ding', ev('tick_hand'), '秒针归零'),
 ('END_chord', seg['END']['t0'], '片尾卡'), ('END_button', ev('rocket_pop'), '冲天炮')]
mx = 0; print(f"{'配乐卡点':16s} {'配乐 s':>8s} {'画面 s':>8s} {'偏差 ms':>8s}  画面事件")
for k, t, name in pairs:
    m = K[k]; m = m[0] if isinstance(m, list) else m; d = (t - m) * 1000; mx = max(mx, abs(d))
    print(f"{k:16s} {m:8.3f} {t:8.3f} {d:+8.1f}  {name}")
print('最大偏差 %.1f ms，共 %d 项' % (mx, len(pairs)))
