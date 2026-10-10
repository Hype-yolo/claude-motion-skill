"""From Bean to Cup — sound design + mix. Run from the repo root after events.mjs and score.py:
.venv/bin/python styles/iso-infographic/demo/mix.py   → demo/mix.wav
Three layers: ambience beds (crossfaded station to station), foley synthesised per material, music (ducked under voice)."""
import sys, os, json
import numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt, fftconvolve
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..')); sys.path.insert(0, ROOT)
from core.audio.sfx import SR, add, compress, limit, whoosh, creak
rng = np.random.default_rng(11)
EV = json.load(open(os.path.join(D, 'events.json')))
EVL = EV['ev'] if isinstance(EV, dict) and 'ev' in EV else EV
DUR = float(EV.get('dur', 58.8)) if isinstance(EV, dict) else 58.8
N = int(DUR * SR)
T = lambda d: np.arange(int(d * SR)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, min(hi, SR / 2 - 100)], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def nz(d): return rng.standard_normal(int(d * SR))
def ex(d, tau): return np.exp(-T(d) / tau)
def nrm(x, p=1.0): m = np.abs(x).max(); return x * (p / m) if m > 0 else x
def brown(d): w = np.cumsum(nz(d)); w -= np.linspace(w[0], w[-1], len(w)); return nrm(hp(w, 15))
def fit(x, n): return np.pad(x, (0, max(0, n - len(x))))[:n]
def fade(x, a=.01, b=.05): n = len(x); x = x.copy(); na, nb = min(n, int(a * SR)), min(n, int(b * SR)); x[:na] *= np.linspace(0, 1, na); x[n - nb:] *= np.linspace(1, 0, nb); return x
def partials(d, fs, taus, amps, jitter=0):
    t = T(d); return sum(a * np.sin(2 * np.pi * f * (1 + jitter * rng.standard_normal()) * t + rng.random() * 6) * np.exp(-t / tau) for f, tau, a in zip(fs, taus, amps))
def grains(d, rate, lo, hi, tau=.004, amp_env=None):   # many tiny impacts (beans, cherries, gravel)
    out = np.zeros(int(d * SR)); n = int(rate * d)
    for _ in range(n):
        s = int(rng.random() * (len(out) - 600)); L = int(.012 * SR); g = rng.standard_normal(L) * np.exp(-np.arange(L) / (tau * SR)) * (.4 + rng.random() * .6)
        out[s:s + L] += g
    out = bp(out, lo, hi)
    if amp_env is not None: out *= amp_env(T(d))
    return nrm(out)
def verb(x, rt=1.2, mix=.25):
    L = int(rt * SR); ir = rng.standard_normal(L) * np.exp(-np.arange(L) / (rt / 6.9 * SR)); ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    y = fftconvolve(x, ir)[:len(x) + L]; out = np.zeros(len(y)); out[:len(x)] = x * (1 - mix); return out + y * mix

# ---------- foley recipes (material first) ----------
def snap(): d = .08; return nrm(hp(nz(d), 3000) * ex(d, .003) + partials(d, [3400, 5200], [.01, .006], [.5, .3]) + lp(nz(d), 900) * ex(d, .01) * .4)
def palm(): d = .25; t = T(d); return nrm(np.sin(2 * np.pi * (140 - 60 * t / d) * t) * ex(d, .05) + lp(nz(d), 700) * ex(d, .018) * .8 + hp(nz(d), 2500) * ex(d, .004) * .2)
def tick(f=1900): d = .07; return nrm(np.sin(2 * np.pi * f * T(d)) * ex(d, .012) + hp(nz(d), 4000) * ex(d, .002) * .5)
def wood(f=900): d = .12; return nrm(partials(d, [f, f * 2.3, f * .5], [.03, .012, .02], [1, .5, .4]) + hp(nz(d), 1500) * ex(d, .003) * .5)
def wicker(): d = .3; return grains(d, 260, 1500, 6000, .002, lambda t: np.sin(np.pi * t / d))
def knife():
    d = .3; n = nz(d); out = np.zeros_like(n); t = T(d)
    for i in range(0, len(n), 480): f = 3500 + 5000 * i / len(n); seg = bp(n[max(0, i - 1500):i + 480], f * .85, f * 1.15)[-480:]; out[i:i + len(seg)] = seg
    return nrm(out * np.sin(np.pi * t / d) ** 1.5)
