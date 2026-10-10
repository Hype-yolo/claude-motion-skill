"""Mix: foley (glass, lead, stone, air) + narration + score (ducked under voice) -> mix.wav
Run from repo root: .venv/bin/python styles/stained-glass/demo/mix.py"""
import sys, os, json, numpy as np, soundfile as sf, soxr
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, compress, limit, add
from scipy.signal import fftconvolve
D = os.path.dirname(os.path.abspath(__file__))
EV = json.load(open(os.path.join(D, 'events.json'))); DUR = EV['dur']; ev = EV['ev']
N = int(DUR * SR)
fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); amb = np.zeros((N, 2))
rng = np.random.default_rng(34)

def hall_ir(d=2.6, damp=2600, pre=.02):
    n = int(d * SR); e = np.exp(-np.arange(n) / SR / (d / 6.9))
    ir = np.stack([lp(rng.standard_normal(n), damp) * e, lp(rng.standard_normal(n), damp) * e], 1)
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir]); ir[0] = 1; return ir / np.abs(ir).sum(0) * 5
def verb(x, ir, mix=.3):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1); return x * (1 - mix) + y * mix
HALL = hall_ir(); ROOM = hall_ir(1.1, 3500, .008)

# ---------- glass & lead foley ----------
def glass_tink(v=1., f0=None, d=1.2, bright=1.):
    """struck glass: inharmonic modal partials (plate-ish ratios), fast attack, long-ish ring"""
    f0 = f0 or rng.uniform(2300, 3400); t = t_(d); y = np.zeros_like(t)
    for r, a, tau in [(1, 1, .5), (2.32, .6, .32), (4.25, .38, .2), (6.63, .22, .12), (9.38, .12, .07)]:
        y += a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / (tau * d))
    y += .25 * hp(noise(d), 5000) * np.exp(-t / .004) * bright
    return y * v * .35
def glass_crack(v=1.):
    d = 2.2; t = t_(d); y = np.zeros_like(t)
    y += hp(noise(d), 1500) * np.exp(-t / .03) * 1.2                              # the snap
    y += bp(noise(d), 180, 900) * np.exp(-t / .06) * .9                            # body of the pane
    for k in range(26):                                                            # the crack running + tinkle rain
        at = rng.uniform(.0, .28) if k < 12 else rng.uniform(.2, 1.4); n0 = int(at * SR)
        s = glass_tink(rng.uniform(.25, .8) * (1 if k < 12 else .5), rng.uniform(2500, 6200), rng.uniform(.25, .7))
        y[n0:n0 + len(s)] += s[:len(y) - n0]
    return y * v
def lead_creak(d=1.0, v=1.):
    """soft lead came bending: slow stick-slip friction, low band"""
    t = t_(d); rate = 18 + 10 * np.sin(2 * np.pi * .7 * t)
    ph = np.cumsum(rate) / SR; pulses = (np.sin(2 * np.pi * ph) > .92).astype(float)
    y = bp(pulses * noise(d) * .7 + pulses * .6, 260, 1400) * np.sin(np.pi * t / d) ** .5
    return y * v
def grind(d=1.0, v=1.):
    """glass edge sliding along a came: gritty band noise with a faint squeal"""
    t = t_(d); e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** .7
    y = bp(noise(d), 1800, 5200) * .5 * (1 + .6 * np.sin(2 * np.pi * 23 * t) * rng.uniform(.3, 1))
    y += .12 * np.sin(2 * np.pi * (1900 + 200 * np.sin(2 * np.pi * 1.3 * t)) * t) * e
    return y * e * v
def weld(v=1.):
    d = .7; t = t_(d); y = hp(noise(d), 3500) * np.exp(-t / .12) * .45            # soldering hiss
    g = glass_tink(.5, 3000, .6); y[:len(g)] += g[:len(y)]
    return y * v
def air(d=1.2, v=1., lo=300, hi=2400):
    t = t_(d); e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return bp(noise(d), lo, hi) * e * v * .5
def step_tick(v=1.):
    return glass_tink(v * .35, rng.uniform(3800, 4600), .25, .6)
def wings(v=1.):
    d = .9; t = t_(d); y = np.zeros_like(t)
    for k in range(4):
        n0 = int((k * .16 + rng.uniform(0, .02)) * SR); s = bp(noise(.12), 300, 2500) * np.hanning(int(.12 * SR) + 0)[:int(round(.12 * SR))]
        y[n0:n0 + len(s)] += s * (1 - k * .15)
    return y * v * .6
def clash(v=1.):
    d = 1.0; t = t_(d); y = np.zeros_like(t); g = glass_tink(.7, rng.uniform(1900, 2600), .8); y[:len(g)] += g
    y += lp(noise(d), 180) * np.exp(-t / .07) * 1.2                                 # low thud of the swing
    return y * v
def ignite(v=1., d=2.4):
    t = t_(d); e = np.clip(t / 1.2, 0, 1) ** 1.5 * np.exp(-np.clip(t - 1.6, 0, None) / .6)
    y = lp(noise(d), 900) * .4 * e
    cr = (rng.random(len(t)) > .9994).astype(float); y += bp(cr, 1500, 6000) * 2.5 * e
    return y * v
