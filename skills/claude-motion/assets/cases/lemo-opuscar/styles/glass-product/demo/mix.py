"""混音：原创配乐（music/score.wav）+ 玻璃/金属拟音（events.json）+ 旁白（voices/）→ mix.wav（48k 立体声）
python styles/glass-product/demo/mix.py"""
import json, os, sys, numpy as np, soundfile as sf, librosa
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, compress, limit, add

rng = np.random.default_rng(23)
ev = json.load(open(os.path.join(HERE, 'events.json')))
DUR = ev['dur']; N = int(round(DUR * SR))
fx = np.zeros((N, 2)); vo = np.zeros((N, 2))


def nz(d): return rng.standard_normal(int(round(d * SR)))


def sweep(d, v):
    """光扫：手指划过玻璃杯口的 shimmer —— 高频带通噪声扫频 + 非谐波泛音"""
    tt = t_(d); n = nz(d); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        f = 2500 + 5500 * (i / len(n)); s = bp(n[max(0, i - 4000):i + hop], f * .8, f * 1.25)[-hop:]; out[i:i + len(s)] = s
    part = sum(a * np.sin(2 * np.pi * f * tt + rng.random() * 6) for f, a in [(3136, .5), (4435, .35), (5274, .25), (7040, .15)])
    e = np.sin(np.pi * tt / d) ** 2
    return norm((out * .7 + part * .12) * e) * v


def panned_sweep(buf, at, d, v, p0, p1):
    x = sweep(d, v); s = int(at * SR); n = len(x)
    pan = np.linspace(p0, p1, n); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    e = min(len(buf), s + n); buf[s:e, 0] += x[:e - s] * l[:e - s] * 1.414; buf[s:e, 1] += x[:e - s] * r[:e - s] * 1.414


def mag_click(v=1.0):
    """磁吸：极短瞬态 + 3.2k/5.1k 金属共振 + 低频咚"""
    d = .12; tt = t_(d)
    tr = hp(nz(d), 3000) * env_exp(d, .0012)
    res = sum(a * np.sin(2 * np.pi * f * tt + rng.random() * 6) * env_exp(d, tau) for f, a, tau in [(3200, .55, .018), (5100, .35, .012), (1900, .3, .025)])
    body = np.sin(2 * np.pi * 120 * tt * (1 - .3 * tt)) * env_exp(d, .018) * .6
    return norm(tr + res + body) * v


def glass_ding(freqs=(1568, 1976, 2349), d=2.4, v=1.0):
    """玻璃叮：每个音带非谐波泛音（2.76×、5.4×），长衰减"""
    tt = t_(d); x = np.zeros_like(tt)
    for f in freqs:
        for m, a, tau in [(1, 1, .9), (2.76, .35, .4), (5.4, .15, .18)]:
            x += a * np.sin(2 * np.pi * f * m * tt + rng.random() * 6) * env_exp(d, tau)
    x[:int(.002 * SR)] *= np.linspace(0, 1, int(.002 * SR))
    return norm(x) * v


def slide(d, v):
    """玻璃-金属缓慢摩擦：粗糙带通噪声，慢调制"""
    tt = t_(d); n = bp(nz(d), 300, 1400, 2)
    grain = 1 + .5 * np.sin(2 * np.pi * 7 * tt + 2 * np.sin(2 * np.pi * .9 * tt))
    e = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.5
    return norm(n * grain * e + bp(nz(d), 2500, 6000) * .08 * e) * v


def tock(v):
    d = .15; tt = t_(d)
    return norm(np.sin(2 * np.pi * 420 * tt) * env_exp(d, .02) + bp(nz(d), 800, 3000) * env_exp(d, .006) * .6) * v