def wetpop(): d = .16; t = T(d); return nrm(np.sin(2 * np.pi * (300 + 500 * t / d) * t) * ex(d, .03) + lp(nz(d), 1600) * ex(d, .04) * .6)
def soilstep(): d = .09; return nrm(lp(nz(d), 500) * ex(d, .02) + bp(nz(d), 1500, 4000) * ex(d, .006) * .3)
def rake(): d = .45; return nrm(grains(d, 700, 1200, 5500, .003, lambda t: np.sin(np.pi * t / d) ** .7) + partials(d, [3100, 4700], [.12, .08], [.12, .08]) + bp(nz(d), 300, 1200) * np.sin(np.pi * T(d) / d) * .25)
def cherries_pour(): d = .6; return nrm(grains(d, 600, 600, 3500, .005, lambda t: np.minimum(1, t / .05) * np.exp(-t / .3)) + lp(nz(d), 200) * ex(d, .08) * .5)
def beans_pour(d=.6, lo=1500, hi=7000): return nrm(grains(d, 1400, lo, hi, .0025, lambda t: np.sin(np.pi * np.minimum(t / d, 1)) ** .5))
def sackthump(): d = .35; t = T(d); return nrm(np.sin(2 * np.pi * (90 - 30 * t / d) * t) * ex(d, .07) + grains(d, 500, 800, 3500, .003, lambda t: np.exp(-t / .08)) * .6)
def onwood(): d = .3; t = T(d); return nrm(np.sin(2 * np.pi * 80 * t) * ex(d, .06) + partials(d, [220, 540], [.05, .03], [.5, .3]) + grains(d, 300, 800, 3000, .003, lambda t: np.exp(-t / .06)) * .4)
def engine(d, f0=38, f1=55, rev=None):
    t = T(d); f = f0 + (f1 - f0) * np.clip(t / (d * .6), 0, 1); ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 9)) * (1 + .3 * np.sin(2 * np.pi * 7 * t)); x = lp(x, 500) + lp(brown(d), 300) * .3
    return nrm(fade(x, .15, .3))
def steel_clank(big=1.0): d = 1.2; t = T(d); return nrm(partials(d, [175, 410, 690, 1130, 1790], [.5, .35, .25, .15, .08], [1, .7, .5, .35, .2], .004) * (1 + .0) + lp(nz(d), 800) * ex(d, .02) * 1.2 * big + hp(nz(d), 3000) * ex(d, .003) * .4)
def crane(d): t = T(d); f = 320 + 120 * np.sin(np.pi * t / d); ph = 2 * np.pi * np.cumsum(f) / SR; x = lp(np.sin(ph) + .4 * np.sin(2 * ph) + .2 * np.sin(3 * ph), 1500) * .5 + lp(brown(d), 400) * .3; beep = (np.sin(2 * np.pi * 1040 * t) * ((t * 2.2) % 1 < .35)) * .12; return nrm(fade(x + beep, .1, .2))
def steel_boom(): d = 1.6; t = T(d); return nrm(np.sin(2 * np.pi * 55 * t) * ex(d, .25) + partials(d, [110, 163, 247, 390], [.6, .4, .3, .2], [.6, .5, .4, .25]) + lp(nz(d), 300) * ex(d, .05))
def scrape(d=.4, lo=300, hi=2500, end=True): t = T(d); x = bp(nz(d), lo, hi) * (0.6 + .4 * np.sin(2 * np.pi * 31 * t) ** 2) * np.sin(np.pi * t / d) ** .5; y = nrm(x); return (np.concatenate([y, steel_clank(.5)[:int(.5 * SR)] * .5]) if end else y)
def land(heavy=1.0): d = .7; t = T(d); return nrm(np.sin(2 * np.pi * (58 - 14 * t) * t) * ex(d, .12) * 1.4 + partials(d, [150, 340, 610, 980], [.3, .2, .12, .07], [.6, .45, .3, .2], .01) + lp(nz(d), 500) * ex(d, .03) * heavy)
def tear(): d = .28; return nrm(grains(d, 1800, 900, 6500, .0015, lambda t: np.sin(np.pi * t / d) ** .3))
def horn():
    d = 4.2; t = T(d); f = 73.4 * (1 + .003 * np.sin(2 * np.pi * 4.5 * t)); env = np.minimum(1, t / .09) * np.where(t < 2.1, 1, np.exp(-(t - 2.1) / .35))
    x = np.zeros_like(t)
    for det in (-.004, 0, .005):
        ph = 2 * np.pi * np.cumsum(f * (1 + det)) / SR; x += sum(np.sin(k * ph) * (1 / k ** .8) for k in range(1, 14))
    x = lp(x, 1100, 3) * env + lp(nz(d), 200) * env * .15
    return nrm(verb(x, 2.8, .35))
