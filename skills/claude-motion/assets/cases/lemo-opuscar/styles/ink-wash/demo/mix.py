"""混音：旁白 + 原创配乐（music/score.wav）+ 按材质合成的拟音（纸、墨、水、丝、铁、木）+ 环境（风、江水）
用法：.venv/bin/python styles/ink-wash/demo/mix.py  → demo/mix.wav（48k 立体声，未归一，mux.sh 做 −14 LUFS）"""
import sys, os, json, numpy as np, soundfile as sf, soxr
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, noise, bp, lp, hp, env_exp, brown, whoosh, compress, limit, add
D = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(D, 'events.json')))
DUR = ev['dur']; E = ev['ev']
N = int(DUR * SR)
rng = np.random.default_rng(11)
def env_adsr(d, a=.01, r=.1):
    n = len(t_(d)); e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

# ---------- 拟音（材质）----------
def drip(v=1.):         # 墨/水滴落在纸上：短促的下滑"嘀"+ 湿软的噗
    d = .35; t = t_(d)
    f = 1300 * np.exp(-t / .02) + 380
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .045)
    thud = lp(noise(d), 900) * np.exp(-t / .03) * .5
    return (tone * .6 + thud) * v
def brush(d=.4, v=1.):   # 毛笔/剑气破空：带通噪声 + 毛刷的颗粒感
    t = t_(d); x = bp(noise(d), 1200, 6500)
    grain = (rng.random(len(t)) < .02) * rng.standard_normal(len(t)) * 2
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return (x + bp(grain, 2000, 8000) * .4) * e * v * .5
def water_step(v=1.):    # 足尖点水：轻水花 + 小"咚"
    d = .5; t = t_(d)
    sp = bp(noise(d), 900, 5000) * np.exp(-t / .05)
    plop = np.sin(2 * np.pi * (240 + 400 * np.exp(-t / .015)) * t) * np.exp(-t / .07)
    drops = np.zeros(len(t))
    for k in range(5):
        s = int((.05 + rng.random() * .3) * SR); f = 1800 + rng.random() * 2500; L = int(.03 * SR)
        if s + L < len(t): drops[s:s + L] += np.sin(2 * np.pi * f * t[:L]) * np.exp(-t[:L] / .006) * .25
    return (sp * .6 + plop * .45 + drops) * v
def splash(v=1.):
    d = 1.2; t = t_(d)
    return (bp(noise(d), 300, 4000) * np.exp(-t / .25) + lp(noise(d), 400) * np.exp(-t / .4) * .6) * v
def skid(v=1.):
    d = 1.0; t = t_(d)
    return bp(noise(d), 500, 3500) * np.exp(-t / .35) * (1 - np.exp(-t / .03)) * v * .7
def sword(v=1.):         # 拔剑：铁鞘摩擦上行 + 长而细的金属清鸣
    d = 2.4; t = t_(d)
    scrape = bp(noise(d), 2500, 7000) * np.clip(1 - t / .35, 0, 1) * (t < .35) * .5
    ring = sum(a * np.sin(2 * np.pi * f * t + p) * np.exp(-t / tau) for f, a, tau, p in [(1870, .5, 1.1, 0), (3140, .35, .8, 1), (4420, .25, .6, 2), (6110, .15, .4, 3), (2490, .2, .9, .5)])
    ring *= (1 - np.exp(-np.maximum(t - .3, 0) / .005)) * (t > .3)
    return (scrape + ring * .5) * v
def cut(v=1.):           # 断流：撕裂的气流 + 江水被劈开的轰响 + 低频冲击
    d = 2.6; t = t_(d)
    tear = bp(noise(d), 800, 9000) * np.exp(-t / .12) * 1.2
    roar = lp(brown(d), 900) * np.exp(-t / .9) * 2.5
    boom = np.sin(2 * np.pi * (45 + 60 * np.exp(-t / .05)) * t) * np.exp(-t / .5)
    return (tear + roar + boom * .9) * v
def splatter(v=1.):      # 墨点落纸：许多极短的湿点
    d = 1.2; x = np.zeros(len(t_(d)))
    for k in range(70):
        s = int(rng.random() ** 1.6 * (d - .05) * SR); L = int(.018 * SR); tt = np.arange(L) / SR
        x[s:s + L] += bp(rng.standard_normal(L), 1500, 7000) * np.exp(-tt / .004) * (.3 + rng.random() * .7)
    return x * v * .6
def collapse(v=1.):
    d = 2.8; t = t_(d)
    return (lp(brown(d), 700) * 2 + bp(noise(d), 300, 2500) * .5) * np.exp(-t / 1.1) * (1 - np.exp(-t / .1)) * v
def waterclose(v=1.):
    d = 1.8; t = t_(d)
    return bp(noise(d), 200, 2200) * np.sin(np.pi * t / d) ** 2 * v * .6
def cloth(v=1.):
    d = .5; t = t_(d)
    return bp(noise(d), 300, 3000) * np.sin(np.pi * t / d) * v * .35
