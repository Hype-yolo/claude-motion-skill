# 《胖橘案卷》配乐 + 音效：纯代码合成，120 BPM，一小节 = 2 秒
import numpy as np
from scipy.signal import lfilter, butter
import wave, sys, os
# 用法：python music.py [输出.wav]   默认写到本脚本旁的 music.wav
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music.wav')

SR = 44100
DUR = 30.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
BEAT = 0.5
BAR = 2.0

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

# ---------- 编曲 ----------
C, Am, F, G, E7 = [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59, 62]
MEL = {
    'C':  [72, 0, 76, 79, 81, 79, 76, 0],
    'Am': [81, 0, 84, 81, 79, 0, 76, 74],
    'F':  [72, 74, 77, 0, 81, 0, 79, 77],
    'G':  [79, 0, 74, 0, 71, 74, 79, 0],
    'C2': [84, 0, 83, 84, 79, 0, 76, 79],
    'Am2': [81, 84, 0, 88, 86, 84, 81, 0],
    'F2': [77, 0, 81, 84, 86, 84, 81, 77],
    'G2': [79, 81, 83, 86, 0, 83, 86, 0],
}
# 小节 → (和弦, 旋律, 模式)
PLAN = {
    0: (C, 'C', 'intro'), 1: (Am, 'Am', 'intro'),
    2: (F, 'F', 'full'), 3: (G, 'G', 'full'), 4: (C, 'C2', 'full'), 5: (Am, 'Am2', 'full'),
    6: (Am, None, 'sneak'), 7: (E7, None, 'sneak'),
    8: (F, 'F2', 'full'), 9: (G, 'G2', 'full'),
    10: (G, None, 'build'),
    11: (C, 'C2', 'drop'),
    12: (F, 'F2', 'full'),
    13: (C, None, 'outro'), 14: (C, None, 'end'),
}

for b, (ch, mel, mode) in PLAN.items():
    t0 = b * BAR
    root = ch[0] - 12 if ch[0] >= 55 else ch[0]
    root = root - 12 if root > 50 else root
    if mode in ('intro', 'full', 'drop'):
        start_beat = 2 if mode == 'drop' else 0  # 结论小节前半留白
        for k in range(start_beat, 4):
            add(kick(), t0 + k * BEAT, 0.9)
        if mode != 'intro':
            for k in (1, 3):
                if mode == 'drop' and k == 1: continue
                add(snare(), t0 + k * BEAT, 0.55); add(clap(), t0 + k * BEAT, 0.35, 0.15)
        else:
            for k in (1, 3): add(clap(), t0 + k * BEAT, 0.45, -0.1)
        for k in range(start_beat * 2, 8):
            add(hat(k % 2 == 1 and k == 7), t0 + k * BEAT / 2 + (0.012 if k % 2 else 0), 0.55, 0.35)
        bpat = [0, None, 12, 0, None, 0, 12, None]
        for k, o in enumerate(bpat):
            if o is None or k < start_beat * 2: continue
            add(bass(root + o), t0 + k * BEAT / 2, 0.55)
        if mode != 'intro':
            add(pad([m + 12 for m in ch], BAR if mode != 'drop' else BAR / 2), t0 + (BAR / 2 if mode == 'drop' else 0), 0.16)
        if mel:
            for k, m in enumerate(MEL[mel]):
                if m and k >= start_beat * 2:
                    add(pluck(m), t0 + k * BEAT / 2, 0.32, pan=0.2 if k % 2 else -0.2)
                    add(pluck(m + 12, bright=0.5), t0 + k * BEAT / 2 + 0.25 * 0 + 0.18, 0.06, 0.6)  # 轻回声
    elif mode == 'sneak':
        # 深夜跑酷：拨弦 + 响指，蹑手蹑脚
        line = [45, 0, 48, 0, 49, 50, 0, 0] if b == 6 else [52, 0, 51, 50, 49, 0, 47, 0]
        for k, m in enumerate(line):
            if m: add(pizz(m), t0 + k * BEAT / 2, 0.8)
        for k in (1, 3): add(snap(), t0 + k * BEAT, 0.55, 0.3)
        add(kick(0.6), t0, 0.7); add(kick(0.6), t0 + 2 * BEAT, 0.5)
        mel_s = [76, 0, 77, 0, 78, 79, 0, 0] if b == 6 else [84, 83, 76, 0, 79, 0, 76, 0]
        for k, m in enumerate(mel_s):
            if m: add(pluck(m, 0.2), t0 + k * BEAT / 2 + 0.03, 0.22, -0.3)
    elif mode == 'build':
        add(pad([m + 12 for m in G], BAR), t0, 0.2)
        roll(t0, t0 + BAR - 0.04)
        n = int(BAR * SR); tt = np.arange(n) / SR
        sweep = np.sin(2 * np.pi * np.cumsum(300 + 900 * (tt / BAR) ** 2) / SR) * (tt / BAR) ** 2 * 0.08
        add(sweep, t0)
        for k in range(4): add(kick(0.7), t0 + k * BEAT, 0.5 + 0.1 * k)
    elif mode == 'outro':
        add(pad([m + 12 for m in ch], BAR * 2), t0, 0.14)
        for k, m in enumerate([84, 79, 76, 79, 84, 0, 86, 0]):
            if m: add(bell(m), t0 + k * BEAT / 2, 0.22, pan=-0.3 + 0.08 * k)
        add(bass(36, 1.2), t0, 0.35)
    elif mode == 'end':
        for k, m in enumerate([72, 76, 79, 84, 88]):
            add(bell(m, 2.2), t0 + k * 0.035, 0.2, pan=-0.4 + 0.2 * k)

