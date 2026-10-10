"""《Sunday Ride》混音：配乐 + 旁白（闪避）+ 拟音 + 环境 → mix.wav
在仓库根运行：.venv/bin/python styles/risograph/demo/mix.py
拟音跟材质走：纸（印刷机进纸/滚筒/出纸/落纸）、金属小钟（车铃、刹车）、面包皮、鸽子羽毛、水。"""
import os, sys, json, numpy as np, soundfile as sf, soxr
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'music'))
from core.audio.sfx import SR, t_, bp, lp, hp, noise, norm, compress, limit, add, thump, click
from bell import bell

D = os.path.dirname(os.path.abspath(__file__))
EVJ = json.load(open(os.path.join(D, 'events.json')))
EV, DUR = EVJ['ev'] if 'ev' in EVJ else EVJ['EV'] if 'EV' in EVJ else EVJ['events'], EVJ['dur']
N = int(DUR * SR)
rng = np.random.default_rng(7)
nz = lambda d: rng.standard_normal(int(round(d * SR)))
def mixin(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o
env = lambda d, a, r: np.minimum(1, t_(d) / max(a, 1e-4)) * np.exp(-np.maximum(0, t_(d) - a) / r)

# ───── 拟音 ─────
def riso_drum(v=1.0):          # 进纸"唰" + 滚筒"咔嚓—咚"
    d = .7; x = np.zeros(int(d * SR))
    feed = bp(nz(.32), 1800, 7000) * np.linspace(0, 1, int(.32 * SR)) ** 1.5 * .35
    x[:len(feed)] += feed
    k = int(.3 * SR)
    cl = hp(nz(.03), 1500) * np.exp(-t_(.03) / .004) * .9
    x[k:k + len(cl)] += cl
    th = np.sin(2 * np.pi * 62 * t_(.4) * (1 - .25 * t_(.4))) * np.exp(-t_(.4) / .09) * 1.1
    x[k:k + len(th)] += th
    rat = bp(nz(.25), 300, 1200) * np.exp(-t_(.25) / .06) * .3
    x[k + 600:k + 600 + len(rat)] += rat
    return x * v
def door_chime(v=1.0):
    x = np.zeros(int(1.4 * SR))
    for i, f in enumerate([1568, 1976]):
        s = int(i * .12 * SR); tt = t_(1.4 - i * .12)
        x[s:s + len(tt)] += (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt / .5) * .4
    return x * v
def catch(v=1.0):
    return mixin(lp(nz(.12), 900) * np.exp(-t_(.12) / .025) * .8, bp(nz(.18), 2500, 8000) * np.exp(-t_(.18) / .04) * .25) * v
def flap(v=1.0, f0=900):
    d = .09; return bp(nz(d), f0, f0 * 3.5) * np.sin(np.pi * t_(d) / d) ** 2 * v
def flock(v=1.0):
    x = np.zeros(int(2.2 * SR), dtype=float); out = np.zeros((len(x), 2))
    for b in range(14):
        t0 = rng.random() * .4; rate = 9 + rng.random() * 6; pan = rng.uniform(-.8, .8); f0 = 600 + rng.random() * 700
        n = int((1.2 + rng.random() * .6) * rate)
        for k in range(n):
            at = t0 + k / rate; g = np.exp(-at / 1.1) * (.6 + .4 * rng.random())
            add(out, flap(g, f0), at, .35, pan)
    return out
def coo(v=1.0):
    d = .9; tt = t_(d)
    f = 330 + 60 * np.sin(np.pi * np.minimum(1, tt / .35)) - 40 * (tt > .45)
    ph = 2 * np.pi * np.cumsum(f) / SR
    am = np.clip(np.sin(np.pi * tt / .4), 0, 1) + np.clip(np.sin(np.pi * (tt - .45) / .45), 0, 1) * .8
    x = (np.sin(ph) + .35 * np.sin(2 * ph) + .1 * np.sin(3 * ph)) * am
    return lp(x, 1400) * .35 * v
def brake(v=1.0):
    d = .45; tt = t_(d); f = 2350 + 60 * np.sin(2 * np.pi * 23 * tt)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) ** .6 * .25 + bp(nz(d), 3000, 7000) * .05
    return x * v