def seal(v=1.):          # 木印压纸：闷的一"咚" + 纸面细响
    d = .6; t = t_(d)
    thud = np.sin(2 * np.pi * (110 + 80 * np.exp(-t / .01)) * t) * np.exp(-t / .08)
    knock = bp(noise(d), 600, 2400) * np.exp(-t / .012) * .6
    paper = bp(noise(d), 3000, 9000) * np.exp(-t / .05) * .12
    return (thud + knock + paper) * v

FX = dict(drip=drip, brush=lambda v=1, dur=.4: brush(dur + .15, v), step=water_step, splash=splash, skid=skid, sword=sword,
          cut=cut, splatter=splatter, collapse=collapse, waterclose=waterclose, cloth=cloth, seal=seal, whoosh=lambda v=1: whoosh(.4, v))
PAN = dict(step=-.1, sword=-.3, splash=.3, skid=.35, seal=-.2)

fx = np.zeros((N, 2), np.float32); amb = np.zeros((N, 2), np.float32)
for e in E:
    k = e['type']
    if k in FX:
        g = e.get('gain', 1)
        x = FX[k](g, e['dur']) if k == 'brush' and 'dur' in e else FX[k](g)
        if k == 'sword':            # 清鸣在第二段静默前必须收掉
            end = int((30.45 - e['t']) * SR); x = x[:end]; x[-int(.2 * SR):] *= np.linspace(1, 0, int(.2 * SR))
        add(fx, x.astype(np.float32), e['t'], .5, PAN.get(k, 0))
    elif k == 'amb':
        t0, t1 = e['t0'], e['t1']; d = t1 - t0; t = t_(d)
        if e['kind'] == 'wind': x = lp(brown(d), 500) * (0.6 + .4 * np.sin(2 * np.pi * t / 7.3)) * .5
        elif e['kind'] == 'water': x = bp(noise(d), 200, 1400) * (.5 + .5 * np.abs(np.sin(2 * np.pi * t / 2.9))) * .12
        else: x = lp(brown(d), 300) * np.clip(t / d, 0, 1) ** 2 * 1.4
        f = int(.5 * SR); fo = int(.02 * SR) if abs(t1 - 26.8) < .01 else f
        x[:f] *= np.linspace(0, 1, f); x[-fo:] *= np.linspace(1, 0, fo)
        add(amb, x.astype(np.float32), t0, .35, 0)

# ---------- 旁白 ----------
vo = np.zeros((N, 2), np.float32); vmask = np.zeros(N)
for e in E:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav'))
    y = soxr.resample(y, sr, SR).astype(np.float32)
    pk = np.abs(y).max(); y = y / pk * .8
    y = compress(y, thr=.22, ratio=3.2)
    add(vo, y, e['t'], 1.0, 0)
    s = int(e['t'] * SR); vmask[s:s + len(y)] = 1

# ---------- 配乐 ----------
mu, sr = sf.read(os.path.join(D, 'music', 'score.wav'))
if sr != SR: mu = soxr.resample(mu, sr, SR)
mus = np.zeros((N, 2), np.float32); L = min(N, len(mu)); mus[:L] = mu[:L]
# 人声闪避：−6 dB，前后 0.25 s 平滑
from scipy.ndimage import uniform_filter1d
duck = 1 - .62 * np.clip(uniform_filter1d(vmask, int(.5 * SR)) * 1.6, 0, 1)
mus *= duck[:, None]; amb *= (1 - .7 * (1 - duck) / .62)[:, None]

# ---------- 配平 ----------
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
vo_active = vo[vmask > 0]
vo *= .16 / rms(vo_active)                 # 人声作为基准
mus *= 1.0
fx *= 1.0
mix = vo + mus * 1.35 + fx * .9 + amb * .7
# 静默窗口：全部清零（20 ms 淡出淡入）
for e in E:
    if e['type'] != 'silence': continue
    a, b = int(e['t0'] * SR), int(e['t1'] * SR); f = int(.02 * SR)
    mix[a - f:a] *= np.linspace(1, 0, f)[:, None]; mix[a:b] = 0; mix[b:b + f] *= np.linspace(0, 1, f)[:, None]
# 保留：静默段之后第一声（滴水 / 断流）不受影响
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
seg = lambda a, b: 20 * np.log10(rms(mix[int(a * SR):int(b * SR)]) + 1e-9)
print('mix.wav', mix.shape, 'peak', round(20 * np.log10(np.abs(mix).max()), 2), 'dBFS')
for a, b, n in [(0, 7, 'A'), (7, 14.5, 'B'), (14.5, 21.3, 'C'), (21.3, 26.8, 'D'), (26.8, 27.55, 'silence1'), (30.5, 32.39, 'silence2'), (32.4, 35.4, 'F'), (35.4, 42.6, 'G'), (42.6, 48, 'H')]:
    print(f'{n:9s} {seg(a, b):7.1f} dB')
print('vo rms', round(20 * np.log10(rms(vo[vmask > 0])), 1), 'music rms under vo', round(20 * np.log10(rms((mus * 1.15)[vmask > 0])), 1))
