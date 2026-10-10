# Where the Wind Went —— 配乐：150 BPM 3/4 爵士华尔兹（F 大调），按 cue map 写死每个小节
# 小节 n 起点 = n * 1.2 s；摇摆八分音符（后半拍落在 2/3 处）
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR, add, bp, hp, lp, noise, env_exp, norm, t_

OUT = os.path.join(os.path.dirname(__file__), 'music_stems')
os.makedirs(OUT, exist_ok=True)
BEAT = .4; BAR = 1.2; DUR = 32.4
S.seed(11)
rng = np.random.default_rng(5)
bt = lambda bar, beat=0: bar * BAR + beat * BEAT
sw = lambda b: int(b) + (2 / 3 if abs(b - int(b) - .5) < 1e-6 else b - int(b))   # 摇摆
hum = lambda: rng.normal(0, .006)

stems = {k: [] for k in ['melody', 'bass', 'piano', 'drums', 'strings', 'color']}

# ---------- 和声 ----------
CH = {  # 小节: (低音根音, 钢琴/弦乐声部)
    5: ('F2', ['A3', 'C4', 'D4', 'F4']), 6: ('D2', ['F#3', 'A3', 'C4', 'E4']), 7: ('G2', ['Bb3', 'D4', 'F4', 'A4']), 8: ('C2', ['E3', 'Bb3', 'D4', 'G4']),
    9: ('Bb1', ['A3', 'D4', 'F4', 'C5']), 10: ('A1', ['G3', 'C4', 'E4', 'B4']), 11: ('D2', ['F3', 'A3', 'C4', 'E4']), 12: ('G2', ['Bb3', 'D4', 'F4', 'A4']),
    13: ('F2', ['A3', 'C4', 'E4', 'G4']), 14: ('Bb1', ['A3', 'D4', 'F4', 'C5']), 15: ('C2', ['Bb3', 'E4', 'G4', 'D5']),
    20: ('F2', ['A3', 'D4', 'G4', 'C5']), 21: ('D2', ['F#3', 'C4', 'E4', 'A4']), 22: ('G2', ['Bb3', 'D4', 'F4', 'A4']), 23: ('F2', ['A3', 'C4', 'D4', 'F4']),
}
SPLIT = {12: 'C2', 22: 'C2'}           # 第三拍换到 C7
APPROACH = {5: 'C#2', 6: 'F#2', 7: 'B1', 8: 'A1', 9: 'G#1', 10: 'C#2', 11: 'F#2', 12: 'Db2', 13: 'A1', 14: 'B1', 15: 'Db2', 20: 'C#2', 21: 'F#2', 22: 'E2', 23: 'E2'}
FIFTH = {5: 'C3', 6: 'A2', 7: 'D3', 8: 'G2', 9: 'F2', 10: 'E2', 11: 'A2', 12: 'D3', 13: 'C3', 14: 'F2', 15: 'G2', 20: 'C3', 21: 'A2', 22: 'D3', 23: 'C3'}

def mel(inst, bar, notes, vel=.62, pan=-.15, gain=1.0, stem='melody'):
    for b, p, d, *v in notes:
        s = sw(b); t = bt(bar, s) + hum(); dd = d * BEAT * .95
        name = inst if dd > .3 or inst.endswith('_stac') else (inst + '_stac' if inst in ('clarinet', 'trumpet') else inst)
        stems[stem].append((t, name, p, max(.12, dd), (v[0] if v else vel) * (1 + rng.normal(0, .04)), pan, gain))

# ---------- 1.8 s：草帽上色的那一声 ----------
stems['color'] += [(1.8, 'vibraphone', 'A5', 2.5, .55, .25, 1.0), (1.8, 'glockenspiel', 'C7', 1.2, .25, .3, .6)]
# ---------- 2.4–4.8 呼吸段：钢琴分解和弦 + 单簧管低音 ----------
for i, p in enumerate(['F2', 'C3', 'A3', 'E4', 'G4']): stems['piano'].append((2.4 + i * .07, 'upright', p, 2.2, .38 - i * .03, -.2 + i * .1, 1))
for i, p in enumerate(['Bb1', 'F2', 'D3', 'A3', 'C4']): stems['piano'].append((3.6 + i * .07, 'upright', p, 2.0, .34 - i * .03, -.2 + i * .1, 1))
stems['melody'].append(dict(t=2.45, inst='clarinet', pitch='F3', dur=2.2, vel=.3, pan=-.1, attack=.6))
for k, (t, p) in enumerate([(2.9, 'C6'), (3.3, 'A5'), (3.75, 'G5'), (4.2, 'F5')]): stems['color'].append((t, 'harp', p, 1.2, .3, .4 - k * .2, .8))
# ---------- 4.8–6.0 阵风：震音渐强 + 竖琴上行刮奏 ----------
for p in ['E4', 'Bb4', 'C5', 'G5']: stems['strings'].append(dict(t=4.8, inst='violins_trem', pitch=p, dur=1.2, vel=.45, pan=.2, attack=1.0))
for p in ['C3', 'G3']: stems['strings'].append(dict(t=4.8, inst='cellos', pitch=p, dur=1.2, vel=.4, pan=-.2, attack=.9))
sc = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C6']
for i, p in enumerate(sc): stems['color'].append((5.62 + i * .025, 'harp', p, .6, .4 + i * .02, -.3 + i * .04, 1))