def drum(d):
    t = T(d); rot = .6 + .4 * np.abs(np.sin(np.pi * 1.4 * t)); x = lp(brown(d), 220) * rot * 1.2 + grains(d, 500, 700, 3500, .004, lambda tt: .6 + .4 * np.abs(np.sin(np.pi * 1.4 * tt))) * .35
    return nrm(fade(x, .4, .4))
def crack(): d = .1; return nrm(hp(nz(d), 1500) * ex(d, .004) * 1.5 + partials(d, [2300, 3900], [.012, .008], [.6, .4]) + grains(d, 200, 2000, 6000, .002, lambda t: np.exp(-t / .03)) * .4)
def bell(): d = 1.0; one = partials(d, [4180, 5210, 8360, 2090], [.35, .2, .1, .4], [1, .5, .25, .3]); return nrm(one + fit(np.pad(one, (int(.16 * SR), 0)), len(one)) * .8)
def plaster(): n = int(.45 * SR); return nrm(fit(scrape(.45, 250, 1800, False), n) * .8 + fit(np.pad(wood(420), (int(.4 * SR), 0)), n) * .5)
def grinder(d):
    t = T(d); spin = np.minimum(1, t / .15) * np.minimum(1, (d - t) / .12); f = 820 * (.6 + .4 * np.minimum(1, t / .2)); ph = 2 * np.pi * np.cumsum(f) / SR
    return nrm((lp(np.sin(ph) + .5 * np.sin(2 * ph) + .3 * np.sin(3.1 * ph), 3000) * .4 + grains(d, 3000, 1200, 7000, .0015) * .9) * spin)
def tamp(): d = .2; t = T(d); return nrm(np.sin(2 * np.pi * 120 * t) * ex(d, .03) + lp(nz(d), 1000) * ex(d, .01) * .6)
def lock(): d = .25; n = int(d * SR); return nrm(partials(d, [1900, 3100, 5400], [.04, .03, .02], [1, .6, .3]) + hp(nz(d), 2500) * ex(d, .004) + fit(np.pad(partials(.1, [2600], [.02], [.6]), (int(.09 * SR), 0)), n))
def pump(d): t = T(d); ph = 2 * np.pi * 100 * t; x = lp(np.sign(np.sin(ph)) * .5 + np.sin(ph), 800) * .4 + bp(nz(d), 3000, 9000) * .35; return nrm(fade(x, .05, .15))
def drip(): d = .35; t = T(d); f = 1100 + 900 * np.minimum(1, t / .05); return nrm(np.sin(2 * np.pi * np.cumsum(f) / SR) * ex(d, .06) + partials(d, [3200, 5100], [.15, .08], [.2, .1]))
def pour(d):
    t = T(d); n = nz(d); out = np.zeros_like(n)
    for i in range(0, len(n), 480): f = 700 + 900 * i / len(n); seg = bp(n[max(0, i - 2000):i + 480], f * .9, f * 1.12)[-480:]; out[i:i + len(seg)] = seg
    bub = grains(d, 140, 400, 1800, .01)
    return nrm(fade(out + bub * .3, .02, .2))
def ceramic_scrape(): d = .7; return nrm(bp(nz(d), 1500, 5000) * np.sin(np.pi * T(d) / d) * .6)
def clink(): d = .8; return nrm(partials(d, [2350, 4120, 6020, 3180], [.3, .18, .1, .22], [1, .6, .3, .4]) + hp(nz(d), 4000) * ex(d, .002) * .5)

