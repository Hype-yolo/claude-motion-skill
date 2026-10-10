"""原创配乐合成 → music/score.wav（48k 立体声，成片长度）+ music/stems/*.wav
全部 numpy 合成：特雷门琴（连续音高 + 滑音 + 渐入颤音）、模拟贝斯、方波琶音、复古鼓机、
果冻宇宙的摇摆大号、马克杯宇宙的刷子鼓爵士、电梯 bossa（Karplus-Strong 尼龙弦）、弹簧/房间混响。
cue 时间全部来自 events.json（由 story.js 导出），所以每个 cue 的第一拍就是剪辑点。
用法：python music/score.py"""
import json, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
E = json.load(open(os.path.join(ROOT, 'events.json'))); DUR = E['dur']
CUE = {e['name']: e for e in E['ev'] if e['type'] == 'cue'}
SR = 48000; N = int(DUR * SR); BEAT = .5
rng = np.random.default_rng(11)

# ———————————————— 基础 ————————————————
def tt(d): return np.arange(int(round(d * SR))) / SR
def mf(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def M(s):   # 'D5' → 74
    n, o = (s[:2], s[2:]) if len(s) > 2 and s[1] in '#b' else (s[:1], s[1:]); return 12 * (int(o) + 1) + NOTE[n]
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR * .45), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def adsr(n, a=.005, d=.1, s=.6, r=.1, hold=None):
    e = np.zeros(n); A, D, R = int(a * SR), int(d * SR), int(r * SR); H = n - R if hold is None else int(hold * SR)
    H = max(H, 1); i = np.arange(n)
    e = np.where(i < A, i / max(A, 1), np.where(i < A + D, 1 - (1 - s) * (i - A) / max(D, 1), s))
    rel = np.clip(1 - (i - H) / max(R, 1), 0, 1); e = np.where(i >= H, e[min(H, n - 1)] * rel, e)
    return e
def saw(ph): return 2 * (ph % 1) - 1
def sq(ph, w=.5): return np.where(ph % 1 < w, 1., -1.)
def tri(ph): return 2 * np.abs(2 * (ph % 1) - 1) - 1

class Bus:
    def __init__(s, name): s.name = name; s.b = np.zeros((N, 2))
    def add(s, x, at, g=1., pan=0.):
        st = int(round(at * SR))
        if x.ndim == 1: l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414; x = np.stack([x * l, x * r], 1)
        if st < 0: x = x[-st:]; st = 0
        e = min(N, st + len(x));
        if e > st: s.b[st:e] += x[:e - st] * g
    def cut(s, t0, t1, fade=.008):   # 静音区间（硬切）
        a, b = int(t0 * SR), int(t1 * SR); f = int(fade * SR)
        s.b[a:b] = 0
        if a - f > 0: s.b[a - f:a] *= np.linspace(1, 0, f)[:, None]
BUS = {k: Bus(k) for k in ['drums', 'bass', 'lead', 'harm', 'fx']}

# ———————————————— 乐器 ————————————————
def theremin(notes, glide=.07, vib=.32, rate=5.7, bright=.14, v=1.):
    """notes: [(t, dur, midi)] 连续演奏；返回 (起点, 信号)"""
    t0 = notes[0][0]; t1 = max(t + d for t, d, _ in notes) + .25; n = int((t1 - t0) * SR)
    target = np.full(n, float(notes[0][2])); amp = np.zeros(n)
    for t, d, m in notes:
        a, b = int((t - t0) * SR), int((t + d - t0) * SR); target[a:] = m
        env = adsr(b - a + int(.12 * SR), .035, .08, .85, .12, hold=d); amp[a:a + len(env)] = np.maximum(amp[a:a + len(env)], env[:n - a])
    k = 1 - np.exp(-1 / (glide * SR))
    from scipy.signal import lfilter
    mid = lfilter([k], [1, -(1 - k)], target, zi=[target[0] * (1 - k)])[0]
    # 颤音在每个音开始 150ms 后渐入
    vib_env = np.zeros(n)
    for t, d, m in notes:
        a = int((t - t0) * SR); L = int((d + .12) * SR); w = np.clip((np.arange(L) / SR - .15) / .25, 0, 1); vib_env[a:a + L] = np.maximum(vib_env[a:a + L], w[:n - a])
    ph_v = np.arange(n) / SR * rate * 2 * np.pi
    f = mf(mid + vib * vib_env * np.sin(ph_v)); ph = np.cumsum(f) / SR
    x = np.sin(2 * np.pi * ph) + bright * np.sin(4 * np.pi * ph) + .05 * np.sin(6 * np.pi * ph)
    return t0, lp(x * amp, 5000) * v