# ---------- 华尔兹 A（5–8）+ 路灯（9）+ 树（10–12）+ 城市（13–15）----------
mel('clarinet', 5, [(0, 'C5', 1.5), (1.5, 'D5', .5), (2, 'C5', 1)])
mel('clarinet', 6, [(0, 'A4', 1), (1, 'F#4', .5), (1.5, 'A4', .5), (2, 'C5', 1)])
mel('clarinet', 7, [(0, 'Bb4', 1.5), (1.5, 'A4', .5), (2, 'G4', .9)])
mel('clarinet', 8, [(0, 'E4', .5), (.5, 'G4', .5), (1, 'Bb4', .5), (1.5, 'C5', .5), (2, 'E5', 1)])
for k in range(10):   # 9：帽子绕灯转一圈 = 单簧管颤音
    stems['melody'].append((bt(9) + k * .08, 'clarinet_stac', 'F5' if k % 2 == 0 else 'G5', .1, .5, -.15, .9))
mel('clarinet', 9, [(2, 'A5', .5), (2.5, 'Bb5', .5)], vel=.6)
mel('clarinet', 10, [(0, 'C6', 1.5), (1.5, 'Bb5', .5), (2, 'A5', 1)])
mel('clarinet', 11, [(0, 'F5', 1), (1, 'D5', .5), (1.5, 'F5', .5), (2, 'A5', 1)])
mel('clarinet', 12, [(0, 'G5', 1.5), (1.5, 'F5', .5), (2, 'E5', 1)])
mel('trumpet_mute', 13, [(0, 'A4', 1), (1, 'C5', 1), (2, 'F5', 1)], vel=.58, pan=.15)
mel('trumpet_mute', 14, [(0, 'E5', 1.5), (1.5, 'D5', .5), (2, 'F5', 1)], vel=.62, pan=.15)
mel('trumpet_mute', 15, [(0, 'G5', .5), (.5, 'F5', .5), (1, 'G5', .5), (1.5, 'A5', .5)], vel=.7, pan=.15)
mel('clarinet', 15, [(2, 'A5', 1)], vel=.7)
# 树炸色：下拍颤音琴 + 马林巴滚奏
for bar, ch in [(10, ['A4', 'C5', 'E5', 'G5']), (11, ['F4', 'A4', 'C5', 'E5']), (12, ['Bb4', 'D5', 'F5', 'A5'])]:
    for i, p in enumerate(ch): stems['color'].append((bt(bar) + i * .012, 'vibraphone', p, 1.1, .5, -.3 + i * .2, 1))
    for k in range(6): stems['color'].append((bt(bar) + k * .045, 'marimba', ch[k % 4], .3, .25 + k * .03, .3, .7))
# 城市：拨弦八分音符（摇摆）
for bar in (13, 14, 15):
    tones = CH[bar][1]
    for k in range(6): b = k * .5; stems['strings'].append((bt(bar, sw(b)) + hum(), 'violins_pizz', tones[(k * 2 + 1) % 4], .2, .42 + .1 * (bar - 13) + (.08 if k % 2 == 0 else 0), .35, 1))

# 低音 + 钢琴伴奏 + 刷子
def waltz_bar(bar, loud=1.0):
    root, voic = CH[bar]
    b3 = SPLIT.get(bar)
    stems['bass'] += [(bt(bar) + hum(), 'jazz_bass', root, .38, .8 * loud, -.05, 1), (bt(bar, 1) + hum(), 'jazz_bass', FIFTH[bar], .36, .62 * loud, -.05, 1),
                      (bt(bar, 2) + hum(), 'jazz_bass', b3 or APPROACH[bar], .36, .66 * loud, -.05, 1)]
    v2 = voic if not b3 else voic
    for beat in (1, 2):
        vv = v2 if not (b3 and beat == 2) else ['Bb3', 'E4', 'G4', 'D5']
        for i, p in enumerate(vv): stems['piano'].append((bt(bar, beat) + i * .006 + hum(), 'upright', p, .26, (.36 if beat == 1 else .3) * loud, .2, 1))
