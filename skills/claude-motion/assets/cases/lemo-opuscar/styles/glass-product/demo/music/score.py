"""Aura — Hear the Light · 原创配乐（纯 numpy 合成，可一键重现）
120 BPM，F 小调，32.0 s，48 kHz 立体声。
.venv/bin/python styles/glass-product/demo/music/score.py
输出：score.wav、stems/{bass,drums,arp,pad,fx,bells}.wav、score.json（关键时间点 + 自检）
"""
import os, json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
DUR = 32.0
N = int(DUR * SR)
BEAT, BAR = .5, 2.0
rng = np.random.default_rng(23)

# 808 kick 必须落点（与画面光纹脉冲一一对应）
KPAT = [0, .75, 1.0, 1.5]
KICKS_808 = [b + o for b in (16, 18, 20, 22) for o in KPAT]
SILENCE = (15.5, 16.0)


def mid(n): return 440.0 * 2 ** ((n - 69) / 12)
NOTE = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def hz(s):
    name, octv = s[:-1], int(s[-1]); return mid(12 * (octv + 1) + NOTE[name])


def T(d): return np.arange(int(round(d * SR))) / SR
def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return sosfilt(sos('low', min(f, SR * .45), o), x)
def hp(x, f, o=2): return sosfilt(sos('high', f, o), x)
def bp(x, lo, hi, o=2): return sosfilt(sos('band', [lo, min(hi, SR * .45)], o), x)


def stereo(): return np.zeros((N, 2))
def put(bus, x, t, gain=1.0, pan=0.0):
    """单声道 x 放到立体声 bus 的 t 秒处（等功率声像，pan -1..1 或逐样本数组）"""
    i = int(round(t * SR))
    if i >= N: return
    x = x[:N - i] * gain
    p = pan if np.isscalar(pan) else pan[:len(x)]
    a = (np.asarray(p) + 1) * np.pi / 4
    bus[i:i + len(x), 0] += x * np.cos(a)
    bus[i:i + len(x), 1] += x * np.sin(a)


def fade(x, fi=.003, fo=.01):
    x = x.copy(); a, b = int(fi * SR), int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x


# ——— 乐器 ———
def kick_soft(v=1.0):
    """C 段软 kick：正弦下扫 110→48 Hz，短尾"""
    t = T(.28); f = 48 + 62 * np.exp(-t / .025)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / .09) + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / .002) * .15
    return fade(x) * v


def k808(length, big=False, glide=0.0):
    """808：F1 正弦，起音从 ~2.2 倍频快速落下；长尾；可选尾部滑音（半音数，负=下滑）；软饱和"""
    t = T(length); f0 = hz('F1')
    f = f0 * (1 + 1.2 * np.exp(-t / .018))
    if glide: f *= 2 ** (glide / 12 * np.clip((t - length * .45) / (length * .5), 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / (1.1 if big else .55))
    x = np.sin(ph) * env
    x = np.tanh(x * (3.4 if big else 2.8)) / np.tanh(3.4 if big else 2.8)   # 饱和出谐波：小音箱也听得见
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / .0025) * .25
    return fade(x + click, .001, .02)


def clap(v=1.0):
    d = .45; t = T(d); n = rng.standard_normal(len(t)); env = np.zeros(len(t))
    for k, o in enumerate([0, .011, .022, .034]):
        i = int(o * SR); env[i:] += np.exp(-(t[i:] - o) / (.006 if k < 3 else .12)) * (.8 if k < 3 else 1)
    return fade(bp(n * env, 900, 4200) * v)


def hat(v=1.0, open_=False):
    d = .25 if open_ else .06; t = T(d)
    x = hp(rng.standard_normal(len(t)), 7500, 4) * np.exp(-t / (.07 if open_ else .014))
    return fade(x * v, .0005, .005)


def tick(v=1.0):
    """细碎高频：极短高频正弦 blip"""
    d = .02; t = T(d); f = rng.uniform(8000, 13000)
    return fade(np.sin(2 * np.pi * f * t) * np.exp(-t / .004) * v, .0003, .002)


def glass_pluck(f, v=1.0, cutoff=8000, d=.5):
    """FM 玻璃拨弦：2 算子，调制比 3.5（非谐）+ 指数衰减的调制指数"""
    t = T(d); I = 2.2 * np.exp(-t / .05) + .25
    x = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t))
    x += .25 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / .08)
    x *= np.exp(-t / .18)
    return fade(lp(x, cutoff), .002, .03) * v


