"""《The Last Save Point》原创芯片配乐：python music/score.py
读 ../timeline.json，输出 score.wav（48 kHz 立体声）+ score.json（动机、关键时间点）。
配器"色深"跟画面走：4 色段 = 单声道 + 4-bit 音量阶梯 + 11 kHz 采样保持；8-bit 段 = 单声道 NES 式；
16-bit 段 = 立体声 + SNES 式回声（3 抽头 + 反馈低通）；"现在" = 整体低通闷住。
动机 M（F 大调）：A4 C5 F5 E5 D5（3-5-1'-7-6），A 段停在属和弦上的 G4，尾声解决到 F4。
"""
import json, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '..', 'timeline.json')))
SR = 48000
DUR = TL['dur']; N = int(round(DUR * SR))
SEC = {s['id']: s for s in TL['sections']}

# ---------- 基础 ----------
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(n):
    if isinstance(n, (int, float)): return n
    k = NAMES[n[0]]; i = 1
    while i < len(n) and n[i] in '#b': k += 1 if n[i] == '#' else -1; i += 1
    return k + 12 * (int(n[i:]) + 1)
def hz(n): return 440.0 * 2 ** ((midi(n) - 69) / 12)
def ns(d): return max(1, int(round(d * SR)))
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x, axis=-1)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x, axis=-1)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x, axis=-1)

def phase(f0, n, vib=0.0, vrate=5.5, vdel=0.25, glide=None):
    t = np.arange(n) / SR
    f = np.full(n, f0, dtype=np.float64)
    if glide is not None: f = f0 * (glide / f0) ** np.clip(t / max(1e-6, n / SR), 0, 1)
    if vib: f = f * (1 + vib * np.sin(2 * np.pi * vrate * t) * np.clip((t - vdel) / .3, 0, 1))
    dt = f / SR
    return np.cumsum(dt) % 1.0, dt

def _blep(t, dt):
    y = np.zeros_like(t)
    m = t < dt; x = t[m] / dt[m]; y[m] = x + x - x * x - 1
    m = t > 1 - dt; x = (t[m] - 1) / dt[m]; y[m] = x * x + x + x + 1
    return y

def pulse(f, d, duty=.5, bl=True, **kw):
    n = ns(d); ph, dt = phase(f, n, **kw)
    y = np.where(ph < duty, 1.0, -1.0)
    if bl: y += _blep(ph, dt) - _blep((ph - duty) % 1.0, dt)
    return y - (2 * duty - 1)

TRI32 = np.concatenate([np.arange(15, -1, -1), np.arange(0, 16)]) / 7.5 - 1
def tri_nes(f, d, **kw):
    ph, _ = phase(f, ns(d), **kw); return TRI32[(ph * 32).astype(int) % 32]
def tri(f, d, **kw):
    ph, _ = phase(f, ns(d), **kw); return 2 * np.abs(2 * ph - 1) - 1

WAVE = (np.array([8, 11, 13, 14, 15, 15, 14, 13, 11, 9, 8, 7, 6, 6, 7, 8, 8, 7, 5, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]) / 7.5 - 1)
def wave(f, d, **kw):
    ph, _ = phase(f, ns(d), **kw); return WAVE[(ph * 32).astype(int) % 32]

def _lfsr(short):
    reg, out = 1, np.empty(32767 if not short else 93)
    for i in range(len(out)):
        b = (reg ^ (reg >> (6 if short else 1))) & 1; reg = (reg >> 1) | (b << 14); out[i] = reg & 1
    return out * 2 - 1
LF_LONG, LF_SHORT = _lfsr(False), _lfsr(True)
def noise(d, rate=12000, short=False):
    n = ns(d); tab = LF_SHORT if short else LF_LONG
    return tab[(np.arange(n) * rate / SR).astype(int) % len(tab)]

def saw_add(f, d, nh=24, bright=None, detune=0.0):
    n = ns(d); t = np.arange(n) / SR; y = np.zeros(n)
    if bright is None: bright = np.full(n, .6)
    for k in range(1, nh + 1):
        if f * k > 11000: break
        ph = 2 * np.pi * f * k * (1 + detune) * t
        y += np.sin(ph) / k * bright ** (k - 1)
    return y * .6

def fm(f, d, ratio, idx0, idx1, itau, **kw):
    n = ns(d); t = np.arange(n) / SR
    idx = idx1 + (idx0 - idx1) * np.exp(-t / itau)
    return np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t))

def env(n, a=.005, d=.08, s=.7, r=.06, steps=0):
    n = int(n); t = np.arange(n) / SR; dur = n / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((dur - t) / max(r, 1e-6), 0, 1); e = e * rel
    if steps: e = np.round(e * steps) / steps
    return e