for bar in list(range(5, 16)) + list(range(20, 24)): waltz_bar(bar, 1.12 if bar >= 20 else 1)

# ---------- 16：到顶——漂浮的 Db 大七（#11）----------
for p, inst, v in [('C6', 'violins', .5), ('G5', 'violins', .45), ('F4', 'violas', .4), ('Ab4', 'violas', .4), ('Db3', 'cellos', .5)]:
    stems['strings'].append(dict(t=bt(16), inst=inst, pitch=p, dur=.95, vel=v, pan=.1, release=.35))
for i, p in enumerate(['Db4', 'F4', 'Ab4', 'C5', 'G5']): stems['color'].append((bt(16) + i * .03, 'vibraphone', p, 1.2, .45, -.2 + i * .1, 1))
stems['melody'].append((bt(16), 'clarinet', 'C6', .9, .55, -.15, 1))
stems['bass'].append((bt(16), 'jazz_bass', 'Db2', .9, .75, 0, 1))
for i, p in enumerate(['Db5', 'F5', 'Ab5', 'C6', 'Eb6', 'F6', 'Ab6']): stems['color'].append((bt(16) - .2 + i * .03, 'harp', p, 1, .35, .3, .9))
# ---------- 17：静音 ----------
# ---------- 18：下坠——单簧管半音下行 + 定音鼓 ----------
stems['drums'].append((bt(18), 'timpani', 'C3', 1.2, .8, 0, 1))
chrom = ['C6', 'B5', 'Bb5', 'A5', 'Ab5', 'G5', 'Gb5', 'F5', 'E5', 'Eb5', 'D5', 'Db5', 'C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4', 'Gb4', 'F4', 'E4']
for i, p in enumerate(chrom): stems['melody'].append((bt(18) + .02 + i * .05, 'clarinet_stac', p, .09, .62 - i * .01, -.15, 1))
for i, p in enumerate(['C2', 'B1', 'Bb1', 'A1']): stems['bass'].append((bt(18, i * .75), 'jazz_bass', p, .3, .7, 0, 1))
# ---------- 19：冲刺——鼓加花 + 定音鼓滚奏，低音往上走 ----------
for i, p in enumerate(['C2', 'D2', 'E2']): stems['bass'].append((bt(19, i), 'jazz_bass', p, .35, .75, 0, 1))
for k in range(12): stems['drums'].append((bt(19) + k * .1, 'timpani', 'C3', .15, .3 + k * .04, 0, .8))
for k in range(9): stems['drums'].append((bt(19, 1.5) + k * BEAT / 6, 'toms', 'high' if k % 3 else 'low', None, .45 + k * .05, (-.4 + k * .1), 1))
stems['strings'] += [dict(t=bt(19), inst='violins_trem', pitch=p, dur=1.2, vel=.5, pan=.2, attack=1.1) for p in ['C5', 'E5', 'G5']]
# ---------- 20：接住！全奏 + 华尔兹再现 ----------
for p, inst, v in [('C6', 'violins', .55), ('A5', 'violins', .5), ('F5', 'violins', .5), ('D4', 'violas', .45), ('A3', 'violas', .45), ('F2', 'cellos', .55), ('C3', 'cellos', .5)]:
    stems['strings'].append(dict(t=bt(20), inst=inst, pitch=p, dur=4.6, vel=v, pan=.1, release=.8))