# ---------- ambience beds ----------
def birds(d, dens=1.4, hi=1.0, seed=3):
    r = np.random.default_rng(seed); out = np.zeros(int(d * SR)); t_ = 0
    while t_ < d - .5:
        t_ += r.exponential(1 / dens); kind = r.integers(3); f0 = (2600 + r.random() * 1600) * hi; n = r.integers(2, 6)
        for j in range(n):
            L = .05 + r.random() * .08; tt = np.arange(int(L * SR)) / SR
            if kind == 0: f = f0 * (1 + .35 * np.sin(np.pi * tt / L))
            elif kind == 1: f = f0 * (1.3 - .5 * tt / L)
            else: f = f0 * (1 + .1 * np.sin(2 * np.pi * 40 * tt))
            ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / L) ** 2
            s = int((t_ + j * (L + .03)) * SR); out[s:s + len(ch)] += ch[:max(0, len(out) - s)] * (.5 + .5 * r.random())
    return out
def bed(kind, d):
    t = T(d)
    if kind == 'hill': return lp(brown(d), 500) * (.5 + .3 * np.sin(2 * np.pi * .15 * t)) * .35 + bp(nz(d), 1800, 4500) * (.5 + .5 * np.sin(2 * np.pi * .23 * t + 1)) * .006
    if kind == 'port':
        g = np.zeros(int(d * SR))
        for tt in [.8, 3.2, 5.1]:
            L = .7; x = np.arange(int(L * SR)) / SR; f = 1350 - 500 * x / L + 80 * np.sin(2 * np.pi * 9 * x); cry = sum(np.sin(k * 2 * np.pi * np.cumsum(f) / SR) / k for k in (1, 2, 3)) * np.sin(np.pi * x / L); s = int(tt * SR); g[s:s + len(cry)] += cry[:max(0, len(g) - s)]
        return lp(brown(d), 300) * .45 + g * .12 + bp(nz(d), 400, 2000) * .03
    if kind == 'sea':
        sw = sum(np.maximum(0, np.sin(2 * np.pi * t / p + ph)) ** 2 for p, ph in [(3.7, 0), (5.1, 2), (2.9, 4)])
        return lp(brown(d), 900) * (.3 + .35 * sw) * .8 + bp(nz(d), 3000, 8000) * .03 * sw
    if kind == 'city': return bp(brown(d), 80, 700) * .6 + bp(nz(d), 800, 3000) * .02 + birds(d, .4, 1.2, 9) * .05
    if kind == 'cafe':
        m = np.zeros(int(d * SR)); r = np.random.default_rng(5)
        for _ in range(int(d * 9)):
            s = int(r.random() * (len(m) - SR)); L = int((.08 + r.random() * .2) * SR); m[s:s + L] += np.sin(np.pi * np.arange(L) / L) * (.3 + r.random() * .7)
        return bp(nz(d), 300, 2500) * m * .12 + bp(brown(d), 60, 300) * .15
    if kind == 'morning': return bp(brown(d), 70, 500) * .12
    return np.zeros(int(d * SR))

amb = np.zeros((N, 2)); fol = np.zeros((N, 2)); voc = np.zeros((N, 2))
def place(buf, x, t, g=1.0, pan=0.0): add(buf, x.astype(np.float64), t, g, pan)
def bed_span(kind, t0, t1, fi, fo, g, pan_w=.3):
    d = t1 - t0 + fo; L = bed(kind, d); R = bed(kind, d); env = np.ones(int(d * SR)); ni, no = int(fi * SR), int(fo * SR); env[:ni] = np.linspace(0, 1, ni); env[-no:] = np.linspace(1, 0, no); env = env[:len(L)]
    s = int(t0 * SR); e = min(N, s + len(env)); amb[s:e, 0] += (L[:e - s] * env[:e - s]) * g; amb[s:e, 1] += (R[:e - s] * env[:e - s]) * g
bed_span('hill', 0, 17.2, .8, 1.2, 1.0)
brd = np.zeros((N, 2))
def bird_span(t0, t1, dens, hi, seed, g):
    d = t1 - t0; L = birds(d, dens, hi, seed); R = birds(d, dens, hi, seed + 1); e = np.minimum(1, np.minimum(T(d) / .8, (d - T(d)) / 1.2)); s0 = int(t0 * SR); n = min(N - s0, len(L)); brd[s0:s0 + n, 0] += L[:n] * e[:n] * g; brd[s0:s0 + n, 1] += R[:n] * e[:n] * g