def bell(f, v=1.0, d=3.0):
    """玻璃铃：FM 比 1.4 + 两个非谐泛音，长衰减"""
    t = T(d); I = 3 * np.exp(-t / .4) + .4
    x = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 1.4 * t)) * np.exp(-t / 1.1)
    for r, a, tau in [(2.76, .35, .5), (5.40, .18, .25), (8.93, .08, .12)]:
        x += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    return fade(x, .001, .05) * v


def pad_chord(notes, d, cutoff=1800, att=1.2, rel=1.5):
    """去谐锯齿叠层（每音 5 个声部 ±12 cent），低通；返回立体声"""
    t = T(d); L = np.zeros(len(t)); R = np.zeros(len(t))
    for n in notes:
        f = hz(n)
        for k, c in enumerate(np.linspace(-12, 12, 5)):
            ff = f * 2 ** (c / 1200); ph = rng.uniform(0, 1)
            saw = 2 * ((ff * t + ph) % 1) - 1
            if k % 2: L += saw
            else: R += saw
    env = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel).clip(0, 1)
    L, R = lp(L, cutoff, 2) * env, lp(R, cutoff, 2) * env
    s = np.stack([L, R], 1); return s / (len(notes) * 3)


def shimmer(d, direction=1):
    """光扫：非谐高频正弦簇 + 带通噪声嘶声，声像随时间扫过"""
    t = T(d); x = np.zeros(len(t))
    for f in [2637, 3136 * 1.004, 3951, 4699 * .997, 5588, 6645, 7902]:
        x += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (.6 + .4 * np.sin(2 * np.pi * rng.uniform(5, 11) * t))
    x = x / 7 + bp(rng.standard_normal(len(t)), 4000, 11000) * .5
    env = np.sin(np.pi * t / d) ** 2
    pan = direction * np.linspace(-.9, .9, len(t))
    return x * env, pan


def reverb_ir(d=2.2, seed=5):
    r = np.random.default_rng(seed); t = T(d)
    ir = np.stack([r.standard_normal(len(t)), r.standard_normal(len(t))], 1) * np.exp(-t / .55)[:, None]
    ir[:, 0] = lp(ir[:, 0], 7000); ir[:, 1] = lp(ir[:, 1], 7000)
    ir[:int(.012 * SR)] = 0  # 预延迟
    return ir / np.sqrt((ir ** 2).sum(0)).max()


# ——— 编曲 ———
stems = {k: stereo() for k in ['bass', 'drums', 'arp', 'pad', 'fx', 'bells']}
send = stereo()   # 混响送出

# A：次低频嗡鸣 0–16（黑场主导，之后压低垫在下面），15.5 全切
t_all = np.arange(N) / SR
drone = np.sin(2 * np.pi * hz('F1') * t_all) + .25 * np.sin(2 * np.pi * hz('F2') * t_all + .3)
drone *= (.55 + .45 * np.sin(2 * np.pi * t_all / 7.0 - 1.2)) * np.clip(t_all / 1.2, 0, 1)
drone *= np.interp(t_all, [0, 4, 8, 12, 15.5, 15.5001], [1.0, .85, .55, .5, .65, 0])
stems['bass'][:, 0] += drone * .26; stems['bass'][:, 1] += drone * .26

for (a, b), dirn in [((0.5, 1.7), 1), ((2.0, 3.2), -1), ((24.0, 25.3), 1)]:
    x, pan = shimmer(b - a, dirn); put(stems['fx'], x, a, .3, pan); put(send, x, a, .12, pan)
put(stems['drums'], kick_soft(.7), 2.0)

# 和弦进行（每小节）
CH = {
    'Fm9': ['F3', 'Ab3', 'C4', 'Eb4', 'G4'], 'Dbmaj9': ['Db3', 'F3', 'Ab3', 'C4', 'Eb4'],
    'Bbm9': ['Bb2', 'Db3', 'F3', 'Ab3', 'C4'], 'Eb6': ['Eb3', 'G3', 'Bb3', 'C4', 'F4'],
}
PROG = {2: 'Fm9', 3: 'Fm9', 4: 'Dbmaj9', 5: 'Dbmaj9', 6: 'Bbm9', 7: 'Bbm9',
        8: 'Fm9', 9: 'Dbmaj9', 10: 'Bbm9', 11: 'Eb6', 12: 'Fm9', 13: 'Fm9'}