def crackle_bed(d, v=1.):
    t = t_(d); cr = (rng.random(len(t)) > .99975).astype(float) * rng.uniform(.3, 1, len(t))
    return (bp(cr, 1200, 7000) * 2 + lp(noise(d), 260) * .04) * v

# ---------- events ----------
V = {l['id']: l for l in json.load(open(os.path.join(D, 'lines.json')))}
def rs(a, sr):
    return soxr.resample(a, sr, SR) if sr != SR else a
for e in ev:
    t0, k = e['t'], e['type']
    if k == 'beam': add(fx, air(1.6, .5, 200, 1600), t0 - .1, .8); add(fx, glass_tink(.6, 2940, 1.8), t0, .9)
    elif k == 'title': add(fx, air(2.2, .35, 400, 3000), t0, .6)
    elif k == 'tink': add(fx, glass_tink(e.get('v', .6)), t0, .7, rng.uniform(-.3, .3))
    elif k == 'move': add(fx, air(e['d'] + .4, .45, 250, 2000), t0 - .1, .9, .2)
    elif k == 'step': add(fx, step_tick(e.get('v', .6)), t0, .55, -.1)
    elif k == 'wings': add(fx, wings(1), t0, .5, .4)
    elif k == 'clash': add(fx, clash(1), t0, .75, rng.uniform(-.2, .2))
    elif k == 'creak': add(fx, lead_creak(1.3, .5), t0, .6)
    elif k == 'crack': add(fx, glass_crack(1.0), t0 - .005, 1.35)
    elif k == 'grind': add(fx, grind(e['d'], .5), t0, .7, .25); add(fx, lead_creak(e['d'], .45), t0 + .1, .6)
    elif k == 'ignite': add(fx, ignite(.9), t0, .7, .3)
    elif k == 'slide': add(fx, grind(e['d'], .35), t0, .55, -.2); add(fx, lead_creak(e['d'], .35), t0, .5)
    elif k == 'weld': add(fx, weld(1), t0, .6, rng.uniform(-.2, .2))
    elif k == 'dusk': add(fx, air(2.5, .25, 150, 900), t0, .6)
    elif k == 'dawnwink': add(fx, air(1.4, .25, 300, 2400), t0 + .1, .5)
    elif k == 'voice':
        a, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav')); a = rs(a.astype(np.float64), sr)
        add(vo, a, t0, 1.0, 0)

# ---------- ambience: a large stone hall ----------
tt = t_(DUR)
room = lp(brown(DUR), 380) * .06 + bp(noise(DUR), 400, 1600) * .004
room *= np.clip(.35 + .65 * np.clip((tt - .3) / 1.5, 0, 1), 0, 1)
room[int(31.8 * SR):int(33.6 * SR)] *= .45                                        # hush after the crack
amb[:, 0] += room; amb[:, 1] += np.roll(room, 311)
for at, g in [(7.8, .35), (13.4, .25), (36.4, .18)]:                                # far pigeons in the vault
    add(amb, verb(np.stack([wings(.8)] * 2, 1), HALL, .6)[:, 0], at, g, rng.uniform(-.7, .7))
eb = crackle_bed(DUR - 33.0, .5); add(amb, eb, 33.0, .5, .35)                     # the ember, once lit

fx = verb(fx, HALL, .38)
vo[:, 0] = compress(vo[:, 0], .2, 3.0); vo[:, 1] = compress(vo[:, 1], .2, 3.0)
vo = verb(vo, ROOM, .12)

# ---------- score (stems) with ducking under the narration ----------
st = {}
for n in ['drone', 'melody', 'harp_chimes', 'battle', 'bell_glass']:
    a, sr = sf.read(os.path.join(D, 'music', 'stems', n + '.wav')); a = rs(a, sr); b = np.zeros((N, 2)); b[:min(N, len(a))] = a[:N]; st[n] = b
gains = {'drone': .8, 'melody': 1.0, 'harp_chimes': 1.0, 'battle': 1.05, 'bell_glass': 1.1}
mus = sum(st[n] * g for n, g in gains.items())
env = np.abs(vo).max(1); win = int(.25 * SR); env = np.convolve(env, np.ones(win) / win, 'same')
duck = 1 - .72 * np.clip(env / .04, 0, 1)
k = int(.12 * SR); duck = np.convolve(duck, np.ones(k) / k, 'same')
mus *= duck[:, None]

mix = mus * 1.0 + fx * .9 + amb * 1.0 + vo * 1.7
mix[:int(.45 * SR)] *= 0
mix = np.stack([limit(mix[:, 0], .95), limit(mix[:, 1], .95)], 1)
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
def rms(x): return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
for a, b, n in [(1.0, 4.5, 'L1'), (10, 13.8, 'L2'), (24.4, 27.4, 'L4'), (33.8, 37.6, 'L5'), (45, 47.2, 'L7'), (49.2, 52.9, 'L8')]:
    s0, s1 = int(a * SR), int(b * SR); print(f'{n}: voice {rms(vo[s0:s1] * 1.7):6.1f}  music {rms(mus[s0:s1]):6.1f}  fx {rms(fx[s0:s1] * .9):6.1f}')
print('silence 31.9-33.7 music', rms(mus[int(31.9 * SR):int(33.7 * SR)]), 'total', rms(mix[int(32.4 * SR):int(33.7 * SR)]))
print('wrote mix.wav', mix.shape, 'peak', np.abs(mix).max())
