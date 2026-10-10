"""TRANQUILITY.LOG 原创配乐：Carpenter / 80 年代科幻模拟合成器（numpy + numba，从零合成、确定性）
python score.py → score.wav（48k 立体声 59.8s）+ stems/*.wav + score.json
D 小调，100 BPM（拍 0.6s，小节 2.4s）。音色：PolyBLEP 锯齿/方波 + 失谐 + 4 极点 ladder 低通（截止可随时间变化）+ ADSR + 磁带 wow + 长混响 / 门限混响。"""
import os, json, numpy as np, soundfile as sf
from numba import njit
from scipy.signal import fftconvolve, butter, sosfilt

D = os.path.dirname(os.path.abspath(__file__))
SR = 48000; DUR = 59.8; N = int(round(DUR * SR))
BEAT = .6; S16 = BEAT / 4; S8 = BEAT / 2
rng = np.random.default_rng(20910614)
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def m(s):  # 'D3' → midi
    n, o = (s[:-1], int(s[-1])); return 12 * (o + 1) + NOTE[n]
ix = lambda t: int(round(t * SR))

# ---------------- DSP 内核 ----------------
@njit(cache=True)
def osc(freq, sr, ph0, kind):
    # kind 0 = 锯齿，1 = 方波（两支错相锯齿相减），PolyBLEP 抗混叠
    n = len(freq); out = np.empty(n); ph = ph0
    for i in range(n):
        dt = freq[i] / sr
        v = 2.0 * ph - 1.0
        if ph < dt:
            t = ph / dt; v -= t + t - t * t - 1.0
        elif ph > 1.0 - dt:
            t = (ph - 1.0) / dt; v -= t * t + t + t + 1.0
        if kind == 1:
            p2 = ph + .5
            if p2 >= 1.0: p2 -= 1.0
            w = 2.0 * p2 - 1.0
            if p2 < dt:
                t = p2 / dt; w -= t + t - t * t - 1.0
            elif p2 > 1.0 - dt:
                t = (p2 - 1.0) / dt; w -= t * t + t + t + 1.0
            v = (v - w) * .5
        out[i] = v
        ph += dt
        if ph >= 1.0: ph -= 1.0
    return out

@njit(cache=True)
def ladder(x, fc, res, sr):
    # 4 极点梯形低通（非线性、带共振），fc 每个采样可变
    y1 = 0.0; y2 = 0.0; y3 = 0.0; y4 = 0.0
    out = np.empty(len(x))
    for i in range(len(x)):
        f = fc[i]
        if f > sr * .42: f = sr * .42
        if f < 20.0: f = 20.0
        g = 1.0 - np.exp(-2.0 * np.pi * f / sr)
        u = np.tanh(x[i] - 4.0 * res * y4)
        y1 += g * (u - np.tanh(y1))
        y2 += g * (np.tanh(y1) - np.tanh(y2))
        y3 += g * (np.tanh(y2) - np.tanh(y3))
        y4 += g * (np.tanh(y3) - np.tanh(y4))
        out[i] = y4
    return out

def wow(n, t0, seed):
    t = t0 + np.arange(n) / SR
    r = np.random.default_rng(seed)
    return 2 ** ((3 / 1200) * (np.sin(2 * np.pi * .37 * t + r.random() * 6.28) * .7 + np.sin(2 * np.pi * .91 * t + r.random() * 6.28) * .3))

def adsr(n, a, d, s, r, rel_at=None):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if rel_at is not None:
        ra = rel_at
        e = np.where(t > ra, np.interp(ra, t, e) * np.exp(-(t - ra) / max(r, 1e-4)), e)
    return e

def pan2(x, p):  # p: -1 左 … +1 右（等功率）
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)

def place(bus, x, t):
    i = ix(t)
    if i >= N: return
    L = min(len(x), N - i)
    bus[i:i + L] += x[:L]

# ---------------- 乐器 ----------------
def voice_saw(midi, dur, t0, detune=(-7, 0, 7), cutoff=900., res=.2, amp=1., a=.01, d=.2, s=.8, r=.3, kind=0, fenv=0., fdec=.15, seed=0, spread=.6):
    """一支（多振荡器失谐）合成音：返回立体声数组"""
    n = ix(dur + r * 5)
    w = wow(n, t0, seed)
    sig = np.zeros((n, 2))
    k = len(detune)
    rr = np.random.default_rng(seed + 11)
    for j, c in enumerate(detune):
        f = mf(midi) * 2 ** (c / 1200) * w
        o = osc(f, SR, rr.random(), kind)
        p = 0 if k == 1 else (j / (k - 1) * 2 - 1) * spread
        sig += pan2(o, p) / np.sqrt(k)
    t = np.arange(n) / SR
    fc = cutoff * (1 + fenv * np.exp(-t / fdec))
    env = adsr(n, a, d, s, r, rel_at=dur)
    out = np.stack([ladder(sig[:, 0], fc, res, SR), ladder(sig[:, 1], fc, res, SR)], 1)
    return out * env[:, None] * amp

