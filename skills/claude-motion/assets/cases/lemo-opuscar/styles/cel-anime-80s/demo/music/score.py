# -*- coding: utf-8 -*-
"""City Lights, 1987 — 原创 city pop / 合成器放克配乐（numpy + numba 从零合成）

运行：.venv/bin/python styles/cel-anime-80s/demo/music/score.py
输出：score.wav（48k 立体声 float，正好 59.0 s）、stems/*.wav、score.json

116 BPM，4/4，E♭ 大调 → 第 22 小节升半音到 E 大调。结构与 demo/story.js 的镜头一一对齐：
  bar 0–4   前奏（弦乐垫 + FM 电钢分解和弦 + FM 钟预示副歌动机）
  bar 4     过门：低音上行 + 噪声 riser + 门限混响嗵鼓（后两拍）
  bar 5–7   片名：铜管齐奏 riff（片名重音 = bar 5 第一拍）
  bar 7–13  主歌律动：slap 贝斯 + 电钢 + 合唱切音吉他 + 鼓 + 柔和主旋律
  bar 13–16 预副歌：上行和弦、铜管渐强、军鼓滚奏；bar 15 第 4 拍 → bar 16 全静音
  bar 16–21 副歌（王道进行 IVM9–V13–iii9–vi9），bar 18 落地重音
  bar 21    卡带/收音机音质（带通 + wow/flutter + 嘶声）
  bar 22–26 升调最后副歌（E 大调），bar 24–25 稍收给台词
  bar 26    结束和弦 EM9 + 铜管最后一击 + FM 钟琶音，余韵到 59.0 s
"""
import os, json, numpy as np, soundfile as sf
from numba import njit
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
BPM = 116
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = 59.0
N = int(round(DUR * SR))
rng = np.random.default_rng(1987)


def T(bar, beat=0.0): return (bar * 4 + beat) * BEAT


CUT0, CUT1 = T(15, 3), T(16)          # 全静音
LOFI0, LOFI1 = T(21), T(22)           # 卡带音质
KEY_UP = 22                           # 从这一小节起升半音


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def ts(n): return np.arange(n) / SR
def noise(n): return rng.standard_normal(n)


def _sos(kind, f, o): return butter(o, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return sosfilt(_sos('low', f, o), x, axis=0)
def hp(x, f, o=2): return sosfilt(_sos('high', f, o), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(_sos('band', [lo, hi], o), x, axis=0)


# ───────────────────────── DSP 内核（numba） ─────────────────────────
@njit(cache=True)
def svf(x, fc, res, mode):
    """TPT 状态变量滤波器，逐样本截止频率。mode 0=低通 1=带通 2=高通"""
    n = x.shape[0]; y = np.empty(n); ic1 = 0.0; ic2 = 0.0; k = 1.0 / res
    for i in range(n):
        f = fc[i]
        if f > 20000.0: f = 20000.0
        if f < 20.0: f = 20.0
        g = np.tan(np.pi * f / 48000.0)
        a1 = 1.0 / (1.0 + g * (g + k)); a2 = g * a1; a3 = g * a2
        v3 = x[i] - ic2; v1 = a1 * ic1 + a2 * v3; v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
        if mode == 0: y[i] = v2
        elif mode == 1: y[i] = v1
        else: y[i] = x[i] - k * v1 - v2
    return y


@njit(cache=True)
def ks_loop(exc, L, P, damp, bright):
    """Karplus-Strong：延迟 P 的环路 + 可调亮度的平均滤波"""
    y = np.zeros(L)
    for i in range(L):
        v = exc[i] if i < exc.shape[0] else 0.0
        if i > P:
            v += damp * (bright * y[i - P] + (1 - bright) * 0.5 * (y[i - P] + y[i - P - 1]))
        elif i == P:
            v += damp * y[0]
        y[i] = v
    return y


@njit(cache=True)
def env_follow(x, att, rel):
    n = x.shape[0]; e = np.empty(n); s = 0.0
    a = np.exp(-1.0 / (att * 48000.0)); r = np.exp(-1.0 / (rel * 48000.0))
    for i in range(n):
        v = x[i]
        if v > s: s = a * s + (1 - a) * v
        else: s = r * s + (1 - r) * v
        e[i] = s
    return e


def saw(freq, phase0=0.0):
    """PolyBLEP 带限锯齿，freq 可为逐样本数组"""
    dt = np.asarray(freq, dtype=float) / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt; x = ph[m] / dt[m]; y[m] -= x + x - x * x - 1
    m = ph > 1 - dt; x = (ph[m] - 1) / dt[m]; y[m] -= x * x + x + x + 1
    return y


def adsr(dur, a, d, s, r):
    n = int((dur + r) * SR); t = ts(n)
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    ig = min(int(dur * SR), n - 1); v = e[ig]
    return np.where(t < dur, e, v * np.exp(-(t - dur) / (r / 4.6)))


def make_ir(dur, rt60, predelay=0.02, damp=3500, seed=1, early=True):
    n = int(dur * SR); t = ts(n); r = np.random.default_rng(seed)
    dec = np.exp(-6.9 * t / rt60); out = []
    for c in range(2):
        x = r.standard_normal(n) * dec
        dark = lp(x, damp, 1); w = np.clip(t / (rt60 * .45), 0, 1)
        x = x * (1 - w) * .6 + dark * w
        x[:int(.003 * SR)] *= np.linspace(0, 1, int(.003 * SR))
        if early:
            for k in range(6):
                d = int((0.007 + 0.011 * k + r.random() * .006) * SR); x[d] += (0.5 - k * .06) * (1 if r.random() > .5 else -1) * 8
        out.append(np.concatenate([np.zeros(int(predelay * SR)), x]))
    ir = np.stack(out, 1); return ir / np.sqrt((ir ** 2).sum(0).mean())


IR_HALL = make_ir(2.6, 1.9, .024, 3800, 11)
IR_PLATE = make_ir(1.1, 0.9, .006, 6500, 12, early=False)

# ───────────────────────── 乐器 ─────────────────────────


def epiano(m, dur, vel=0.7):
    """DX7 式 FM 电钢：1:1 载波对（音色主体，调制指数随时间衰减）+ 14:1 铃音瞬态"""
    f = mtof(m); rel = 0.22; n = int((dur + rel) * SR); t = ts(n)
    tau = 1.2 * (262 / f) ** .5 + .35
    rel_env = np.where(t < dur, 1.0, np.exp(-(t - dur) / .06))
    amp = np.exp(-t / tau) * rel_env * np.minimum(1, t / .0015)
    I1 = vel * 1.5 * np.exp(-t / .5) + .3 * vel
    ph = 2 * np.pi * f * t; ph2 = 2 * np.pi * f * 1.0015 * t
    body = .62 * np.sin(ph + I1 * np.sin(ph)) + .38 * np.sin(ph2 + .7 * I1 * np.sin(ph2))
    tine = np.sin(ph + 2.2 * vel * np.exp(-t / .016) * np.sin(14 * ph)) * np.exp(-t / .11) * .3 * vel * rel_env
    return (body * amp + tine) * vel


def bass(m, dur, vel=.8, kind='T'):
    """加法合成 slap 贝斯：高次谐波衰减更快（拨弦的自然滤波）+ 起音音高下滑 + 击弦噪声"""
    f0 = mtof(m); rel = .025; n = int((dur + rel) * SR); t = ts(n)
    P = dict(T=(1.1, .30, 1.0, .03, .5), P=(.8, .12, .8, .045, .9), D=(.045, .9, 1.5, 0, .7), F=(1.8, .7, 1.5, .01, .1))[kind]
    base_tau, kk, tilt, drop, click = P
    ph = 2 * np.pi * np.cumsum(f0 * (1 + drop * np.exp(-t / .009))) / SR
    y = np.zeros(n); nh = int(min(46, 9000 / f0))
    for k in range(1, nh + 1):
        y += np.sin(k * ph + .37 * k) / k ** tilt * np.exp(-t / (base_tau / (1 + kk * k ** 1.15)))
    y /= 2.2
    cl = hp(noise(n), 2500) * np.exp(-t / .0022) * click
    env = np.minimum(1, t / .0012) * np.where(t < dur, 1, np.exp(-(t - dur) / .01))
    return np.tanh(1.5 * (y + cl) * env) * vel


def kick(vel=1.0):
    n = int(.42 * SR); t = ts(n)
    f = 50 + 85 * np.exp(-t / .028) + 380 * np.exp(-t / .0025)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .15) + hp(noise(n), 3000) * np.exp(-t / .004) * .22
    return np.tanh(1.4 * y) * vel


def _gate(n, hold, fall=.018):
    t = ts(n); return np.where(t < hold, 1.0, np.clip(1 - (t - hold) / fall, 0, 1))


def snare(vel=1.0, gate=.26):
    """门限混响军鼓：干声 + 板式混响，混响尾巴在 ~260 ms 被硬门限切掉"""
    n = int(.6 * SR); t = ts(n)
    tone = np.sin(2 * np.pi * np.cumsum(190 * (1 + .12 * np.exp(-t / .01))) / SR) * np.exp(-t / .05) * .6 \
        + np.sin(2 * np.pi * 335 * t) * np.exp(-t / .03) * .3
    nz = bp(noise(n), 1200, 9000) * np.exp(-t / .1) * .9 + hp(noise(n), 5500) * np.exp(-t / .03) * .3
    dry = tone + nz
    wet = np.stack([fftconvolve(dry, IR_PLATE[:, c])[:n] for c in range(2)], 1)
    g = _gate(n, gate)[:, None]
    return (dry[:, None] * .8 + wet * 1.1 * g) * vel


def tom(f, vel=1.0):
    n = int(.55 * SR); t = ts(n)
    dry = np.sin(2 * np.pi * np.cumsum(f * (1 + .6 * np.exp(-t / .018))) / SR) * np.exp(-t / .22) + bp(noise(n), 300, 4000) * np.exp(-t / .03) * .3
    wet = np.stack([fftconvolve(dry, IR_PLATE[:, c])[:n] for c in range(2)], 1)
    return (dry[:, None] * .9 + wet * .9 * _gate(n, .24)[:, None]) * vel


HAT_F = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) * 2.1