def expdec(n, tau): return np.exp(-np.arange(int(n)) / SR / tau)

# ---------- 缓冲 ----------
def buf(): return np.zeros((2, N), dtype=np.float64)
def place(B, t, sig, vol=1.0, pan=0.0):
    i = int(round(t * SR)); sig = np.asarray(sig) * vol
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig)); s = sig[:j - i]
    gl, gr = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
    B[0, i:j] += s * gl; B[1, i:j] += s * gr

def mask(B, t0, t1, fin=.005, fout=.005):
    t = np.arange(N) / SR
    m = np.clip((t - t0) / max(fin, 1e-6), 0, 1) * np.clip((t1 - t) / max(fout, 1e-6), 0, 1)
    m[(t < t0) | (t >= t1)] = 0
    return B * m

def echo(B, taps=(.18, .27, .37), gains=(.5, .38, .3), fb=.4, lpf=3000, mix=.45):
    x = B.mean(0); L = len(x); D = int(round(taps[2] * SR))
    sos = butter(2, lpf, 'low', fs=SR, output='sos'); zi = np.zeros((sos.shape[0], 2))
    w = np.zeros(L); lw = np.zeros(L)
    for s in range(0, L, D):
        e = min(L, s + D)
        w[s:e] = x[s:e] + (fb * lw[s - D:e - D] if s >= D else 0)
        lw[s:e], zi = sosfilt(sos, w[s:e], zi=zi)
    def dl(sig, tt):
        k = int(round(tt * SR)); o = np.zeros(L); o[k:] = sig[:L - k]; return o
    wl = gains[0] * dl(lw, taps[0]) + gains[2] * dl(lw, taps[2])
    wr = gains[1] * dl(lw, taps[1]) + gains[2] * .8 * dl(lw, taps[2]) * -1   # 反相尾巴 = 宽
    return B + mix * np.stack([wl, wr])

def rms_db(x):
    v = np.sqrt(np.mean(x ** 2) + 1e-20); return 20 * np.log10(v)
def set_rms(B, t0, t1, target):
    i, j = int(t0 * SR), int(t1 * SR); cur = rms_db(B[:, i:j])
    return B * 10 ** ((target - cur) / 20)

def chord_tones(root, kind):
    r = midi(root); iv = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'dom': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'add9': [0, 4, 7, 14]}[kind]
    return [r + k for k in iv]

KEY = {}   # score.json 用

# ============ A 存档点（80 BPM，现在：闷住 + 长回声）============
def sec_A():
    S = SEC['A_savepoint']; b = 60 / S['bpm']; e = b / 2
    B = buf()
    # 八音盒琶音（12.5% 脉冲短拨 + 正弦）
    ch = [(0.5, 'F4', 'maj'), (5.0, 'D4', 'min'), (6.5, 'A#3', 'maj'), (8.0, 'G3', 'min'), (9.5, 'C4', 'maj')]
    pat = [0, 1, 2, 3, 2, 1]
    t = 0.5; k = 0
    while t < 11.0 - 1e-6:
        root = [c for c in ch if c[0] <= t + 1e-6][-1]; tones = chord_tones(root[1], root[2]); tones = tones + [tones[0] + 12]
        m = tones[pat[k % 6]] + 12
        sig = (pulse(hz(m), .34, .125) * .35 + np.sin(2 * np.pi * hz(m) * np.arange(ns(.34)) / SR)) * expdec(ns(.34), .12)
        fade = min(1, (t - .5) / 1.5 + .25)
        place(B, t, sig, .16 * fade, pan=(-.35 if k % 2 else .35))
        t += e; k += 1
    # 三角波低音（二分音符）
    for tt, n, d in [(2.0, 'F2', 1.5), (3.5, 'F2', 1.5), (5.0, 'D2', 1.5), (6.5, 'A#1', 1.5), (8.0, 'G2', 1.5), (9.5, 'C2', 1.5)]:
        place(B, tt, tri_nes(hz(n), d) * env(ns(d), .01, .5, .6, .15), .3)
    # 主旋律（12.5% 脉冲，带颤音）
    mel = [(2.0, 'A4', b, 1), (2.75, 'C5', b, 1), (3.5, 'F5', 2 * b, 1),
           (5.0, 'E5', 2 * b, .45), (6.5, 'D5', 2 * b, .45),
           (8.0, 'C5', b, 1), (8.75, 'A#4', b, 1), (9.5, 'A4', b, 1), (10.25, 'G4', 1.2, 1)]
    for tt, n, d, v in mel:
        sig = pulse(hz(n), d, .125, vib=.006) * env(ns(d), .01, .25, .75, .12)
        place(B, tt, sig, .3 * v, pan=.05)
    B = echo(B, mix=.55, fb=.42)
    B = lp(B, 2200, 2)
    B = mask(B, 0.4, 11.25, fin=.1, fout=.3)
    KEY['A_unresolved_G4'] = 10.25
    return set_rms(B, 2.0, 11.0, -25)