def bass(t, d, m, v=1., cut=900):
    n = int((d + .06) * SR); ph = np.cumsum(np.full(n, mf(m))) / SR
    x = .7 * saw(ph) + .6 * np.sin(2 * np.pi * ph * .5 * 2) ; e = adsr(n, .004, .15, .55, .05, hold=d)
    fe = cut * (.35 + .65 * np.exp(-np.arange(n) / SR / .12))
    y = np.zeros(n); seg = 256
    for i in range(0, n, seg): y[i:i + seg] = lp(x[max(0, i - 2048):i + seg], fe[i])[-len(x[i:i + seg]):]
    return y * e * v
def pluck(t, d, m, v=1., w=.3, cut=3200):
    n = int((d + .15) * SR); ph = np.cumsum(np.full(n, mf(m))) / SR
    return lp(sq(ph, w) * adsr(n, .002, .09, .25, .1, hold=d), cut) * v
def pad(d, ms, v=1., cut=1600, att=.3):
    n = int((d + .6) * SR); x = np.zeros(n)
    for m in ms:
        for dt in (-.08, 0, .09):
            ph = np.cumsum(np.full(n, mf(m + dt))) / SR + rng.random(); x += saw(ph)
    return lp(x / len(ms) / 3, cut, 2) * adsr(n, att, .3, .8, .5, hold=d) * v
def rhodes(d, m, v=1.):
    n = int((d + .8) * SR); tn = np.arange(n) / SR; f = mf(m)
    x = np.sin(2 * np.pi * f * tn) * np.exp(-tn / 1.6) + .35 * np.sin(2 * np.pi * f * 2 * tn) * np.exp(-tn / .35) + .12 * np.sin(2 * np.pi * f * 7.1 * tn) * np.exp(-tn / .04)
    return x * (1 + .15 * np.sin(2 * np.pi * 4.5 * tn)) * adsr(n, .003, .2, 1, .3, hold=d) * v
def vibes(d, m, v=1.):
    n = int(1.6 * SR); tn = np.arange(n) / SR; f = mf(m)
    x = np.sin(2 * np.pi * f * tn) * np.exp(-tn / .9) + .3 * np.sin(2 * np.pi * f * 4 * tn) * np.exp(-tn / .2) + .1 * np.sin(2 * np.pi * f * 10 * tn) * np.exp(-tn / .05)
    return x * (1 + .35 * np.sin(2 * np.pi * 5.5 * tn)) * v
def xylo(m, v=1.):
    n = int(.5 * SR); tn = np.arange(n) / SR; f = mf(m)
    return (np.sin(2 * np.pi * f * tn) * np.exp(-tn / .18) + .4 * np.sin(2 * np.pi * f * 3.93 * tn) * np.exp(-tn / .05) + .2 * hp(rng.standard_normal(n), 3000) * np.exp(-tn / .004)) * v
def ks(m, d=1.2, v=1., bright=.5):   # Karplus-Strong 尼龙弦
    n = int(d * SR); f = mf(m); L = int(SR / f); buf = lp(rng.standard_normal(L), 2000 + 4000 * bright); out = np.zeros(n)
    for i in range(n): out[i] = buf[i % L]; buf[i % L] = .5 * (buf[i % L] + buf[(i + 1) % L]) * .996
    return out * v
