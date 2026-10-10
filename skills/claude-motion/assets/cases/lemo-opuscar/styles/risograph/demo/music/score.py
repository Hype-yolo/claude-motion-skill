"""《Sunday Ride》原创配乐 —— 轻快 bossa nova，120 BPM，D 大调，40.000 s
一键生成：.venv/bin/python styles/risograph/demo/music/score.py
产物：music/score.wav（立体声 48k，峰值 −3 dBFS）、music/stems/*.wav、music/score.json

全部 numpy/numba 合成（core/audio/INSTRUMENTS.md 未就绪时的约定做法）：
  尼龙弦吉他 / 低音提琴 = 扩展 Karplus-Strong 波导（分数延迟全通 + 单极点损耗 + 拨弦位置梳状 + 琴体共鸣峰）
  颤音琴 = 模态合成（1 : 3.93 : 9.9 分音 + 马达颤音）
  口哨 = 正弦 + 少量二次谐波 + 气声窄带噪声 + 滑音/延迟揉音
  沙锤 / 边击 / 刷子 / 软底鼓 / 吊镲 = 滤波噪声 + 阻尼正弦
"音乐也叠版"：吉他(蓝版) → +打击(黄版) → +贝斯+口哨(粉版) → +颤音琴(全版) → 26–28 全停 → 回来 → 逐件撤。
"""
import os, sys, json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, lfilter
from numba import njit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT); sys.path.insert(0, HERE)
from core.audio.sfx import SR
from bell import bell

BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT; DUR = 40.0
N = int(DUR * SR)
rng = np.random.default_rng(20260925)


def mhz(m): return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def M(s):
    """'F#4' → midi"""
    p = NOTE[s[0]]; i = 1
    while i < len(s) and s[i] in '#b': p += 1 if s[i] == '#' else -1; i += 1
    return 12 * (int(s[i:]) + 1) + p


def sos_bp(x, f, q):
    bw = f / q; lo, hi = max(20, f - bw / 2), min(SR / 2 - 100, f + bw / 2)
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)


def peak(x, f, gain_db, q):
    """RBJ 峰值 EQ（琴体共鸣）"""
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x)


# ───────── 波导弦 ─────────
@njit(cache=True)
def _ks(exc, n, Nd, c, g, a):
    L = Nd + 4
    buf = np.zeros(L); y = np.zeros(n)
    w = 0; s = 0.0; apx = 0.0; apy = 0.0
    for i in range(n):
        r = (w - Nd) % L
        v = buf[r]
        s = (1 - a) * v + a * s                     # 单极点低通（频率相关损耗）
        o = c * s + apx - c * apy                    # 一阶全通（分数延迟）
        apx = s; apy = o
        x = (exc[i] if i < exc.shape[0] else 0.0) + g * o
        buf[w] = x; y[i] = x
        w = (w + 1) % L
    return y


def string(m, dur, vel=.8, t60=3.0, damp=.35, pos=.15, bright=.5, cents=0.0):
    f0 = mhz(m + cents / 100); P = SR / f0
    a = damp * (1 - bright * .5)
    lpd = a / (1 - a)                                 # 低通在低频的相位延迟（样本）
    tot = P - lpd; Nd = int(np.floor(tot - .15)); d = tot - Nd
    if d < .15: Nd -= 1; d += 1
    c = (1 - d) / (1 + d)
    g = 10 ** (-3 / (f0 * t60))
    n = int(dur * SR)
    L = max(8, int(P))
    ex = rng.standard_normal(L)
    ex = lp(ex, 800 + 5000 * bright * vel, 1)
    ex *= np.hanning(L) ** .5
    k = int(pos * L); ex = ex - np.concatenate([np.zeros(k), ex[:L - k]])  # 拨弦位置梳状
    ex *= vel / (np.abs(ex).max() + 1e-9)
    return _ks(ex.astype(np.float64), n, Nd, c, g, a)


