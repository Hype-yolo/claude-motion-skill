"""混音：拟音（纸 / 剪刀 / 烛火 / 爆竹）+ 旁白 + 配乐（旁白下闪避）→ mix.wav
用法（仓库根）：.venv/bin/python styles/papercut-red/demo/mix.py"""
import sys, os, json, numpy as np, soundfile as sf, soxr
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, compress, limit, add
from scipy.signal import fftconvolve
from scipy.ndimage import uniform_filter1d
D = os.path.dirname(os.path.abspath(__file__))
EV = json.load(open(os.path.join(D, 'events.json'))); DUR = EV['dur']; ev = EV['ev']
N = int(DUR * SR) + SR
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); amb = np.zeros((N, 2))
rng = np.random.default_rng(31)

def room_ir(d=.6, damp=3500):
    n = int(d * SR); e = np.exp(-np.arange(n) / SR / (d / 6.9)); ir = np.stack([lp(rng.standard_normal(n), damp) * e, lp(rng.standard_normal(n), damp) * e], 1)
    ir[0] = 1; return ir / np.abs(ir).sum(0) * 6
def verb(x, ir, mix=.2):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1); return x * (1 - mix) + y * mix

# —— 纸与剪刀 ——
def snip(v=1., big=False):      # 剪刀：刃擦过的金属"嚓" + 纸纤维断的"咔"
    d = .22; tt = t_(d)
    sweep = bp(noise(d), 2500, 9000) * np.clip(tt / .06, 0, 1) * np.exp(-np.maximum(0, tt - .06) / .025)
    ring = np.sin(2 * np.pi * 3800 * tt) * env_exp(d, .03) * .25 + np.sin(2 * np.pi * 5600 * tt) * env_exp(d, .02) * .12
    crack = np.zeros_like(tt); s = int(.06 * SR); c = hp(noise(.012), 1800) * env_exp(.012, .002); crack[s:s + len(c)] = c * 2.2
    body = lp(noise(d), 900) * env_exp(d, .01) * .3
    x = sweep * .8 + ring + crack + body
    if big: x = x + np.sin(2 * np.pi * 140 * tt) * env_exp(d, .03) * .4
    return norm(x) * v
def swish(d=.4, v=1., lo=700, hi=6000, flutter=0):   # 纸面滑过 / 翻动
    tt = t_(d); e = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.5
    am = 1 + flutter * np.sin(2 * np.pi * 22 * tt + rng.random() * 6)
    return norm(bp(noise(d), lo, hi) * e * am) * v
def tap(v=1., f=900):            # 手指压纸 / 贴纸
    d = .09; tt = t_(d)
    return norm(bp(noise(d), 300, 3000) * env_exp(d, .01) + np.sin(2 * np.pi * f * .25 * tt) * env_exp(d, .015) * .5) * v
def snap(v=1.):                  # 展开"啪"
    d = .3; tt = t_(d)
    x = hp(noise(d), 600) * env_exp(d, .012) * 1.4 + lp(noise(d), 300) * env_exp(d, .04) * .8 + np.sin(2 * np.pi * 90 * tt) * env_exp(d, .05) * .6
    return norm(x) * v
def peel(d=1.2, v=1.):           # 揭纸：细碎撕拉
    tt = t_(d); x = bp(noise(d), 1200, 7000) * (.4 + .6 * np.sin(np.pi * tt / d))
    g = np.zeros_like(tt)
    for _ in range(int(d * 90)):
        s = int(rng.random() * (len(tt) - 600)); g[s:s + 600] += hp(noise(600 / SR), 2500)[:600] * env_exp(600 / SR, .002) * rng.random()
    return norm(x * .5 + g) * v
def stamp(v=1.):
    d = .35; tt = t_(d); return norm(np.sin(2 * np.pi * 110 * tt) * env_exp(d, .05) + lp(noise(d), 600) * env_exp(d, .03) * .7) * v
# —— 年兽 ——
def thud(v=1.):                  # 厚纸板落地的闷"嘭"
    d = .9; tt = t_(d); f = 55 * (1 + .6 * np.exp(-tt / .04))
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .18) + lp(noise(d), 350) * env_exp(d, .06) * .8) * v
def growl(d=.8, v=1.):
    tt = t_(d); f0 = 70 + 14 * np.sin(2 * np.pi * 5 * tt); ph = 2 * np.pi * np.cumsum(f0) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 12)); x = bp(x, 80, 1200) * (1 + .5 * lp(noise(d), 30)) + lp(brown(d), 300) * .6
    return norm(x * np.sin(np.pi * tt / d) ** .7) * v
def breath(d=1.2, v=1.):
    tt = t_(d); return norm(bp(noise(d), 150, 900) * np.sin(np.pi * tt / d) ** 1.4) * v