def tuba(t, d, m, v=1.):
    n = int((d + .08) * SR); tn = np.arange(n) / SR; f = mf(m) * (1 - .06 * np.exp(-tn / .03))
    ph = np.cumsum(f) / SR; x = saw(ph) + .5 * np.sin(2 * np.pi * ph)
    return lp(x, 700) * adsr(n, .02, .1, .7, .06, hold=d) * v
def wobble_lead(notes, v=1.):   # 果冻颤音主旋律：大幅快颤音
    return theremin(notes, glide=.04, vib=.7, rate=7.5, bright=.35, v=v)
def brass(d, ms, v=1.):
    n = int((d + .2) * SR); x = np.zeros(n)
    for m in ms:
        for dt in (-.1, .1): ph = np.cumsum(np.full(n, mf(m + dt))) / SR + rng.random(); x += saw(ph)
    e = adsr(n, .01, .15, .5, .15, hold=d); fe = 400 + 3200 * np.exp(-np.arange(n) / SR / .15)
    y = np.zeros(n)
    for i in range(0, n, 256): y[i:i + 256] = lp(x[max(0, i - 2048):i + 256], fe[i])[-len(x[i:i + 256]):]
    return y * e * v / len(ms)
def strings_trem(d, ms, v=1., rise=0):
    n = int(d * SR); x = np.zeros(n); tn = np.arange(n) / SR
    for m in ms:
        for dt in (-.12, 0, .12): ph = np.cumsum(mf(m + dt + rise * tn / d)) / SR + rng.random(); x += saw(ph)
    return lp(x, 2600) * (.55 + .45 * np.sin(2 * np.pi * 13 * tn)) * adsr(n, .08, .1, 1, .02, hold=d - .02) * v / len(ms)
# 鼓
def kick(v=1.):
    n = int(.4 * SR); tn = np.arange(n) / SR; f = 45 + 95 * np.exp(-tn / .04)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tn / .18) + .3 * hp(rng.standard_normal(n), 2000) * np.exp(-tn / .003)) * v
def snare(v=1.):
    n = int(.3 * SR); tn = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 1200, 7000) * np.exp(-tn / .07) * .8 + np.sin(2 * np.pi * 190 * tn) * np.exp(-tn / .04) * .6) * v
def hat(v=1., open_=False):
    n = int((.25 if open_ else .06) * SR); tn = np.arange(n) / SR
    return lp(hp(rng.standard_normal(n), 6500), 12000) * np.exp(-tn / (.08 if open_ else .012)) * v
def clap(v=1.):
    n = int(.25 * SR); tn = np.arange(n) / SR; e = sum(np.exp(-np.maximum(tn - k * .011, 0) / .006) * (tn >= k * .011) for k in range(3)) + .5 * np.exp(-tn / .08)
    return bp(rng.standard_normal(n), 900, 5000) * e * v
def crash(v=1., d=2.2):
    n = int(d * SR); tn = np.arange(n) / SR
    x = lp(hp(rng.standard_normal(n), 3500), 11000) * np.exp(-tn / .7) + .25 * sum(np.sin(2 * np.pi * f * tn) for f in (2523, 3811, 5123, 6579)) / 4 * np.exp(-tn / .4)
    return hp(x, 2500) * v
def tom(m=45, v=1.):
    n = int(.5 * SR); tn = np.arange(n) / SR; f = mf(m) * (1 + .5 * np.exp(-tn / .05))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tn / .2) * v
def brush(v=1., d=.18):
    n = int(d * SR); tn = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 9000) * np.sin(np.pi * tn / d) ** 1.5 * v
def ride(v=1.):
    n = int(.9 * SR); tn = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 3000, 9000) * np.exp(-tn / .3) * .8 + .12 * sum(np.sin(2 * np.pi * f * tn + 3 * np.sin(2 * np.pi * f * 1.41 * tn)) for f in (3150, 4870)) / 2 * np.exp(-tn / .25) + lp(hp(rng.standard_normal(n), 5000), 10000) * np.exp(-tn / .02) * .6
    return hp(x, 2500) * v
def rim(v=1.):
    n = int(.08 * SR); tn = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * tn) * np.exp(-tn / .012) + bp(rng.standard_normal(n), 2000, 6000) * np.exp(-tn / .004)) * v