def rel_env(n, hold, rel=.06):
    e = np.ones(n); h = int(hold * SR); r = int(rel * SR)
    if h < n:
        e[h:h + r] = np.linspace(1, 0, min(r, n - h)) if h + r <= n else np.linspace(1, 0, r)[:n - h]
        e[h + r:] = 0
    return e


def guitar_note(m, hold, vel=.7, bright=.45, t60=3.2):
    n = int(min(hold + .5, 4.5) * SR)
    y = string(m, n / SR, vel, t60=t60, damp=.42, pos=.14 + rng.random() * .03, bright=bright, cents=rng.normal(0, 2))
    return y * rel_env(n, hold, .09)


def guitar_body(x):
    x = peak(x, 102, 5, 1.2); x = peak(x, 205, 4, 1.4); x = peak(x, 400, 2, 1.5)
    x = lp(x, 5200, 2); x = hp(x, 70, 2)
    return x


def bass_note(m, hold, vel=.8):
    n = int(min(hold + .4, 3) * SR)
    y = string(m, n / SR, vel, t60=1.6, damp=.6, pos=.27, bright=.25, cents=rng.normal(0, 3))
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * mhz(m) * t) * np.exp(-t / .12) * .5 * vel     # 指腹的低频
    fn = lp(rng.standard_normal(n), 900) * np.exp(-t / .006) * .25 * vel        # 拨弦噪声
    return (y + thump + fn) * rel_env(n, hold, .07)


# ───────── 颤音琴（模态）─────────
def vibe_note(m, hold, vel=.7, motor=5.6, pedal=.6, rel=.25):
    f = mhz(m); ring = min(hold + 1.8, 4.0)
    n = int(ring * SR); t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.9) +
         .28 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / .45) +
         .10 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t / .12) * (f * 9.9 < 16000))
    mallet = lp(rng.standard_normal(n), 2500) * np.exp(-t / .004) * .15
    trem = 1 - .28 * (.5 + .5 * np.sin(2 * np.pi * motor * t + rng.random() * 6))
    y = (y * trem + mallet) * vel
    return y * rel_env(n, hold + pedal, rel)       # 踏板：延音到 hold + pedal 再阻尼


# ───────── 口哨 ─────────
def whistle_line(notes, n_total):
    """notes = [(t0, dur, midi, vel, trill)] 连续一条线：滑音、揉音、气声"""
    f = np.zeros(n_total); amp = np.zeros(n_total)
    prev = None
    for (t0, d, m, v, tr) in notes:
        i0, i1 = int(t0 * SR), int((t0 + d) * SR)
        tt = np.arange(i1 - i0) / SR
        base = m - .6 * np.exp(-tt / .035)                                       # 起音微微往上"兜"
        if prev is not None and abs(prev[0] + prev[1] - t0) < .035:               # 连音：滑过去
            base = base + (prev[2] - m) * np.exp(-tt / .03)
        vibd = .18 * np.clip((tt - .18) / .25, 0, 1)                            # 延迟揉音
        base = base + vibd * np.sin(2 * np.pi * 5.4 * tt)
        if tr: base = base + np.where(tt < tr, 1.0 * (np.sin(2 * np.pi * 14 * tt) > 0), 0)   # 颤音（上方二度）
        f[i0:i1] = mhz(base)
        a = np.minimum(1, tt / .03) * np.minimum(1, (d - tt) / .05) * v
        amp[i0:i1] = np.maximum(amp[i0:i1], a)
        prev = (t0, d, m)
    f[f == 0] = 800
    ph = 2 * np.pi * np.cumsum(f) / SR
    amp = lp(amp, 40, 1)
    y = np.sin(ph) + .06 * np.sin(2 * ph) + .02 * np.sin(3 * ph)
    breath = sos_bp(rng.standard_normal(n_total), 2400, 1.5) * .05 + sos_bp(rng.standard_normal(n_total), 1200, 4) * .03
    return (y + breath) * amp