def hat(vel=1.0, open_=False):
    n = int((.5 if open_ else .09) * SR); t = ts(n)
    x = sum(np.sign(np.sin(2 * np.pi * f * t + i)) for i, f in enumerate(HAT_F)) / 6
    x = hp(bp(x, 6000, 16000) + hp(noise(n), 8000) * .5, 6000)
    return x * np.exp(-t / (.13 if open_ else .017)) * vel


def crash(vel=1.0, dur=2.6):
    n = int(dur * SR); t = ts(n); out = []
    for c in range(2):
        x = hp(noise(n), 3500) + .5 * bp(sum(np.sign(np.sin(2 * np.pi * f * 1.37 * t + c)) for f in HAT_F), 3000, 12000)
        out.append(x * np.exp(-t / 1.1) * np.minimum(1, t / .002))
    return np.stack(out, 1) * vel * .5


def clap(vel=1.0):
    n = int(.3 * SR); t = ts(n); e = np.zeros(n)
    for k, d in enumerate([0, .009, .018, .03]):
        s = int(d * SR); e[s:] += np.exp(-(t[:n - s]) / (.006 if k < 3 else .09))
    return bp(noise(n), 900, 3500) * e * vel * .6


def tamb(vel=1.0):
    n = int(.12 * SR); t = ts(n)
    x = hp(noise(n), 7000) + .4 * sum(np.sin(2 * np.pi * f * t) for f in (5200, 6900, 8300))
    return x * np.exp(-t / .045) * vel


def boom(vel=1.0):
    n = int(.9 * SR); t = ts(n)
    return np.sin(2 * np.pi * np.cumsum(38 + 45 * np.exp(-t / .12)) / SR) * np.exp(-t / .35) * np.minimum(1, t / .004) * vel


