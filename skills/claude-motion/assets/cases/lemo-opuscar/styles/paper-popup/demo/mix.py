# 配乐 + 旁白 + 合成音效（纸片马里奥式）→ mix.wav
# 用法（仓库根）：.venv/bin/python styles/paper-popup/demo/mix.py [输出路径，默认 demo/mix.wav]
import json, re, os, sys, numpy as np, soundfile as sf
os.chdir(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'mix.wav'
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
from scipy.ndimage import maximum_filter1d

SR = 48000; DUR = 133.0; N = int(DUR * SR)
rng = np.random.default_rng(5)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n)
def pink(n):
    w = np.fft.rfft(noise(n)); f = np.arange(len(w)); f[0] = 1
    return np.fft.irfft(w / np.sqrt(f), n) * 20
def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p
def st(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)
def tt(d): return np.arange(int(d * SR)) / SR
def ex(t, a, r): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))
def sweep(f0, f1, t, curve=1.0): d = t[-1] if len(t) else 1; f = f0 + (f1 - f0) * (t / d) ** curve; return np.sin(2 * np.pi * np.cumsum(f) / SR)
def fade(x, fi, fo):
    n = len(x); e = np.ones(n); a = int(fi * SR); b = int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 1.5
    if b: e[-b:] = np.minimum(e[-b:], np.linspace(1, 0, b) ** 1.5)
    return x * (e[:, None] if x.ndim == 2 else e)
def dbfs(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
IRn = int(1.4 * SR); IR = np.stack([noise(IRn), noise(IRn)], 1) * np.exp(-np.arange(IRn) / SR * 4.5)[:, None]
IR = np.stack([lp(IR[:, 0], 6000), lp(IR[:, 1], 6000)], 1); IR /= np.sqrt((IR ** 2).sum(0))
def verb(x2, wet=.25):
    y = np.stack([fftconvolve(x2[:, 0], IR[:, 0])[:len(x2)], fftconvolve(x2[:, 1], IR[:, 1])[:len(x2)]], 1)
    return x2 * (1 - wet) + y * wet

sfx = np.zeros((N, 2)); amb = np.zeros((N, 2))
def put(buf, t, x):
    i = int(t * SR); j = min(N, i + len(x))
    if j > i and i >= 0: buf[i:j] += x[:j - i]

# ---------- 音效库 ----------
def bell(f, d=.6, g=1., bright=1.):
    t = tt(d); x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (4 + k * 3)) / k ** (1.6 / bright) for k in (1, 2, 3, 4.2))
    return x * ex(t, .002, d) * g
