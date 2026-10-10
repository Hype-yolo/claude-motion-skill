"""《The Honeybee, Plate VII》原创配乐 —— 巴洛克室内乐：羽管键琴 + 弦乐四重奏（拨奏 → 首次拉弓）
D 大调，96 BPM，4/4，一拍 0.625 s，一小节 2.5 s，16 小节 = 40.0 s。
运行（仓库根目录）：.venv/bin/python styles/engraving/demo/music/score.py
输出：music/score.wav、music/stems/{harpsichord,pizz,bowed}.wav、music/cues.json、music/CREDITS_music.txt，
      并打印卡点校验报告（同时写入 music/timing_report.txt，NOTES.md 引用）。

雕版段（2.5–25.0）= 细碎拨奏，像刻刀一刀一刀；上色段（26.25 起）= 全片第一次拉弓，长音舒展。
"""
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, lfilter
from core.audio import sampler as S
from core.audio.sfx import SR, add, limit

HERE = os.path.dirname(os.path.abspath(__file__))
# The score follows the picture: events.json (node demo/tools/events.mjs) gives the number of details, their roles
# (A = long signature detail, B = tilt-down middle detail, C = pull-back detail) and where the outro starts.
# Every section below is written once on the demo's own grid and placed by shifting it (OFF) to where the film has it.
# ENG_WORK (optional): a work folder holding events.json and receiving the score outputs (used for the alt-content film)
WORK = os.environ.get('ENG_WORK'); MOUT = os.path.join(WORK, 'music') if WORK else HERE; os.makedirs(MOUT, exist_ok=True)
EVJ = json.load(open(os.path.join(WORK, 'events.json') if WORK else os.path.join(HERE, '..', 'events.json')))
DUR = float(EVJ['dur']); N = int(round(DUR * SR))
DETS = [e for e in EVJ['ev'] if e['type'] == 'push']
OUTRO = next(e['t'] for e in EVJ['ev'] if e['type'] == 'natsize')     # the gather/run starts here (23.75 in the demo)
O2 = OUTRO - 23.75                                                      # shift of everything after the details
OFF = 0.0
BEAT = .625; BAR = 2.5; E8 = BEAT / 2; E16 = BEAT / 4
S.seed(7); RNG = np.random.default_rng(7)

STEMS = ['harpsichord', 'pizz', 'bowed']
bus = {k: np.zeros((N, 2), np.float32) for k in STEMS}
CUES = []                    # {t, what, stem}
USED = set()

def T(bar, beat=1.0):
    """小节号（1 起）+ 拍（1 起，可小数）→ 秒"""
    return (bar - 1) * BAR + (beat - 1) * BEAT

def cue(t, what, stem, band=None):
    """band='low' 只看 <300 Hz（低音落地），'high' 只看 >2 kHz（高音“叮”）"""
    CUES.append(dict(t=round(float(t) + OFF, 4), what=what, stem=stem, **({'band': band} if band else {})))

PRE = .003
def tr(x):
    """起音对齐：切掉 30% 峰值前 3 ms 以前的部分 → 放在 t-PRE 时冲击点正好落在 t"""
    x = np.asarray(x, np.float32); a = np.abs(x); i = int(np.argmax(a > .3 * a.max()))
    return x[max(0, i - int(PRE * SR)):]

PAN = {'harpsichord': -.12, 'violin_pizz': -.4, 'violins_pizz': .35, 'violas_pizz': .15,
       'cellos_pizz': -.08, 'contrabass_pizz': -.15,
       'violins': .3, 'violin': -.4, 'violas': .12, 'cellos': -.1, 'contrabass': -.18}
STEM_OF = lambda inst: 'harpsichord' if inst == 'harpsichord' else ('pizz' if inst.endswith('pizz') else 'bowed')

def pl(t, inst, p, d=.25, v=.6, g=1.0, exact=False, pan=None, release=None):
    """拨奏 / 羽管键琴一音。exact=False 时加 ±4 ms 人味和 ±0.04 力度浮动（卡点音一律 exact）"""
    USED.add(inst)
    if not exact:
        t = t + RNG.uniform(-.004, .004); v = float(np.clip(v + RNG.uniform(-.04, .04), .05, 1))
    kw = {} if release is None else dict(release=release)
    x = tr(S.note(inst, p, d, vel=v, **kw))
    add(bus[STEM_OF(inst)], x, t + OFF - PRE, g, PAN[inst] if pan is None else pan)