def yelp(v=1.):                  # 憨憨的一声"呜"：下滑 + 鼻音共振峰
    d = .9; tt = t_(d); f0 = 330 * (1 - .45 * np.clip(tt / .7, 0, 1)) * (1 + .02 * np.sin(2 * np.pi * 6 * tt)); ph = 2 * np.pi * np.cumsum(f0) / SR
    x = sum(np.sin(k * ph) / k ** 1.2 for k in range(1, 16)); x = bp(x, 250, 1400) + bp(x, 2000, 3200) * .3
    return norm(x * np.clip(tt / .05, 0, 1) * np.exp(-np.maximum(0, tt - .45) / .15)) * v
# —— 火与光 ——
def puff(v=1.):
    d = .5; tt = t_(d); return norm(lp(noise(d), 700) * env_exp(d, .05) + hp(noise(d), 4000) * np.clip(tt / .04, 0, 1) * env_exp(d, .15) * .25) * v
def match_(v=1.):
    d = .7; tt = t_(d); am = lp((rng.random(len(tt)) > .7) * 1.0, 60)
    x = bp(noise(d), 1800, 6500) * am * np.minimum(1, tt / .03) * np.exp(-np.maximum(0, tt - .16) / .05)
    fl = lp(noise(d), 1400) * np.sin(np.clip((tt - .12) / .5, 0, 1) * np.pi) * .7
    return norm(x + fl) * v
def fwoomp(d=.9, v=1., f=900):
    tt = t_(d); e = np.minimum(1, tt / .06) * np.exp(-tt / (d / 3)); return norm(lp(noise(d), f) * e + np.sin(2 * np.pi * 70 * tt) * e * .4) * v
def shimmer(d=1.2, v=1.):
    tt = t_(d); x = sum(np.sin(2 * np.pi * f * tt + rng.random() * 6) * env_exp(d, .3 + rng.random() * .4) for f in [2637, 3136, 3520, 4186, 4699]) / 5
    return norm(x * np.clip(tt / .02, 0, 1)) * v
# —— 爆竹 / 烟花 ——
def crackers(d=1.2, v=1.):       # 一串密集噼啪（间隔 20–60 ms，越来越密）+ 远处闷响
    out = np.zeros(int((d + .4) * SR)); t = 0.
    while t < d:
        s = int(t * SR); k = .006 + rng.random() * .006
        c = hp(noise(k), 1200) * env_exp(k, .0012) * (.6 + rng.random() * .8) + np.sin(2 * np.pi * (300 + rng.random() * 300) * t_(k)) * env_exp(k, .002) * .4
        out[s:s + len(c)] += c
        if rng.random() < .12: b = lp(noise(.25), 200) * env_exp(.25, .05) * .8; out[s:s + len(b)] += b
        t += .02 + .04 * rng.random() * (1 - t / d * .6)
    return norm(out) * v
def firework(v=1.):
    d = 2.2; tt = t_(d); out = np.zeros(len(tt))
    wl = int(.45 * SR); f = 1200 + 1600 * t_(.45) / .45; w = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t_(.45) / .45) * .25 + bp(noise(.45), 3000, 8000) * .1
    out[:wl] += w
    s = wl; b = lp(noise(1.2), 400) * env_exp(1.2, .18) * 1.2 + np.sin(2 * np.pi * 50 * t_(1.2)) * env_exp(1.2, .2); out[s:s + len(b)] += b
    cr = crackers(.9, .5); out[s + 2000:s + 2000 + len(cr)] += cr[:len(out) - s - 2000] * .6
    return norm(out) * v
def wind(d, v=1.):
    tt = t_(d); m = lp(rng.random(len(tt)), 3); return norm(bp(noise(d), 200, 1600) * (.3 + m)) * np.minimum(1, tt / 1.) * np.minimum(1, (d - tt) / .6) * v
def bird(v=1.):
    d = .35; out = np.zeros(int(d * SR))
    for k in range(3):
        s = int(k * .1 * SR); tt = t_(.07); f = 3800 + 1400 * np.sin(np.pi * tt / .07); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / .07); out[s:s + len(x)] += x
    return norm(out) * v
def room(d):
    tt = t_(d); return lp(brown(d), 300) * np.minimum(1, tt / .8) * np.minimum(1, (d - tt) / .8)

G = dict(snip=.55, paperwhoosh=.35, place=.25, stamp=.4, pageturn=.4, thud=.5, growl=.45, puff=.3, breath=.35, blink=.25, paperpop=.35, match=.45,
         rattle=.3, fold=.45, unfold=.55, bloom=.5, pat=.4, glowon=.4, lanternarrive=.22, crackers=.36, yelp=.5, firework=.32, peel=.4, bird=.18)