def ir_long(dec=3.2, seed=1, pre=.02, hp=250):
    n = ix(dec * 1.6); t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ir = r.standard_normal((n, 2)) * np.exp(-t / (dec / 6.9))[:, None]
    ir[:ix(pre)] = 0
    lp = butter(1, 5200, 'low', fs=SR, output='sos'); hps = butter(1, hp, 'high', fs=SR, output='sos')
    ir = sosfilt(hps, sosfilt(lp, ir, axis=0), axis=0)
    return ir / np.sqrt((ir ** 2).sum(0).mean())

def ir_gated(length=.34, seed=2):
    n = ix(length); r = np.random.default_rng(seed)
    ir = r.standard_normal((n, 2)) * (1 - .25 * np.arange(n) / n)[:, None]
    ir[-ix(.012):] *= np.linspace(1, 0, ix(.012))[:, None]
    ir = sosfilt(butter(2, [180, 6000], 'bandpass', fs=SR, output='sos'), ir, axis=0)
    return ir / np.sqrt((ir ** 2).sum(0).mean())

def reverb(x, ir, wet):
    y = np.stack([fftconvolve(x[:, 0], ir[:, 0])[:N], fftconvolve(x[:, 1], ir[:, 1])[:N]], 1)
    return x + y * wet

def delay(x, dt, fb, wet, pingpong=True):
    d = ix(dt); y = np.zeros_like(x); cur = x.copy()
    for k in range(1, 7):
        cur = np.zeros_like(x); cur[d * k:] = x[:N - d * k] * (fb ** (k - 1))
        if pingpong and k % 2: cur = cur[:, ::-1]
        y += cur
    lp = butter(2, 3200, 'low', fs=SR, output='sos')
    return x + sosfilt(lp, y, axis=0) * wet

# ---------------- 编曲 ----------------
stems = {k: np.zeros((N, 2)) for k in ['drone', 'seq', 'bass', 'pad', 'arp', 'hits']}
cues = {}

# 2. 低 D 持续音 4.8–16.2
def drone():
    t0, t1 = 4.8, 16.2
    n = ix(t1 - t0); t = np.arange(n) / SR
    x = np.zeros((n, 2))
    for mid, g in [(m('D1'), .8), (m('D2'), .45)]:
        for c, p in [(-5, -.5), (4, .5)]:
            f = mf(mid) * 2 ** (c / 1200) * wow(n, t0, mid + c)
            x += pan2(osc(f, SR, .3, 0), p) * g
    fc = 150 + 60 * np.sin(2 * np.pi * .11 * t) + 120 * np.clip((t - 2.4) / 7, 0, 1)
    x = np.stack([ladder(x[:, 0], fc, .35, SR), ladder(x[:, 1], fc, .35, SR)], 1)
    env = np.clip(t / 2.0, 0, 1) ** 2
    place(stems['drone'], x * env[:, None] * .38, t0)
    cues['drone'] = t0
drone()

# 3. 方波十六分音符音序 7.2–16.2（Carpenter 式固定音型），滤波慢开，10.35–11.4 上扬扫频
SEQ = ['D3', 'A3', 'F3', 'A3', 'D4', 'A3', 'F3', 'A3']
def seq():
    t = 7.2; k = 0
    while t < 16.2 - 1e-6:
        prog = np.clip((t - 7.2) / 4.8, 0, 1)
        cut = 260 + 1500 * prog ** 1.5
        if 10.35 <= t < 11.4: cut += 2600 * ((t - 10.35) / 1.05) ** 2
        res = .45 + .2 * prog
        note = m(SEQ[k % 8]) + (12 if (10.35 <= t < 11.4 and k % 2) else 0)
        acc = 1.0 if k % 4 == 0 else .72
        v = voice_saw(note, .1, t, detune=(0,), cutoff=cut, res=res, amp=.56 * acc, a=.002, d=.07, s=.0, r=.05, kind=1, fenv=2.5, fdec=.05, seed=k)
        place(stems['seq'], v * [[1, .82]] if k % 2 else v * [[.82, 1]], t)
        t += S16; k += 1
    cues['seq'] = 7.2; cues['sweep'] = 10.35