def brass(m, dur, vel=.8, bright=1.0, att=.012):
    """合成铜管：3 只失谐 PolyBLEP 锯齿 + 起音音高下滑（scoop）+ 滤波包络 swell + 延迟颤音"""
    f = mtof(m); rel = .14; n = int((dur + rel) * SR); t = ts(n)
    scoop = 2 ** ((-.3 * np.exp(-t / .035)) / 12)
    vib = 1 + .0035 * np.sin(2 * np.pi * 5.3 * t) * np.clip((t - .35) / .3, 0, 1)
    y = sum(saw(f * 2 ** (d / 1200) * scoop * vib, rng.random()) for d in (-8, 0, 7)) / 3
    fe = np.where(t < att + .03, np.minimum(1, t / (att + .03)), .5 + .5 * np.exp(-(t - att - .03) / .25))
    fe = np.where(t < dur, fe, fe[min(int(dur * SR), n - 1)] * np.exp(-(t - dur) / .05))
    fc = f * 1.3 + (1200 + 5.5 * f) * bright * (.35 + .65 * vel) * fe
    y = svf(y, fc, .85, 0)
    return y * adsr(dur, att, .3, .78, rel)[:n] * vel


def pad(m, dur, vel=.5):
    f = mtof(m); rel = .9; n = int((dur + rel) * SR); t = ts(n)
    y = sum(saw(f * 2 ** (d / 1200) * (1 + .0015 * np.sin(2 * np.pi * .31 * t + d)), rng.random()) for d in (-12, -4, 4, 12)) / 4
    y = lp(y, 2400, 2)
    return y * adsr(dur, .45, .6, .85, rel)[:n] * vel


def gtr(m, dur, vel=.7, mute=False):
    """Karplus-Strong 电吉他：拨片噪声激励，muted 切音用高阻尼"""
    f = mtof(m); P = int(round(SR / f - .5)); L = int((dur + .06) * SR)
    exc = lp(noise(P), 2500 + 3500 * vel, 1) * vel
    y = ks_loop(exc, L, P, .975 if mute else .9965, .15 if mute else .35)
    t = ts(L); env = np.where(t < dur, 1, np.exp(-(t - dur) / .012))
    if mute: y = lp(y, 2200, 1)
    return y * env


def bell(m, dur=2.8, vel=.5):
    f = mtof(m); n = int(dur * SR); t = ts(n)
    I = 2.6 * vel * np.exp(-t / .3) + .25
    y = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * 3.5 * f * t)) * np.exp(-t / .95) \
        + .25 * np.sin(2 * np.pi * 2.001 * f * t) * np.exp(-t / .4)
    return y * np.minimum(1, t / .002) * vel


def riser(dur, vel=1.0, f0=250, f1=7000):
    n = int(dur * SR); t = ts(n); u = t / dur
    fc = f0 * (f1 / f0) ** (u ** 1.6)
    y = svf(noise(n), fc, 2.2, 1) * (u ** 2.2)
    return y * vel


# ───────────────────────── 和声数据 ─────────────────────────
PC = dict(C=0, Db=1, **{'C#': 1}, D=2, Eb=3, E=4, F=5, **{'F#': 6}, G=7, Ab=8, **{'G#': 8}, A=9, Bb=10, B=11)
Q = {'M7': [0, 4, 7, 11], 'M9': [0, 4, 7, 11, 14], 'm7': [0, 3, 7, 10], 'm9': [0, 3, 7, 10, 14], '7': [0, 4, 7, 10],
     '13': [0, 4, 10, 14, 21], '7sus4': [0, 5, 7, 10], '7b9': [0, 4, 7, 10, 13], 'add9': [0, 4, 7, 14]}
# bar -> [(起拍, 拍数, 根音, 性质)]
CH = {
    0: [(0, 4, 'Ab', 'M9')], 1: [(0, 4, 'G', 'm9')], 2: [(0, 4, 'F', 'm9')], 3: [(0, 4, 'Bb', '7sus4')],
    4: [(0, 2, 'Bb', '7sus4'), (2, 2, 'Bb', '7b9')],
    5: [(0, 2, 'Ab', 'M9'), (2, 2, 'Bb', 'add9')], 6: [(0, 2, 'G', 'm7'), (2, 2, 'C', 'm9')],
    7: [(0, 4, 'Ab', 'M9')], 8: [(0, 4, 'G', 'm7')], 9: [(0, 4, 'F', 'm9')], 10: [(0, 2, 'Bb', '7sus4'), (2, 2, 'Bb', '13')],
    11: [(0, 4, 'Ab', 'M9')], 12: [(0, 2, 'G', 'm7'), (2, 2, 'C', '7b9')],
    13: [(0, 2, 'F', 'm9'), (2, 2, 'G', 'm7')], 14: [(0, 2, 'Ab', 'M9'), (2, 2, 'Bb', 'add9')], 15: [(0, 2, 'C', 'm9'), (2, 2, 'Bb', '7sus4')],
    16: [(0, 4, 'Ab', 'M9')], 17: [(0, 4, 'Bb', '13')], 18: [(0, 4, 'G', 'm9')], 19: [(0, 4, 'C', 'm9')],
    20: [(0, 2, 'F', 'm9'), (2, 2, 'Bb', '13')], 21: [(0, 2, 'Eb', 'M9'), (2, 1, 'B', '7sus4'), (3, 1, 'B', '7')],
    22: [(0, 4, 'A', 'M9')], 23: [(0, 4, 'B', '13')], 24: [(0, 4, 'G#', 'm9')], 25: [(0, 2, 'C#', 'm9'), (2, 2, 'B', '7sus4')],
    26: [(0, 4, 'E', 'M9')], 27: [(0, 4, 'E', 'M9')], 28: [(0, 4, 'E', 'M9')],
}


def chord_at(b, beat):
    while beat >= 4: b += 1; beat -= 4
    for s, d, r, q in CH.get(b, CH[28]):
        if s <= beat < s + d: return r, q
    return CH.get(b, CH[28])[-1][2:]


def bass_root(r): return 28 + (PC[r] - 4) % 12


def voicing(r, q, center, drop_root=True, nmax=5):
    ints = Q[q]
    tones = sorted(set((PC[r] + i) % 12 for i in ints if not (drop_root and i == 0 and len(ints) > 3)))
    best, bs = None, 1e9
    for k in range(len(tones)):
        rot = tones[k:] + tones[:k]; v = [rot[0]]
        for p in rot[1:]:
            while p <= v[-1]: p += 12
            v.append(p)
        v = np.array(v[-nmax:], float); v += 12 * round((center - v.mean()) / 12)
        s = abs(v.mean() - center) + .15 * (v.max() - v.min())
        if s < bs: best, bs = v, s
    return [int(x) for x in best]