# B–E：FM 玻璃拨弦琶音（16 分），滤波 900 Hz → 全开
def arp_cut(t): return float(np.interp(t, [4, 8, 12, 15.5, 16, 24], [900, 2200, 4500, 7000, 9000, 9000]))
def arp_gain(t): return float(np.interp(t, [4, 5, 8, 12, 15.4, 16, 23.5, 24], [.25, .5, .6, .65, .8, .8, .8, 0]))
ARP_ORDER = [0, 2, 4, 3, 1, 3, 4, 2]   # 和弦音索引，上下行
for bar in range(2, 12):
    notes = CH[PROG[bar]]
    for s16 in range(16):
        t = bar * BAR + s16 * BEAT / 2
        if SILENCE[0] <= t < SILENCE[1] or t >= 24 or t < 4: continue
        n = notes[ARP_ORDER[s16 % 8]]; f = hz(n) * 2   # 高八度 = 玻璃音区
        if s16 % 8 >= 4 and bar >= 8: f *= 2 if s16 % 16 == 13 else 1
        acc = 1.0 if s16 % 4 == 0 else .7
        # 旁白区间压低琶音
        vo = any(a <= t < b for a, b in [(8.55, 9.8), (12.45, 14.3)])
        g = arp_gain(t) * acc * (.6 if vo else 1)
        x = glass_pluck(f, g, arp_cut(t))
        pan = .35 * np.sin(s16 * 1.3 + bar)
        put(stems['arp'], x, t, .5, pan); put(send, x, t, .22, pan)

# B：极轻闭镲 4–8；C：细碎 tick
for s in range(16):
    t = 4 + s * .25
    if s % 2 == 1: put(stems['drums'], hat(.12), t, 1, .3)
for i in range(64):
    t = 8 + i * .0625
    if rng.random() < .35: put(stems['drums'], tick(.10), t, 1, rng.uniform(-.8, .8))

# C：软 kick 每拍（8.0/9.0/10.0/11.0 重）
for k in range(8):
    t = 8 + k * BEAT; put(stems['drums'], kick_soft(.95 if k % 2 == 0 else .5), t)
put(stems['bells'], bell(hz('C6'), .25, 2.5), 8.0, 1, -.2); put(send, bell(hz('C6'), .25, 2.5), 8.0, .5, -.2)

# D：riser（噪声扫频 + 上扬锯齿）+ 军鼓滚奏加密
d = SILENCE[0] - 12.0; t = T(d); u = t / d
nz = rng.standard_normal(len(t)); out = np.zeros(len(t)); hop = 480
for i in range(0, len(t), hop):
    fc = 400 * (20 ** u[i]); seg = bp(nz[max(0, i - 4000):i + hop], fc * .7, fc * 1.4)[-hop:]
    out[i:i + len(seg)] = seg
riser_n = out * (u ** 2.2) * .5
f_saw = hz('F3') * (4 ** (u ** 1.6)); ph = np.cumsum(f_saw) / SR
saw = (2 * (ph % 1) - 1) + (2 * ((ph * 1.007) % 1) - 1)
riser_s = lp(saw, 3000) * (u ** 2.5) * .12
put(stems['fx'], riser_n, 12.0, 1, 0); put(stems['fx'], riser_s, 12.0, 1, 0)
put(send, riser_n, 12.0, .3)
tt = 13.0
while tt < SILENCE[0] - .02:
    prog = (tt - 13) / (SILENCE[0] - 13); rate = 4 + 20 * prog ** 1.5
    sn = bp(rng.standard_normal(int(.08 * SR)), 180, 6000) * np.exp(-T(.08) / .02) + np.sin(2 * np.pi * 190 * T(.08)) * np.exp(-T(.08) / .015) * .5
    put(stems['drums'], fade(sn), tt, .05 + .22 * prog ** 1.3, rng.uniform(-.2, .2)); tt += 1 / rate
# 12.0–15.5 pad Bbm9（低，给爆炸垫底）
put_pad = lambda chord, t0, d, g, cut=1800, att=1.2, rel=1.5: stems['pad'].__setitem__(slice(int(t0 * SR), int(t0 * SR) + int(round(d * SR))), stems['pad'][int(t0 * SR):int(t0 * SR) + int(round(d * SR))] + pad_chord(chord, d, cut, att, rel) * g)
put_pad(CH['Bbm9'], 12.0, 3.5, .35, 1400, 1.5, .01)
put_pad(CH['Fm9'], 4.0, 8.0, .18, 900, 3.0, 1.0)