# ============ B 村庄（4 色：单声道、4-bit 音量阶梯、11 kHz 采样保持）============
def sec_B():
    S = SEC['B_village']; b = 60 / S['bpm']; e = b / 2; t0 = S['t0']
    M = np.zeros(N)
    def put(t, sig, v):
        i = int(round(t * SR)); j = min(N, i + len(sig)); M[i:j] += sig[:j - i] * v
    q = lambda d, a=.005, dd=.12, s=.6, r=.04: env(ns(d), a, dd, s, r, steps=15)
    # 旋律（50% 方波，旁白 11.5–15.5 期间退后）
    bar = [t0, t0 + 4 * b, t0 + 8 * b]
    mel = [(bar[0], 'A4', b), (bar[0] + b, 'C5', b), (bar[0] + 2 * b, 'F5', b), (bar[0] + 3 * b, 'E5', b),
           (bar[1], 'D5', b), (bar[1] + b, 'C5', b), (bar[1] + 2 * b, 'A4', 2 * b),
           (bar[2], 'F5', e), (bar[2] + e, 'G5', e), (bar[2] + b, 'A5', 1.5 * b), (bar[2] + 2.5 * b, 'C6', b * .9)]
    for tt, n, d in mel:
        v = .55 if 11.4 < tt < 15.5 else 1.0
        put(tt, pulse(hz(n), d, .5, bl=False, vib=.004) * q(d), .22 * v)
    # 转场下行琶音 17.6 → 18.0
    run = ['C6', 'A5', 'F5', 'C5', 'A4', 'F4']
    for k, n in enumerate(run): put(17.6 + k * .0667, pulse(hz(n), .075, .25, bl=False) * q(.075, .002, .03, .8, .01), .2)
    # 和声：25% 方波反拍
    chords = [(bar[0], 'F4', 'maj'), (bar[1], 'A#3', 'maj'), (bar[2], 'F4', 'maj'), (bar[2] + 2 * b, 'C4', 'maj')]
    tt = t0
    while tt < 17.55:
        c = [x for x in chords if x[0] <= tt + 1e-6][-1]; tones = chord_tones(c[1], c[2])
        for m in tones: put(tt + e, pulse(hz(m + 12), e * .8, .25, bl=False) * q(e * .8, .002, .05, .4, .02), .045)
        tt += b
    # 波表低音
    bl_ = [('F2', 'C3', 'F2', 'C3'), ('A#1', 'F2', 'A#1', 'F2'), ('F2', 'C3', 'C2', 'G2')]
    for bi, ns_ in enumerate(bl_):
        for k, n in enumerate(ns_): put(bar[bi] + k * b, wave(hz(n), b * .9) * q(b * .9, .003, .2, .7, .03), .3)
    # 噪声：长模式"鼓"在 1、3 拍，短模式镲在反拍
    tt = t0; k = 0
    while tt < 17.55:
        if k % 2 == 0: put(tt, noise(.08, 3000) * q(.08, .001, .03, .0, .02), .18)
        put(tt + e, noise(.03, 22000, short=True) * q(.03, .001, .01, .0, .01), .05)
        tt += b; k += 1
    # 11 kHz 采样保持（4 色年代的 DAC）
    ratio = SR / 11025.0
    idx = (np.floor(np.arange(N) / ratio) * ratio).astype(int)
    M = M[idx]
    M = lp(M, 8000, 2)
    B = np.stack([M, M])
    B = mask(B, t0, 18.08, fin=.01, fout=.06)
    KEY['B_point_accent'] = bar[2] + b
    return set_rms(B, t0, 18.0, -21)