# ───────── 打击 ─────────
def shaker(v=1.0):
    d = .09; n = int(d * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = sos_bp(x, 5200, 1.1); x = lp(x, 9000, 2)
    e = np.minimum(1, t / .008) * np.exp(-np.maximum(0, t - .008) / .03)
    return x * e * v


def rim(v=1.0, big=False):
    d = .12; n = int(d * SR); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * 1750 * t) * np.exp(-t / .018) + .6 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / .03)
         + .35 * np.sin(2 * np.pi * 380 * t) * np.exp(-t / .04))
    x += hp(rng.standard_normal(n), 2000) * np.exp(-t / .002) * .8
    if big: x += np.sin(2 * np.pi * 540 * t) * np.exp(-t / .06) * .8   # 木质"咔"
    return lp(x, 8500) * v


def brush(v=1.0, d=.22):
    n = int(d * SR); t = np.arange(n) / SR
    x = lp(hp(rng.standard_normal(n), 1500), 7000)
    e = np.sin(np.pi * np.minimum(1, t / d)) ** 1.5
    return x * e * v


def kick(v=1.0):
    d = .25; n = int(d * SR); t = np.arange(n) / SR
    f = 62 + 40 * np.exp(-t / .02)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .09) + lp(rng.standard_normal(n), 400) * np.exp(-t / .01) * .3) * v


