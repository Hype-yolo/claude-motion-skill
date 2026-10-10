"""Volt · Spec Scan —— 原创电子配乐（numpy 合成，无采样）。
读 ../timeline.json 排段落，输出 score.wav / score.json / ../out/music_stems/*.wav（分轨是中间产物，不进仓库）。
120 BPM，4/4，D 小调（Dorian 色彩）。所有音符起点落在 1/16 网格（0.125 s）。
"""
import os, sys, json
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp, limit  # noqa: E402
from scipy.signal import butter, sosfilt  # noqa: E402

WORK = os.environ.get('HH_WORK') or os.path.join(HERE, '..')   # 换内容时指向 out/<name>/
OUTD = os.path.join(WORK, 'music'); os.makedirs(OUTD, exist_ok=True)
TL = json.load(open(os.path.join(WORK, 'timeline.json')))
BPM = TL.get('bpm', 120); BEAT = 60 / BPM; S16 = BEAT / 4; BAR = BEAT * 4
DUR = float(TL['dur']); N = int(round(DUR * SR))
I0, I1 = TL['intro']; R0, R1 = TL['regroup']; H0, H1 = TL['high']
L0, L1 = TL['lock']; E0, E1 = TL['end']; CALLS = TL['calls']
SIL = [[I1 - 0.5, I1], [R1 - 0.5, R1]]

rng = np.random.default_rng(52)
ONSETS = []


def q(t):
    """强制 1/16 网格"""
    g = round(t / S16) * S16
    assert abs(g - t) < 1e-6, f'off-grid onset {t}'
    return round(g, 6)


def mark(t, part): ONSETS.append({'t': q(t), 'part': part})


def stereo(): return np.zeros((N, 2))


def put(buf, x, at, gain=1.0, pan=0.0):
    """x 单声道或 (n,2)；等功率声像"""
    s = int(round(at * SR))
    if s >= N: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        x = np.stack([x * l, x * r], 1)
    e = min(N, s + len(x)); buf[s:e] += x[:e - s] * gain


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)


def blep_saw(freq, n, ph0=0.0):
    """polyBLEP 锯齿；freq 可为标量或逐样本数组"""
    f = np.broadcast_to(np.asarray(freq, float), (n,)) if np.ndim(freq) == 0 else freq
    dt = f / SR; p = (ph0 + np.cumsum(dt)) % 1.0
    y = 2 * p - 1; o = np.zeros(n)
    m = p < dt; x = p[m] / dt[m]; o[m] = x + x - x * x - 1
    m = p > 1 - dt; x = (p[m] - 1) / dt[m]; o[m] = x * x + x + x + 1
    return y - o


def square(freq, n, ph0=0.0):
    return 0.5 * (blep_saw(freq, n, ph0) - blep_saw(freq, n, ph0 + 0.5))


def adsr(n, a=0.003, tau=0.1, rel=0.01):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(t - a, 0) / tau)
    r = int(rel * SR)
    if r > 0: e[-r:] *= np.linspace(1, 0, r)
    return e


# ---------- 和声 ----------
# MIDI: D2=38 A1=33 D1=26
CH = {
    'Dm9':    [50, 53, 57, 60, 64],   # D F A C E
    'Bbmaj7': [46, 50, 53, 57, 60],   # Bb D F A C
    'Fmaj9':  [53, 57, 60, 64, 67],   # F A C E G
    'G6':     [55, 59, 62, 64, 69],   # G B D E A （Dorian 的 B 本位）
}
ROOTS = {'Dm9': 38, 'Bbmaj7': 34, 'Fmaj9': 41, 'G6': 43}
CYCLE = ['Dm9', 'Bbmaj7', 'Fmaj9', 'G6']


def in_(t, a, b): return a <= t < b - 1e-9