bird_span(0, 18.2, 1.3, 1.0, 3, .2 * .55); bird_span(46.1, DUR - .1, 2.2, 1.35, 21, .16 * .55)
bed_span('port', 17.4, 22.4, .5, 1.2, 1.0)          # J-cut: harbour before the picture arrives (18.0)
bed_span('sea', 22.0, 29.95, .9, .05, 1.1)
bed_span('city', 33.9, 40.4, 1.2, 1.0, .9)          # L-cut: the horn tail runs into the city
bed_span('cafe', 40.3, 45.2, .6, .1, 1.0)
bed_span('morning', 46.1, DUR - .2, 1.2, 1.5, 1.0)

evs = sorted(EVL, key=lambda e: e['t'])
for e in evs:
    t, ty = e['t'], e['type']
    if ty == 'snap': place(fol, snap(), t, .55, .15)
    elif ty == 'palm': place(fol, palm(), t, .9, 0)
    elif ty == 'tag': place(fol, tick(1600), t, .25, .3)
    elif ty == 'pin': place(fol, tick(2100), t, .18, .2)
    elif ty == 'title_word': k = [x['t'] for x in evs if x['type'] == 'title_word'].index(t); place(fol, wood(700 + 90 * k), t, .4, -.2 + .12 * k)
    elif ty == 'basket': place(fol, wicker(), t, .3, -.1)
    elif ty == 'inset_open': w_ = whoosh(.3, 1); place(fol, w_ * .5 + fit(tick(1400), len(w_)), t - .05, .25, .4)
    elif ty == 'inset_close': place(fol, whoosh(.25, 1)[::-1] * .5, t, .18, .4)
    elif ty == 'knife': place(fol, knife(), t, .32, .2)
    elif ty == 'cherry_cut': place(fol, wetpop(), t, .45, .4)
    elif ty == 'step': place(fol, soilstep(), t, .3, 0)
    elif ty == 'basket_pour': place(fol, cherries_pour(), t, .35, 0)
    elif ty == 'rake': place(fol, rake(), t - .08, .42, .15)
    elif ty == 'sack_fill': place(fol, beans_pour(.6, 1200, 6000), t, .25, .2)
    elif ty == 'sack_thump': place(fol, sackthump(), t, .6, .2)
    elif ty == 'sack_load': place(fol, onwood(), t, .5, .1)
    elif ty == 'truck': x = engine(e.get('dur', 1.8)); place(fol, x, t - .3, .35, 0)
    elif ty == 'door': place(fol, steel_clank(1.0), t, .55, .1)
    elif ty == 'crane': place(fol, crane(e.get('dur', 2)), t, .18, .3)
    elif ty == 'box_hold': place(fol, steel_boom(), t, .55, 0)
    elif ty == 'hatch': place(fol, scrape(.3, 200, 1500), t, .22, 0)
    elif ty == 'box_land':
        if e.get('wave'):
            x = np.zeros(int(.8 * SR));
            for j in range(4): y = land(.8); s = int(j * .012 * SR); x[s:s + len(y)] += y[:len(x) - s] * (1 - j * .15)
            place(fol, nrm(x), t, .5, rng.uniform(-.3, .3))
        else: place(fol, land(), t, .62, 0)
    elif ty == 'ship_engine': place(fol, engine(e.get('dur', 8), 32, 36), t, .35, 0)
    elif ty == 'whoosh_ff': place(fol, whoosh(.7, 1), t - .1, .35, 0)
    elif ty == 'day_tick': k = [x['t'] for x in evs if x['type'] == 'day_tick'].index(t); place(fol, wood(1500 if k % 2 == 0 else 1150), t, .16, .35)
    elif ty == 'slide_steel': place(fol, scrape(.35 if e.get('small') else .45, 300, 2500), t, .35 if e.get('small') else .45, 0)
    elif ty == 'tear': place(fol, tear(), t, .45, 0)
    elif ty == 'creak': place(fol, creak(1.0), t, .03, 0)
    elif ty == 'horn': place(fol, horn(), t, 1.0, 0)
    elif ty == 'drum': place(fol, drum(e.get('dur', 4)), t, .38, -.1)
    elif ty == 'slide_wall': place(fol, plaster(), t, .35, 0)
    elif ty == 'beans_metal': place(fol, beans_pour(.7, 2000, 8000), t, .4, -.1)
    elif ty == 'crack': place(fol, crack(), t, .5, rng.uniform(-.35, .35))
    elif ty == 'cool_pour': place(fol, beans_pour(.7, 900, 5000), t, .4, .2)
    elif ty == 'bike': place(fol, bell(), t, .28, .4); place(fol, whoosh(.4, 1), t + .05, .25, .3)
    elif ty == 'beans_hopper': place(fol, beans_pour(.5, 1500, 7000), t, .32, -.2)
    elif ty == 'grinder': place(fol, grinder(e.get('dur', 1.2)), t, .42, -.2)
    elif ty == 'tamp': place(fol, tamp(), t, .55, 0)
    elif ty == 'lock': place(fol, lock(), t, .45, 0)
    elif ty == 'panel': place(fol, scrape(.3, 800, 4000), t, .25, .2)
    elif ty == 'pump': place(fol, pump(e.get('dur', 1)), t, .2, .1)
    elif ty == 'drip': place(fol, drip(), t, .7, 0)
    elif ty == 'pour': place(fol, pour(e.get('dur', 1.2)), t, .45, 0)
    elif ty == 'cup_slide': place(fol, ceramic_scrape(), t, .25, .2)
    elif ty == 'clink': place(fol, clink(), t, .45, .2)
    elif ty == 'voice':
        y, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav')); y = y.mean(1) if y.ndim > 1 else y
        y = librosa.resample(y, orig_sr=sr, target_sr=SR); y = compress(nrm(y, .9), thr=.3, ratio=3); place(voc, y, t, .62, 0)