# ============ C 篝火（8-bit：单声道 NES 式，6/8）============
def sec_C():
    S = SEC['C_campfire']; bar = S['bar']; e = bar / 6; t0 = S['t0']
    M = np.zeros(N)
    def put(t, sig, v):
        i = int(round(t * SR)); j = min(N, i + len(sig)); M[i:j] += sig[:j - i] * v
    q = lambda d, a=.004, dd=.15, s=.55, r=.05: env(ns(d), a, dd, s, r, steps=15)
    bars = [t0 + k * bar for k in range(5)]
    chords = [('A#3', 'maj'), ('G3', 'min'), ('D#3', 'maj'), ('F3', 'maj'), ('A#3', 'maj')]
    pat = [0, 1, 2, 3, 2, 1]
    for bi, (r, kd) in enumerate(chords):
        tones = chord_tones(r, kd); tones = tones + [tones[0] + 12]
        for k in range(6):
            put(bars[bi] + k * e, pulse(hz(tones[pat[k]] + 12), e * .9, .125) * q(e * .9, .003, .08, .3, .03), .07)
        rt = midi(r) - 12
        put(bars[bi], tri_nes(hz(rt), 3 * e * .95) * q(3 * e * .95, .005, .3, .8, .05), .32)
        put(bars[bi] + 3 * e, tri_nes(hz(rt + 7), 3 * e * .95) * q(3 * e * .95, .005, .3, .8, .05), .32)
    mel = [(bars[1], 'D5', 3 * e), (bars[1] + 3 * e, 'F5', 2 * e), (bars[1] + 5 * e, 'A#5', e),
           (bars[2], 'A5', 3 * e), (bars[2] + 3 * e, 'G5', 3 * e),
           (bars[3], 'F5', 2 * e), (bars[3] + 2 * e, 'D5', e), (bars[3] + 3 * e, 'D#5', 2 * e), (bars[3] + 5 * e, 'F5', e),
           (bars[4], 'D5', 6 * e)]
    for tt, n, d in mel:
        put(tt, pulse(hz(n), d, .25, vib=.008, vdel=.18) * q(d, .006, .3, .65, .08), .2)
    # 流星：32 分音符上行
    for k, n in enumerate(['A#5', 'D6', 'F6', 'A#6', 'D7']):
        put(24.0 + k * .05, pulse(hz(n), .09, .125) * q(.09, .002, .04, .3, .03), .09 * (1 - k * .12))
    B = np.stack([M, M]); B = lp(B, 10000, 2)
    B = mask(B, t0, 25.45, fin=.02, fout=.05)
    KEY['C_star'] = 24.0
    return set_rms(B, t0, 25.4, -23.5)

# ============ 遇敌刺音 25.4 → 26.2 ============
def sec_enc():
    B = buf(); t0, t1 = 25.4, 26.2; d = t1 - t0
    n = ns(d); t = np.arange(n) / SR
    f = 1800 * (60 / 1800) ** (t / d)
    ph = np.cumsum(f / SR) % 1
    sq = np.where(ph < .5, 1., -1.); sq = np.round(sq * np.clip(1 - t / d * .6, 0, 1) * 7) / 7
    place(B, t0, sq * .5, 1, 0)
    # 顿挫琶音 + 左右旋转
    for k in range(10):
        m = 84 - k * 3
        s = pulse(hz(m), .06, .25) * env(ns(.06), .001, .03, .3, .01)
        place(B, t0 + k * .065, s, .35, pan=np.sin(k * 1.9) * .8)
    nz = noise(d, 16000) * np.clip(t / d, 0, 1) ** 2
    place(B, t0, lp(nz, 6000) * .6, 1, 0)
    B = mask(B, t0, t1 + .02, fin=.003, fout=.02)
    return set_rms(B, t0, t1, -21)