def church(v=1.0):
    d = 3.5; tt = t_(d); x = np.zeros(len(tt))
    for f, a, tau in [(220, 1, 2.2), (440.8, .5, 1.6), (523, .35, 1.3), (659, .25, 1.0), (880, .2, .8), (110, .5, 2.8)]:
        x += a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / tau)
    return lp(x, 1800) * .18 * v
def snap(v=1.0):
    return mixin(hp(nz(.02), 2000) * np.exp(-t_(.02) / .003), np.sin(2 * np.pi * 180 * t_(.06)) * np.exp(-t_(.06) / .015) * .6) * v
def crunch(v=1.0):
    d = .35; x = np.zeros(int(d * SR))
    for k in range(40):
        s = int(rng.random() * (d - .02) * SR * (.4 + .6 * rng.random())); c = bp(nz(.006), 2000, 9000) * np.exp(-t_(.006) / .0015)
        x[s:s + len(c)] += c * (1 - s / len(x))
    x += lp(nz(d), 500) * np.exp(-t_(d) / .05) * .5
    return x * .8 * v
def peck(v=1.0):
    return (hp(nz(.012), 1500) * np.exp(-t_(.012) / .002) * .6) * v
def paper_out(d=2.0, v=1.0):   # 印刷机出纸：马达嗡 + 滚轮 + 纸面摩擦
    tt = t_(d); e = np.minimum(1, tt / .15) * np.minimum(1, (d - tt) / .2)
    motor = (np.sin(2 * np.pi * 100 * tt) * .3 + np.sin(2 * np.pi * 200 * tt) * .15) * (1 + .3 * np.sin(2 * np.pi * 7 * tt))
    rub = bp(nz(d), 1500, 6000) * .18 * (1 + .5 * np.sin(2 * np.pi * 13 * tt))
    return lp(motor, 600) * e * .5 + rub * e * v
def paper_land(v=1.0):
    return mixin(lp(nz(.25), 1200) * np.exp(-t_(.25) / .05) * .7, bp(nz(.3), 2500, 8000) * np.exp(-t_(.3) / .07) * .15) * v
def whoosh_swell(v=1.0):
    d = 1.0; tt = t_(d); e = (tt / d) ** 2 * np.exp(-np.maximum(0, tt - .6) / .1)
    return bp(nz(d), 400, 3000) * e * .5 * v

# ───── 环境 ─────
def birds(d, dens, v=1.0):
    out = np.zeros((int(d * SR), 2))
    for k in range(int(d * dens)):
        at = rng.random() * d; f = 2800 + rng.random() * 2500; n = 2 + int(rng.random() * 4)
        for j in range(n):
            ch = t_(.06); ff = f * (1 + .25 * np.sin(np.pi * ch / .06)); c = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.sin(np.pi * ch / .06) ** 2
            add(out, c * .05 * v, at + j * .09, 1, rng.uniform(-.9, .9))
    return out
def water(d, v=1.0):
    tt = t_(d); x = lp(nz(d), 700) * (0.6 + .4 * np.sin(2 * np.pi * .7 * tt) * np.sin(2 * np.pi * .23 * tt + 1))
    lap = np.zeros(len(tt))
    for k in range(int(d * 1.6)):
        s = int(rng.random() * (d - .4) * SR); lap[s:s + int(.35 * SR)] += bp(nz(.35), 300, 1400) * np.sin(np.pi * t_(.35) / .35) ** 2 * .6
    return (x * .25 + lap * .3) * v
def ride(d, v=1.0):             # 轮胎压石板 + 链条
    tt = t_(d); x = lp(nz(d), 260) * .35 + bp(nz(d), 2500, 6000) * .025 * (1 + np.sin(2 * np.pi * 5.5 * tt))
    return x * v