def whoosh_air(d, v, f0=500, f1=2200, rev=False):
    tt = t_(d); n = nz(d); out = np.zeros_like(n); hop = 480
    for i in range(0, len(n), hop):
        u = i / len(n); f = f0 + (f1 - f0) * u; s = bp(n[max(0, i - 3000):i + hop], f * .6, f * 1.5)[-hop:]; out[i:i + len(s)] = s
    e = (tt / d) ** 3 if rev else np.sin(np.pi * tt / d) ** 2
    if rev: e[-int(.01 * SR):] *= np.linspace(1, 0, int(.01 * SR))
    return norm(out * e) * v


def puff(v):
    d = .22; tt = t_(d)
    return norm(lp(nz(d), 900) * env_exp(d, .05) * (1 - np.exp(-tt / .008))) * v


for e in ev['ev']:
    ty, t = e['type'], e['t']
    if ty == 'sweep': panned_sweep(fx, t, e['d'], e['v'], *e['pan'])
    elif ty == 'slide': add(fx, slide(e['d'], e['v']), t, 1, .1)
    elif ty == 'tock': add(fx, tock(e['v']), t, 1, 0)
    elif ty == 'click': add(fx, mag_click(e['v']), t, 1, e.get('pan', 0))
    elif ty == 'lift': add(fx, whoosh_air(e['d'], e['v'], 300, 1600), t, 1, e.get('pan', 0))
    elif ty == 'puff': add(fx, puff(e['v']), t, 1, e.get('pan', 0))
    elif ty == 'slowwhoosh': add(fx, whoosh_air(e['d'], e['v'], 1400, 250), t, 1, 0)
    elif ty == 'revwhoosh': add(fx, whoosh_air(e['d'], e['v'], 400, 3000, rev=True), t, 1, 0)
    elif ty == 'snap':
        for k in range(6): add(fx, mag_click(.55 + .08 * k), t - .075 + k * .015, 1, (k - 2.5) * .25)
        add(fx, glass_ding((2093, 2637, 3136), 2.8, .7), t, 1, 0)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
        if y.ndim > 1: y = y.mean(1)
        y = librosa.resample(y, orig_sr=sr, target_sr=SR)
        y = hp(y, 90); y = compress(y / (np.abs(y).max() + 1e-9) * .9, .3, 3.0); add(vo, y, t, 1.0, 0)

# 旁白加一点"影棚"短混响（早反射）
def early(x):
    out = x.copy()
    for dl, g in [(.011, .22), (.019, .16), (.031, .1), (.047, .06)]:
        s = int(dl * SR); out[s:] += x[:-s] * g
    return out
vo = np.stack([early(vo[:, 0]), early(vo[:, 1])], 1)

mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
if mus.ndim == 1: mus = np.stack([mus, mus], 1)
if msr != SR: mus = np.stack([librosa.resample(mus[:, c], orig_sr=msr, target_sr=SR) for c in range(2)], 1)
mus = mus[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))

# 旁白闪避：人声包络 → 音乐 −7 dB
venv = np.abs(vo).max(1); from scipy.ndimage import maximum_filter1d, uniform_filter1d
venv = uniform_filter1d(maximum_filter1d(venv, int(.25 * SR)), int(.12 * SR))
duck = 1 - (1 - 10 ** (-12 / 20)) * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
fxduck = 1 - .5 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)   # 拟音也给人声让一点
mix = mus * duck[:, None] * 1.0 + fx * .32 * fxduck[:, None] + vo * .95
# 15.5–16.0 保持绝对静默之外只留反向 whoosh（配乐本身已清零）
pk = np.abs(mix).max(); mix = mix / pk * .89
# 只削 808 drop 的最高峰（约 3 dB），给 loudnorm 留出线性增益的余量（否则会退回动态模式，响度偏 0.3 LU）
mix = np.stack([limit(mix[:, 0], .63), limit(mix[:, 1], .63)], 1) / .63 * .85
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')

def rms(a, b, x): s = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12)
print('mix.wav', DUR, 's')
for name, x in [('music', mus * duck[:, None]), ('fx', fx * .32), ("vo", vo * .85)]:
    print(f'{name:6s}', ' '.join(f'{rms(a, a + 2, x):6.1f}' for a in range(0, 32, 2)))