# ============ D 战斗（16-bit，D 小调 160 BPM，立体声 + 回声，29.2 硬切）============
def sec_D():
    S = SEC['D_battle']; b = 60 / S['bpm']; e = b / 2; s16 = b / 4; t0 = S['t0']
    B = buf(); bars = [t0, t0 + 4 * b]
    # slap 低音（FM）八分音符八度跳
    roots = [('D2', 4), ('A#1', 4), ('C2', 4), ('A1', 4)]
    tt = t0
    for r, cnt in roots:
        for k in range(cnt):
            n = midi(r) + (12 if k % 2 else 0)
            sig = fm(hz(n), e * .95, 1.0, 5.0, .4, .05) * expdec(ns(e * .95), .12)
            place(B, tt, sig, .32, pan=-.1); tt += e
    # 鼓
    for k in range(8):
        tb = t0 + k * b
        kick = np.sin(2 * np.pi * np.cumsum(60 + 120 * np.exp(-np.arange(ns(.18)) / SR / .03)) / SR) * expdec(ns(.18), .07)
        if k % 2 == 0: place(B, tb, kick, .55)
        if k % 2 == 1:
            sn = (lp(noise(.16, 20000), 7000) * .8 + np.sin(2 * np.pi * 190 * np.arange(ns(.16)) / SR) * .4) * expdec(ns(.16), .05)
            place(B, tb, sn, .32, pan=.1)
        for h in range(2):
            place(B, tb + h * e, hp(noise(.04, 30000, short=h), 6000) * expdec(ns(.04), .012), .1, pan=.4)
    place(B, t0 + 7 * b + e, np.sin(2 * np.pi * np.cumsum(60 + 120 * np.exp(-np.arange(ns(.18)) / SR / .03)) / SR) * expdec(ns(.18), .07), .45)
    # 铜管和弦（反拍 stabs）
    chords = [('D4', 'min'), ('A#3', 'maj'), ('C4', 'maj'), ('A3', 'dom')]
    for ci, (r, kd) in enumerate(chords):
        for k in range(2):
            tt = t0 + ci * 2 * b + k * b + e
            for m in chord_tones(r, kd):
                d = e * .8; n_ = ns(d)
                br = .35 + .45 * np.exp(-np.arange(n_) / SR / .04)
                place(B, tt, saw_add(hz(m), d, 16, br) * env(n_, .008, .06, .6, .03), .09, pan=(-.4 if m % 2 else .4))
    # 主旋律：M 转小调（F A D' C' Bb A）+ 蓄力上行
    mel = [(bars[0], 'F5', e), (bars[0] + e, 'A5', e), (bars[0] + 2 * e, 'D6', b), (bars[0] + 4 * e, 'C6', e), (bars[0] + 5 * e, 'A#5', e), (bars[0] + 6 * e, 'A5', b)]
    run = ['A4', 'A#4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'A#5', 'C6', 'C#6', 'D6', 'E6', 'F6', 'G6', 'A6']
    for k, n in enumerate(run): mel.append((bars[1] + k * s16, n, s16))
    for tt, n, d in mel:
        for det, pan in [(0, -.25), (.004, .25)]:
            sig = pulse(hz(n) * (1 + det), d, .25) * env(ns(d), .004, .1, .7, .02)
            place(B, tt, sig, .16, pan)
    B = echo(B, mix=.35, fb=.38)
    B = mask(B, t0, S['hard_cut'], fin=.003, fout=.001)   # 29.2 一刀切（回声也切）
    return set_rms(B, t0, 29.2, -17)

# ============ E 挽歌 + 塌缩（每级掉一层保真度）============
def sec_E():
    S = SEC['E_lament_drain']; st = S['steps']; t0 = S['t0']; b = 60 / S['bpm']
    B = buf()
    mel = [(t0, 'A4'), (st[0], 'C5'), (st[1], 'F5'), (st[2], 'E5'), (st[3], 'D5')]
    # 满保真：16-bit "采样长笛" + 立体声回声（30.1–31.9）
    full = buf()
    for tt, n in mel[:3]:
        d = b + .02; n_ = ns(d); tm = np.arange(n_) / SR
        ph, _ = phase(hz(n), n_, vib=.007, vrate=5.0, vdel=.2)
        sig = (np.sin(2 * np.pi * ph) + .25 * np.sin(4 * np.pi * ph) + .08 * np.sin(6 * np.pi * ph)) * env(n_, .06, .3, .8, .08)
        place(full, tt, sig, .3, pan=.1)
    # 和声垫（30.1–31.0）
    for m in chord_tones('F3', 'maj'):
        d = st[0] - t0 + .1; n_ = ns(d)
        place(full, t0, saw_add(hz(m), d, 10, np.full(n_, .45), detune=.003) * env(n_, .15, .5, .8, .06), .12, pan=(-.5 if m % 2 else .5))
    full = mask(full, t0 - .01, 31.9 + 1.2, .05, .005)   # 回声要在 31.9 之前的内容上产生
    full = echo(full, mix=.5, fb=.4)
    harmony_gone = mask(full, t0, st[0], .05, .004)       # 30.1–31.0：全部
    # 31.0–31.9：旋律 + 回声仍在，但和声没了 → 重新渲染一遍"无和声"的版本
    mel_only = buf()
    for tt, n in mel[:3]:
        d = b + .02; n_ = ns(d)
        ph, _ = phase(hz(n), n_, vib=.007, vrate=5.0, vdel=.2)
        sig = (np.sin(2 * np.pi * ph) + .25 * np.sin(4 * np.pi * ph) + .08 * np.sin(6 * np.pi * ph)) * env(n_, .06, .3, .8, .08)
        place(mel_only, tt, sig, .3, pan=.1)
    mel_only = echo(mel_only, mix=.5, fb=.4)
    B += harmony_gone + mask(mel_only, st[0], st[1], .004, .004)
    # 低音（30.1–32.8；31.9 起干声单声道）
    d = st[2] - t0; n_ = ns(d); bass = tri(hz('F2'), d) * env(n_, .08, 1.0, .85, .02)
    bb = buf(); place(bb, t0, bass, .28, 0); B += mask(bb, t0, st[2], .05, .004)
    # 31.9–32.8：单声道干旋律（同音色，无回声）
    dry = buf()
    tt, n = mel[2]; d = b + .02; n_ = ns(d)
    ph, _ = phase(hz(n), n_, vib=.007, vrate=5.0, vdel=.2)
    place(dry, tt, (np.sin(2 * np.pi * ph) + .25 * np.sin(4 * np.pi * ph)) * env(n_, .02, .3, .8, .03), .3, 0)
    B += mask(dry, st[1], st[2], .004, .004)
    # 32.8–33.7：8-bit 细脉冲，无低音
    thin = buf(); tt, n = mel[3]
    place(thin, tt, pulse(hz(n), b, .125) * env(ns(b), .004, .2, .6, .02, steps=15), .34, 0)
    B += mask(thin, st[2], st[3], .003, .004)
    # 33.7–34.6：只剩一个方波长音
    one = buf(); tt, n = mel[4]
    place(one, tt, pulse(hz(n), b, .5) * env(ns(b), .003, 2.0, .9, .02, steps=15), .12, 0)
    B += mask(one, st[3], st[4], .003, .003)
    B = mask(B, t0, st[4], .02, .002)           # 34.6 起静音一拍
    KEY['E_steps'] = st
    return set_rms(B, t0, st[4], -25)

# ============ F 现在：稀薄高音垫、存档完成三音、门下低音、心跳 ============
def sec_F():
    S = SEC['F_present']; B = buf()
    pad = buf()
    for m, dt_ in [('F5', 0), ('C6', .003), ('G6', -.002)]:
        d = 41.8 - 35.8; n_ = ns(d); t = np.arange(n_) / SR
        sig = pulse(hz(m) * (1 + dt_), d, .125) * (0.6 + .4 * np.sin(2 * np.pi * .7 * t + midi(m)))
        place(pad, 35.8, sig * env(n_, 1.4, 1, 1, 1.4), .1, pan=(-.4 if m == 'F5' else .4))
    pad = lp(pad, 2200, 2); B += pad
    # SAVE COMPLETE：M 的前三音（A C F），亮、有回声
    jt = S['hits']['save_complete']; jin = buf()
    for k, (n, d) in enumerate([('A5', .12), ('C6', .12), ('F6', .7)]):
        tt = jt + k * .12
        place(jin, tt, pulse(hz(n), d, .25) * env(ns(d), .003, .15, .6, .12), .22, pan=(-.2, 0, .2)[k])
        place(jin, tt, np.sin(2 * np.pi * hz(midi(n) + 12) * np.arange(ns(d)) / SR) * expdec(ns(d), .15), .08, 0)
    jin = echo(jin, mix=.5, fb=.35); jin = lp(jin, 5000, 2); B += jin
    KEY['save_complete'] = {'t': [jt, jt + .12, jt + .24], 'notes': ['A5', 'C6', 'F6']}
    # 门下低音（D，预示 Boss 调）42.1–44.9
    lo = buf(); d = 44.9 - 42.1; n_ = ns(d)
    place(lo, 42.1, (tri(hz('D2'), d) * .8 + pulse(hz('D3'), d, .125) * .15) * env(n_, .8, 1, 1, .6), .35, 0)
    lo = lp(lo, 1500, 2); B += lo
    # 44.7 一下心跳似的低音
    th = np.sin(2 * np.pi * np.cumsum(45 + 40 * np.exp(-np.arange(ns(.35)) / SR / .05)) / SR) * expdec(ns(.35), .12)
    place(B, 44.7, th, .5, 0)
    B = mask(B, 35.5, 45.6, .3, .1)
    return set_rms(B, 35.5, 45.5, -31)

# ============ G 最终之门（D 小调 120 BPM；第 1 小节闷，47.5 满配，49.5 重音后切）============
def sec_G():
    S = SEC['G_lastdoor']; b = 60 / S['bpm']; e = b / 2; s16 = b / 4; t0 = S['t0']; hit = S['hits']['white_flash']
    b1 = buf(); b2 = buf()
    def timp(tt, n, v, B):
        d = .6; n_ = ns(d); t = np.arange(n_) / SR
        f = hz(n) * (1 + .5 * np.exp(-t / .02))
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n_, .25) + lp(noise(d, 8000), 900) * expdec(n_, .06) * .5
        place(B, tt, sig, v, 0)
    # 第 1 小节（45.5–47.5）：低音八分 + 定音鼓 + 滚奏
    for k in range(8):
        tt = t0 + k * e; n = 'D2'
        place(b1, tt, (tri_nes(hz(n), e * .9) + pulse(hz(n), e * .9, .5) * .3) * env(ns(e * .9), .003, .1, .7, .02), .3)
    timp(t0, 'D2', .6, b1); timp(t0 + 2 * b, 'A1', .55, b1)
    for k in range(8):
        timp(t0 + 3 * b + k * s16 / 2, 'D2', .12 + k * .04, b1)
    b1 = lp(b1, 2500, 2) * .5
    # 第 2 小节（47.5–49.5）：满配
    t2 = t0 + 4 * b
    for k in range(8):
        tt = t2 + k * e; n = ['D2', 'D2', 'D2', 'D2', 'A#1', 'A#1', 'C2', 'C2'][k]
        place(b2, tt, fm(hz(n), e * .95, 1.0, 4.0, .3, .05) * expdec(ns(e * .95), .15), .35, -.1)
        place(b2, tt, tri(hz(n), e * .95) * env(ns(e * .95), .003, .1, .8, .02), .25)
    for k in range(4):
        tb = t2 + k * b
        kick = np.sin(2 * np.pi * np.cumsum(55 + 110 * np.exp(-np.arange(ns(.2)) / SR / .03)) / SR) * expdec(ns(.2), .08)
        place(b2, tb, kick, .6)
        if k % 2 == 1:
            sn = (lp(noise(.18, 20000), 7000) * .8 + np.sin(2 * np.pi * 180 * np.arange(ns(.18)) / SR) * .4) * expdec(ns(.18), .06)
            place(b2, tb, sn, .34, .1)
        for h in range(4): place(b2, tb + h * s16, hp(noise(.03, 30000, short=True), 6000) * expdec(ns(.03), .01), .08, .45)
    # 铜管和弦
    for ci, (tt, r, kd, d) in enumerate([(t2, 'D4', 'min', 2 * b), (t2 + 2 * b, 'A#3', 'maj', b), (t2 + 3 * b, 'C4', 'maj', b)]):
        for m in chord_tones(r, kd):
            n_ = ns(d); br = .35 + .3 * np.exp(-np.arange(n_) / SR / .1)
            place(b2, tt, saw_add(hz(m), d, 14, br, detune=.002) * env(n_, .02, .2, .75, .05), .07, pan=(-.5 if m % 2 else .5))
    # 旋律：铜管八度（旁白 48.04 结束后进入）
    for tt, n, d in [(t2 + b, 'F5', b), (t2 + 2 * b, 'A5', b), (t2 + 3 * b, 'D6', b)]:
        for oc, pan in [(0, -.3), (-12, .3)]:
            m = midi(n) + oc; n_ = ns(d); br = .4 + .35 * np.exp(-np.arange(n_) / SR / .08)
            place(b2, tt, saw_add(hz(m), d, 18, br) * env(n_, .015, .2, .8, .04), .14, pan)
            place(b2, tt, pulse(hz(m), d, .5) * env(n_, .01, .2, .7, .04), .05, -pan)
    # 升腾噪声
    d = hit - t2; n_ = ns(d); t = np.arange(n_) / SR
    riser = bp(noise(d, 24000), 800, 7000) * (t / d) ** 2
    place(b2, t2, riser, .12, 0)
    # 49.5 重音
    hb = buf()
    for m in [38, 50, 53, 57, 62, 65, 69, 74]:
        d = .9; n_ = ns(d); br = .5 + .3 * np.exp(-np.arange(n_) / SR / .1)
        place(hb, hit, saw_add(hz(m), d, 14, br) * env(n_, .005, .25, .5, .4), .08, pan=(-.5 if m % 2 else .5))
    boom = np.sin(2 * np.pi * np.cumsum(40 + 120 * np.exp(-np.arange(ns(1.0)) / SR / .04)) / SR) * expdec(ns(1.0), .3)
    place(hb, hit, boom, .8, 0)
    place(hb, hit, lp(noise(1.2, 30000), 9000) * expdec(ns(1.2), .35), .25, 0)
    hb = mask(hb, hit, hit + .35, .001, .15)                 # 重音本身只留短促
    b2 = mask(b2, t2, hit, .003, .004) + hb
    b2 = echo(b2, mix=.4, fb=.4)
    B = mask(b1, t0, t2 + .02, .01, .02) + mask(b2, t2, hit + .8, .002, .5)
    KEY['G_flood'] = t2; KEY['G_hit'] = hit
    B = set_rms(B, t0, hit, -18)
    return B