def boing(f0=300, f1=900, d=.26, g=1.):
    t = tt(d); f = f0 + (f1 - f0) * (1 - np.exp(-t * 14)); f *= 1 + .06 * np.sin(2 * np.pi * 28 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return x * ex(t, .005, d * .45) * g
def tap(g=1., f=900):
    t = tt(.12); x = bp(noise(len(t)), f * .6, f * 2.2) * ex(t, .001, .018) + np.sin(2 * np.pi * f * .35 * t) * ex(t, .001, .03) * .6
    return x * g
def crinkle(d, g=1., dens=180, lo=1800, hi=9000):
    n = int(d * SR); x = np.zeros(n)
    for _ in range(int(dens * d)):
        i = rng.integers(0, n - 400); L = rng.integers(40, 300); x[i:i + L] += noise(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(.3, 1)
    return bp(x, lo, hi) * g
def swish(d, g=1., f0=500, f1=3500):
    t = tt(d); n = len(t); x = noise(n); y = np.zeros(n); B = 8
    for k in range(B):
        a, b = k * n // B, (k + 1) * n // B; fc = f0 + (f1 - f0) * (k + .5) / B
        y[a:b] = bp(x, fc * .6, min(fc * 1.6, 20000))[a:b]
    return y * np.sin(np.pi * t / t[-1]) ** 1.5 * g
def pop(g=1., f=700):
    t = tt(.16); x = sweep(f, f * .45, t) * ex(t, .001, .04) + bp(noise(len(t)), 1200, 5000) * ex(t, .004, .025) * .5
    return x * g
def blip(f, g=1., d=.055, wave='sq'):
    t = tt(d); ph = 2 * np.pi * f * t
    x = np.sign(np.sin(ph)) * .5 + np.sin(ph) * .5 if wave == 'sq' else 2 / np.pi * np.arcsin(np.sin(ph))
    return lp(x, 4500) * ex(t, .003, d * .5) * g
def arp(fs, gap=.07, g=1.):
    out = np.zeros(int((gap * len(fs) + .8) * SR))
    for i, f in enumerate(fs): b = bell(f, .7, 1, 1.4); i0 = int(i * gap * SR); out[i0:i0 + len(b)] += b
    return out * g

G = dict(blip=4, page=6, bang=2.8, hop=2.5, spout=2.2, tink=2.5, splash=2.2, step=1.6, sparkle=1.6, clack=1.6, creak=1.6, skid=1.6, whoosh=1.6, pop=1.3)
def putg(buf, t, x): put(buf, t, x * G.get(ty, 1))
EV = json.load(open('events.json'))['ev']
C5 = 523.25
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'creak':
        d = 1.6; tq = tt(d); rate = 25 + 60 * (tq / d); clk = np.sin(2 * np.pi * np.cumsum(rate) / SR) > .97
        x = bp(clk.astype(float) + noise(len(tq)) * .05, 250, 900, 3) * np.sin(np.pi * tq / d) ** .6
        putg(sfx, t, verb(st(norm(x, .22)), .3))
    elif ty == 'thump':
        tq = tt(.8); x = np.sin(2 * np.pi * 70 * tq) * ex(tq, .003, .12) + lp(noise(len(tq)), 600) * ex(tq, .002, .05) * .5
        putg(sfx, t, verb(st(norm(x, .5)), .2))
    elif ty == 'sparkle':
        d = e['d']
        for k in range(int(d * 14)): putg(sfx, t + rng.uniform(0, d), verb(st(bell(rng.choice([C5 * 4, C5 * 4 * 1.25, C5 * 4 * 1.5, C5 * 8, C5 * 6]), .5, rng.uniform(.03, .07)), rng.uniform(-.7, .7)), .45))
    elif ty == 'pop':
        putg(sfx, t + rng.uniform(-.03, .03), st(pop(rng.uniform(.05, .09), rng.uniform(500, 1100)) + np.pad(crinkle(.12, .05), (0, 1920)), rng.uniform(-.5, .5)))
    elif ty == 'page':
        d = e['d']; x = swish(d, .35, 400, 2600) + crinkle(d, .12, 60) * np.sin(np.pi * tt(d) / d)
        putg(sfx, t, verb(st(x, 0), .25))
    elif ty == 'door':
        tq = tt(.5); x = bp(np.sin(2 * np.pi * np.cumsum(420 + 180 * np.sin(2 * np.pi * 3 * tq)) / SR) * (1 + noise(len(tq)) * .3), 300, 2500) * np.sin(np.pi * tq / .5)
        putg(sfx, t, st(norm(x, .1), -.4))
    elif ty == 'boing': putg(sfx, t, verb(st(boing(280, 820, .3, .22)), .15))
    elif ty == 'hop': putg(sfx, t, verb(st(boing(480, 1150, .18, .14)), .12))
    elif ty == 'land': putg(sfx, t, st(tap(.25, 700)))
    elif ty == 'step': putg(sfx, t, st(tap(rng.uniform(.035, .055), rng.uniform(1100, 1600)) + np.pad(crinkle(.05, .02, 200), (0, 3360))))
    elif ty == 'roll': putg(sfx, t, st(crinkle(e['d'], .25, 260, 800, 6000) * np.linspace(1, .4, int(e['d'] * SR)), .5))
    elif ty == 'bang': putg(sfx, t, st(np.concatenate([blip(880, .18, .07), blip(1320, .2, .12)])))
    elif ty in ('stomp', 'stomp2'):
        g = 1 if ty == 'stomp' else 1.25
        tq = tt(.4); x = np.sin(2 * np.pi * np.cumsum(160 * np.exp(-tq * 8) + 60) / SR) * ex(tq, .002, .08) * .8 + crinkle(.4, .5, 400, 1000, 8000) * ex(tq, .002, .1)
        putg(sfx, t, verb(st(norm(x, .5 * g) + np.pad(boing(600 * g, 1100 * g, .2, .1), (0, len(tq) - int(.2 * SR)))), .15))
    elif ty == 'nice': putg(sfx, t + .03, verb(st(arp([C5 * 2, C5 * 2.52, C5 * 3], .06, .16)), .3))
    elif ty == 'great': putg(sfx, t + .03, verb(st(arp([C5 * 2, C5 * 2.52, C5 * 3, C5 * 4], .055, .18)), .3))
    elif ty == 'poof':
        tq = tt(.7); x = lp(noise(len(tq)), 1800) * ex(tq, .01, .18) * .8
        putg(sfx, t, verb(st(norm(x, .3)), .35))
        for k in range(6): putg(sfx, t + .1 + k * .05, st(bell(C5 * 4 * [1, 1.25, 1.5, 2, 2.5, 3][k], .4, .05)))
    elif ty == 'fold':
        for k in range(4): putg(sfx, t + k * e['d'] / 4, st(crinkle(.09, .3, 500, 2500, 10000) * ex(tt(.09), .002, .03), rng.uniform(-.3, .3)))
    elif ty == 'whoosh':
        x = swish(.7, .3, 300, 2000); putg(sfx, t, np.stack([x * np.linspace(1.3, .3, len(x)), x * np.linspace(.3, 1.3, len(x))], 1))
    elif ty == 'splash':
        tq = tt(.8); x = lp(noise(len(tq)), 2500) * ex(tq, .005, .2)
        for k in range(10): i = rng.integers(0, len(tq) - 3000); b = sweep(rng.uniform(500, 900), rng.uniform(1200, 2000), tt(.05)) * ex(tt(.05), .002, .015); x[i:i + len(b)] += b * .6
        putg(sfx, t, verb(st(norm(x, .22)), .3))
    elif ty == 'spout':
        d = e['d']; tq = tt(d); x = bp(noise(len(tq)), 1500, 7000) * np.sin(np.pi * tq / d) ** .5
        putg(sfx, t, verb(st(norm(x, .12)), .3))
        for k in range(22): putg(sfx, t + rng.uniform(.2, d), st(bell(rng.uniform(2500, 5000), .3, .03), rng.uniform(-.6, .6)))
    elif ty == 'clack':
        tq = tt(.12); x = np.sin(2 * np.pi * 1300 * tq) * ex(tq, .001, .02) + bp(noise(len(tq)), 1500, 6000) * ex(tq, .001, .01) * .5
        putg(sfx, t, verb(st(x * .16, rng.uniform(-.5, .5)), .2))
    elif ty == 'tink': putg(sfx, t, verb(st(bell(rng.choice([C5 * 3, C5 * 3.36, C5 * 4, C5 * 4.5, C5 * 5]), .9, .06), rng.uniform(-.6, .6)), .4))
    elif ty == 'lampon':
        putg(sfx, t, st(tap(.12, 2500)))
        tq = tt(3.5); x = sum(np.sin(2 * np.pi * f * tq) for f in (C5 / 2, C5 / 2 * 1.26, C5 / 2 * 1.5, C5)) * np.minimum(1, tq / 1.2) * np.exp(-np.maximum(0, tq - 1.4) / .9)
        putg(sfx, t + .05, verb(st(x * .03), .5))
    elif ty == 'skid': d = .45; putg(sfx, t, st(bp(noise(int(d * SR)), 1200, 5000) * np.exp(-tt(d) * 6) * .09, .3))
    elif ty == 'blip':
        who = e.get('who')
        if who == 'pip': f = rng.choice([C5 * 1.5, C5 * 1.68, C5 * 2, C5 * 2.24, C5 * 1.33]); x = blip(f, .07)
        elif who == 'crumple': f = rng.choice([180, 200, 225, 240]); x = blip(f, .09, .07)
        else: f = rng.choice([C5, C5 * 1.12, C5 * 1.26, C5 * 1.5]); x = blip(f, .07, .05, 'tri') * 1.4
        putg(sfx, t, st(x))

# ---------- 环境声 ----------
def bed(t0, t1, fn, fi=1.5, fo=1.5):
    x = fn(t1 - t0); put(amb, t0, fade(x, fi, fo))
def room(d): return np.stack([lp(pink(int(d * SR)), 400), lp(pink(int(d * SR)), 400)], 1) * .004
def ticks(d):
    x = np.zeros((int(d * SR), 2))
    for k in range(int(d)):
        c = st(tap(.05, 2600 if k % 2 else 2300) * 1.0, -.6); i = int(k * SR); x[i:i + len(c)] += c[:len(x) - i]
    return x
def birds(d, dens=.8):
    x = np.zeros((int(d * SR), 2))
    for _ in range(int(d * dens)):
        s = rng.uniform(0, d - 1); f0 = rng.uniform(2500, 4500); n = rng.integers(2, 5)
        for k in range(n):
            q = tt(.08); c = np.sin(2 * np.pi * np.cumsum(f0 * (1 + .4 * np.sin(2 * np.pi * 30 * q)) * (1 + q * 2)) / SR) * np.sin(np.pi * q / q[-1]) ** 2
            i = int((s + k * .12) * SR); x[i:i + len(c)] += st(c * rng.uniform(.012, .03), rng.uniform(-.8, .8))[:len(x) - i]
    return x
def river(d): return np.stack([bp(pink(int(d * SR)), 400, 3000), bp(pink(int(d * SR)), 400, 3000)], 1) * .012
def crickets(d):
    q = tt(d); x = np.sin(2 * np.pi * 4400 * q) * (np.sin(2 * np.pi * 28 * q) > .3) * (np.sin(2 * np.pi * .8 * q) > -.2) * .006
    y = np.sin(2 * np.pi * 4700 * q) * (np.sin(2 * np.pi * 31 * q + 1) > .3) * (np.sin(2 * np.pi * .7 * q + 2) > -.2) * .005
    return np.stack([x, y], 1)
def waves(d):
    q = tt(d); sw = .5 + .5 * np.sin(2 * np.pi * q / 3.4) ** 2
    return np.stack([lp(pink(len(q)), 1200) * sw, lp(pink(len(q)), 1200) * np.roll(sw, int(.7 * SR))], 1) * .02
def rustle(d): return np.stack([bp(pink(int(d * SR)), 1500, 6000), bp(pink(int(d * SR)), 1500, 6000)], 1) * .004 * (.6 + .4 * np.sin(2 * np.pi * tt(d) / 5))[:, None]
bed(0, 14.5, lambda d: room(d) + ticks(d) * .9, .5, 1.5)
bed(15.5, 35.5, lambda d: birds(d, .6))
bed(26.0, 35.8, river, 1, 1.5)
for s in (32.02, 33.0, 33.88): put(sfx, s - .05, verb(st(swish(.55, .22, 600, 2600)), .2))
bed(36.0, 48.8, crickets, 2, 1)
bed(51.4, 71.8, lambda d: birds(d, 1.1) + rustle(d))
bed(74.4, 87.0, waves, 1, 1.5)
bed(89.6, 104.0, room, 1, .5)
bed(104.8, DUR, lambda d: room(d) + ticks(d) * .9, 1.5, 3)

# ---------- 配乐 ----------
mus, sr = sf.read('music/score.wav'); assert sr == SR
mus = np.pad(mus[:N], ((0, max(0, N - len(mus))), (0, 0)))

# ---------- 旁白 ----------
dur = json.load(open('voices/dur.json'))
vo_times = [(m[0], float(m[1])) for m in re.findall(r"\['(v\d\d)', ([\d.]+),", open('story.js').read())]
vo = np.zeros(N); duck = np.zeros(N)
def compress(x, thr=-24, ratio=3.0):
    e = np.sqrt(np.maximum(lp(x ** 2, 30), 0) + 1e-10); lv = 20 * np.log10(e)
    gdb = np.where(lv > thr, (thr - lv) * (1 - 1 / ratio), 0); return x * 10 ** (gdb / 20)
for vid, t0 in vo_times:
    x, vsr = sf.read(f'voices/{vid}.wav')
    x = resample_poly(x, SR, vsr); x = hp(x, 90); x = compress(x)
    i = int(t0 * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
    a = max(0, i - int(.25 * SR)); b = min(N, j + int(.4 * SR)); duck[a:b] = 1
duck = lp(np.convolve(duck, np.ones(int(.3 * SR)) / int(.3 * SR), 'same'), 5)
act = duck > .5
def limit(x, ceil):
    pk = maximum_filter1d(np.abs(x), int(.005 * SR)); g = np.minimum(1, ceil / (pk + 1e-9))
    g = np.minimum.reduce([g, np.roll(g, int(.0025 * SR))]); g = lp(g, 200); return x * np.clip(g, 0, 1)
speech = np.abs(vo) > 10 ** (-40 / 20) * np.abs(vo).max()
vr = np.sqrt(np.mean(vo[np.convolve(speech, np.ones(2400), 'same') > 0] ** 2))
vo = limit(vo, vr * 10 ** (11 / 20))
mus_db = dbfs(mus[act]); vo_db = dbfs(vo[act])
vo *= 10 ** ((mus_db + 8.5 - vo_db) / 20)
mus *= (1 - .4 * duck)[:, None]
vo2 = verb(st(vo), .07)
print('sfx pre', 20*np.log10(np.abs(sfx).max()+1e-12)); sfx = np.stack([limit(sfx[:, 0], .5), limit(sfx[:, 1], .5)], 1)
mix = mus + vo2 + sfx * .9 + amb * 2
pk = lambda x: round(20 * np.log10(np.abs(x).max() + 1e-12), 1)
print('peaks mus', pk(mus), 'vo', pk(vo2), 'sfx', pk(sfx), 'amb', pk(amb)); print('music', round(dbfs(mus), 1), 'vo(active)', round(dbfs(vo2[act]), 1), 'sfx', round(dbfs(sfx), 1), 'amb', round(dbfs(amb), 1))
mix = mix / np.abs(mix).max() * .89
sf.write(OUT, mix.astype(np.float32), SR, subtype='FLOAT')
# 诊断：各类音效峰值相对同时刻配乐 RMS
if __name__ == '__main__':
    import collections
    rep = collections.defaultdict(list)
    for e in EV:
        i = int(e['t'] * SR); a, b = i, min(N, i + int(.25 * SR))
        if b <= a: continue
        s = 20 * np.log10(np.abs(sfx[a:b]).max() + 1e-9); m = dbfs(mus[max(0, i - SR // 2):i + SR // 2])
        rep[e['type']].append(s - m)
    print(' '.join(f"{k}:{np.median(v):+.0f}" for k, v in sorted(rep.items())))