# E：drop 16–24
for i, t in enumerate(KICKS_808):
    nxt = KICKS_808[i + 1] if i + 1 < len(KICKS_808) else 24.0
    length = (nxt - t) if t < 23.5 else .1
    big = t in (16.0, 20.0)
    if t == 23.5: length = .1   # 最后一击极短，23.6–24.0 空
    x = k808(max(length, .1), big, glide=-2 if t in (17.5, 21.5) else 0)
    put(stems['bass'], x, t, .95 if big else .8)
for bar in range(8, 12):
    b0 = bar * BAR
    for o in (.5, 1.5):   # 2、4 拍拍手
        t = b0 + o
        if t >= 23.5: continue   # 23.5 起抽鼓
        c = clap(.55); put(stems['drums'], c, t, 1, -.1); put(send, c, t, .25)
    for s in range(16):   # 16 分细碎高频
        t = b0 + s * .125
        if t >= 23.5: continue
        v = .16 if s % 4 == 2 else .07 + .04 * rng.random()
        put(stems['drums'], hat(v, open_=(s % 8 == 6)), t, 1, .25 if s % 2 else -.25)
        if rng.random() < .3: put(stems['drums'], tick(.07), t + .0625, 1, rng.uniform(-.9, .9))
# drop pad（很低，给律动一点和声）
put_pad(CH['Fm9'], 16.0, 2.0, .16, 2400, .05, .3); put_pad(CH['Dbmaj9'], 18.0, 2.0, .16, 2400, .05, .3)
put_pad(CH['Bbm9'], 20.0, 2.0, .16, 2400, .05, .3); put_pad(CH['Eb6'], 22.0, 1.6, .16, 2400, .05, .2)

# 玻璃铃动机（原创 4 音，节奏 = kick 拍型 [0, .75, 1.0, 1.5]）
MOTIF = ['Ab5', 'C6', 'G5', 'F5']
for b0 in (18.0, 22.0):
    for o, n in zip(KPAT, MOTIF):
        x = bell(hz(n), .32, 2.0); put(stems['bells'], x, b0 + o, 1, .25); put(send, x, b0 + o, .45, .25)
# drop 与揭示的"叮"和弦
for t0, notes, g in [(16.0, ['F6', 'Ab6', 'C7'], .3), (24.0, ['F5', 'C6', 'Ab6'], .3)]:
    for k, n in enumerate(notes):
        x = bell(hz(n), g, 3.5); put(stems['bells'], x, t0 + k * .012, 1, (k - 1) * .5); put(send, x, t0, .5, (k - 1) * .5)

# F：揭示 24–28
put(stems['bass'], k808(2.4, True, glide=-1), 24.0, .95)
put_pad(['F2', 'C3', 'Ab3', 'Eb4', 'G4', 'C5'], 24.0, 8.0, .42, 2200, 1.0, 3.5)   # Fm9 延音到结尾，渐弱
# 动机最后一次（慢速，避开旁白 24.5–25.55、25.8–26.9）：27.0 起，28.0 落在"叮"上
for o, n in zip([0, .5, .75], MOTIF[:3]):
    x = bell(hz(n), .22, 2.5); put(stems['bells'], x, 27.0 + o, 1, -.2); put(send, x, 27.0 + o, .5, -.2)
# G：28.0 高音玻璃叮（收束到 F）
for k, n in enumerate(['F5', 'C6', 'F6']):
    x = bell(hz(n), .3, 4.0); put(stems['bells'], x, 28.0 + k * .01, 1, (k - 1) * .4); put(send, x, 28.0, .55, (k - 1) * .4)

# ——— 混响 + 总线 ———
ir = reverb_ir()
wet = np.stack([fftconvolve(send[:, 0], ir[:, 0])[:N], fftconvolve(send[:, 1], ir[:, 1])[:N]], 1) * .35
stems['fx'] += wet   # 混响尾计入 fx 分轨

GAIN = {'bass': .78, 'drums': 1.0, 'arp': 1.25, 'pad': .8, 'fx': 1.1, 'bells': 1.0}
i0, i1 = int(SILENCE[0] * SR), int(SILENCE[1] * SR)
end_fade = np.interp(t_all, [30.5, 31.9, 32.0], [1, 0, 0])
for k in stems:
    s = stems[k] * GAIN[k]
    # 15.5 硬切（5 ms 淡出）→ 16.0 全静
    fo = int(.005 * SR); s[i0 - fo:i0] *= np.linspace(1, 0, fo)[:, None]; s[i0:i1] = 0
    s *= end_fade[:, None]
    stems[k] = s