def cymbal(v=1.0, d=1.8, swell=0.0):
    n = int(d * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = sos_bp(x, 6000, .8) * .7 + sos_bp(rng.standard_normal(n), 3500, 2) * .4
    x = lp(x, 9500, 4)
    if swell > 0:
        e = (t / d) ** 2.2
    else:
        e = np.exp(-t / (d * .35)) * np.minimum(1, t / .003)
    return x * e * v


def brush_roll(t0, t1, v=1.0):
    d = t1 - t0; n = int(d * SR); t = np.arange(n) / SR
    x = lp(hp(rng.standard_normal(n), 1200), 7500)
    mod = .6 + .4 * np.abs(np.sin(2 * np.pi * 8 * t))
    return x * mod * (t / d) ** 1.8 * v


# ───────── 编曲数据 ─────────
# 和弦：(低音 midi, 上方音)
CH = {
    'Dmaj9': ('D3', ['F#3', 'C#4', 'E4']), 'Em9': ('E2', ['G3', 'D4', 'F#4']), 'A13': ('A2', ['G3', 'C#4', 'F#4']),
    'F#m7': ('F#2', ['E3', 'A3', 'C#4']), 'B7b9': ('B2', ['D#3', 'A3', 'C4']), 'Bm9': ('B2', ['D3', 'A3', 'C#4']),
    'E9': ('E2', ['G#3', 'D4', 'F#4']), 'A7sus': ('A2', ['G3', 'D4', 'E4']), 'Gmaj7': ('G2', ['F#3', 'B3', 'D4']),
    'Gm6': ('G2', ['A#3', 'D4', 'E4']), 'B7': ('B2', ['A3', 'D#4', 'F#4']), 'Gmaj9': ('G2', ['F#3', 'A3', 'B3']),
}
# 每小节两半（小节号从 1 开始；bar b 起点 = (b-1)*2 s）
PROG = {2: ('Dmaj9', 'Dmaj9'), 3: ('Em9', 'A13'), 4: ('F#m7', 'B7b9'), 5: ('Em9', 'A13'), 6: ('Dmaj9', 'Dmaj9'),
        7: ('Bm9', 'E9'), 8: ('Em9', 'A7sus'), 9: ('Dmaj9', 'Dmaj9'), 10: ('Gmaj7', 'Gm6'), 11: ('F#m7', 'B7'),
        12: ('Em9', 'A13'), 13: ('Dmaj9', 'Bm9'), 15: ('Gmaj9', 'F#m7'), 16: ('Em9', 'A13'), 17: ('Dmaj9', 'Bm9'),
        18: ('Em9', 'A13')}


def bar_t(b): return (b - 1) * BAR


def chord_at(b, eighth):
    c = PROG.get(b)
    if not c: return None
    return c[0] if eighth < 4 else c[1]


def in_break(t): return 26.0 - 1e-6 <= t < 28.0


class Bus:
    def __init__(self, name, send, pan):
        self.name, self.send, self.pan = name, send, pan
        self.x = np.zeros(N + SR * 5)

    def add(self, y, t, gain=1.0):
        i = int(round(t * SR))
        if i < 0: y = y[-i:]; i = 0
        m = min(len(y), len(self.x) - i)
        if m > 0: self.x[i:i + m] += y[:m] * gain


GTR = Bus('guitar', .16, -.22)
BAS = Bus('bass', .05, 0.0)
PRC = Bus('perc', .10, .25)
WHI = Bus('whistle', .28, .12)
VIB = Bus('vibes', .30, .32)
BEL = Bus('bell', .20, .3)
cues = {}


def hum(): return rng.normal(0, .006)   # 人手时值误差


# ── 吉他 ──
def guitar():
    # 1.5 弱起：A3 → C#4（引向 2.0 的 Dmaj9）
    GTR.add(guitar_note(M('A3'), .22, .45), 1.5)
    GTR.add(guitar_note(M('C#4'), .4, .5), 1.75)
    for b in range(2, 19):
        if b == 14: continue
        t0 = bar_t(b); cyc = (b - 2) % 2          # 0 = A 小节，1 = B 小节
        # 拇指低音：第 1 拍根音、第 3 拍五度（或第二个和弦的根音）
        c1, c2 = PROG[b]
        r1 = M(CH[c1][0]); r2 = M(CH[c2][0])
        # 低音不低于 D2
        bn1 = r1 if r1 >= M('D2') else r1 + 12
        bn2 = (r2 if c2 != c1 else r1 + 7)
        if bn2 > M('A3'): bn2 -= 12
        vb = .85 if b == 2 else .7
        GTR.add(guitar_note(bn1, .85, vb, .35), t0 + hum())
        GTR.add(guitar_note(bn2, .85, .62, .35), t0 + 2 * BEAT + hum())
        # 手指和弦：A 小节 [0,3,6]，B 小节 [2,5]（八分位置）
        pos = [0, 3, 6] if cyc == 0 else [2, 5]
        if b in (4, 8, 12, 16):                  # 每四小节的第四小节加一个推进
            pos = [2, 5, 7]
        for p in pos:
            ch = chord_at(b, p if p != 3 else 3)
            if p == 7 and b + 1 in PROG: ch = PROG[b + 1][0]   # 反拍预示下一小节
            up = CH[ch][1]
            hold = .42 if p in (0, 3) else .3
            v = (.62 if p else .7) * (1.15 if (b == 2 and p == 0) else 1)
            for k, nm in enumerate(up):
                GTR.add(guitar_note(M(nm), hold, v * (.9 + .1 * k), .5), t0 + p * BEAT / 2 + k * .006 + hum())
    # 36.0 最终和弦 Dmaj9（慢扫，长延音）+ 37.0 泛音
    fin = ['D2', 'A2', 'F#3', 'C#4', 'E4', 'A4']
    for k, nm in enumerate(fin):
        GTR.add(guitar_note(M(nm), 3.4, .72, .45, t60=9.0), 36.0 + k * .028)
    GTR.add(guitar_note(M('E5'), 2.4, .35, .8, t60=4.0) * .7, 37.0)
    cues['guitar'] = {'in': 1.5, 'out': 40.0, 'first_chord': 2.0, 'final_chord': 36.0}


# ── 低音提琴 ──
def bass():
    for b in range(9, 18):
        if b == 14: continue
        t0 = bar_t(b); c1, c2 = PROG[b]
        r1 = M(CH[c1][0]); r2 = M(CH[c2][0])
        r1 = r1 - 12 if r1 >= M('C3') else r1
        r2 = r2 - 12 if r2 >= M('C3') else r2
        f1 = r1 + 7 if c1 == c2 else r2
        nxt = PROG.get(b + 1) or PROG.get(b + 2)
        nr = M(CH[nxt[0]][0]) if nxt else r1
        nr = nr - 12 if nr >= M('C3') else nr
        appr = nr - 1 if (b % 2) else nr + 7 - 12 if nr + 7 - 12 > M('E1') else nr + 7
        pat = [(0, 1.4, r1, .9), (1.5, .45, r1 + 7 if c1 == c2 else r1, .6), (2, 1.4, f1, .8), (3.5, .45, appr, .6)]
        if b == 17: pat = [(0, 1.4, r1, .85), (1.5, .45, r1 + 7, .55), (2, 1.9, r2 if r2 else r1, .75)]  # 34.0 干净收尾
        if b == 13: pat = [(0, 1.4, r1, 1.0), (1.5, .45, r1 + 7, .65), (2, 1.4, r2, .85), (3.5, .4, r2 + 7, .6)]
        for (bt, d, m, v) in pat:
            hold = d * BEAT
            if b == 17 and bt == 2: hold = 2 * BEAT - .03        # 结束在 34.0
            if b == 13 and bt == 3.5: hold = .22                # 26.0 前收住
            BAS.add(bass_note(m, hold, v), t0 + bt * BEAT + hum())
    cues['bass'] = {'in': 16.0, 'out': 34.0}


# ── 打击 ──
def perc():
    acc = [.5, .28, .9, .33]
    t = 8.0
    while t < 35.0 - 1e-6:
        k = int(round((t - 8.0) / (BEAT / 4))) % 4
        if not in_break(t) and not (25.9 < t < 26.0):
            lvl = .55 if t < 16 else .7
            PRC.add(shaker(acc[k] * lvl), t + hum() * .5)
        t += BEAT / 4
    # bossa clave（两小节循环，八分位置）
    clave = [0, 3, 6, 10, 13]
    for cyc0 in np.arange(8.0, 35.0, 2 * BAR):
        for p in clave:
            tt = cyc0 + p * BEAT / 2
            if tt >= 35.0 - 1e-6 or in_break(tt): continue
            big = abs(tt - 12.0) < 1e-6
            PRC.add(rim(1.25 if big else .55, big), tt + (0 if big else hum() * .5))
    if True:  # 12.0 的"接住"重音再补一层
        PRC.add(kick(.5), 12.0)
    # 刷子：第 2、4 拍（8–16 极轻，16 起正常）
    for b in range(5, 18 + 1):
        for bt in (1, 3):
            tt = bar_t(b) + bt * BEAT
            if tt >= 35.0 or in_break(tt) or tt < 8.0: continue
            PRC.add(brush(.16 if tt < 16 else .3), tt - .05)
    # 软底鼓：跟贝斯（16 起），第 1 拍与 2&
    for b in range(9, 18 + 1):
        for bt in (0, 1.5, 2):
            tt = bar_t(b) + bt * BEAT
            if tt >= 35.0 or in_break(tt): continue
            PRC.add(kick(.55 if bt == 0 else .35), tt)
    # 23–24 刷子滚奏 + 吊镲渐强 → 24.0 镲；28.0 镲
    PRC.add(brush_roll(23.0, 24.0, .35), 23.0)
    PRC.add(cymbal(.28, 1.0, swell=1), 23.0)
    PRC.add(cymbal(.3, 1.9), 24.0); PRC.add(kick(.8), 24.0)
    PRC.add(cymbal(.32, 1.9), 28.0); PRC.add(kick(.85), 28.0)
    # 车铃当打击乐：15.5 一声极轻
    BEL.add(bell(single=True, seed=4) * .22, 15.5)
    cues['perc'] = {'in': 8.0, 'out': 35.0, 'accent_catch': 12.0, 'roll': [23.0, 24.0], 'cymbal': [24.0, 28.0], 'bell_tick': 15.5}


# ── 颤音琴 ──
def vibes():
    def chordv(names, t, hold, v=.5):
        for k, nm in enumerate(names): VIB.add(vibe_note(M(nm), hold, v * (.9 + .05 * k)), t + k * .012)
    chordv(['F#4', 'A4', 'C#5', 'E5'], 24.0, 1.0, .6)            # 24.0 全版重拍
    chordv(['D4', 'F#4', 'A4', 'C#5'], 25.0, .55, .42)
    chordv(['F#4', 'A4', 'B4', 'D5'], 28.0, .8, .58)              # 28.0 回来
    chordv(['E4', 'A4', 'C#5'], 29.0, .7, .3)                     # 旁白下退让
    chordv(['D4', 'G4', 'B4'], 30.0, .4, .3)
    # 30.5–32.0 与口哨三度和声（口哨下方三度）
    th = [(30.5, .25, 'G5'), (30.75, .25, 'A5'), (31.0, .5, 'C#6'), (31.5, .25, 'B5'), (31.75, .2, 'A5')]
    for t, d, nm in th: VIB.add(vibe_note(M(nm) - 12, d, .5, pedal=.02, rel=.06), t)
    cues['vibes'] = {'in': 24.0, 'out': 32.0}


# ── 口哨 ──
def whistle():
    b = 0.5  # 1 拍
    W = []
    def ph(t0, seq):  # seq: [(beats, note, vel, trill)]
        t = t0
        for d, nm, *rest in seq:
            v = rest[0] if rest else .8; tr = rest[1] if len(rest) > 1 else 0
            if nm: W.append((t, d * b - .02, M(nm), v, tr))
            t += d * b
    # 16.0 主题（粉版进）
    ph(16.0, [(1.5, 'A5'), (.5, 'F#5'), (.5, 'E5', .7), (1.0, 'F#5'), (.5, 'A5'),
              (1.5, 'B5'), (.5, 'A5', .7), (.5, 'G5', .7), (1.0, 'A#5'), (.5, 'A5', .7)])
    # 20.0 鸽群起飞：上行快速音阶 + 颤音
    ph(20.0, [(.25, 'D5', .6), (.25, 'E5', .65), (.25, 'F#5', .7), (.25, 'A5', .75), (1.0, 'C#6', .9, .35),
              (.5, 'B5', .75), (.5, 'A5', .7), (.5, 'F#5', .65), (.4, 'E5', .6)])      # 21.7 前收
    # 24.75 小句（旁白 24.7 结束后）
    ph(24.75, [(.5, 'A5', .7), (.5, 'B5', .75), (1.0, 'D6', .85), (.45, 'C#6', .7)])
    # 30.5 旋律高点（与颤音琴三度）→ 32.0 落 D6 → 33.0 收
    ph(30.5, [(.5, 'B5', .8), (.5, 'C#6', .85), (1.0, 'E6', .95), (.5, 'D6', .85), (.4, 'C#6', .8)])
    ph(32.0, [(1.5, 'D6', .7), (.44, 'A5', .5)])
    y = whistle_line(W, len(WHI.x))
    WHI.add(y, 0.0)
    cues['whistle'] = {'in': 16.0, 'out': 33.0, 'trill': 20.0, 'phrases': [[16.0, 21.7], [24.75, 26.0], [30.5, 33.0]]}


# ───────── 混音 ─────────
def reverb_ir(rt=.9, seed=1):
    r = np.random.default_rng(seed); n = int(rt * 1.2 * SR); t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for ch in range(2):
        x = r.standard_normal(n) * np.exp(-t * 6.9 / rt)
        x = lp(x, 5500, 2); x[:int(.012 * SR)] = 0
        ir[:, ch] = x
    return ir / np.sqrt((ir ** 2).sum(0).mean())


def pan2(x, p):
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def gate_env():
    e = np.ones(N)
    i26, i28 = int(26.0 * SR), int(28.0 * SR)
    f = int(.025 * SR)
    e[i26:i26 + f] = np.linspace(1, 0, f); e[i26 + f:i28] = 0
    i39 = int(39.0 * SR); e[i39:] = np.linspace(1, 0, N - i39) ** 1.5
    e[-1] = 0
    return e


def main():
    guitar(); bass(); perc(); vibes(); whistle()
    GTR.x = guitar_body(GTR.x)
    BAS.x = lp(peak(BAS.x, 90, 3, 1.0), 1800)
    WHI.x = hp(WHI.x, 400)
    ir = reverb_ir()
    g = gate_env()
    levels = {'guitar': .6, 'bass': .6, 'perc': .5, 'whistle': .15, 'vibes': .11, 'bell': .5}
    stems = {}
    for bus in (GTR, BAS, PRC, WHI, VIB, BEL):
        dry = bus.x[:N] * levels[bus.name]
        st = pan2(dry, bus.pan)
        wet = np.stack([fftconvolve(dry * bus.send, ir[:, c])[:N] for c in range(2)], 1)
        s = (st + wet) * g[:, None]
        stems[bus.name] = s
    mix = sum(stems.values())
    pk = np.abs(mix).max(); k = 10 ** (-3 / 20) / pk
    os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
    for nm, s in stems.items(): sf.write(os.path.join(HERE, 'stems', nm + '.wav'), (s * k).astype(np.float32), SR)
    mix *= k
    sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR)
    # 自检
    def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    table = []
    for s in range(40):
        a, b_ = s * SR, (s + 1) * SR
        row = {'t': s, 'mix': round(rms_db(mix[a:b_]), 1)}
        for nm, st in stems.items(): row[nm] = round(rms_db(st[a:b_] * k), 1)
        table.append(row)
    bands = {}
    from scipy.signal import welch
    for sec, (a, b_) in {'2-8': (2, 8), '8-16': (8, 16), '16-24': (16, 24), '28-32': (28, 32)}.items():
        f, P = welch(mix[a * SR:b_ * SR].mean(1), SR, nperseg=8192)
        tot = P.sum()
        bands[sec] = {k2: round(10 * np.log10(P[(f >= lo) & (f < hi)].sum() / tot + 1e-12), 1)
                      for k2, (lo, hi) in {'0-250': (0, 250), '250-2k': (250, 2000), '2k-8k': (2000, 8000), '8k-20k': (8000, 20000)}.items()}
    brk = mix[int(26.03 * SR):int(27.99 * SR)]
    info = {'bpm': BPM, 'key': 'D major', 'dur': DUR, 'sr': SR, 'backend': 'numpy/numba synthesis (INSTRUMENTS.md not READY)',
            'sections': [[0, 2, 'silence + pickup 1.5'], [2, 8, 'guitar'], [8, 16, '+perc'], [16, 24, '+bass +whistle'],
                         [24, 26, 'tutti +vibes'], [26, 28, 'BREAK silence'], [28, 32, 'tutti'], [32, 36, 'strip down'], [36, 40, 'guitar final chord, fade 39-40']],
            'instruments': cues,
            'hits': {'title_chord': 2.0, 'plate2_perc_in': 8.0, 'catch_accent': 12.0, 'plate3_bass_in': 16.0, 'pigeon_trill': 20.0,
                     'roll': [23.0, 24.0], 'tutti_vibes': 24.0, 'break': [26.0, 28.0], 'return': 28.0, 'vibes_out': 32.0,
                     'whistle_out': 33.0, 'bass_out': 34.0, 'perc_out': 35.0, 'final_chord': 36.0, 'fade': [39.0, 40.0]},
            'check': {'break_peak': float(np.abs(brk).max()), 'peak_dbfs': round(20 * np.log10(np.abs(mix).max()), 2), 'bands_db_rel': bands, 'rms_per_sec': table}}
    json.dump(info, open(os.path.join(HERE, 'score.json'), 'w'), indent=1, ensure_ascii=False)
    print('peak', info['check']['peak_dbfs'], 'break_peak', info['check']['break_peak'])
    print('t   mix   ' + '  '.join(f'{nm[:5]:>6}' for nm in stems))
    for r in table: print(f"{r['t']:2d} {r['mix']:6.1f} " + '  '.join(f"{r[nm]:6.1f}" for nm in stems))
    print(json.dumps(bands, indent=0))


if __name__ == '__main__':
    main()