def chord_at(t):
    b = int(t // BAR)
    if in_(t, H0, H1): return ['Dm9', 'Bbmaj7'][int((t - H0) // BAR) % 2]
    if in_(t, E0, E1 + 1): return 'Bbmaj7' if t < E0 + BAR else 'Dm9'
    if in_(t, I0, I1): return ['Dm9', 'Dm9', 'Bbmaj7', 'Dm9'][int((t - I0) // BAR) % 4]
    return CYCLE[b % 4]


def call_idx(t):
    for c in CALLS:
        if in_(t, c['t0'], c['t1']): return c['i']
    return -1


NC = len(CALLS)
def has_hat(i): return i >= 1
def has_clap(i): return i >= 2 or (NC == 2 and i == 1)


# ---------- 各声部缓冲 ----------
ARP, BASS, DRUM, PAD = stereo(), stereo(), stereo(), stereo()

# 原创 16 步琶音音型：索引进五音集合，第二项为八度偏移
PAT = [(0, 0), (2, 0), (4, 0), (1, 1), (3, 0), (0, 1), (2, 0), (4, 0),
       (1, 0), (3, 1), (4, 0), (2, 1), (0, 0), (4, 1), (3, 0), (1, 0)]


def arp_note(m, t, cutoff, vel, glide=0.0, length=0.28, tau=0.085):
    n = int(length * SR)
    f = hz(m) * np.ones(n)
    if glide: f = hz(m) * 2 ** (glide * np.minimum(1, np.arange(n) / (0.4 * SR)) / 12)
    ph = rng.random()
    x = 0.7 * blep_saw(f, n, ph) + 0.35 * square(f * 1.003, n, ph) + 0.25 * np.sin(2 * np.pi * np.cumsum(f / 2) / SR)
    x = sosfilt(butter(2, min(cutoff, 9000), 'low', fs=SR, output='sos'), x)
    return x * adsr(n, 0.002, tau, 0.02) * vel


def add_arp(t, step, cutoff, vel, oct_=0, rate16=True, glide=0.0, length=None, tau=None, keep=5):
    idx, o = PAT[step % 16]
    if idx >= keep: return
    m = CH[chord_at(t)][idx] + 12 * (o + oct_) + 12   # 琶音在 D4 以上
    L = length or (0.28 if rate16 else 0.45); T = tau or (0.085 if rate16 else 0.16)
    put(ARP, arp_note(m, t, cutoff, vel, glide, L, T), t, 1.0, pan=0.35 if step % 2 else -0.35)
    mark(t, 'arp')


def grid(a, b, step):
    k = int(round(a / S16)); out = []
    while k * S16 < b - 1e-9:
        out.append(k * S16); k += int(round(step / S16))
    return out


# 1) 引子：2.0 起十六分，400 Hz；4–8 慢慢打开
for t in grid(I0 + 2.0, I1 - 0.5, S16):
    u = max(0, (t - (I0 + 4)) / 4)
    cut = 400 * (1 + 2.2 * u ** 1.5)
    vel = 0.35 + 0.25 * min(1, (t - I0 - 2) / 2)
    add_arp(t, int(round(t / S16)), cut, vel)

# 2) 部件段：全开；第 3 个起升八度
for c in CALLS:
    for t in grid(c['t0'], c['t1'], S16):
        up = 1 if c['i'] >= 2 else 0
        add_arp(t, int(round(t / S16)), 2600 if not up else 3000, 0.62, oct_=up)

# 3) 重组：十六分 → 八分 → 四分，末段下行滑音
act_end = R1 - 0.5
t16_end, t8_end = act_end - 1.0, act_end - 0.5
for t in grid(R0, t16_end, S16): add_arp(t, int(round(t / S16)), 2200, 0.55)
desc = [4, 2, 0]
for j, t in enumerate(grid(t16_end, t8_end, 2 * S16)):
    m = CH[chord_at(t)][desc[min(j, 2)]] + 12
    put(ARP, arp_note(m, t, 1800, 0.55, 0, 0.45, 0.16), t, 1.0, pan=0.3 - 0.6 * j); mark(t, 'arp')
for t in grid(t8_end, act_end, 4 * S16):
    m = CH[chord_at(t)][0] + 12
    put(ARP, arp_note(m, t, 1500, 0.55, glide=-12, length=0.5, tau=0.3), t, 1.0); mark(t, 'arp')

# 4) 点亮：十六分全开，高八度层叠
for t in grid(H0, H1, S16):
    st = int(round(t / S16))
    add_arp(t, st, 3200, 0.6)
    if st % 2 == 0:
        idx, o = PAT[st % 16]; m = CH[chord_at(t)][idx] + 24 + 12 * o
        put(ARP, arp_note(m, t, 3500, 0.22), t, 1.0, pan=-0.6 if st % 4 else 0.6)

# 5) 落版：八分（半速感），滤波回收
for t in grid(L0, L1, 2 * S16):
    u = (t - L0) / (L1 - L0)
    add_arp(t, int(round(t / (2 * S16))), 2000 - 700 * u, 0.5, rate16=False)

# 6) 片尾：八分，一个音一个音拿掉
end_arp_stop = E1 - 1.5
for t in grid(E0, end_arp_stop, 2 * S16):
    u = (t - E0) / (end_arp_stop - E0)
    keep = 5 - int(u * 5)
    add_arp(t, int(round(t / (2 * S16))), 1300 - 500 * u, 0.45 * (1 - 0.4 * u), rate16=False, keep=keep)

# ---------- 低频：脉冲 / 低音 / 808 ----------
def pulse_hit(t, vel=1.0, click=False):
    n = int(0.42 * SR); f = hz(26)
    x = square(f, n) * 0.6 + np.sin(2 * np.pi * 2 * f * np.arange(n) / SR)
    x = lp(x, 180) * adsr(n, 0.004, 0.13, 0.03)
    if click:
        k = np.arange(int(0.12 * SR)) / SR
        kk = np.sin(2 * np.pi * np.cumsum(55 + 110 * np.exp(-k / 0.02)) / SR) * np.exp(-k / 0.05)
        x[:len(kk)] += 0.9 * kk
    put(BASS, x * vel, t); mark(t, 'pulse')


for t in grid(I0 + 4, I1 - 0.5, BEAT): pulse_hit(t, 0.3 + 0.12 * (t - I0 - 4) / 4)
for t in grid(H0, H1, BEAT): pulse_hit(t, 0.9, click=True)
for t in grid(L0, L1, 2 * BEAT): pulse_hit(t, 0.7)            # 半速
for t in grid(E0, E0 + BAR, 2 * BEAT): pulse_hit(t, 0.5)

# 原创八分低音音型（每小节 8 步，半音相对根音，限制在 A1..D2 一带）
BPAT = [0, 0, -5, 0, 0, -2, 0, -5]
BPAT2 = [0, 0, 0, 2, 0, -2, 0, 0]


def bass_note(m, t, vel, length=0.24, cut=380):
    n = int(length * SR); f = hz(m)
    x = 0.8 * blep_saw(f, n) + 0.5 * square(f * 0.998, n) + 0.6 * np.sin(2 * np.pi * f * np.arange(n) / SR)
    e = adsr(n, 0.003, 0.12, 0.02)
    lo = lp(x, cut) * e; hi = lp(x, cut * 2.5) * e * np.exp(-np.arange(n) / SR / 0.03)
    put(BASS, (lo + 0.5 * hi) * vel, t); mark(t, 'bass')


def bass_root(t):
    r = ROOTS[chord_at(t)]
    while r > 38: r -= 12
    while r < 33: r += 12
    return r


def bass_run(a, b, vel, pat):
    for t in grid(a, b, 2 * S16):
        st = int(round((t % BAR) / (2 * S16)))
        bass_note(bass_root(t) + pat[st], t, vel)


for c in CALLS: bass_run(c['t0'], c['t1'], 0.62 + 0.1 * min(c['i'], 2), BPAT if c['i'] % 2 == 0 else BPAT2)
bass_run(H0, H1, 0.9, BPAT)
bass_note(bass_root(R0), R0, 0.7, length=0.9, cut=300)          # 重组：一记长音后撤


def sub808(t, vel=1.0, length=1.9):
    n = int(length * SR); k = np.arange(n) / SR
    f = hz(26) * (1 + 1.0 * np.exp(-k / 0.05))                    # D2→D1 下滑
    x = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * adsr(n, 0.002, 0.9, 0.2)
    put(BASS, lp(x, 220, 4) * vel, t); mark(t, 'sub')


sub808(H0, 1.0)
sub808(H0 + BAR, 0.8, 1.9)

# ---------- 鼓 ----------
def hat(t, vel):
    n = int(0.06 * SR); x = hp(rng.standard_normal(n), 7500, 4) * np.exp(-np.arange(n) / SR / 0.015)
    put(DRUM, x * vel, t, pan=0.25); mark(t, 'hat')


def clap(t, vel):
    n = int(0.3 * SR); k = np.arange(n) / SR; nz = rng.standard_normal(n)
    env = np.zeros(n)
    for d in (0, 0.011, 0.022): env += (k >= d) * np.exp(-np.maximum(k - d, 0) / (0.012 if d < 0.02 else 0.11))
    x = bp(nz, 900, 2600) * env * 0.6 + hp(nz, 5000) * env * 0.25
    x += 0.4 * np.sin(2 * np.pi * 190 * k) * np.exp(-k / 0.04)
    put(DRUM, x * vel, t, pan=-0.1); mark(t, 'clap')


HATV = [1, .45, .7, .45]
for c in CALLS:
    if has_hat(c['i']):
        for t in grid(c['t0'], c['t1'], S16): hat(t, 0.28 * HATV[int(round(t / S16)) % 4])
    if has_clap(c['i']):
        for t in grid(c['t0'] + BEAT, c['t1'], 2 * BEAT): clap(t, 0.55)
for t in grid(H0, H1, S16): hat(t, 0.32 * HATV[int(round(t / S16)) % 4])
for t in grid(H0 + BEAT, H1, 2 * BEAT): clap(t, 0.62)
for t in grid(L0 + S16 * 2, L0 + 2 * BAR, BEAT): hat(t, 0.09)   # 落版开头只留很轻的反拍 hat

# drop 冲击：宽噪声 + 反向吸气无，直接砸
k = np.arange(int(1.2 * SR)) / SR
imp = hp(rng.standard_normal(len(k)), 300) * np.exp(-k / 0.18)
imp = lp(imp, 6000)
put(DRUM, np.stack([imp, np.roll(imp, 240)], 1) * 0.35, H0); mark(H0, 'drop')

# ---------- 和弦垫 ----------
def pad_chord(t, dur, name, bright, vel, wide=False, attack=0.3, voices=4):
    n = int(dur * SR); out = np.zeros((n, 2))
    det = np.linspace(-1, 1, voices)
    for m in CH[name]:
        for ch in (0, 1):
            for d in det:
                cents = d * (18 if wide else 7) * (1 if ch == 0 else -1) + (3 if ch else 0)
                out[:, ch] += blep_saw(hz(m) * 2 ** (cents / 1200), n, rng.random())
    out /= voices * 5
    out = np.stack([lp(out[:, c], bright, 2) for c in (0, 1)], 1)
    kk = np.arange(n) / SR
    env = np.minimum(1, kk / attack) * np.minimum(1, (dur - kk) / 0.25)
    return out * env[:, None] * vel


def add_pad(a, b, bright, vel, wide=False, attack=0.3, voices=4):
    for t in grid(a, b, BAR):
        d = min(BAR, b - t) + 0.25          # 重叠 0.25 s 交叉淡化
        put(PAD, pad_chord(t, d, chord_at(t), bright, vel, wide, attack, voices), t); mark(t, 'chord')


# 引子：0–2.6 上行 pad（滤波上扫），之后维持
n = int((I1 - I0) * SR); kk = np.arange(n) / SR
x = pad_chord(I0, I1 - I0, 'Dm9', 1200, 1.0, attack=2.0)
sweep = np.clip(kk / 2.6, 0, 1)
lo = np.stack([lp(x[:, c], 350) for c in (0, 1)], 1)
x = lo * (1 - sweep[:, None]) + x * sweep[:, None]
x *= (0.35 + 0.25 * sweep)[:, None]
put(PAD, x, I0); mark(I0, 'chord')
for c in CALLS: add_pad(c['t0'], c['t1'], 900 + 250 * min(c['i'], 2), 0.3 + 0.08 * min(c['i'], 2))
add_pad(R0, R1 - 0.5, 800, 0.35)
add_pad(H0, H1, 3200, 1.0, wide=True, attack=0.01, voices=7)
add_pad(L0, L1, 1100, 0.5, attack=0.5)
# 片尾拖尾：一个长和弦 + 最后 Dm9
put(PAD, pad_chord(E0, BAR + 0.25, chord_at(E0), 1000, 0.5, attack=0.2), E0); mark(E0, 'chord')
put(PAD, pad_chord(E0 + BAR, E1 - E0 - BAR, 'Dm9', 900, 0.5, attack=0.3), E0 + BAR); mark(E0 + BAR, 'chord')

# ---------- 处理：中频让位、分段延时、门、收尾 ----------
def mid_dip(buf, amt):
    return buf - amt * np.stack([bp(buf[:, c], 1000, 4000) for c in (0, 1)], 1)


ARP = mid_dip(ARP, 0.45); PAD = mid_dip(PAD, 0.35)

gate = np.ones(N); kk = np.arange(N) / SR
for a, b in SIL:
    fo = 0.06
    gate[(kk >= a - fo) & (kk < a)] = np.linspace(1, 0, int(((kk >= a - fo) & (kk < a)).sum()))
    gate[(kk >= a) & (kk < b)] = 0.0
    fi = (kk >= b) & (kk < b + 0.003); gate[fi] = np.linspace(0, 1, fi.sum())
# 片尾：拖尾到 dur 归零
fade = (kk >= E0 + 1.0)
gate[fade] *= np.clip((DUR - 0.02 - kk[fade]) / (DUR - 0.02 - E0 - 1.0), 0, 1) ** 1.6
gate[kk >= DUR - 0.02] = 0

ARP *= gate[:, None]
# 乒乓延时（附点八分），按静音切段，尾巴不跨静音
bounds = [0] + [int(x * SR) for s in SIL for x in s] + [N]
wet = np.zeros_like(ARP); D = int(3 * S16 * SR)
for i in range(0, len(bounds), 2):
    s, e = bounds[i], bounds[i + 1]; seg = ARP[s:e]
    for r in range(1, 4):
        off = D * r
        if off >= e - s: break
        g = 0.28 * 0.5 ** (r - 1); ch = (r % 2)
        src = lp(seg[:, 0] + seg[:, 1], 2500)[:e - s - off] * 0.5
        wet[s + off:e, ch] += src * g
ARP = ARP + wet

stems = {'arp': ARP * gate[:, None] * 0.55, 'bass': BASS * gate[:, None] * 0.75,
         'drums': DRUM * gate[:, None] * 0.9, 'pad': PAD * gate[:, None] * 0.6}
mix = sum(stems.values())
ceil = 10 ** (-1.2 / 20)
mix = np.stack([limit(mix[:, c], ceil) for c in (0, 1)], 1) * gate[:, None]
pk = np.abs(mix).max()
if pk > ceil:
    mix *= ceil / pk
    for k2 in stems: stems[k2] *= ceil / pk

sf.write(os.path.join(OUTD, 'score.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
STEMS = os.path.join(WORK, 'out', 'music_stems')
os.makedirs(STEMS, exist_ok=True)
for k2, v in stems.items():
    sf.write(os.path.join(STEMS, f'{k2}.wav'), v.astype(np.float32), SR, subtype='PCM_24')
ONSETS.sort(key=lambda o: (o['t'], o['part']))
json.dump({'bpm': BPM, 'dur': DUR, 'onsets': ONSETS, 'silence': SIL},
          open(os.path.join(OUTD, 'score.json'), 'w'), indent=1)
print(f'score.wav {DUR}s, {len(ONSETS)} onsets, peak {20*np.log10(np.abs(mix).max()):.2f} dBFS')