# ---------- 音效时间表（与画面 index.html 对齐） ----------
for i in range(6): add(pop(500 + 90 * i), 0.0 + i * 0.25, 0.25)
add(boing(260, 620), 1.5, 0.5)
add(whoosh(0.4), 1.8, 0.35)
add(pop(700), 2.0, 0.25); add(pop(820), 2.25, 0.25); add(pop(940), 2.5, 0.25)
add(stamp(), 3.0, 0.75)
add(whoosh(0.4), 3.8, 0.35)
add(shutter(), 5.0, 0.6); add(shutter(), 6.0, 0.6)
add(pop(1200), 6.5, 0.3)
add(meow(0.45, 700), 7.0, 0.5)
add(whoosh(0.4), 7.8, 0.35)
add(clink(2600), 9.0, 0.5, 0.2); add(clink(2750), 9.5, 0.5, 0.2)
add(clink(2900), 10.5, 0.5, 0.2)
add(whoosh(0.4, up=False), 10.6, 0.3)
add(crash_glass(), 11.0, 0.7)
add(whoosh(0.4), 11.8, 0.3)
add(whoosh(0.5), 13.0, 0.6, -0.5); add(whoosh(0.5), 14.0, 0.6, 0.5)
add(boing(200, 480), 15.0, 0.45)
add(pop(1500), 15.5, 0.25)
add(whoosh(0.4), 15.8, 0.3)
add(plop(), 17.5, 0.8)
t = 17.62
while t < 19.6:
    add(key_click(), t, 0.4, rng.uniform(-.3, .3)); t += rng.uniform(0.06, 0.11)
add(whoosh(0.4), 19.8, 0.3)
for i, f in enumerate([700, 850, 1000]): add(pop(f), 20.25 + 0.25 * i, 0.35)
for tt in (22.3, 22.5, 22.7): add(key_click(), tt, 0.9); add(pop(520), tt, 0.18)
add(stamp(big=True), 23.0, 0.9)
add(sparkle(), 24.5, 0.55)
add(boing(300, 700, 0.5), 24.05, 0.3)
add(stamp(), 26.8, 0.4)
add(pop(1100), 27.3, 0.2)
add(meow(0.55, 560, 0.45), 29.0, 0.6)

# ---------- 总线：轻压缩 + 限幅 + 淡出 ----------
mix = np.stack([L, R])
t = np.arange(N) / SR
fade = np.clip((DUR - t) / 1.2, 0, 1)
mix *= fade
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 1.6
mix = np.tanh(mix) * 0.9
out = (mix.T * 32767).astype(np.int16)
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(out.tobytes()); w.close()
print('ok', out.shape, '->', OUT)