seq()

# 11.4 "咚"（sub + 噪声，门限混响）；37.2 高点"咚"（tom + sub）
def thump(t0, f0=48, amp=1., tom=False):
    n = ix(1.2); t = np.arange(n) / SR
    f = f0 * (1 + 1.6 * np.exp(-t / .045))
    ph = np.cumsum(2 * np.pi * f / SR)
    x = np.sin(ph) * np.exp(-t / (.32 if tom else .42))
    if tom:
        f2 = 118 * (1 + .7 * np.exp(-t / .06)); x += .55 * np.sin(np.cumsum(2 * np.pi * f2 / SR)) * np.exp(-t / .22)
    nz = rng.standard_normal(n) * np.exp(-t / .03) * .5
    nz = sosfilt(butter(2, [300, 3000], 'bandpass', fs=SR, output='sos'), nz)
    x = np.tanh((x + nz) * 1.4) * amp
    st = pan2(x, 0)
    tmp = np.zeros((N, 2)); place(tmp, st, t0)
    tmp = reverb(tmp, ir_gated(.36 if tom else .3, 5), .55)
    stems['hits'][:] += tmp
thump(11.4, 44, .8); cues['thump1'] = 11.4

# 4 + 13. 贝斯：锯齿八分音符脉冲，滤波包络有"嗒"的起音
def bass(t0, t1, root, amp=.5, cut=240):
    t = t0; k = 0
    while t < t1 - 1e-6:
        r = root(t) if callable(root) else root
        v = voice_saw(r, S8 * .78, t, detune=(-4, 4), cutoff=cut, res=.3, amp=amp * (1 if k % 2 == 0 else .82), a=.003, d=.12, s=.55, r=.06, fenv=3.5, fdec=.035, seed=500 + k, spread=.15)
        place(stems['bass'], v, t); t += S8; k += 1
bass(12.0, 16.2, m('D2')); cues['bass1'] = 12.0

# pad：6 支失谐锯齿
def pad(notes, t0, t1, amp=.2, a=1.5, r=.9, cut=1100, bright=False, seed=0):
    for j, nm in enumerate(notes):
        mid = m(nm) if isinstance(nm, str) else nm
        v = voice_saw(mid, t1 - t0, t0, detune=(-14, -8, -3, 3, 8, 14), cutoff=cut * (1.6 if bright else 1), res=.12, amp=amp, a=a, d=1.0, s=.9, r=r, seed=seed + j * 7, spread=.8)
        place(stems['pad'], v, t0)
DM = ['D3', 'F3', 'A3', 'D4']
pad(DM + ['D2'], 12.0, 16.2, .16, a=1.5, cut=900, seed=10); cues['pad1'] = 12.0
# 6. 21.4 pad 轻轻回来，26.4 转 Bbmaj7（无三音），29.4 起淡出到 32.1
pad(DM, 21.4, 26.6, .08, a=1.8, r=.8, cut=800, seed=20); cues['pad2'] = 21.4
pad(['Bb2', 'F3', 'A3', 'D4'], 26.3, 29.4, .08, a=.6, r=1.1, cut=800, seed=30); cues['pad_bb'] = 26.4

# 8. 琶音 33.6–37.2：D3 F3 A3 C4 上行（偶尔 E4），滤波逐拍打开
def arp_note(mid, t, cut, res, amp, seed, p=0.):
    v = voice_saw(mid, S16 * .82, t, detune=(-5, 5), cutoff=cut, res=res, amp=amp, a=.002, d=.09, s=.25, r=.08, fenv=2.2, fdec=.04, seed=seed, spread=.25)
    place(stems['arp'], v * np.array([[1 - max(0, p) * .5, 1 + min(0, p) * .5]]), t)
def arp1():
    t = 33.6; k = 0
    pat = ['D3', 'F3', 'A3', 'C4']
    while t < 37.2 - 1e-6:
        beat = int((t - 33.6) / BEAT + 1e-6)
        cut = 280 + beat * 330
        nm = pat[k % 4]
        if k % 16 == 15: nm = 'E4'
        arp_note(m(nm), t, cut, .5, .44, 900 + k, p=(-.3 if k % 2 else .3))
        t += S16; k += 1
    cues['arp'] = 33.6
arp1()
bass(35.4, 37.2, m('D2'), amp=.42, cut=220); cues['bass2'] = 35.4