def harm(top, r, q, nv=4):
    pcs = set((PC[r] + i) % 12 for i in Q[q]); out = [top]; c = top - 2
    while len(out) < nv and c > top - 13:
        if c % 12 in pcs and out[-1] - c >= 2: out.append(c)
        c -= 1
    return out + [top - 12]


# ───────────────────────── 总线与放置 ─────────────────────────
STEMS = ['drums', 'bass', 'keys', 'guitar', 'pad', 'brass', 'lead', 'fx']
BUS = {k: np.zeros((N, 2)) for k in STEMS}
SEND = {k: np.zeros(N) for k in STEMS}          # 混响发送（单声道）
SEND_AMT = dict(drums=.05, bass=0, keys=.22, guitar=.12, pad=.35, brass=.2, lead=.28, fx=.45)
KICKS = []


def place(bus, sig, t, gain=1.0, pan=0.0, send=None):
    s = int(round(t * SR))
    if s >= N: return
    st = sig if sig.ndim == 2 else np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)], 1) * 1.4142
    st = st * gain
    if t < CUT0 - 1e-6:                      # 静音段之前开始的声音，不许漏进静音段
        c = int(CUT0 * SR) - s
        if c < len(st):
            fl = min(int(.012 * SR), c)
            if fl > 0: st[c - fl:c] *= np.linspace(1, 0, fl)[:, None]
            st[c:] = 0
    if s < 0: st = st[-s:]; s = 0
    e = min(N, s + len(st))
    BUS[bus][s:e] += st[:e - s]
    SEND[bus][s:e] += st[:e - s].mean(1) * (SEND_AMT[bus] if send is None else send)


def hum(ms=3.0): return rng.normal(0, ms / 1000)
def jv(v, j=.08): return v * (1 + rng.uniform(-j, j))
def tr(m, b): return m + (1 if b >= KEY_UP else 0)   # 旋律数据按原调写，升调段 +1


# ───────────────────────── 编曲 ─────────────────────────
SNARES = [snare(1, .26) for _ in range(3)]
KICKW = [kick(1) for _ in range(2)]


def drums_bar(b, style, dyn=1.0, crash_=False):
    t0 = T(b)
    def at(s): return t0 + s * BEAT / 4
    def K(s, v=1.0):
        place('drums', KICKW[s % 2], at(s) + hum(1), .5 * v * dyn); KICKS.append(at(s))
    def S(s, v=1.0): place('drums', SNARES[rng.integers(3)], at(s) + hum(2), .36 * v * dyn)
    def H(s, v=1.0, o=False): place('drums', hat(jv(1), o), at(s) + hum(3), (.09 if o else .075) * v * dyn, .3)
    if crash_: place('drums', crash(1), t0, .24 * dyn); K(0, 1.1)
    acc = [1, .45, .72, .45]
    if style == 'groove':
        for s in (0, 6, 10, 13): K(s, .95 if s else 1.0)
        S(4); S(12); S(7, .16); S(15, .14)
        for s in range(16):
            if s == 14: H(s, .9, True)
            elif s != 15: H(s, acc[s % 4])
    elif style == 'chorus':
        for s in (0, 3, 6, 8, 10, 14): K(s, 1.0 if s in (0, 8) else .85)
        S(4); S(12); S(7, .15); S(15, .18)
        for s in (4, 12): place('drums', clap(jv(1)), at(s) + .004, .22 * dyn, -.1)
        for s in range(16):
            if s % 4 == 2: H(s, .75, True)
            else: H(s, acc[s % 4])
            place('drums', tamb(jv(1, .15)), at(s) + hum(4), .032 * acc[s % 4] * dyn, -.4)
    elif style == 'title':
        for s in (0, 3, 8, 11): K(s)
        S(4); S(12); S(13, .2)
        for s in range(0, 16, 2): H(s, 1 if s % 4 == 0 else .7)
        for s in (4, 12): place('drums', clap(jv(1)), at(s) + .004, .2 * dyn, -.1)
    elif style == 'pullback':
        for s in (0, 8, 10): K(s, .85)
        S(4, .8); S(12, .8)
        for s in range(0, 16, 2): H(s, .8 if s % 4 == 0 else .55)
    elif style == 'pre13':
        for s in (0, 4, 8, 12): K(s, .9)
        S(4, .85); S(12, .85)
        for s in range(16):
            if s % 4 == 2: H(s, .8, True)
            elif s % 2 == 0: H(s, .6)
    elif style == 'pre14':
        for s in (0, 4, 8, 12): K(s, .95)
        S(4, .9)
        for i, s in enumerate(range(8, 16, 2)): S(s, .45 + .12 * i)
        for s in range(16):
            if s % 4 == 2: H(s, .85, True)
            elif s % 2 == 0: H(s, .6)
    elif style == 'pre15':
        for s in (0, 4, 8): K(s, 1.0)
        for s in range(12): S(s, .45 + .55 * s / 11)
        for s in (0, 4, 8): place('drums', tom(95), at(s), .22 * dyn)
    elif style == 'intro':
        for s in range(0, 16, 2): place('drums', tamb(jv(1, .2)), at(s) + hum(5), .035 * (1 if s % 4 == 2 else .6), .35)
    elif style == 'fill4':
        K(0, .7)
        for i, (s, f) in enumerate(zip(range(8, 16), [225, 215, 180, 172, 142, 136, 108, 104])):
            place('drums', tom(f, .6 + .04 * i), at(s) + hum(1), .2 * dyn, .5 - i * .13)
        S(15, .55)
    elif style == 'fill25':
        for s in (0, 8, 10): K(s, .9)
        S(4, .85)
        for i, (s, f) in enumerate(zip(range(8, 16), [230, 225, 182, 176, 140, 134, 106, 100])):
            place('drums', tom(f, .7 + .04 * i), at(s) + hum(1), .3 * dyn, .5 - i * .13)
        S(15, 1.0)
        for s in range(0, 8, 2): H(s, .7)