def hch(t, ps, d=.4, v=.55, g=1.0, strum=.012, exact=False):
    """羽管键琴和弦（轻琶，最低音落在 t）"""
    for i, p in enumerate(ps): pl(t + i * strum, 'harpsichord', p, d, v, g, exact=(exact and i == 0))

def bow(t, inst, p, d, v=.45, g=1.0, attack=.5, release=.6, pan=None):
    """拉弓长音：从 t 开始（采样起点即 t，不做起音裁切），attack 秒淡入"""
    USED.add(inst)
    x = S.note(inst, p, d, vel=v, release=release)
    a = np.abs(x); i0 = int(np.argmax(a > a.max() * 10 ** (-40 / 20)))        # 去掉采样开头的空白，弓毛接触即 t
    x = x[i0:].copy(); na = int(attack * SR); x[:na] *= np.linspace(0, 1, na) ** 1.5
    add(bus['bowed'], x, t + OFF, g, PAN[inst] if pan is None else pan)

# ════════════════════════════════════════════════════════════════════
# 0.0–1.875：无音乐（刻刀拟音）
# 1.875 / 2.1875：羽管键琴两音弱起（A4 → C#5，导入 D）
pl(1.875, 'harpsichord', 'A4', .09, .62, exact=True, release=.03); cue(1.875, 'pickup 1: harpsichord A4', 'harpsichord')
pl(2.1875, 'harpsichord', 'C#5', .09, .66, exact=True, release=.03); cue(2.1875, 'pickup 2: harpsichord C#5', 'harpsichord')

# ─── 和声与声部素材 ───
RH = {'D': ['D4', 'F#4', 'A4'], 'A/C#': ['C#4', 'E4', 'A4'], 'Bm': ['D4', 'F#4', 'B4'], 'G': ['D4', 'G4', 'B4'],
      'A7': ['C#4', 'E4', 'G4'], 'Em': ['E4', 'G4', 'B4'], 'Em7': ['D4', 'G4', 'B4']}
HATCH = {'D': ['F#4', 'A4', 'D5', 'A4'], 'A/C#': ['E4', 'A4', 'C#5', 'A4'], 'Bm': ['D4', 'F#4', 'B4', 'F#4'],
         'G': ['G4', 'B4', 'D5', 'B4'], 'A7': ['E4', 'G4', 'C#5', 'G4'], 'Em': ['E4', 'G4', 'B4', 'G4'],
         'Em7': ['D4', 'G4', 'B4', 'G4']}
VLA = {'D': ['A3', 'F#3'], 'A/C#': ['A3', 'E3'], 'Bm': ['B3', 'F#3'], 'G': ['B3', 'G3'], 'A7': ['G3', 'E3'],
       'Em': ['B3', 'G3'], 'Em7': ['B3', 'G3']}

def cello8(t0, notes, v=.62, g=1.0):
    for i, p in enumerate(notes):
        if p: pl(t0 + i * E8, 'cellos_pizz', p, .3, v, g)

def viola8(t0, chord, n, v=.42, g=1.0, off_only=False):
    for i in range(n):
        if off_only and i % 2 == 0: continue
        pl(t0 + i * E8, 'violas_pizz', VLA[chord][i % 2], .25, v * (.85 if i % 2 == 0 else 1), g)

def hatch16(t0, chord, beats, v=.36, g=1.0, cresc=0.0):
    """第二小提琴十六分拨奏交叉排线"""
    n = int(round(beats * 4))
    for i in range(n):
        vv = v + cresc * i / max(1, n - 1) + (.05 if i % 4 == 0 else 0)
        pl(t0 + i * E16, 'violins_pizz', HATCH[chord][i % 4], .16, vv, g)

def cont(t0, chord, beats, v=.5, g=1.0, every=1):
    for k in range(0, beats, every): hch(t0 + k * BEAT, RH[chord], .3, v, g)

# ─── 第 2 小节（2.5）：拉印 —— 大提琴 + 中提琴八分拨奏 + 羽管键琴通奏低音，强下拍 ───
t = T(2)
hch(t, ['D3', 'A3', 'D4', 'F#4', 'A4'], .5, .78, .95, strum=.008, exact=True)
pl(t, 'contrabass_pizz', 'D2', .5, .85, 1.1, exact=True)
pl(t, 'cellos_pizz', 'D3', .35, .85, 1.1, exact=True)
pl(t, 'violas_pizz', 'A3', .3, .7, 1.0, exact=True)
cue(t, 'bar 2 downbeat: print pulled (tutti D accent)', 'pizz')
cello8(t + E8, ['A2', 'D3', 'F#3'])
cello8(T(2, 3), ['C#3', 'A2', 'C#3', 'E3'])
viola8(t + E8, 'D', 3, off_only=False); viola8(T(2, 3), 'A/C#', 4)
hch(T(2, 3), RH['A/C#'], .3, .5)