# 9–11. 高点和弦段：37.2 Bbmaj7 → 39.6 F/A → 42.0 Gm9 → 44.4 Ebmaj7 → 46.8 A7sus4 → 49.2 A7
CH = [
    (37.2, 39.6, ['Bb2', 'D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3', 'A3', 'Bb3', 'D4', 'F4', 'A4', 'D5'], 'Bb1'),
    (39.6, 42.0, ['A2', 'C3', 'F3', 'A3'], ['A2', 'C3', 'F3', 'A3', 'C4', 'F4', 'A4', 'C5'], 'A1'),
    (42.0, 44.4, ['G2', 'Bb2', 'D3', 'F3', 'A3'], ['G2', 'Bb2', 'D3', 'F3', 'A3', 'Bb3', 'D4'], 'G1'),
    (44.4, 46.8, ['Eb3', 'G3', 'Bb3', 'D4'], ['Eb3', 'G3', 'Bb3', 'D4', 'G3', 'Bb3'], 'Eb2'),
    (46.8, 49.2, ['A2', 'D3', 'E3', 'G3'], ['A2', 'D3', 'E3', 'G3', 'A3', 'D4', 'E4'], 'A1'),
    (49.2, 49.8, ['A2', 'C#3', 'E3', 'G3'], ['A2', 'C#3', 'E3', 'G3'], 'A1'),
]
for ci, (t0, t1, chord, arpn, root) in enumerate(CH):
    big = ci == 0
    pad(chord, t0 - (0 if big else .05), t1 + .1, .15 if ci < 2 else .11, a=(.25 if big else .5), r=1.2, cut=1300 if ci < 2 else 950, bright=False, seed=100 + ci * 13)
    if ci < 2:  # 高八度明亮层
        pad([nm[:-1] + str(int(nm[-1]) + 1) for nm in chord[1:]], t0, t1 + .1, .06, a=.6, r=1.4, cut=2600, seed=150 + ci)
    seqn = arpn + arpn[-2:0:-1]
    t = t0; k = 0
    while t < t1 - 1e-6:
        if t < 42.0: cut, amp = 3400 - (t - 37.2) * 120, .3
        elif t < 46.8: cut, amp = 1700 - (t - 42.0) * 110, .24
        elif t < 48.0: cut, amp = 1500, .24
        else: cut, amp = 1500 * np.exp(-(t - 48.0) / .55) + 180, .24
        arp_note(m(seqn[k % len(seqn)]), t, cut, .42, amp, 2000 + int(t * 100), p=np.sin(k * .9) * .5)
        t += S16; k += 1
    bass(t0, min(t1, 49.8), m(root) + 12 if root[-1] == '1' else m(root), amp=.4 if ci < 2 else .32, cut=260)
cues.update({'peak': 37.2, 'F/A': 39.6, 'Gm9': 42.0, 'Ebmaj7': 44.4, 'A7sus4': 46.8, 'A7': 49.2})
thump(37.2, 62, 1.0, tom=True); cues['thump2'] = 37.2

# 12. 49.8–51.6 悬置长音 A3
pad(['A3'], 49.8, 51.5, .1, a=.3, r=.5, cut=900, seed=300); cues['wait'] = 49.8
# 13. 51.6 D 大三和弦
pad(['D3', 'F#3', 'A3', 'D4'], 51.6, 58.6, .13, a=.9, r=.8, cut=1000, seed=320); cues['Dmaj'] = 51.6
pad(['F#4', 'A4'], 51.6, 58.6, .045, a=1.4, r=.8, cut=2400, seed=340)

# 14. 54.0–58.4 开场动机的回声：单音、八分音符、逐渐稀疏；55.2 落点
def reprise():
    motif = ['D4', 'A3', 'F#3', 'A3', 'D4', 'A3', 'F#3', 'A3']
    t = 54.0; k = 0
    while t < 58.4 - 1e-6:
        keep = True
        if t > 55.2: keep = (k % 2 == 0) if t < 56.8 else (k % 4 == 0)
        if abs(t - 55.2) < 1e-6:
            v = voice_saw(m('D5'), 1.4, t, detune=(0,), cutoff=1800, res=.35, amp=.26, a=.004, d=.5, s=.2, r=1.0, kind=1, fenv=1.2, fdec=.08, seed=4000)
            place(stems['seq'], v, t)
        elif keep:
            v = voice_saw(m(motif[k % 8]), .2, t, detune=(0,), cutoff=1300, res=.4, amp=.24 * (1 - (t - 54) / 6), a=.002, d=.12, s=0, r=.1, kind=1, fenv=2, fdec=.05, seed=4100 + k)
            place(stems['seq'], v * ([[1, .8]] if k % 2 else [[.8, 1]]), t)
        t += S8; k += 1
    cues['reprise'] = 54.0; cues['endcard_note'] = 55.2