# ============ H 尾声：解决到主和弦 ============
def sec_H():
    S = SEC['H_coda']; b = 60 / S['bpm']; e = b / 2; t0 = S['t0']; t1 = S['t1']
    B = buf()
    mel = [(t0, 'D5', b), (t0 + b, 'C5', b), (t0 + 2 * b, 'A#4', e), (t0 + 2 * b + e, 'G4', e), (t0 + 3 * b, 'A4', b), (t0 + 4 * b, 'F4', t1 - t0 - 4 * b)]
    for tt, n, d in mel:
        n_ = ns(d); sig = fm(hz(n), d, 3.5, 3.0, .3, .15) * expdec(n_, .9 if d > 1 else .5) * env(n_, .004, 1, 1, .1)
        place(B, tt, sig, .22, .1)
        place(B, tt, pulse(hz(n), d, .125) * env(n_, .01, .3, .4, .1), .05, -.1)
    for tt, r, kd, d in [(t0, 'A#3', 'maj', 2 * b), (t0 + 2 * b, 'C4', 'maj', 2 * b), (t0 + 4 * b, 'F3', 'add9', t1 - t0 - 4 * b)]:
        for m in chord_tones(r, kd):
            n_ = ns(d)
            place(B, tt, saw_add(hz(m), d, 8, np.full(n_, .4), detune=.003) * env(n_, .3, .5, .8, .3), .06, pan=(-.5 if m % 2 else .5))
    pat = [0, 1, 2, 1]; tt = t0; k = 0
    chords = [(t0, 'A#4', 'maj'), (t0 + 2 * b, 'C5', 'maj'), (t0 + 4 * b, 'F4', 'maj')]
    while tt < t0 + 4 * b + 2 * e:
        c = [x for x in chords if x[0] <= tt + 1e-6][-1]; m = chord_tones(c[1], c[2])[pat[k % 4]] + 12
        place(B, tt, np.sin(2 * np.pi * hz(m) * np.arange(ns(.3)) / SR) * expdec(ns(.3), .1), .05, (-.4 if k % 2 else .4))
        tt += e; k += 1
    B = echo(B, mix=.45, fb=.38)
    B = mask(B, t0, t1, .01, .6)
    KEY['H_resolve_F4'] = t0 + 4 * b
    return set_rms(B, t0, t1 - .6, -23)