def shaker(v=1.):
    n = int(.09 * SR); tn = np.arange(n) / SR
    return lp(hp(rng.standard_normal(n), 4500), 10000) * np.sin(np.pi * tn / .09) ** 2 * v
def noise_riser(d, v=1.):
    n = int(d * SR); x = rng.standard_normal(n); y = np.zeros(n)
    for i in range(0, n, 512):
        f = 300 * (8000 / 300) ** (i / n); y[i:i + 512] = bp(x[max(0, i - 4096):i + 512], f * .7, min(f * 1.4, 20000))[-len(x[i:i + 512]):]
    return y * (np.arange(n) / n) ** 2 * v
def rev_swell(d, ms, v=1.):
    x = pad(d, ms, 1, 3000, .02)[:int(d * SR)]; e = (np.arange(len(x)) / len(x)) ** 3; return x * e * v

# 节拍工具
def at(cue, beat): return CUE[cue]['t0'] + beat * BEAT
def swing(b, amt=.16): return b + (amt if (b * 2) % 2 == 1 else 0)

D, L, H, F = BUS['drums'], BUS['lead'], BUS['harm'], BUS['fx']; B = BUS['bass']

# ———————————————— riser：Vask 抬起遥控器 ————————————————
c = CUE['riser']; d = c['t1'] - c['t0']
t0, th = theremin([(c['t0'], d - .05, M('D3'))], glide=.9, vib=.5, rate=6.5); th *= np.linspace(.3, 1, len(th))
# 用长滑音：目标瞬间设到 A5，glide 很慢 → 一路滑上去
t0, th = theremin([(c['t0'], .05, M('D3')), (c['t0'] + .05, d - .1, M('A5'))], glide=.45, vib=.45, rate=6.2)
L.add(th * np.linspace(.25, .9, len(th)), t0, .5)
F.add(noise_riser(d, .5), c['t0'], .6)
BUS['lead'].cut(c['t1'], c['t1'] + .02)

# ———————————————— 主题：传送门炸开 + 片名 ————————————————
def theme_band(cue, bars, gain=1., melody=True, start_beat=0, drums=True):
    base = CUE[cue]['t0']; chords = [('D', [M('D3'), M('F3'), M('A3')], M('D2')), ('Bb', [M('Bb2'), M('D3'), M('F3')], M('Bb1')),
                                     ('Gm', [M('G2'), M('Bb2'), M('D3')], M('G1')), ('A7', [M('A2'), M('C#3'), M('E3'), M('G3')], M('A1'))]
    for bi in range(bars):
        name, ch, root = chords[bi % 4]; tb = base + bi * 4 * BEAT
        H.add(pad(4 * BEAT, [m + 12 for m in ch], .5, 1800, .05), tb, .55 * gain)
        for k in range(8):   # 八分音符贝斯：根音-根音-五度-八度
            m = [root, root, root + 7, root + 12, root, root, root + 7, root + 10][k]
            B.add(bass(0, .22, m, 1., 1100), tb + k * BEAT / 2, .55 * gain)
        for k in range(16):   # 16 分琶音
            m = (ch + [ch[0] + 12])[k % 4] + 24
            H.add(pluck(0, .09, m, 1., .25, 3000), tb + k * BEAT / 4, .12 * gain, pan=.35 * (1 if k % 2 else -1))
        if drums:
            for k in range(4):
                if k in (0, 2): D.add(kick(1), tb + k * BEAT, .9 * gain)
                if k in (1, 3): D.add(snare(1), tb + k * BEAT, .45 * gain); D.add(clap(1), tb + k * BEAT, .25 * gain)
            D.add(kick(.8), tb + 2.5 * BEAT, .7 * gain)
            for k in range(8): D.add(hat(1), tb + k * BEAT / 2, (.22 if k % 2 else .14) * gain, pan=.3)