reprise()

# ---------------- 效果、剪切、混合 ----------------
IRL = ir_long(3.6, 1); IRM = ir_long(1.6, 3, hp=300)
stems['pad'] = reverb(stems['pad'], IRL, .55)
stems['drone'] = reverb(stems['drone'], IRM, .25)
stems['seq'] = delay(stems['seq'], S8 * 1.5, .38, .35); stems['seq'] = reverb(stems['seq'], IRM, .3)
stems['arp'] = delay(stems['arp'], S8 * 1.5, .35, .32); stems['arp'] = reverb(stems['arp'], IRL, .3)
stems['bass'] = reverb(stems['bass'], IRM, .08)

# 硬切 / 数字静音区间（连混响尾巴一起清零）
t = np.arange(N) / SR
mask = np.ones(N)
for a, b in [(0, 4.8), (16.2, 21.4), (32.1, 33.6), (59.4, DUR)]:
    mask[ix(a):ix(b)] = 0
# 29.4–32.1 pad 淡出（整条总线乘包络，保证 32.1 归零）
fo = (t >= 29.4) & (t < 32.1); mask[fo] *= ((32.1 - t[fo]) / 2.7) ** 2
# 58.6 起 0.6s 淡出
fo2 = (t >= 58.6) & (t < 59.4); mask[fo2] *= np.clip((59.2 - t[fo2]) / .6, 0, 1) ** 2
# 16.2 前 4ms 斜坡防爆音
r4 = ix(.004); mask[ix(16.2) - r4:ix(16.2)] *= np.linspace(1, 0, r4)
for k in stems: stems[k] *= mask[:, None]

G = {'drone': 1.0, 'seq': .9, 'bass': .9, 'pad': 1.0, 'arp': 1.0, 'hits': .9}
mix = sum(stems[k] * G[k] for k in stems)
# 高频温柔一点
mix = sosfilt(butter(2, 9500, 'low', fs=SR, output='sos'), mix, axis=0)
mix *= (mask > 0)[:, None]   # 滤波振铃也清零：静音段保持数字静音
pk = np.abs(mix).max(); sc = 10 ** (-1.5 / 20) / pk
mix *= sc
for k in stems:
    sf.write(os.path.join(D, 'stems', k + '.wav'), (stems[k] * G[k] * sc).astype(np.float32), SR)
sf.write(os.path.join(D, 'score.wav'), mix.astype(np.float32), SR)

# ---------------- 自检 ----------------
def bands(x):
    X = np.abs(np.fft.rfft(x.mean(1))) ** 2; f = np.fft.rfftfreq(len(x), 1 / SR)
    tot = X.sum() + 1e-20
    return {k: round(10 * np.log10(X[(f >= a) & (f < b)].sum() / tot + 1e-12), 1) for k, (a, b) in {'<200': (0, 200), '200-2k': (200, 2000), '2k-8k': (2000, 8000), '8k-20k': (8000, 20000)}.items()}
SEG = [('silence', 0, 4.8), ('drone', 4.8, 7.2), ('seq', 7.2, 12.0), ('bass+pad', 12.0, 16.2), ('cut', 16.3, 21.4), ('pad2', 21.4, 29.4), ('fade', 29.4, 32.1), ('pre-earth', 32.1, 33.6),
       ('arp', 33.6, 37.2), ('peak', 37.2, 42.0), ('vo-under', 42.0, 46.8), ('send', 46.8, 49.8), ('wait', 49.8, 51.6), ('Dmaj', 51.6, 54.0), ('reprise', 54.0, 58.6), ('tail', 59.4, DUR)]
check = {}
for name, a, b in SEG:
    x = mix[ix(a):ix(b)]
    rms = np.sqrt((x ** 2).mean())
    check[name] = {'t': [a, b], 'rms_dbfs': round(20 * np.log10(rms + 1e-12), 1), 'peak': round(float(np.abs(x).max()), 4)}
    if rms > 1e-6: check[name]['bands_db'] = bands(x)
json.dump({'bpm': 100, 'dur': DUR, 'sr': SR, 'peak_dbfs': round(20 * np.log10(np.abs(mix).max()), 2), 'cues': cues, 'check': check}, open(os.path.join(D, 'score.json'), 'w'), indent=1)
print(json.dumps(check, indent=0)[:4000])