# ─── 第 3 小节（5.0）：第二小提琴十六分交叉排线进入；6.25 羽管键琴琶音华彩落 7.5 ───
t = T(3)
cello8(t, ['B2', 'F#2', 'B2', 'D3']); cello8(T(3, 3), ['G2', 'D3', 'A2', 'E3'], v=.55)
viola8(t, 'Bm', 4); viola8(T(3, 3), 'G', 2, v=.34); viola8(T(3, 4), 'A7', 2, v=.34)
pl(t, 'violins_pizz', 'D4', .16, .5, exact=True); cue(t, 'bar 3: 2nd violin 16th pizz hatching enters', 'pizz')
hatch16(t + E16, 'Bm', 2 - .25, v=.34)
hatch16(T(3, 3), 'G', 1, v=.26); hatch16(T(3, 4), 'A7', 1, v=.26)
hch(t, RH['Bm'], .3, .5); hch(T(3, 2), RH['Bm'], .25, .4)
# 华彩：G 大调琶音上行 8 音 + A7 琶音上行 8 音（三十二分），7.5 落 F#5 于 D 和弦
FL = ['G2', 'B2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4', 'A3', 'C#4', 'E4', 'G4', 'A4', 'C#5', 'E5', 'G5']
for i, p in enumerate(FL):
    pl(T(3, 3) + i * (BAR / 2 / 16), 'harpsichord', p, .18, .44 + .01 * i, .9, exact=(i == 0))
cue(T(3, 3), 'harpsichord flourish starts (title engraved)', 'harpsichord')