# the dive: ambience + engine sink under water, then the real silence
tt = np.arange(N) / SR
w = np.clip((tt - 27.6) / 2.4, 0, 1)
dive_lp = lambda x: x * (1 - w[:, None]) + lp(x, 400) * w[:, None]
sea_mask = (tt >= 27.6) & (tt < 33.6)
for buf in (amb,):
    y = dive_lp(buf.copy()); buf[sea_mask] = y[sea_mask]
fol_dive = dive_lp(fol.copy()); m2 = (tt >= 27.6) & (tt < 30.0) ; fol[m2] = fol_dive[m2]
# ambience hard off in the two silences (foley stays: only the far-off creak lives there)
g_amb = np.interp(tt, [0, 29.9, 30.0, 33.6, 33.65, 45.2, 45.3, 45.9, 46.0, DUR], [1, 1, 0, 0, 1, 1, 0, 0, 1, 1])[:, None]
amb *= g_amb
g_fol = np.interp(tt, [0, 30.0, 30.05, 31.5, 31.6, 32.4, 32.5, 33.58, 33.6, 45.25, 45.3, 45.88, 45.9, DUR], [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1])[:, None]   # pre-silence tails cut; creak window open
fol *= g_fol

# music + ducking under voice
mus, sr = sf.read(os.path.join(D, 'music', 'score.wav')); mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
act = np.abs(voc).max(1); from scipy.ndimage import maximum_filter1d, uniform_filter1d
act = uniform_filter1d(maximum_filter1d((act > .02).astype(float), int(.6 * SR)), int(.15 * SR))
duck_m = 1 - .62 * act; duck_f = 1 - .35 * act
duck_a = 1 - .55 * act
brd *= g_amb * (1 - act)[:, None]
mixd = voc * 1.12 + brd + fol * .9 * duck_f[:, None] + amb * .55 * duck_a[:, None] + mus * .52 * duck_m[:, None]
for c in range(2): mixd[:, c] = limit(mixd[:, c], .95)
sf.write(os.path.join(D, 'mix.wav'), mixd.astype(np.float32), SR)
if os.environ.get('STEMS'):
    for nm, b in [('voc', voc * 1.12), ('fol', fol * .9 * duck_f[:, None]), ('amb', amb * .55 * duck_a[:, None] + brd), ('mus', mus * .52 * duck_m[:, None])]: sf.write(os.path.join(D, 'out', 'stem_' + nm + '.wav'), b.astype(np.float32), SR)
def rms(a, b, x=mixd): s = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9)
for nm, b in [('amb', amb), ('fol', fol), ('mus', mus), ('voc', voc)]: print(nm, 'sil1', round(rms(30.1, 33.5, b), 1), 'sil2', round(rms(45.35, 45.85, b), 1))
print('mix.wav', DUR, 's | voice', round(rms(8.4, 11.5, voc), 1), 'dB, music', round(rms(18, 22, mus * .52), 1), 'dB | silence 30.1–33.5:', round(rms(30.1, 33.5), 1), 'dB | 45.35–45.85:', round(rms(45.35, 45.85), 1), 'dB | horn peak', round(rms(33.6, 34.4), 1))