mix = np.zeros((N, 2)); fx = np.zeros((N, 2)); vo = np.zeros((N, 2))
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'drum': add(fx, riso_drum(), t - .3 if t > .3 else 0, .55, {'blue': -.3, 'yellow': 0, 'pink': .3}[e['plate']])
    elif ty == 'bell': b = bell(n_rings=e.get('n', 2), sr=SR, seed=int(t * 10)); add(fx, b, t, .28 * e.get('gain', 1), .2)
    elif ty == 'doorchime': add(fx, door_chime(), t, .25, -.4)
    elif ty == 'catch': add(fx, catch(), t, .7, -.1)
    elif ty == 'flock': add(fx, flock()[:, 0], t, .55, -.2); add(fx, flock()[:, 1], t + .05, .55, .3)
    elif ty == 'flap':
        for k in range(4): add(fx, flap(.6), t + k * .09, .5, .4)
    elif ty == 'land': add(fx, catch(.5), t, .5, .3)
    elif ty == 'coo': add(fx, coo(), t, .8, .35)
    elif ty == 'whoosh': add(fx, whoosh_swell(), t - .8, .7, 0)
    elif ty == 'brake': add(fx, brake(), t, .8, 0)
    elif ty == 'church': add(fx, church(), t, .9, -.5)
    elif ty == 'snap': add(fx, snap(), t, .6, 0)
    elif ty == 'crunch': add(fx, crunch(), t, .9, -.1)
    elif ty == 'peck': add(fx, peck(), t, .7, .3)
    elif ty == 'paperout': add(fx, paper_out(2.0), t, .7, 0)
    elif ty == 'paperland': add(fx, paper_land(), t, .8, 0)
    elif ty == 'amb':
        d = e['t1'] - t; k = e['kind']
        if k in ('street', 'bakery'): a = birds(d, .8 if k == 'street' else 1.3, .7)
        elif k == 'park': a = birds(d, 2.5, .9)
        else: a = birds(d, 1.0, .6); w = water(d, .45); a[:, 0] += w * .9; a[:, 1] += w
        fade = np.minimum(1, np.minimum(t_(d), d - t_(d)) / .15)[:, None]
        s = int(t * SR); fx[s:s + len(a)] += (a * fade)[:N - s]
    elif ty == 'ride':
        d = e['t1'] - t; r = ride(d, e.get('v', 1)); fade = np.minimum(1, np.minimum(t_(d), d - t_(d)) / .1); add(fx, r * fade, t, .5, 0)
    elif ty == 'vo':
        y, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav'))
        if y.ndim > 1: y = y.mean(1)
        y = soxr.resample(y, sr, SR); y = compress(y / (np.abs(y).max() + 1e-9) * .9, thr=.3, ratio=3); add(vo, y, t, .75, 0)

# 配乐 + 旁白闪避（−8 dB，平滑）
mus, msr = sf.read(os.path.join(D, 'music', 'score.wav'))
if msr != SR: mus = soxr.resample(mus, msr, SR)
mus = mus[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
act = (np.abs(vo).max(1) > .02).astype(float)
from scipy.ndimage import uniform_filter1d, maximum_filter1d
act = maximum_filter1d(act, int(.25 * SR)); act = uniform_filter1d(act, int(.2 * SR))
duck = 1 - act * (1 - 10 ** (-8 / 20))
mix = mus * duck[:, None] * .95 + fx * .8 + vo
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
# 电平表（每 2 秒）
for s in range(0, int(DUR), 2):
    a, b = s * SR, (s + 2) * SR
    r = lambda x: 20 * np.log10(np.sqrt((x[a:b] ** 2).mean()) + 1e-9)
    print(f'{s:2d}s  mix {r(mix):6.1f}  music {r(mus * duck[:, None]):6.1f}  vo {r(vo):6.1f}  fx {r(fx * .8):6.1f}')
print('wrote mix.wav')