B_VERSE = [(0, 'T', 0, 3), (3, 'D', 0, 1), (4, 'P', 12, 1), (6, 'T', 0, 2), (8, 'T', 7, 2), (10, 'P', 12, 1), (11, 'D', 0, 1), (12, 'T', 0, 2), (14, 'T', 'b7', 1), (15, 'T', 'A', 1)]
B_CHORUS = [(0, 'T', 0, 2), (2, 'P', 12, 1), (3, 'D', 0, 1), (4, 'T', 0, 2), (6, 'P', 12, 2), (8, 'T', 7, 2), (10, 'P', 12, 1), (11, 'T', 0, 1), (12, 'T', 0, 2), (14, 'P', 12, 1), (15, 'T', 'A', 1)]
B_TITLE = [(0, 'T', 0, 3), (3, 'P', 12, 1), (5, 'T', 0, 3), (8, 'T', 0, 3), (11, 'P', 12, 1), (13, 'T', 0, 2), (15, 'D', 0, 1)]
B_PULL = [(0, 'T', 0, 4), (6, 'T', 0, 2), (8, 'T', 7, 3), (12, 'T', 0, 2), (14, 'P', 12, 1), (15, 'T', 'A', 1)]


def bass_bar(b, pat, dyn=1.0, stop=16):
    for s, kind, iv, ln in pat:
        if s >= stop: continue
        beat = s / 4; r, q = chord_at(b, beat); root = bass_root(r)
        if iv == 'A':
            nr = bass_root(chord_at(b + 1, 0)[0]); cands = [nr - 1, nr + 1, nr + 11, nr - 11]
            m = min(cands, key=lambda c: abs(c - root))
        elif iv == 'b7': m = root + (9 if q.startswith('M') or q == 'add9' else 10)
        else: m = root + iv
        v = {'T': .85, 'P': .8, 'D': .5, 'F': .7}[kind]
        place('bass', bass(m, ln * BEAT / 4 * .92, jv(v, .06), kind), T(b, beat) + hum(1.5), .36 * dyn)


def ep_bar(b, pat, dyn=1.0, center=64):
    for beat, d, vm in pat:
        r, q = chord_at(b, beat + (.5 if beat % 1 == .5 and beat >= 3.5 else 0))   # 3.5 拍的切分提前进下一和弦
        for i, m in enumerate(voicing(r, q, center)):
            place('keys', epiano(m, d * BEAT, jv(.62 * vm)), T(b, beat) + i * .004 + hum(2), .27 * dyn, -.35 + .18 * i)


def pad_bar(b, dyn=1.0, center=62):
    for s, d, r, q in CH[b]:
        dur = d * BEAT
        for i, m in enumerate(voicing(r, q, center)):
            place('pad', pad(m, dur, .5), T(b, s), .22 * dyn, (-.6, .6)[i % 2])


G_VERSE = '..x.X..x..x.X.x.'
G_CHORUS = 'x.xxX.xxx.xxX.xx'
G_TITLE = 'X..X.X..X..X.X..'


def gtr_bar(b, pat, dyn=1.0):
    for s, ch in enumerate(pat):
        if ch == '.': continue
        r, q = chord_at(b, s / 4); v = voicing(r, q, 71, nmax=4)[-3:]
        if s % 2: v = v[::-1]
        mute = ch == 'x'
        for i, m in enumerate(v):
            place('guitar', gtr(m, .045 if mute else .2, jv(.5 if mute else .85), mute), T(b, s / 4) + i * .006 + hum(2.5), .4 * dyn, 0)


def stab(b, beat, dur, top, dyn=1.0, bright=1.0, att=.012, vel=.85):
    r, q = chord_at(b, beat)
    for i, m in enumerate(harm(top, r, q)):
        place('brass', brass(m, dur, jv(vel, .05), bright, att), T(b, beat) + hum(3), .15 * dyn, (-.45, .45, -.2, .2, 0)[i % 5])


# 主旋律（原调 E♭，拍, 时值, MIDI）
V_MEL = {7: [(0.5, .5, 75), (1, .5, 77), (1.5, 1.0, 79), (2.5, .5, 77), (3, 1.0, 75)],
         8: [(0.5, .5, 74), (1, .5, 75), (1.5, .5, 77), (2, 1.5, 82)],
         9: [(0.5, .5, 80), (1, .5, 79), (1.5, .5, 77), (2, .5, 75), (2.5, 1.5, 72)],
         10: [(0, .5, 75), (.5, .5, 77), (1, 1.0, 79), (2.5, .5, 80), (3, 1.0, 79)],
         11: [(0.5, .5, 75), (1, .5, 77), (1.5, 1.0, 79), (2.5, .5, 82), (3, 1.0, 84)],
         12: [(0, 1.5, 82), (1.5, .5, 79), (2, 1.75, 76)]}
HOOK = [[(0, 1.5, 84), (1.5, .5, 82), (2, .5, 84), (2.5, 1.0, 87), (3.5, .5, 86)],
        [(0, 1.0, 82), (1, .5, 80), (1.5, .5, 82), (2, .5, 84), (2.5, .5, 82), (3, 1.0, 79)],
        [(0.5, .5, 82), (1, .5, 84), (1.5, 1.0, 86), (2.5, .5, 84), (3, .5, 82), (3.5, .5, 84)],
        [(0, 1.0, 87), (1, .5, 86), (1.5, .5, 84), (2, .5, 82), (2.5, 1.5, 79)]]
C_MEL = {16: HOOK[0], 17: HOOK[1], 18: HOOK[2], 19: HOOK[3],
         20: [(0, .5, 80), (.5, .5, 82), (1, 1.0, 84), (2, .5, 87), (2.5, .5, 86), (3, .5, 84), (3.5, .5, 82)],
         21: [(0, 1.75, 82)],
         22: HOOK[0], 23: HOOK[1], 24: HOOK[2], 25: HOOK[3], 26: [(0, 7.0, 79)]}
TITLE_RIFF = {5: [(0, .5, 75), (.75, .25, 72), (1.25, .75, 75), (2, .5, 77), (2.75, .25, 74), (3.25, .75, 77)],
              6: [(0, .5, 74), (.75, .25, 70), (1.25, .75, 74), (2, 1.0, 75), (3, .5, 74), (3.5, .5, 70)]}