stems['drums'] += [(bt(20), 'bass_drum', None, None, .7, 0, 1)]
mel('clarinet', 20, [(0, 'C5', 1.5), (1.5, 'D5', .5), (2, 'C5', 1)], vel=.68)
mel('clarinet', 21, [(0, 'A4', 1), (1, 'F#4', .5), (1.5, 'A4', .5), (2, 'C5', 1)], vel=.66)
mel('clarinet', 22, [(0, 'Bb4', 1.5), (1.5, 'A4', .5), (2, 'G4', 1)], vel=.64)
mel('clarinet', 23, [(0, 'A4', .5), (.5, 'C5', .5), (1, 'D5', .5), (1.5, 'F5', .5), (2, 'A5', 1)], vel=.64)
mel('trumpet_mute', 20, [(0, 'A4', 1.5), (1.5, 'Bb4', .5), (2, 'A4', 1)], vel=.5, pan=.2)
mel('trumpet_mute', 21, [(0, 'F#4', 1), (1, 'D4', .5), (1.5, 'F#4', .5), (2, 'A4', 1)], vel=.5, pan=.2)
mel('trumpet_mute', 22, [(0, 'G4', 1.5), (1.5, 'F4', .5), (2, 'E4', 1)], vel=.5, pan=.2)
# ---------- 24：片名——F6/9 长和弦 + 颤音琴闪光；26：最后一声拨弦 ----------
stems['melody'].append(dict(t=bt(24), inst='clarinet', pitch='G5', dur=2.4, vel=.5, pan=-.15, release=1.2))
for p, inst, v in [('A4', 'violins', .38), ('D5', 'violins', .36), ('C4', 'violas', .34), ('F2', 'cellos', .42)]: stems['strings'].append(dict(t=bt(24), inst=inst, pitch=p, dur=2.6, vel=v, pan=.1, release=1.4))
for i, p in enumerate(['F2', 'C3', 'A3', 'D4', 'G4', 'C5']): stems['piano'].append((bt(24) + i * .06, 'upright', p, 3.0, .36 - i * .02, -.2 + i * .08, 1))
stems['bass'].append((bt(24), 'jazz_bass', 'F1', 1.8, .7, 0, 1))
for i, p in enumerate(['A5', 'C6', 'D6', 'G6', 'A6', 'C7', 'D7']): stems['color'].append((bt(24) + .3 + i * .16, 'vibraphone' if i < 4 else 'glockenspiel', p, 1.2, .3, -.3 + i * .1, .8))
for i, p in enumerate(['C4', 'F4', 'A4', 'C5', 'F5']): stems['color'].append((bt(25, 1) + i * .12, 'harp', p, 1.4, .28, .3, .8))
stems['strings'] += [(bt(26), 'violins_pizz', 'F4', .3, .55, .2, 1), (bt(26), 'cellos_pizz', 'F2', .5, .6, -.1, 1)]
stems['melody'].append((bt(26), 'clarinet_stac', 'F5', .2, .5, -.15, 1))
stems['bass'].append((bt(26), 'jazz_bass', 'F1', .6, .65, 0, 1))

# ---------- 刷子（合成）+ 踩镲 ----------
def brush_sweep(d=.38, v=1):
    x = bp(noise(d), 2500, 9000); tt = t_(d); e = np.sin(np.pi * np.minimum(1, tt / d)) ** 1.5
    return x * e * v * .5
def brush_tap(v=1):
    d = .08; x = bp(noise(d), 3000, 11000) * env_exp(d, .012) + bp(noise(d), 400, 1200) * env_exp(d, .01) * .4
    return x * v * .7
drum_bus = np.zeros((int(DUR * SR), 2), np.float32)
for bar in list(range(5, 16)) + list(range(20, 24)):
    loud = 1.25 if bar >= 20 else (1.0 + .08 * max(0, bar - 12))
    add(drum_bus, brush_sweep(.36, .55 * loud), bt(bar) - .02, 1, -.25)
    for beat in (1, 2): add(drum_bus, brush_tap(.6 * loud), bt(bar, beat) + hum(), 1, .25)
    for beat in (0, 1, 2): add(drum_bus, brush_tap(.3 * loud), bt(bar, beat + 2 / 3) + hum(), 1, .3)
    stems['drums'].append((bt(bar, 1), 'hihat', 'pedal', None, .28 * loud, .15, .7)); stems['drums'].append((bt(bar, 2), 'hihat', 'pedal', None, .24 * loud, .15, .7))
# 吊镲：城市段渐强 → 到顶；接住的镲
stems['drums'].append((bt(15) - .2, 'sus_cymbal', 'cresc', 1.62, .55, .2, .8))
stems['drums'].append((bt(20), 'crash', None, None, .75, .15, .85))
for k in range(10): stems['drums'].append((bt(19) + .2 + k * .08, 'snare2', 'roll', .09, .25 + k * .05, -.1, .8))

# ---------- 渲染 ----------
def render(evs):
    buf = S.render([e for e in evs], dur=DUR, master=False)
    return buf
mix = {}
for k, evs in stems.items():
    mix[k] = render(evs) if evs else np.zeros((int(DUR * SR), 2), np.float32)
mix['drums'] = mix['drums'] + drum_bus
# 第 16 小节尾巴到 20.4 前收干净，确保 20.4–21.6 真静音
def gate(x, t0, t1, fade=.25):
    a, b = int(t0 * SR), int(t1 * SR); f = int(fade * SR)
    x[a - f:a] *= np.linspace(1, 0, f)[:, None]; x[a:b] = 0; return x
for k in mix: mix[k] = gate(mix[k], 20.4, 21.58)
for k, v in mix.items(): sf.write(os.path.join(OUT, f'{k}.wav'), v.astype(np.float32), SR)
print('stems', {k: round(float(np.sqrt((v ** 2).mean())), 4) for k, v in mix.items()})
print('\n'.join(S.credits(['jazz_bass', 'upright', 'clarinet', 'trumpet_mute', 'violins', 'vibraphone', 'harp'])))
