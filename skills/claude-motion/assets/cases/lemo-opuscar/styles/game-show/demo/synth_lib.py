# 合成器库：乐器 + 音效（抽自胖橘案卷 music.py）
import numpy as np
from scipy.signal import lfilter, butter
import wave

SR = 44100
DUR = 150.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * l * 1.414
    R[i:i + len(sig)] += sig * r * 1.414

def env(n, a=0.002, d=0.2, s=0.0, rel=0.05, hold=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    if hold is None:
        e = e * np.exp(-np.maximum(0, t - a) / d)
    else:
        e = np.where(t < hold, e, e * np.exp(-(t - hold) / rel))
    return e

def lp(x, fc, order=2):
    b, a = butter(order, min(fc / (SR / 2), 0.99)); return lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high'); return lfilter(b, a, x)
def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)

# ---------- 乐器 ----------
def kick(g=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 9) + 0.25 * np.exp(-t * 300) * rng.standard_normal(n) * 0.3
    return np.tanh(s * 1.6) * g

def snare():
    n = int(0.22 * SR); t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1500, 8000) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return noise * 0.7 + tone * 0.5

def clap():
    n = int(0.25 * SR); out = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR); m = n - i; t = np.arange(m) / SR
        out[i:] += bp(rng.standard_normal(m), 900, 5000) * np.exp(-t * (60 if k < 2 else 16))
    return out * 0.6

def snap():
    n = int(0.08 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2000, 7000) * np.exp(-t * 70) * 0.8

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 90)) * 0.35

def pluck(m, dur=0.35, bright=1.0):
    # 木琴/马林巴感：基频 + 4 倍泛音快速衰减
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 7)
         + 0.35 * bright * np.sin(2 * np.pi * f * 3.99 * t) * np.exp(-t * 30)
         + 0.12 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 12))
    return s * np.minimum(1, t / 0.002)

def bell(m, dur=1.6):
    # 八音盒
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.6)
         + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)
         + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 11))
    return s * np.minimum(1, t / 0.001)

def bass(m, dur=0.22):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    ph = 2 * np.pi * f * t
    s = np.sin(ph) + 0.3 * np.sign(np.sin(ph)) * 0.5
    s = lp(s, 900)
    return s * env(n, 0.004, 0.18, hold=dur * 0.7, rel=0.03)

def pizz(m, dur=0.18):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    s = lp(np.sign(np.sin(2 * np.pi * f * t)) * 0.6 + np.sin(2 * np.pi * f * t), 1400)
    return s * np.exp(-t * 16) * np.minimum(1, t / 0.003)

def pad(ms, dur):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for m in ms:
        f = mtof(m)
        for det in (-0.12, 0.12):
            ph = 2 * np.pi * f * (1 + det / 100) * t
            s += 2 / np.pi * np.arcsin(np.sin(ph))  # 三角波
    s = lp(s / (len(ms) * 2), 2200)
    a = np.minimum(1, t / 0.08); r = np.minimum(1, (dur - t) / 0.15)
    return s * a * np.clip(r, 0, 1)

# ---------- 音效 ----------
def stamp(big=False):
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = 40 + 90 * np.exp(-t * 18)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (4 if big else 7))
    click = lp(rng.standard_normal(n), 3000) * np.exp(-t * 55)
    s = np.tanh((boom * 1.4 + click * 0.9) * 1.5)
    if big:
        cr = hp(rng.standard_normal(n), 4000) * np.exp(-t * 3.2) * 0.35
        s = s + cr
    return s

def shutter():
    n = int(0.16 * SR); out = np.zeros(n)
    for off in (0, 0.06):
        i = int(off * SR); m = n - i; t = np.arange(m) / SR
        out[i:] += bp(rng.standard_normal(m), 1200, 6000) * np.exp(-t * 110)
    return out * 0.9

def boing(f0=220, f1=520, dur=0.4):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (1 - np.exp(-t * 14)) + 25 * np.sin(2 * np.pi * 18 * t) * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.7

def pop(f=900):
    n = int(0.12 * SR); t = np.arange(n) / SR
    fr = f * (1 + 1.2 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 35)

def clink(f=2600):
    n = int(0.3 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.3 * t)) * np.exp(-t * 22) * 0.4

def crash_glass():
    n = int(1.1 * SR); t = np.arange(n) / SR
    s = hp(rng.standard_normal(n), 2500) * np.exp(-t * 7) * 0.6
    s += lp(rng.standard_normal(n), 400) * np.exp(-t * 25) * 0.8
    for k in range(14):
        f = rng.uniform(2200, 7500); d = rng.uniform(0, 0.25)
        i = int(d * SR); m = n - i; tt = np.arange(m) / SR
        s[i:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * rng.uniform(10, 25)) * 0.18
    return s

def whoosh(dur=0.55, up=True):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n); out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        p = i / n; fc = 400 + 3500 * (p if up else 1 - p)
        out[i:i + seg] = bp(x[max(0, i - 2048):i + seg], fc * 0.7, fc * 1.3)[-len(x[i:i + seg]):]
    return out * np.sin(np.pi * t / dur) ** 2 * 1.2

def plop():
    n = int(0.25 * SR); t = np.arange(n) / SR
    f = 260 * np.exp(-t * 6) + 80
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * 0.9

def key_click():
    n = int(0.04 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 9000) * np.exp(-t * 160) * 0.5

def sparkle():
    out = np.zeros(int(0.9 * SR))
    for k, m in enumerate([84, 88, 91, 96, 100]):
        b = bell(m, 0.7) * 0.35; i = int(k * 0.045 * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out

def meow(dur=0.5, f0=640, gain=0.6):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    f = f0 * (0.9 + 0.45 * np.sin(np.pi * np.clip(p * 1.25, 0, 1)) - 0.25 * p) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    # 共振峰从 /i/ → /a/ → /u/ 滑动
    F1 = np.interp(p, [0, .35, 1], [350, 850, 400]); F2 = np.interp(p, [0, .35, 1], [2300, 1400, 900])
    s = np.zeros(n)
    for h in range(1, 16):
        fh = f * h
        a = np.exp(-((fh - F1) / 260) ** 2) + 0.7 * np.exp(-((fh - F2) / 380) ** 2) + 0.05
        s += a * np.sin(ph * h) / h ** 0.3
    s += 0.02 * hp(rng.standard_normal(n), 3000)
    e = np.minimum(1, t / 0.03) * np.clip((dur - t) / 0.12, 0, 1)
    return s / 6 * e * gain

def roll(t0, t1):
    # 军鼓滚奏，渐快 + 渐强
    t = t0
    while t < t1:
        p = (t - t0) / (t1 - t0)
        add(snare(), t, 0.15 + 0.5 * p, pan=rng.uniform(-.2, .2))
        t += 0.125 * (1 - p) + 0.03 * p