def lead_line(notes, bright, gain):
    """单音主旋律：连续相位锯齿 + 滑音 + 延迟颤音；notes=[(t, dur, midi, vel)]"""
    if not notes: return
    notes = sorted(notes); t0 = max(0, notes[0][0] - .2); t1 = min(DUR, notes[-1][0] + notes[-1][1] + .6)
    a, b_ = int(t0 * SR), int(t1 * SR); n = b_ - a; t = ts(n) + t0
    pitch = np.full(n, float(notes[0][2])); gate = np.zeros(n); acc = np.zeros(n); vib = np.zeros(n); vel = np.zeros(n)
    for (s, d, m, v) in notes:
        i0, i1 = int((s - t0) * SR), int((s + d - t0) * SR)
        pitch[i0:] = m; gate[i0:max(i0 + 1, i1 - int(.02 * SR))] = 1; vel[i0:i1] = v
        k = np.arange(n - i0) / SR; acc[i0:] = np.maximum(acc[i0:], np.exp(-k / .16))
        if d > .45: vib[i0:i1] = np.clip((k[:i1 - i0] - .22) / .3, 0, 1)
    al = np.exp(-1 / (.028 * SR)); from scipy.signal import lfilter
    pitch = lfilter([1 - al], [1, -al], pitch, zi=[pitch[0] * al])[0]
    pitch = pitch + .16 * vib * np.sin(2 * np.pi * 5.6 * t)
    f = mtof(pitch)
    osc = .5 * saw(f) + .3 * saw(f * 1.004, .3) + .2 * (saw(f, 0) - saw(f, .5))
    amp = env_follow(gate * np.maximum(vel, .01), .006, .07)
    fc = 700 + f * 2.0 + (2600 * acc + 900) * bright
    y = svf(osc, fc, 1.05, 0) * amp
    s = np.stack([y, y], 1) * gain
    BUS['lead'][a:b_] += s; SEND['lead'][a:b_] += y * gain * SEND_AMT['lead']