THEME = [(0, 1, 'D5'), (1, .5, 'A4'), (1.5, .5, 'Bb4'), (2, 1, 'A4'), (3, 1, 'E4'), (4, .5, 'F4'), (4.5, .5, 'E4'), (5, .75, 'Eb4'), (5.75, 1.25, 'D4'),
         (8, 1, 'D5'), (9, .5, 'F5'), (9.5, .5, 'E5'), (10, 1, 'D5'), (11, 1, 'A4'), (12, 1.5, 'Bb4'), (13.5, .5, 'A4'), (14, 2, 'G4')]
def theme_melody(cue, beats_max, gain=1., octave=0):
    base = CUE[cue]['t0']; ns = [(base + b * BEAT, d * BEAT - .02, M(n) + octave) for b, d, n in THEME if b < beats_max]
    t0, x = theremin(ns); L.add(x, t0, .5 * gain, pan=-.1)
c = CUE['theme']
t0, sw = theremin([(c['pickup'], .1, M('A3')), (c['pickup'] + .1, .3, M('D5'))], glide=.12, vib=.5)
L.add(sw, t0, .45)
D.add(crash(1), c['t0'], .5); D.add(kick(1.2), c['t0'], .6)
theme_band('theme', 2, 1.0)
theme_melody('theme', 6, 1.0)
for b in BUS.values(): b.cut(c['t1'] - .01, c['t1'] + 3.0, .12)