mix = sum(stems.values())
peak = np.abs(mix).max(); g = 10 ** (-1.5 / 20) / peak
mix *= g
for k in stems: stems[k] *= g

os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
for k, s in stems.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), s.astype(np.float32), SR, subtype='FLOAT')

# ——— 自检 ———
def db(x): r = np.sqrt(np.mean(x ** 2)) if len(x) else 0; return round(20 * np.log10(r), 2) if r > 0 else -999.0
mono = mix.mean(1)
sections = {'A 0-4': (0, 4), 'B 4-8': (4, 8), 'C 8-12': (8, 12), 'D 12-15.5': (12, 15.5), 'silence 15.5-16': (15.5, 16), 'E 16-24': (16, 24), 'F 24-28': (24, 28), 'G 28-32': (28, 32)}
sec_db = {k: db(mono[int(a * SR):int(b * SR)]) for k, (a, b) in sections.items()}
sil_rms = float(np.sqrt(np.mean(mix[i0:i1] ** 2)))

# kick 瞬态检测：低通 150 Hz 包络，在期望点 ±30 ms 窗口内找起音（包络越过窗口最大值 30% 的第一个样本）
# 用 kick/808 自带的起音 click（>2 kHz 瞬态）检测，零相位滤波无延迟；只看 kick 所在分轨（bass + 低频鼓）
from scipy.signal import sosfiltfilt
def _env(x):
    e = np.abs(x); w = int(.0005 * SR); return np.convolve(e, np.ones(w) / w, 'same')
env808 = _env(sosfiltfilt(sos('high', 2000, 4), stems['bass'].mean(1)))
envsoft = _env(sosfiltfilt(sos('band', [2000, 6500], 4), stems['drums'].mean(1)))
def onset(t, win=.03):
    env = env808 if t >= 16 else envsoft
    a, b = int((t - win) * SR), int((t + win) * SR); seg = env[a:b]
    # 用上升沿：相对前 20 ms 的增量
    # 起音 = 窗口内包络上升最快处（前一个 808 的长尾仍很响，不能用阈值法）
    dv = np.diff(seg, prepend=seg[0]); i = int(np.argmax(dv)); return (a + i) / SR
checks = []
for t in KICKS_808 + [8.0, 9.0, 10.0, 11.0, 24.0]:
    o = onset(t); checks.append({'t': t, 'detected': round(o, 4), 'err_ms': round((o - t) * 1000, 1)})
maxerr = max(abs(c['err_ms']) for c in checks)

def band(x, lo, hi):
    X = np.abs(np.fft.rfft(x)) ** 2; f = np.fft.rfftfreq(len(x), 1 / SR); return float(X[(f >= lo) & (f < hi)].sum())
seg_e = mono[16 * SR:24 * SR]; tot = band(seg_e, 20, 24000)
bands = {f'{lo}-{hi}': round(10 * np.log10(band(seg_e, lo, hi) / tot + 1e-12), 1) for lo, hi in [(20, 60), (60, 150), (150, 500), (500, 2000), (2000, 8000), (8000, 20000)]}

info = {
    'bpm': 120, 'key': 'F minor', 'dur': DUR, 'sr': SR,
    'cues': {'shimmer': [0.5, 2.0, 24.0], 'soft_kick': [2.0] + [8 + k * .5 for k in range(8)], 'lid_click_bar': 8.0,
             'riser': [12.0, 15.5], 'silence': list(SILENCE), 'drop': 16.0, 'kicks_808': KICKS_808,
             'motif': [18.0, 22.0, 27.0], 'ding': [16.0, 24.0, 28.0], 'reveal_808': 24.0, 'end': 32.0},
    'check': {'silence_rms': sil_rms, 'section_rms_dbfs': sec_db, 'peak_dbfs': round(20 * np.log10(np.abs(mix).max()), 2),
              'kick_onsets': checks, 'kick_max_err_ms': maxerr, 'drop_band_rel_db': bands},
}
json.dump(info, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
c = info['check']; print('silence_rms', c['silence_rms'], 'peak', c['peak_dbfs'], 'kick_max_err_ms', c['kick_max_err_ms']); print(c['section_rms_dbfs']); print(c['drop_band_rel_db']); print([x['err_ms'] for x in c['kick_onsets']])