def build():
    lead_notes_soft, lead_notes = [], []
    # ── 前奏 bar 0–3 ──
    ARP = [0, 1, 2, 3, 4, 3, 2, 1]
    for b in range(4):
        pad_bar(b, .8 + .1 * b)
        r, q = CH[b][0][2:]; v = voicing(r, q, 66, nmax=5)
        for k in range(8):
            m = v[ARP[k] % len(v)]
            place('keys', epiano(m, BEAT * 1.4, jv(.42 + .06 * (k % 4 == 0))), T(b, k * .5) + hum(3), .26, -.4 + .1 * ARP[k])
        if b >= 2:
            drums_bar(b, 'intro')
            place('bass', bass(bass_root(r), BAR * .95, .55, 'F'), T(b), .3)
    for s, d, m in [(0, 1.5, 84), (1.5, .5, 82), (2, .5, 84), (2.5, 1.5, 87)]:
        place('fx', bell(m, 3.0, .38), T(0, s), .085, .25)
    for s, d, m in [(0, 1.0, 80), (1, 1.0, 79), (2, 2.0, 75)]:
        place('fx', bell(m, 3.0, .35), T(2, s), .075, -.25)
    # ── 过门 bar 4 ──
    pad_bar(4, 1.0)
    for beat in (0, 2):
        r, q = chord_at(4, beat)
        for i, m in enumerate(voicing(r, q, 64)):
            place('keys', epiano(m, BEAT * 1.8, .5), T(4, beat) + i * .005, .24, -.3 + .15 * i)
    for s, iv, kind, ln in [(0, 0, 'F', 4), (4, 2, 'T', 2), (6, 4, 'T', 2), (8, 5, 'T', 2), (10, 7, 'T', 2), (12, 9, 'T', 1), (13, 21, 'P', 1), (14, 9, 'T', 1), (15, 21, 'P', 1)]:
        place('bass', bass(34 + iv, ln * BEAT / 4 * .9, .8, kind), T(4, s / 4), .34)
    drums_bar(4, 'fill4')
    place('fx', riser(BAR, 1.0), T(4), .12)
    rc = crash(1.0, 1.6)[::-1] * np.linspace(0, 1, int(1.6 * SR))[:, None] ** 2
    place('fx', rc, T(5) - 1.6, .14)
    # ── 片名 bar 5–6 ──
    place('fx', boom(1), T(5), .32)
    place('fx', bell(87, 3.0, .6), T(5), .08, .3); place('fx', bell(94, 3.0, .5), T(5, .02), .06, -.3)
    for b in (5, 6):
        drums_bar(b, 'title', 1.0, crash_=(b == 5))
        bass_bar(b, B_TITLE)
        pad_bar(b, .9)
        gtr_bar(b, G_TITLE, .9)
        for s, d, top in TITLE_RIFF[b]:
            stab(b, s, d * BEAT * .95, top, 2.0, 1.1, vel=.95 if s == 0 else .85)
        ep_bar(b, [(0, 1.0, 1), (2, 1.0, .9), (3.5, .45, .8)], .9)
    # ── 主歌 bar 7–12 ──
    for b in range(7, 13):
        drums_bar(b, 'groove', .78)
        bass_bar(b, B_VERSE, .85)
        ep_bar(b, [(0, 1.0, 1.0), (1.5, .4, .7), (2.5, .9, .9), (3.5, .4, .75)], 1.0)
        gtr_bar(b, G_VERSE, .75)
        pad_bar(b, .45)
        for s, d, m in V_MEL[b]: lead_notes_soft.append((T(b, s), d * BEAT, m, .8))
    for b, s, top in [(10, 2.5, 77), (10, 3.5, 79), (12, 2.5, 76), (12, 3.5, 77)]:
        stab(b, s, BEAT * .4, top, .8, .8)
    # ── 预副歌 bar 13–15 ──
    for i, b in enumerate((13, 14, 15)):
        drums_bar(b, ('pre13', 'pre14', 'pre15')[i], .95 + .05 * i)
        pat = [(s, 'T' if s % 4 == 0 else 'P', 0 if s % 4 == 0 else 12, 2) for s in range(0, 16, 2)]
        bass_bar(b, pat, .85 + .08 * i, stop=12 if b == 15 else 16)
        ep_bar(b, [(k * .5, .4, .55 + .08 * i + .04 * (k % 2 == 0)) for k in range(6 if b == 15 else 8)], .9, 66)
        pad_bar(b, .7 + .25 * i)
        for s, d, r, q in CH[b]:
            dd = min(d, 3 - s) if b == 15 else d
            top = max(voicing(r, q, 70))
            stab(b, s, dd * BEAT, top, .75 + .2 * i, .45 + .25 * i + .15 * (s > 0), att=.22, vel=.7 + .1 * i)
    place('fx', riser(CUT0 - T(14), 1.0, 300, 9000), T(14), .26)
    # ── 副歌 bar 16–21 ──
    for b in range(16, 22):
        drums_bar(b, 'chorus', 1.0, crash_=b in (16, 18, 20))
        bass_bar(b, B_CHORUS, 1.0)
        ep_bar(b, [(0, 1.4, 1), (1.5, .45, .7), (2, 1.4, .9), (3.5, .45, .8)], .85, 65)
        gtr_bar(b, G_CHORUS, .9)
        pad_bar(b, .75)
        for s, d, m in C_MEL[b]: lead_notes.append((T(b, s), d * BEAT, m, 1.0))
    for b in (16, 18):
        place('fx', boom(1), T(b), .34)
        r, q = chord_at(b, 0); stab(b, 0, BEAT * 1.4, max(voicing(r, q, 72)), 1.8, 1.2, vel=1.0)
    place('drums', tom(90, 1), T(18), .35)
    for b, s, top in [(17, 2.5, 77), (17, 3.5, 79), (19, 2.5, 79), (19, 3.5, 77), (20, 1.5, 79), (20, 3.5, 77), (21, 2, 78), (21, 3, 78)]:
        stab(b, s, BEAT * .45, top, 1.4, 1.0)
    # 铜管齐奏低八度叠主旋律（副歌 hook）
    for b in (16, 17, 18, 19, 20):
        for s, d, m in C_MEL[b]:
            place('brass', brass(m - 12, d * BEAT * .95, .8, .9), T(b, s), .17, .15)
    # ── 升调最后副歌 bar 22–25 ──
    for b in range(22, 26):
        pb = b in (24, 25)
        drums_bar(b, 'fill25' if b == 25 else ('pullback' if b == 24 else 'chorus'), 1.05 if not pb else .85, crash_=b in (22,))
        bass_bar(b, B_PULL if pb else B_CHORUS, 1.0)
        ep_bar(b, [(0, 1.4, 1), (1.5, .45, .7), (2, 1.4, .9), (3.5, .45, .8)], .85 if pb else .95, 65)
        if not pb: gtr_bar(b, G_CHORUS, 1.0)
        else: gtr_bar(b, G_VERSE, .7)
        pad_bar(b, .9 if not pb else .8)
        for s, d, m in C_MEL[b]: lead_notes.append((T(b, s), d * BEAT, tr(m, b), .9 if pb else 1.0))
        if not pb:
            for s, d, m in C_MEL[b]:
                place('brass', brass(tr(m, b) - 12, d * BEAT * .95, .85, 1.0), T(b, s), .19, .15)
    place('fx', boom(1.1), T(22), .36)
    for b in (22, 23):   # 升调段加一层高八度弦乐，释放感
        for s, d, r, q in CH[b]:
            for i, m in enumerate(voicing(r, q, 76, nmax=4)):
                place('pad', pad(m, d * BEAT, .55), T(b, s), .2, (-.7, .7)[i % 2])
    r, q = chord_at(22, 0); stab(22, 0, BEAT * 1.6, max(voicing(r, q, 73)), 1.9, 1.3, vel=1.0)
    for b, s, top in [(23, 2.5, 78), (23, 3.5, 80)]:
        stab(b, s, BEAT * .45, top, 1.45, 1.0)
    rc2 = crash(1.0, 1.0)[::-1] * np.linspace(0, 1, int(1.0 * SR))[:, None] ** 2
    place('fx', rc2, T(22) - 1.0, .12)
    # ── 结尾 bar 26 ──
    place('drums', crash(1.2, 5.0), T(26), .4); place('drums', KICKW[0], T(26), .6); place('fx', boom(1), T(26), .32)
    place('drums', SNARES[0], T(26), .45)
    for m in harm(80, 'E', 'M9', 4): place('brass', brass(m, BAR * 1.1, .95, 1.15, .015), T(26), .22, rng.uniform(-.4, .4))
    for i, m in enumerate(voicing('E', 'M9', 62)): place('pad', pad(m, BAR * 2.1, .55), T(26), .18, (-.6, .6)[i % 2])
    for i, m in enumerate(voicing('E', 'M9', 65)): place('keys', epiano(m, BAR * 2.4, .7), T(26) + i * .012, .27, -.35 + .18 * i)
    place('bass', bass(28, BAR * 1.6, .9, 'T'), T(26), .36)
    place('bass', bass(40, .12, .7, 'P'), T(26, .5), .35)
    for s, d, m in C_MEL[26]: lead_notes.append((T(26, s), d * BEAT, tr(m, 26), .9))
    for k, m in enumerate([83, 87, 90, 92, 95, 99, 90, 95]):
        place('fx', bell(m, 3.5, .45 - .03 * k), T(26, 1 + k * .5), .07, (-.5, .5)[k % 2])
    lead_line(lead_notes_soft, .35, .24)
    lead_line(lead_notes, 1.0, .3)


# ───────────────────────── 效果与母带 ─────────────────────────
def chorus_fx(x, base=.009, depth=.0028, rates=(.73, 1.11), mix=.55):
    n = len(x); ar = np.arange(n); t = ar / SR; mono = x.mean(1); out = x.copy()
    for c in range(2):
        d = (base + depth * np.sin(2 * np.pi * rates[c] * t + c * 1.7)) * SR
        out[:, c] = x[:, c] * (1 - mix * .4) + np.interp(ar - d, ar, mono) * mix
    return out


def pingpong(mono, dt, fb=.36, taps=5, lpf=4200):
    out = np.zeros((N, 2)); y = mono.copy()
    for k in range(1, taps + 1):
        y = lp(y, lpf, 1); sh = int(k * dt * SR); g = fb ** k
        out[sh:, k % 2] += y[:N - sh] * g
    return out