# ---------- 总装 ----------
parts = {'A': sec_A(), 'B': sec_B(), 'C': sec_C(), 'enc': sec_enc(), 'D': sec_D(), 'E': sec_E(), 'F': sec_F(), 'G': sec_G(), 'H': sec_H()}
MIX = sum(parts.values())
MIX = lp(MIX, 12000, 2)
# 硬静音窗（连回声、滤波拖尾一起清零）
for a, b_ in [(29.2, 30.1), (34.6, 35.5), (50.3, 50.4)]:
    MIX[:, int(a * SR):int(b_ * SR)] = 0
MIX[:, -1:] = 0
pk = np.abs(MIX).max(); MIX *= 10 ** (-1.5 / 20) / pk
sf.write(os.path.join(HERE, 'score.wav'), MIX.T.astype(np.float32), SR, subtype='PCM_24')

# ---------- 自检 ----------
def band_db(x, lo, hi):
    X = np.abs(np.fft.rfft(x.mean(0))) ** 2; f = np.fft.rfftfreq(x.shape[1], 1 / SR)
    return 10 * np.log10(X[(f >= lo) & (f < hi)].sum() / (X.sum() + 1e-20) + 1e-20)
report = {}
for s in TL['sections']:
    i, j = int(s['t0'] * SR), int(s['t1'] * SR); seg = MIX[:, i:j]
    if j - i < SR * .2: continue
    report[s['id']] = {'rms_db': round(rms_db(seg), 1), 'peak_db': round(20 * np.log10(np.abs(seg).max() + 1e-12), 1),
                       'hf_8_20k_rel_db': round(band_db(seg, 8000, 20000), 1) if np.abs(seg).max() > 1e-6 else None}
for a, b_ in [(29.2, 30.1), (34.6, 35.5)]:
    seg = MIX[:, int(a * SR):int(b_ * SR)]; report[f'silence_{a}-{b_}_peak_db'] = round(20 * np.log10(np.abs(seg).max() + 1e-12), 1)
report['master_peak_db'] = round(20 * np.log10(np.abs(MIX).max()), 2)
report['clipped_samples'] = int((np.abs(MIX) >= 1.0).sum())
KEY['motif_M'] = {'key': 'F major', 'notes': ['A4', 'C5', 'F5', 'E5', 'D5'], 'degrees': '3-5-1\'-7-6',
                  'A_phrase': 'A4 C5 F5 | E5 D5 | C5 A#4 A4 G4 (ends on dominant, unresolved)',
                  'H_resolution': 'D5 C5 A#4 G4 A4 F4 (tonic)'}
KEY['sections'] = {s['id']: [s['t0'], s['t1']] for s in TL['sections']}
KEY['encounter_stinger_in_score'] = [25.4, 26.2]
KEY['selfcheck'] = report
json.dump(KEY, open(os.path.join(HERE, 'score.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(report, indent=1))