for e in ev:
    ty, t = e['type'], e['t']
    if ty == 'snip': add(fx, snip(1, e.get('big')), t - .06, G[ty] * (1.4 if e.get('big') else 1), .1)
    elif ty == 'paperwhoosh': add(fx, swish(.6, 1, 500, 5000, .6), t, G[ty])
    elif ty == 'place':
        for k in range(6): add(fx, tap(1), t + k * .07, G[ty] * (1 - k * .08), -.3 + k * .12)
    elif ty == 'stamp': add(fx, stamp(1), t, G[ty])
    elif ty == 'pageturn': add(fx, swish(.45, 1, 600, 6500, .9), t, G[ty], .3); add(fx, tap(1), t + .42, G[ty] * .6)
    elif ty == 'windbed': add(amb, wind(e['dur']), t, .12 * e.get('gain', 1))
    elif ty == 'thud': add(fx, thud(1), t, G[ty] * e.get('gain', 1) * (.6 if 13.5 < t < 16.3 else 1), -.2)
    elif ty == 'growl': add(fx, growl(.7), t, G[ty], -.2)
    elif ty == 'puff': add(fx, puff(1), t, G[ty], rng.random() - .5)
    elif ty == 'breath': add(fx, breath(1.2), t, G[ty], .3)
    elif ty == 'blink': add(fx, tap(1, 1400), t, G[ty], .2)
    elif ty == 'paperpop': add(fx, swish(.2, 1, 800, 7000), t, G[ty], .3)
    elif ty == 'match': add(fx, match_(1), t, G[ty], .3); add(fx, fwoomp(.8, 1, 1100), t + .12, G[ty] * .6, .3)
    elif ty == 'rattle':
        for k in range(5): add(fx, tap(1, 1800), t + k * .045, G[ty] * (1 - k * .15), .5)
    elif ty == 'fold': add(fx, swish(.45, 1, 700, 6000, .4), t, G[ty]); add(fx, tap(1.2), t + .5, G[ty] * .8)
    elif ty == 'unfold': add(fx, snap(1), t + .15, G[ty])
    elif ty == 'bloom': add(fx, fwoomp(1.2, 1, 700), t, G[ty]); add(fx, shimmer(1.4), t, G[ty] * .5)
    elif ty == 'pat': add(fx, tap(1), t, G[ty]); add(fx, tap(1), t + .09, G[ty] * .7)
    elif ty == 'glowon': add(fx, fwoomp(1.0, 1, 1200), t, G[ty], .4); add(fx, shimmer(1.2), t, G[ty] * .4, .4)
    elif ty == 'lanternarrive': add(fx, swish(.3, 1, 1500, 8000), t - .25, G[ty], -.6 + rng.random() * 1.2)
    elif ty == 'crackers': add(fx, crackers(e.get('dur', 1.2)), t, G[ty] * (.55 if 35 < t < 37.5 else 1), .4 + rng.random() * .3)
    elif ty == 'yelp': add(fx, yelp(1), t, G[ty], -.2)
    elif ty == 'firework': add(fx, firework(1), t - .45, G[ty] * (.6 if 35 < t < 37.5 else 1), rng.random() - .5)
    elif ty == 'peel': add(fx, peel(1.2), t, G[ty], .4)
    elif ty == 'bird': add(amb, bird(1), t, G[ty], .6)
    elif ty == 'roomtone': add(amb, room(e['dur']), t, .08)
# 夜里一直有极轻的风雪
add(amb, wind(31, 1), 7.0, .06)

# —— 旁白：奶奶讲故事，近、暖、小屋子 ——
vo_env = np.zeros(N)
for e in ev:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = soxr.resample(y, sr, SR); y = compress(norm(y, .9), .3, 3); y = y + lp(y, 220) * .22
    add(vo, y, e['t'], 1.35)
    s = int(e['t'] * SR); vo_env[s:s + len(y)] = 1
vo = verb(vo, room_ir(.8), .12)
k = np.clip(uniform_filter1d(vo_env, int(.25 * SR)) * 1.6, 0, 1)

mus = np.zeros((N, 2)); mp = os.path.join(D, 'music', 'score.wav')
m, sr = sf.read(mp)
if m.ndim == 1: m = np.stack([m, m], 1)
if sr != SR: m = soxr.resample(m, sr, SR)
mus[:min(N, len(m))] = m[:N]
mus *= (10 ** (-9 * k / 20))[:, None]
fx = verb(fx, room_ir(.5), .15)
fx *= (10 ** (-3 * k / 20))[:, None]; amb *= (10 ** (-4 * k / 20))[:, None]
mix = mus * .9 + fx + amb + vo
# 静场：17.0–19.5 与 29.5–30.0 只留拟音
mix = np.stack([limit(mix[:, c], .95) for c in range(2)], 1)[:int(DUR * SR)]
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
def rms(x, a, b): y = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-9)
print('mix.wav', mix.shape, 'peak', np.abs(mix).max().round(3))
for a, b, n in [(0, 3, 'open'), (3, 7, 'title'), (7, 12, 'village'), (12, 17, 'nian'), (17, 19.5, 'silence'), (19.5, 24, 'decide'), (24, 29.5, 'fold'), (31, 38, 'fiesta'), (38, 42.5, 'dawn'), (42.5, 49, 'end')]:
    print(f'{n:8s} {rms(mix, a, b):6.1f} dB')
bed = mus * .9 + fx + amb
for e in ev:
    if e['type'] != 'vo': continue
    print(f"{e['id']}  voice {rms(vo, e['t'], e['t'] + 2):6.1f}  bed {rms(bed, e['t'], e['t'] + 2):6.1f}  diff {rms(vo, e['t'], e['t'] + 2) - rms(bed, e['t'], e['t'] + 2):5.1f} dB")