def split_fx(dry_mono_or_st, fx):
    """静音段前的效果尾巴在 CUT0 处切断，静音段后的正常"""
    A = np.ones(N); c0, c1 = int(CUT0 * SR), int(CUT1 * SR); fl = int(.012 * SR)
    A[c0 - fl:c0] = np.linspace(1, 0, fl); A[c0:] = 0
    B = np.zeros(N); B[c1:] = 1
    sh = (slice(None), None) if dry_mono_or_st.ndim == 2 else slice(None)
    a = fx(dry_mono_or_st * (A[:, None] if dry_mono_or_st.ndim == 2 else A)); b = fx(dry_mono_or_st * (B[:, None] if dry_mono_or_st.ndim == 2 else B))
    return a * A[:, None] + b


def lofi(seg):
    n = len(seg); ar = np.arange(n); t = ar / SR
    mid = seg.mean(1); side = (seg[:, 0] - seg[:, 1]) * .5 * .25
    wow = .0014 * np.sin(2 * np.pi * .55 * t) + .00022 * np.sin(2 * np.pi * 6.7 * t) + .0012
    idx = ar - wow * SR
    x = np.stack([np.interp(idx, ar, mid + side), np.interp(idx, ar, mid - side)], 1)
    x = bp(x, 320, 3100, 3)
    x = np.tanh(x * 2.4) / 2.4 * 1.35
    hiss = hp(noise(n), 3500) * .006
    return x * 10 ** (-2.5 / 20) + hiss[:, None]


def apply_lofi(st):
    a, b = int(LOFI0 * SR), int(LOFI1 * SR); pad_ = int(.15 * SR)
    seg = lofi(st[a - pad_:b + pad_])[pad_:-pad_]
    w = np.ones(b - a); f = int(.02 * SR); w[:f] = np.linspace(0, 1, f); w[-f:] = np.linspace(1, 0, f)
    out = st.copy(); out[a:b] = st[a:b] * (1 - w[:, None]) + seg * w[:, None]
    return out


def main():
    import time; t0 = time.time()
    build(); print('build', round(time.time() - t0, 1), 's')
    # 电钢：立体声颤音（Rhodes 式 autopan）+ chorus
    t = ts(N); trem = .22 * np.sin(2 * np.pi * 3.4 * t)
    BUS['keys'][:, 0] *= 1 - trem; BUS['keys'][:, 1] *= 1 + trem
    BUS['keys'] = chorus_fx(BUS['keys'], .007, .0018, (.5, .63), .35)
    BUS['guitar'] = chorus_fx(hp(BUS['guitar'], 180), .010, .0032, (.8, 1.13), .6)   # 合唱效果吉他
    BUS['pad'] = chorus_fx(BUS['pad'], .012, .004, (.25, .33), .5)
    # 侧链：垫子 / 电钢随底鼓轻微呼吸
    pump = np.ones(N)
    for k in KICKS:
        s = int(k * SR); e = min(N, s + int(.3 * SR)); pump[s:e] = np.minimum(pump[s:e], 1 - .28 * np.exp(-ts(e - s) / .09))
    BUS['pad'] *= pump[:, None]; BUS['keys'] *= (1 - (1 - pump) * .5)[:, None]
    BUS['bass'] = hp(BUS['bass'], 32, 2)
    # 主旋律延迟（附点八分乒乓）
    dl = split_fx(BUS['lead'].mean(1), lambda x: pingpong(x, BEAT * .75, .34, 5))
    BUS['lead'] += dl * .32
    # 混响（总发送），按静音段切分
    send = sum(SEND.values())
    wet = split_fx(send, lambda x: np.stack([fftconvolve(x, IR_HALL[:, c])[:N] for c in range(2)], 1))
    BUS['fx'] += hp(wet, 200) * .42
    # 每轨：静音段 + 卡带段 + 结尾淡出
    c0, c1 = int(CUT0 * SR), int(CUT1 * SR)
    fade = np.ones(N); fe = int(.5 * SR); fade[-fe:] = np.linspace(1, 0, fe) ** 2
    for k in STEMS:
        x = BUS[k]; x[c0:c1] = 0; x = apply_lofi(x); BUS[k] = x * fade[:, None]
    BUS['drums'] *= .85
    mix = sum(BUS.values()); mix = hp(mix, 28, 2)
    # 总线压缩（glue）+ 轻微磁带饱和 + 前瞻限幅
    pre = 1.0 / np.abs(mix).max(); mix *= pre
    det = uniform_filter1d(np.abs(mix).max(1), int(.005 * SR))
    g = np.ones(N)
    lv = env_follow(det, .012, .2); thr = .45
    over = lv > thr; g[over] = (thr * (lv[over] / thr) ** (1 / 2.0)) / lv[over]
    mix *= g[:, None]; mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.25) / np.tanh(1.25)
    ceil = 10 ** (-1.2 / 20); look = int(.004 * SR)
    target_gain = 1.3   # 限幅前推 ~2.3 dB（响度由 mux 的 loudnorm 统一）
    raw = np.minimum(1, ceil / np.maximum(np.abs(mix * target_gain).max(1), 1e-9))
    gl = uniform_filter1d(minimum_filter1d(raw, 2 * look + 1), look)
    mix = mix * target_gain * gl[:, None]
    mix = np.clip(mix, -ceil, ceil)
    mix[c0:c1] = 0
    sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
    os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
    stem_gain = pre * target_gain
    for k in STEMS:
        sf.write(os.path.join(HERE, 'stems', k + '.wav'), (BUS[k] * stem_gain).astype(np.float32), SR, subtype='FLOAT')
    info = dict(bpm=BPM, beat=BEAT, bar=BAR, dur=DUR, key='Eb major -> E major at bar 22',
                title_hit=T(5), fill_bar=T(4), verse=T(7), prechorus=T(13), cutout_start=CUT0, cutout_end=CUT1,
                chorus_hit=T(16), land_hit=T(18), tape_lofi_start=LOFI0, tape_lofi_end=LOFI1,
                keychange_hit=T(22), pullback=T(24), final_chord=T(26), fade_out=[DUR - .5, DUR],
                note='stems are post-fx, pre-master (share the master pre-gain); score.wav is mastered to <= -1.2 dBFS peak')
    json.dump({k: (round(v, 4) if isinstance(v, float) else v) for k, v in info.items()}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
    print('done', round(time.time() - t0, 1), 's  peak', np.abs(mix).max())


if __name__ == '__main__':
    main()