# ─── 第 4 小节（7.5）：全奏，自信 ───
t = T(4)
hch(t, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5', 'F#5'], .5, .72, .9, strum=.006, exact=True)
pl(t, 'contrabass_pizz', 'D2', .5, .75, 1.0, exact=True); pl(t, 'cellos_pizz', 'D3', .3, .75, exact=True)
cue(t, 'bar 4: flourish lands, full texture', 'harpsichord')
cello8(t + E8, ['A2', 'D3', 'F#3']); cello8(T(4, 3), ['G2', 'D3'])
viola8(t, 'D', 4, v=.44); viola8(T(4, 3), 'G', 2, v=.44)
hatch16(t, 'D', 2, v=.38); hatch16(T(4, 3), 'G', 1, v=.36)
cont(T(4, 2), 'D', 1, .45); cont(T(4, 3), 'G', 1, .5)
pl(T(4, 3), 'contrabass_pizz', 'G1', .4, .6)

def sec_A():
    # ─── 9.375（第 4 小节第 4 拍）：织体变薄 —— 只留高音羽管键琴音型 + 大提琴 A 持续低音 ───
    t = T(4, 4)
    pl(t, 'cellos_pizz', 'A2', .4, .6, exact=True); cue(t, 'texture thins: cello A pedal + high harpsichord figure', 'pizz', 'low')
    for k in range(1, 3): pl(t + k * BEAT, 'cellos_pizz', 'A2', .4, .44)          # 10.0, 10.625（11.25 让给上行线）
    FIG = ['E5', 'A5', 'C#5', 'A5', 'D5', 'A5', 'C#5', 'A5']
    for i in range(6):                                                              # 9.375 … 10.9375（8 分）
        pl(t + i * E8, 'harpsichord', FIG[i % 8], .2, .36, exact=(i == 0))
    # 10.425：放大镜圆环被刻出 —— 一声高亮 "叮"
    pl(10.425, 'violin_pizz', 'A6', .5, .72, 1.1, exact=True)
    pl(10.425, 'harpsichord', 'A5', .3, .35, .5, exact=True)
    cue(10.425, 'ring ting #1 (violin pizz A6 + harpsichord A5)', 'pizz', 'high')
    # 11.275–12.775：圆框飞过 —— 上行音阶；12.775 落地
    RISE1 = ['A4', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'G5', 'A5']
    for i, p in enumerate(RISE1):
        tt = 11.275 + i * .1875
        pl(tt, 'violin_pizz', p, .2, .5 + .02 * i, .8, exact=True)
        pl(tt, 'harpsichord', p, .15, .34 + .02 * i, .55, exact=True)
    cue(11.275, 'rising line #1 starts', 'pizz'); cue(11.275 + 7 * .1875, 'rising line #1 top note', 'pizz')
    pl(12.775, 'cellos_pizz', 'D2', .5, .85, 1.2, exact=True)
    pl(12.775, 'contrabass_pizz', 'D2', .5, .85, 1.1, exact=True)
    pl(12.775, 'harpsichord', 'D3', .3, .5, .7, exact=True)
    cue(12.775, 'landing #1: low cello + bass pizz D', 'pizz', 'low')

    # ─── 第 6 小节（12.5–15.0）：拨奏回来，更轻 ───
    cello8(T(6, 2), ['A2', 'D3', 'F#3'], v=.5)
    cello8(T(6, 3), ['B2', 'F#2', 'B2', 'D3'], v=.5)
    viola8(T(6, 2), 'D', 2, v=.34, off_only=True); viola8(T(6, 3), 'Bm', 4, v=.34, off_only=True)
    hch(T(6, 3), RH['Bm'], .3, .42); hch(T(6, 4), RH['Bm'], .25, .34)
    hatch16(T(6, 3), 'Bm', 2, v=.24)


def sec_B():
    # ─── 第 7 小节（15.0）：第二个局部，同样语法更快 ───
    t = T(7)
    cello8(t, ['E3', 'B2', 'E3', 'G3'], v=.5)
    hch(t, ['E3'] + RH['Em7'], .3, .5, exact=True); cue(t, 'bar 7: second detail begins (Em7 downbeat)', 'harpsichord')
    for i, p in enumerate(['B5', 'E5', 'G5', 'E5']): pl(t + i * E8, 'harpsichord', p, .18, .33)   # 高音音型到 15.9
    pl(15.5, 'violin_pizz', 'B6', .5, .72, 1.1, exact=True); pl(15.5, 'harpsichord', 'B5', .3, .35, .5, exact=True)
    cue(15.5, 'ring ting #2 (violin pizz B6)', 'pizz', 'high')
    pl(T(7, 3), 'cellos_pizz', 'A2', .4, .5)
    RISE2 = ['B4', 'C#5', 'D5', 'E5', 'F#5', 'G5', 'A5']
    for i, p in enumerate(RISE2):
        tt = 15.8 + i * (1.0 / 7)
        pl(tt, 'violin_pizz', p, .18, .5 + .02 * i, .75, exact=True)
        pl(tt, 'harpsichord', p, .14, .36 + .02 * i, .55, exact=True)
    cue(15.8, 'rising line #2 starts', 'pizz')
    pl(16.8, 'cellos_pizz', 'D2', .5, .85, 1.2, exact=True); pl(16.8, 'contrabass_pizz', 'D2', .5, .85, 1.1, exact=True)
    pl(16.8, 'harpsichord', 'D3', .3, .5, .7, exact=True)
    cue(16.8, 'landing #2: low cello + bass pizz D', 'pizz', 'low')
    cello8(T(7, 4), ['D3', 'F#3'], v=.5); viola8(T(7, 4), 'D', 2, v=.34)

    # ─── 第 8 小节（17.5）：织体再满一点；19.375 第三个局部 ───
    t = T(8)
    pl(t, 'contrabass_pizz', 'B1', .4, .6)
    cello8(t, ['B2', 'F#2', 'B2', 'D3'], v=.58); cello8(T(8, 3), ['G2', 'D3'], v=.55)
    viola8(t, 'Bm', 4, v=.4); viola8(T(8, 3), 'G', 2, v=.38)
    hatch16(t, 'Bm', 2, v=.34); hatch16(T(8, 3), 'G', 1, v=.3)
    cont(t, 'Bm', 2, .46); cont(T(8, 3), 'G', 1, .44)

def sec_C():
    t = T(8, 4)
    pl(t, 'cellos_pizz', 'A2', .4, .66, exact=True); pl(t, 'harpsichord', 'A2', .3, .5, .7, exact=True)
    cue(t, 'third detail: thins to cello A pedal (+ harpsichord A2 / E5 figure)', 'harpsichord')
    for i, p in enumerate(['E5', 'A5']): pl(t + i * E8, 'harpsichord', p, .2, .34, exact=(i == 0))
    pl(19.875, 'violin_pizz', 'A6', .5, .72, 1.1, exact=True); pl(19.875, 'harpsichord', 'A5', .3, .35, .5, exact=True)
    cue(19.875, 'ring ting #3 (violin pizz A6)', 'pizz', 'high')

    # ─── 第 9 小节（20.0）：第一小提琴的拨奏旋律 —— 旁白之下整条上移八度，让出人声频段 ───
    MEL = [(0, 'A5', .5), (.5, 'F#5', .5), (1, 'D6', 1), (2, 'B5', .5), (2.5, 'G5', .25), (2.75, 'A5', .25),
           (3, 'B5', .5), (3.5, 'C#6', .25), (3.75, 'D6', .25), (4, 'E6', 1), (5, 'G5', .5), (5.5, 'F#5', .5)]
    for i, (b, p, d) in enumerate(MEL):
        pl(T(9) + b * BEAT, 'violin_pizz', S.midi(p) + 12, d * BEAT, .66 if b < 4 else .6, 1.0, exact=(i == 0))
    cue(T(9), '1st violin pizz melody begins', 'pizz')
    cello8(T(9), ['D3', 'A2', 'D3', 'F#3'], v=.46)
    viola8(T(9), 'D', 4, v=.3, off_only=True)
    hch(T(9), RH['D'], .3, .4); hch(T(9, 2), RH['D'], .25, .32)
    # 21.475：第三个落地（G）
    pl(21.475, 'cellos_pizz', 'G2', .5, .85, 1.2, exact=True); pl(21.475, 'contrabass_pizz', 'G1', .5, .85, 1.1, exact=True)
    pl(21.475, 'harpsichord', 'G2', .3, .5, .7, exact=True)
    cue(21.475, 'landing #3: low cello + bass pizz G', 'pizz', 'low')
    cello8(T(9, 4), ['D3', 'B2'], v=.46)
    hch(T(9, 4), RH['G'], .25, .36)
    # 22.2：小小的托起 —— 第二小提琴十六分渐强 + 羽管键琴轻琶
    pl(22.1875, 'violins_pizz', 'G4', .16, .34, exact=True)
    hatch16(22.1875 + E16, 'G', .25, v=.36, cresc=.04)
    hch(22.1875, ['B3', 'D4', 'G4', 'B4'], .35, .45, .9, strum=.03, exact=True)
    cue(22.1875, 'gentle lift (swell into bar 10)', 'harpsichord')

    # ─── 第 10 小节（22.5）：Em | A7，23.75 羽管键琴下行音阶，25.0 戛然而止 ───
    t = T(10)
    cello8(t, ['E3', 'B2', 'E3', 'G3'], v=.55)
    viola8(t, 'Em', 4, v=.36)
    hatch16(t, 'Em', 2, v=.42, cresc=-.14)
    hch(t, RH['Em'], .3, .5); hch(T(10, 2), RH['Em'], .25, .4)

def sec_outro():
    pl(T(10, 3), 'cellos_pizz', 'A2', .35, .6); pl(T(10, 3), 'contrabass_pizz', 'A1', .35, .55)
    pl(T(10, 4), 'cellos_pizz', 'A2', .3, .5)
    RUN = ['A5', 'G5', 'F#5', 'E5', 'D5', 'C#5', 'B4', 'A4']
    for i, p in enumerate(RUN):
        last = i == len(RUN) - 1
        pl(T(10, 3) + i * E16, 'harpsichord', p, .09 if last else .15, .55 + (.12 if last else 0), exact=(i == 0 or last),
           release=.03 if last else None)
        if i % 2 == 0: pl(T(10, 3) + i * E16, 'harpsichord', S.midi(p) - 12, .09 if i == 6 else .14, .4)
    cue(T(10, 3), 'harpsichord descending run starts', 'harpsichord')
    cue(T(10, 3) + 7 * E16, 'run last note A4 (short) -> dead stop by 25.0', 'harpsichord')

    # ════════════════════════════════════════════════════════════════════
    # 25.0–26.25：绝对静音
    # 26.25 起：全片第一次拉弓 —— pp 渐强的长音，颜色晕开；羽管键琴稀疏轻琶
    CH = [  # (t, cellos, violas, vln2, vln1, contrabass)
        (26.25, 'D3', 'A3', 'F#4', 'A5', None),
        (27.5, 'B2', 'B3', 'F#4', 'B5', None),
        (28.75, 'G2', 'B3', 'G4', 'B5', 'G1'),
        (30.0, 'E2', 'B3', 'G4', 'D6', 'E1'),
        (30.625, 'A2', 'C#4', 'G4', 'C#6', 'A1'),
        (31.25, 'D3', 'D4', 'F#4', 'D6', 'D2'),
    ]
    END_BOW = 36.0
    def legato(col, inst, g, v0, pan=None):
        """把某声部的长音连起来：同音延续不换弓"""
        seq = [(c[0], c[col]) for c in CH if c[col] is not None]
        merged = []
        for tt, p in seq:
            if merged and merged[-1][1] == p: continue
            merged.append((tt, p))
        for i, (tt, p) in enumerate(merged):
            t1 = merged[i + 1][0] if i + 1 < len(merged) else END_BOW
            first = tt == 26.25
            att = .3 if first else (.12 if tt == 31.25 else .3)
            bow(tt, inst, p, t1 - tt + .12, v0 + (.08 if tt >= 30 else 0), g, attack=att,
                release=2.4 if t1 == END_BOW else .35, pan=pan)
    legato(1, 'cellos', 1.0, .42)
    legato(2, 'violas', .8, .38)
    legato(3, 'violins', .7, .36, pan=.3)
    legato(4, 'violins', .8, .4, pan=-.35)
    legato(5, 'contrabass', .75, .4)
    cue(26.25, 'FIRST BOWED NOTE: strings enter pp on D (cellos/violas/violins)', 'bowed')
    # 渐强包络：26.25 pp → 27.6 mp，30.0–31.25 再微托起
    env = np.ones(N, np.float32); tt_ = np.arange(N) / SR
    tt_ = tt_ - O2
    env = np.where(tt_ < 27.6, .55 + .45 * np.clip((tt_ - 26.25) / 1.35, 0, 1), 1.0)
    env = env * (1 + .15 * np.clip((tt_ - 30.0) / 1.25, 0, 1) * (tt_ < 33.0) + .15 * (tt_ >= 33.0) * np.clip(1 - (tt_ - 33.0) / 1.0, 0, 1))
    bus['bowed'] *= env[:, None].astype(np.float32)

    # 羽管键琴：稀疏、高音区、轻（旁白 26.9–30.9 让开中频）
    for t0, ps in [(27.5, ['B4', 'D5', 'F#5', 'B5']), (28.75, ['G4', 'B4', 'D5', 'G5']), (30.0, ['E4', 'G4', 'B4', 'E5'])]:
        for i, p in enumerate(ps): pl(t0 + i * E8, 'harpsichord', p, .25, .28)
    for i, p in enumerate(['A4', 'C#5', 'E5']): pl(30.625 + i * E16, 'harpsichord', p, .2, .3)
    # 31.25：完满终止 V–I 落在第 13 小节第 3 拍 —— 成品揭晓
    for p in ['D2', 'A2', 'D3']: pl(31.25, 'harpsichord', p, 1.6, .66, 1.0, exact=True)       # 低音三音齐下，不琶
    hch(31.25 + .014, ['F#3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 1.6, .6, 1.0, strum=.014)
    pl(31.25, 'contrabass_pizz', 'D2', .8, .6, .9, exact=True)
    cue(31.25, 'perfect cadence V-I: tonic D lands (harpsichord roll + bass pizz + bowed D)', 'harpsichord')
    # 33.75：最后一个轻轻的拨弦（眨眼）
    pl(33.75, 'violin_pizz', 'D6', .4, .46, .9, exact=True); cue(33.75, 'wink: soft violin pizz D6', 'pizz')
    # 35.625：片尾卡 —— 极轻的羽管键琴主和弦，随后自然淡出
    hch(35.625, ['D4', 'A4', 'D5'], .9, .3, .7, strum=.05, exact=True)
    cue(35.625, 'end card: soft harpsichord tonic, fade begins', 'harpsichord')


# ─── place the sections where the film has them ───
TEMPLATE = {'A': 9.375, 'B': 15.0, 'C': 19.375}
for e in DETS:
    role = e.get('role', 'A' if e['i'] == 0 else 'C')
    OFF = e['t'] - TEMPLATE[role]
    {'A': sec_A, 'B': sec_B, 'C': sec_C}[role]()
OFF = O2
sec_outro()
OFF = 0.0

# ════════════════════════════════════════════════════════════════════
# 混响 → 静音门 → 电平
ROOM = {'harpsichord': dict(size=.28, mix=.16), 'pizz': dict(size=.3, mix=.18), 'bowed': dict(size=.42, mix=.24)}
for k in STEMS: bus[k] = S.room(bus[k], damp=.55, **ROOM[k]).astype(np.float32)

def gate(a, b, fin=.012, fout=.02):
    g = np.ones(N, np.float32); ia, ib = int(a * SR), int(b * SR)
    g[ia:ib] = 0; f = int(fin * SR); g[max(0, ia - f):ia] = np.linspace(1, 0, min(f, ia))
    fo = int(fout * SR); g[ib:ib + fo] = np.minimum(g[ib:ib + fo], np.linspace(0, 1, len(g[ib:ib + fo])))
    return g
G = gate(0.0, 1.874, 0, 0) * gate(24.985 + O2, 26.25 + O2, .02, 0)
tt_ = np.arange(N) / SR
G *= np.clip(1 - (tt_ - 36.6 - O2) / 2.3, 0, 1).astype(np.float32)          # 36.6 起自然淡出，38.9 归零
for k in STEMS: bus[k] *= G[:, None]
_HP = butter(2, 35, 'high', fs=SR, output='sos')
for k in STEMS: bus[k] = sosfilt(_HP, bus[k], axis=0).astype(np.float32) * G[:, None]   # 去超低频隆隆声

GAIN = {'harpsichord': 1.0, 'pizz': 1.0, 'bowed': 1.45}
mix = sum(bus[k] * GAIN[k] for k in STEMS)

def lufs(x):
    """ITU-R BS.1770-4 积分响度（48 kHz K 计权 + 双门限）"""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, .73248077421585]
    b2, a2 = [1, -2, 1], [1, -1.99004745483398, .99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = int(.4 * SR), int(.1 * SR)
    ms = np.array([np.sum(np.mean(y[i:i + blk] ** 2, 0)) for i in range(0, len(y) - blk, hop)])
    L = -.691 + 10 * np.log10(ms + 1e-12); ms = ms[L > -70]
    if not len(ms): return -99
    rel = -.691 + 10 * np.log10(ms.mean()) - 10
    ms = ms[-.691 + 10 * np.log10(ms) > rel]
    return -.691 + 10 * np.log10(ms.mean())

sc = 10 ** ((-18.0 - lufs(mix)) / 20)
_pre = np.abs(mix * sc).max(1)
for _ in range(4):
    _i = int(np.argmax(_pre)); print(f'pre-limit peak {20*np.log10(_pre[_i]):+.1f} dBFS at {_i/SR:.3f}s', {k: round(float(20*np.log10(np.abs(bus[k][_i]*GAIN[k]*sc).max()+1e-9)),1) for k in STEMS}); _pre[max(0,_i-SR//4):_i+SR//4] = 0
mix = mix * sc
CEIL = 10 ** (-1.2 / 20)
mix = np.stack([limit(mix[:, 0], CEIL), limit(mix[:, 1], CEIL)], 1).astype(np.float32)
mix = np.clip(mix, -CEIL, CEIL)[:N]
sf.write(os.path.join(MOUT, 'score.wav'), mix, SR, subtype='PCM_24')
os.makedirs(os.path.join(MOUT, 'stems'), exist_ok=True)
for k in STEMS: sf.write(os.path.join(MOUT, 'stems', k + '.wav'), np.clip(bus[k] * GAIN[k] * sc, -1, 1).astype(np.float32), SR, subtype='PCM_24')
json.dump(sorted(CUES, key=lambda c: c['t']), open(os.path.join(MOUT, 'cues.json'), 'w'), indent=1, ensure_ascii=False)
open(os.path.join(MOUT, 'CREDITS_music.txt'), 'w').write(
    'Original score for "The Honeybee, Plate VII" (Copperplate Engraving demo, Lemo-Opuscar), composed in code (music/score.py).\n'
    'Instruments: harpsichord; violin, violins, violas, cellos, contrabass (pizzicato and arco).\n'
    + '\n'.join(S.credits(sorted(USED))) + '\n')

# ════════════════════════════════════════════════════════════════════
# 卡点校验：在对应 stem（混响后）上找 cue 附近 ±60 ms 内的最大能量跃升（5 ms 帧，log 能量差分）
TOL = .042
def onset_near(x, t, win=.06):
    """攻击点：窗口 [t-60ms, t+120ms] 内，包络从局部谷底升到 (谷底 + 30%×(峰-谷)) 的首个时刻"""
    m = x.mean(1) if x.ndim == 2 else x
    hop = int(.001 * SR); w = int(.004 * SR)
    a = int((t - win) * SR); b = int((t + .12) * SR)
    A = np.array([np.sqrt(np.mean(m[i:i + w] ** 2)) for i in range(a, b, hop)])
    ts = (np.arange(len(A)) * hop + a + w / 2) / SR
    k0 = int(np.argmax(A)); lo_i = int(np.argmin(A[:k0 + 1])); lo, hi = A[lo_i], A[k0]
    k = lo_i + int(np.argmax(A[lo_i:k0 + 1] >= lo + .3 * (hi - lo)))
    return float(ts[k]), float(20 * np.log10(hi / max(lo, 1e-9)))

lines = ['Timing check (onset = first 30% rise from local trough to local peak in [t-60 ms, t+120 ms], measured on the rendered stem; tol ±0.042 s = 1 frame @24fps)', '']
allok = True
for c in sorted(CUES, key=lambda c: c['t']):
    x = bus[c['stem']]
    if c['stem'] == 'bowed':
        m = np.abs(x.mean(1)); i = int(np.argmax(m > 1e-5)); got = i / SR; rise = 0.0   # 首个 > -100 dBFS 的弓奏样本
    else:
        if c.get('band') == 'low': x = sosfilt(butter(4, 300, 'low', fs=SR, output='sos'), x, axis=0)
        if c.get('band') == 'high': x = sosfilt(butter(4, 2000, 'high', fs=SR, output='sos'), x, axis=0)
        got, rise = onset_near(x, c['t'])
    err = got - c['t']; ok = abs(err) <= TOL; allok &= ok
    c['got'] = got
    lines.append(f"{'OK ' if ok else 'BAD'} {c['t']:7.4f}s  got {got:7.4f}s  err {err*1000:+6.1f} ms  (rise {rise:4.1f} dB)  {c['what']}")
CUE_MAP = sorted({c['t'] for c in CUES})
lines += ['', 'Against the brief cue map (nearest measured accent):']
for tm in CUE_MAP:
    c = min(CUES, key=lambda c: abs(c['got'] - tm)); err = c['got'] - tm
    if abs(tm - (26.25 + O2)) < 1e-6: ok = 26.25 + O2 <= c['got'] <= 26.35 + O2
    else: ok = abs(err) <= TOL
    allok &= ok
    lines.append(f"{'OK ' if ok else 'BAD'} map {tm:7.4f}s  <- {c['got']:7.4f}s  err {err*1000:+6.1f} ms  {c['what']}")
def rms_db(a, b): s = mix[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)
def pk_db(a, b): s = mix[int(a * SR):int(b * SR)]; return 20 * np.log10(np.abs(s).max() + 1e-12)
bw = np.abs(bus['bowed'].mean(1)); first_bow = int(np.argmax(bw > 1e-5)) / SR
lines += ['', f'Silence 0.0–1.87 s: peak {pk_db(0, 1.87):.1f} dBFS',
          f'Silence {25.0 + O2:.2f}–{26.25 + O2:.2f} s: peak {pk_db(25.0 + O2, 26.25 + O2):.1f} dBFS',
          f'Pickup ring 2.0–2.18 s: peak {pk_db(2.0, 2.18):.1f} dBFS; 2.3–2.49 s: peak {pk_db(2.3, 2.49):.1f} dBFS',
          f'Tail {DUR - 1:.1f}–{DUR:.1f} s: peak {pk_db(DUR - 1, DUR):.1f} dBFS',
          f'Bowed stem silent before 26.25: peak {20*np.log10(np.abs(bus["bowed"][:int((26.25 + O2)*SR)]).max()+1e-12):.1f} dBFS; first bowed sample above -100 dB at {first_bow:.4f} s',
          f'Bowed stem reaches -50 dBFS at {int(np.argmax(bw > 10**(-50/20)))/SR:.4f} s, -40 dBFS at {int(np.argmax(bw > 10**(-40/20)))/SR:.4f} s',
          'Per-bar RMS (dBFS): ' + ' '.join(f"b{n+1}:{rms_db(n*BAR,(n+1)*BAR):.0f}" for n in range(int(DUR // BAR))),
          f'Mix: {len(mix)/SR:.3f} s, {mix.shape[1]} ch, {SR} Hz, peak {20*np.log10(np.abs(mix).max()):.2f} dBFS, integrated {lufs(mix):.1f} LUFS',
          '', 'ALL CUES WITHIN TOLERANCE' if allok else 'SOME CUES OUT OF TOLERANCE']
rep = '\n'.join(lines); print(rep)
open(os.path.join(MOUT, 'timing_report.txt'), 'w').write(rep + '\n')