# ———————————————— 果冻宇宙：摇摆大号 + 颤音主旋律（G 大调）————————————————
c = CUE['jelly']; base = c['t0']
t0, sl = theremin([(base, .05, M('G4')), (base + .05, .35, M('G6'))], glide=.12, vib=0, bright=.02)   # 滑哨
F.add(sl, t0, .3)
JB = [('G', M('G1'), [M('G3'), M('B3'), M('D4')]), ('C', M('C2'), [M('G3'), M('C4'), M('E4')]), ('D', M('D2'), [M('F#3'), M('A3'), M('D4')]), ('G', M('G1'), [M('G3'), M('B3'), M('D4')])]
nb = int((c['t1'] - base) / BEAT) + 1
for k in range(nb):
    ch = JB[(k // 4) % 4]; tb = at('jelly', swing(k * 1.0, 0))
    if k % 2 == 0: B.add(tuba(0, .3, ch[1] + (7 if k % 4 == 2 else 0)), tb, .9)
    else:
        for m in ch[2]: H.add(pluck(0, .12, m + 12, 1., .5, 2400), tb, .1, pan=.2)
        D.add(snare(.6), tb, .2); D.add(hat(1, True), tb, .08)
    D.add(hat(.8), tb + .25 + .06, .1, pan=-.3)
JM = [(1, .5, 'B4'), (1.5, .5, 'D5'), (2, 1, 'G5'), (3, .5, 'E5'), (3.5, .5, 'C5'), (4, 1, 'E5'), (5, .5, 'D5'), (5.5, .5, 'B4'), (6, 1, 'A4'), (7, .5, 'F#4'), (7.5, .5, 'A4'), (8, 1.5, 'G4')]
t0, jl = wobble_lead([(at('jelly', b), d * BEAT - .03, M(n)) for b, d, n in JM])
L.add(jl, t0, .42, pan=.1)
for b in BUS.values(): b.cut(c['t1'], c['t1'] + 3.2)   # 眼球眨眼：音乐硬切

# ———————————————— 马克杯宇宙：慵懒爵士（C 小调，刷子鼓）————————————————
c = CUE['mug']; base = c['t0']
MC = [([M('C3'), M('Eb3'), M('G3'), M('Bb3'), M('D4')], M('C2')), ([M('F2'), M('A2'), M('Eb3'), M('G3'), M('D4')], M('F1')),
      ([M('Bb2'), M('D3'), M('F3'), M('A3'), M('C4')], M('Bb1')), ([M('Eb3'), M('G3'), M('Bb3'), M('D4')], M('Eb2'))]
walk = [0, 3, 5, 6]
nb = int((c['t1'] - base) / BEAT) + 1
for k in range(nb):
    ch, root = MC[(k // 4) % 4]; tb = base + swing(k * 1.0, 0) * BEAT
    B.add(bass(0, .42, root + walk[k % 4] + 12, 1., 600), tb, .5)
    D.add(ride(.7), tb, .12, pan=.35)
    if k % 2 == 1: D.add(brush(1), tb - .05, .22, pan=-.2); D.add(ride(.5), tb + .33, .08, pan=.35)
    if k % 4 == 0 or k % 4 == 2.5: [H.add(vibes(1, m + 12, .5), tb + .02 * i, .09, pan=-.25) for i, m in enumerate(ch[1:])]
    if k % 4 == 2: [H.add(vibes(1, m + 12, .4), tb + .33 + .02 * i, .07, pan=-.25) for i, m in enumerate(ch[1:4])]
MM = [(1, .5, 'G4'), (1.5, .5, 'Bb4'), (2, 1.5, 'D5'), (4, .5, 'C5'), (4.5, .5, 'A4'), (5, 1.5, 'F4'), (8, .5, 'D5'), (8.5, .5, 'C5'), (9, 1, 'Bb4'), (10, 1, 'A4'), (12, .5, 'G4'), (12.5, .5, 'Bb4'), (13, 1.5, 'Eb5')]
for b, d, n in MM:
    if base + b * BEAT < c['t1'] - .2: H.add(vibes(d, M(n), 1), base + swing(b) * BEAT, .22, pan=.15)
for bb in BUS.values(): bb.cut(c['t1'] - .01, c['t1'] + 3.0, .1)

# ———————————————— 蒙太奇：四拍底鼓 + 每宇宙一个 stinger ————————————————
c = CUE['montage']; base = c['t0']
for k in range(int((c['t1'] - base) / BEAT)):
    tb = base + k * BEAT
    D.add(kick(1), tb, .8)
    for j in range(4): D.add(hat(1), tb + j * BEAT / 4, .12 if j % 2 else .07, pan=.3)
    for j in range(2): B.add(bass(0, .2, M('D2') + (0 if j == 0 else 12), 1., 1300), tb + j * BEAT / 2, .5)
    if k % 2 == 1: D.add(snare(1), tb, .35)
h = c['hits']
H.add(brass(.45, [M('D4'), M('Eb4'), M('Ab4'), M('A4')], 1.4), h[0], .55); D.add(tom(43, 1), h[0], .6); D.add(tom(38, 1), h[0] + .25, .5); D.add(crash(.8, 1.2), h[0], .35)
for i, n in enumerate(['G5', 'A5', 'B5', 'D6', 'E6', 'G6', 'A6', 'B6']): H.add(xylo(M(n), 1), h[1] + i * .055, .28, pan=-.4 + i * .1)
D.add(crash(.6, 1), h[1], .2)
H.add(rev_swell(.35, [M('D4'), M('A4'), M('D5')], 1), h[2] - .35, .5)
t0, ch3 = theremin([(h[2], .8, M('D5'))], vib=.6); L.add(ch3, t0, .35, pan=-.3)
t0, ch3 = theremin([(h[2], .8, M('A4'))], vib=.6, rate=5.1); L.add(ch3, t0, .3, pan=.3)
t0, ch3 = theremin([(h[2], .8, M('Eb4'))], vib=.6, rate=6.3); L.add(ch3, t0, .28)
for bb in BUS.values(): bb.cut(c['t1'] - .01, c['t1'] + 3.0, .1)

# ———————————————— 正常宇宙：电梯 bossa（F 大调）————————————————
c = CUE['muzak']; base = c['t0']
BC = [([M('F3'), M('A3'), M('C4'), M('E4')], M('F2')), ([M('G3'), M('Bb3'), M('D4'), M('F4')], M('G2')), ([M('E3'), M('G3'), M('Bb3'), M('C4')], M('C2')), ([M('F3'), M('A3'), M('C4'), M('E4')], M('F2'))]
nbars = int((c['t1'] - base) / 2) + 1
for bi in range(nbars):
    ch, root = BC[bi % 4]; tb = base + bi * 2
    for bt, m in [(0, root), (1.5, root + 7), (2, root), (3.5, root + 7)]: B.add(ks(m + 12, .6, 1, .2), tb + bt * BEAT, .4)
    for bt in [0.5, 1.5, 2.5, 3, 3.75]:
        for i, m in enumerate(ch): H.add(ks(m + 12, .5, 1, .45), tb + bt * BEAT + i * .008, .09, pan=.25)
    for bt in [1, 2.5, 3.5]: D.add(rim(1), tb + bt * BEAT, .12, pan=-.3)
    for j in range(8): D.add(shaker(1), tb + j * BEAT / 2, .07 if j % 2 else .045, pan=.4)
NM = [(0, 1.5, 'A4'), (1.5, .5, 'G4'), (2, 1, 'F4'), (3, 1, 'D4'), (4, 1.5, 'E4'), (5.5, .5, 'F4'), (6, 2, 'G4'), (8, 1.5, 'C5')]
for b, d, n in NM:
    if base + b * BEAT < c['t1'] - .1: H.add(rhodes(d * BEAT, M(n), 1), base + b * BEAT, .2, pan=-.1)
for bb in BUS.values(): bb.cut(c['t1'] - .01, c['t1'] + 3.0, .1)

# ———————————————— 回家喝一口：温暖的满足 ————————————————
c = CUE['bliss']; base = c['t0']; d = c['t1'] - base
H.add(pad(d, [M('D3'), M('F#3'), M('A3'), M('C#4'), M('E4')], 1, 2200, .5), base, .5)
for i, m in enumerate([M('D4'), M('F#4'), M('A4'), M('C#5'), M('E5'), M('A5')]): H.add(rhodes(1.2, m, 1), base + .1 + i * .18, .16, pan=-.3 + i * .12)
t0, ah = theremin([(base + .4, 1.0, M('F#5')), (base + 1.4, d - 1.5, M('A5'))], glide=.2, vib=.28, rate=5.2, bright=.06)
L.add(ah, t0, .3)
for bb in BUS.values(): bb.cut(c['t1'], c['t1'] + .7)   # 咖啡冒泡：音乐切断

# ———————————————— 惊慌：颤弓弦乐上升 → 硬切进冷场 ————————————————
c = CUE['panic']; base = c['t0']; d = c['t1'] - base
H.add(strings_trem(d, [M('E4'), M('F4'), M('Bb4'), M('B4')], 1, rise=4), base, .32)
for k in range(int(d / .25)): D.add(kick(.7), base + k * .25, .35 + .2 * k / (d / .25))
for bb in BUS.values(): bb.cut(c['t1'], c['t1'] + 5.3, .004)   # 冷场：全静

# ———————————————— 片尾：主题回归 → 片尾卡重音 ————————————————
c = CUE['finale']; base = c['t0']
pk = c['pickup']
t0, sw = theremin([(pk, .1, M('D4')), (pk + .15, base - pk - .2, M('D5'))], glide=.35, vib=.55)
L.add(sw * np.linspace(.4, 1, len(sw)), t0, .35)
for k in range(int((base - pk) / .0625)):   # 军鼓滚奏渐强
    D.add(snare(1), pk + .25 + k * .0625, .05 + .25 * (k * .0625 / (base - pk)))
D.add(crash(1), base, .45)
theme_band('finale', 1, 1.0)
theme_melody('finale', 4, 1.0)
hit = c['hit']
D.add(crash(1.2, 3.0), hit, .6); D.add(kick(1.3), hit, .9); D.add(tom(38, 1), hit, .6)
H.add(pad(2.6, [M('D3'), M('A3'), M('D4'), M('E4'), M('F4'), M('A4')], 1, 2600, .01), hit, .6)
H.add(brass(.9, [M('D4'), M('F4'), M('A4'), M('D5')], 1), hit, .4)
B.add(bass(0, 2.5, M('D2'), 1, 500), hit, .6)
t0, top = theremin([(hit, 2.2, M('D5'))], vib=.45, rate=5.5); L.add(top, t0, .45)
for k in range(12): H.add(pluck(0, .09, [M('D5'), M('F5'), M('A5'), M('D6')][k % 4], 1, .25, 2600), hit + .5 + k * .125, .1 * (1 - k / 12), pan=.4 * (1 if k % 2 else -1))
tb = hit + 3.0   # 结尾小按钮：嘀-嗒-嘀
t0, bt = theremin([(tb, .22, M('D5')), (tb + .25, .22, M('A4')), (tb + .5, .6, M('D5'))], glide=.03, vib=.3); L.add(bt, t0, .35)
D.add(tom(50, 1), tb + .5, .25)

# ———————————————— 混响 + 总线 ————————————————
def ir(d=2.0, decay=.45, lpf=5000, pre=.015):
    n = int(d * SR); tn = np.arange(n) / SR
    x = np.stack([lp(rng.standard_normal(n), lpf) * np.exp(-tn / decay), lp(rng.standard_normal(n), lpf) * np.exp(-tn / decay)], 1)
    x[:int(pre * SR)] = 0; return x / np.sqrt((x ** 2).sum(0))
def spring_ir(d=1.2):   # 弹簧混响：带一点色散的"嘣"
    n = int(d * SR); tn = np.arange(n) / SR; ch = np.sin(2 * np.pi * (1800 * tn - 700 * tn ** 2)) * np.exp(-tn / .05) * .3
    x = np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1) * np.exp(-tn / .35)[:, None]; x[:, 0] += ch; x[:, 1] += np.roll(ch, 300)
    x = np.stack([bp(x[:, 0], 300, 4500), bp(x[:, 1], 300, 4500)], 1); x[:int(.02 * SR)] = 0; return x / np.sqrt((x ** 2).sum(0))
def conv(x, h): return np.stack([fftconvolve(x[:, c], h[:, c])[:N] for c in range(2)], 1)
room, spr = ir(), spring_ir()
send = {'drums': .08, 'bass': .0, 'lead': .28, 'harm': .22, 'fx': .2}
dry = sum(b.b for b in BUS.values())
wet = conv(sum(BUS[k].b * send[k] for k in ['drums', 'harm', 'fx']), room) * .9 + conv(BUS['lead'].b * send['lead'], spr) * 1.1
out = dry + wet
# 冷场与硬切要真静：把混响尾巴也切掉
for c0, c1 in [(CUE['jelly']['t1'], CUE['jelly']['t1'] + 3.0), (CUE['bliss']['t1'], CUE['bliss']['t1'] + .6), (CUE['panic']['t1'], CUE['panic']['t1'] + 5.2)]:
    a, b = int(c0 * SR), int(c1 * SR); out[a:b] = 0
    f = int(.01 * SR); out[a - f:a] *= np.linspace(1, 0, f)[:, None]
# 各 cue 相对电平（主题段乐器最满，其余段落补一点）
CUE_GAIN = {'jelly': 1.6, 'mug': 1.9, 'montage': 1.1, 'muzak': 1.4, 'bliss': 1.35}
gain = np.ones(N)
for k, gk in CUE_GAIN.items():
    a0, a1 = int(CUE[k]['t0'] * SR), min(N, int((CUE[k]['t1'] + .8) * SR)); f = int(.01 * SR)
    gain[a0:a1] = gk
gain = np.convolve(gain, np.ones(480) / 480, mode='same'); out *= gain[:, None]
# 低频整理 + 轻压缩
out = np.stack([hp(out[:, c], 30) for c in range(2)], 1)
pk = np.abs(out).max(); out = out / pk * .89
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
for k, b in BUS.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), (b.b / pk * .89).astype(np.float32), SR)
sf.write(os.path.join(HERE, 'score.wav'), out.astype(np.float32), SR)
# 频段能量自检（低频不能独大）
X = np.abs(np.fft.rfft(out.mean(1))) ** 2; fr = np.fft.rfftfreq(N, 1 / SR); tot = X.sum()
for a, b in [(20, 120), (120, 500), (500, 2000), (2000, 8000), (8000, 20000)]: print(f'{a:>5}-{b:<5} Hz  {10 * np.log10(X[(fr >= a) & (fr < b)].sum() / tot):6.1f} dB')
print('score.wav', DUR, 's  peak norm', round(pk, 3))
