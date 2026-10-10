# Sound design + final mix: rain bed (3 layers), wet foley, umbrella fabric, palette-knife scrapes, birds; music on top.
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, thump, whoosh, add, limit
rng = np.random.default_rng(11)
TL = json.load(open(os.path.join(HERE, 'out/timeline.json')))
T, bB, POPS, TB = TL['T'], TL['BEAT_B'], TL['POPS'], TL['TB']
DUR = TL['DUR'] + .4
N = int(DUR * SR)
music, sr = sf.read(os.path.join(HERE, 'music/score.wav')); music = music[:N]
if len(music) < N: music = np.pad(music, ((0, N - len(music)), (0, 0)))
fx = np.zeros((N, 2)); amb = np.zeros((N, 2))
def put(buf, x, at, g=1., pan=0.):
    if x.ndim == 2: x = x.mean(1)
    add(buf, x, at, g, pan)

# ---------- sounds (materials)
def splish(v=1., size=1.):          # wet footstep on cobbles
    d = .16; tt = t_(d)
    x = hp(noise(d), 1400) * env_exp(d, .018 * size) + bp(noise(d), 250, 900) * env_exp(d, .01) * .6 + np.sin(2 * np.pi * 90 * tt) * env_exp(d, .015) * .5
    return norm(x) * v
def big_splash(v=1.):
    d = .9; out = np.zeros(int(d * SR))
    out += norm(bp(noise(d), 350, 6500) * env_exp(d, .09)) * .9
    out[:int(.35 * SR)] += thump(.7, 75)[:int(.35 * SR)]
    for k in range(26):
        s = int((.05 + rng.random() ** 1.5 * .6) * SR); p = plink(.2 + rng.random() * .35, 1500 + rng.random() * 2500); out[s:s + len(p)] += p[:len(out) - s]
    return norm(out) * v
def plink(v=1., f=1800):              # a drop into water
    d = .12; tt = t_(d); fr = f * (1 + 1.2 * np.exp(-tt / .012))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(d, .025) * v
def woodtap(v=1.):                   # raindrop on varnished spruce
    d = .08; tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(820, 1, .02), (1760, .5, .01), (3100, .3, .006)]) + hp(noise(d), 3000) * env_exp(d, .002) * .6
    return norm(x) * v
def fwump(v=1., big=1.):             # umbrella canopy snapping open
    d = .45; tt = t_(d)
    x = np.sin(2 * np.pi * (95 + 40 * big) * tt * (1 - .5 * tt)) * env_exp(d, .06) * .9
    x += bp(noise(d), 700, 3500) * env_exp(d, .03) * .8
    x[:int(.02 * SR)] += hp(noise(.02), 2500) * .9     # the rib catch
    return norm(x) * v
def fabric(d=.4, v=1.):              # nylon rustle
    n = noise(d); m = np.abs(bp(rng.standard_normal(len(n)), 8, 40, 1)); m /= m.max() + 1e-9
    return norm(bp(n, 1500, 7000) * m * np.sin(np.pi * t_(d) / d)) * v
def knife(d=.4, v=1.):               # palette knife dragged through wet paint
    n = noise(d); tt = t_(d)
    grain = 1 + .8 * np.abs(bp(rng.standard_normal(len(n)), 30, 120, 1)) * 6
    body = bp(n, 900, 4200) * grain
    wet = bp(noise(d), 250, 700) * .5
    e = np.minimum(1, tt / .03) * np.exp(-np.maximum(0, tt - d * .6) / (d * .15))
    return norm((body + wet) * e) * v
def rosin(v=1.):
    d = .14; return norm(bp(noise(d), 1800, 5000) * env_exp(d, .04)) * v
def chirp(v=1.):
    d = .5; out = np.zeros(int(d * SR)); k = 0
    for i in range(3 + rng.integers(3)):
        dd = .05 + rng.random() * .05; tt = t_(dd); f0 = 3200 + rng.random() * 1500
        f = f0 + 900 * np.sin(np.pi * tt / dd) * (1 if i % 2 else -1)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / dd) ** 2
        st = int(k * SR); out[st:st + len(s)] += s[:len(out) - st]; k += dd + .025
    return out * v

# ---------- rain bed: hiss + near drops + gutter trickle, level automated per shot
def rain_bed(d):
    n = int(d * SR)
    hiss = bp(rng.standard_normal(n), 900, 7500) * (1 + .15 * np.sin(2 * np.pi * .23 * np.arange(n) / SR))
    drops = np.zeros(n)
    for _ in range(int(d * 90)):
        s = int(rng.random() * (n - 5000)); x = plink(.15 + rng.random() * .3, 2200 + rng.random() * 3500) if rng.random() < .5 else hp(noise(.01), 2500) * env_exp(.01, .002) * (.2 + rng.random() * .4)
        drops[s:s + len(x)] += x
    trickle = lp(bp(rng.standard_normal(n), 300, 1800) * (1 + np.sin(2 * np.pi * 3.1 * np.arange(n) / SR) * .4), 2000) * .4
    L = hiss * .5 + drops * .6 + trickle * .3
    R = np.roll(hiss, 997) * .5 + np.roll(drops, 4410) * .6 + np.roll(trickle, 2203) * .3
    return np.stack([L, R], 1)
rainw = rain_bed(DUR); rainw /= np.abs(rainw).max()
rain_in = np.stack([lp(rainw[:, 0], 1800), lp(rainw[:, 1], 1800)], 1)      # heard from under the arch
tt = np.arange(N) / SR
def curve(keys):
    xs = [k[0] for k in keys]; ys = [k[1] for k in keys]; return np.interp(tt, xs, ys)
g_out = curve([(0, .55), (2.6, .6), (2.7, 1), (7.1, 1), (7.2, .12), (10.3, .12), (10.6, .05), (12.3, .05), (12.4, .9), (16.6, .9), (16.7, .15), (19.3, .15), (19.4, .5), (23.4, .5), (23.5, .42), (T['gp'], .42), (T['gp'] + .01, 0), (DUR, 0)])
g_in = curve([(0, 0), (7.1, 0), (7.2, .7), (10.3, .7), (10.6, .22), (12.3, .22), (12.4, 0), (16.6, 0), (16.7, .5), (19.3, .5), (19.4, 0), (DUR, 0)])
amb += rainw * g_out[:, None] * .5 + rain_in * g_in[:, None] * .6

# ---------- 1 ECU: rosin on the first stroke, drops tapping the cello
put(fx, rosin(.35), T['hook'] - .02, 1, -.1)
for k in range(9): put(fx, woodtap(.25 + rng.random() * .25), .1 + rng.random() * 2.4, 1, rng.random() * 1.2 - .6)
# palette-knife scrapes: every repaint transition + the title
for t0, d, v in [(T['cutWide'], .45, .5), (T['cutMed'], .35, .4), (T['cutStreet'], .3, .45), (T['cutTop'], .45, .5), (T['last'], .8, .45)]: put(fx, knife(d + .15, v), t0 - .02, 1, 0)
put(fx, knife(1.2, .3), T['title'], 1, -.2)
# 2 wide grey: footsteps of the walkers (same walk maths as film.js)
WALK = [(760, 260, 900, None), (850, 1620, 1120, None), (990, -140, 520, None), (690, 1330, 1030, None), (640, 640, 840, None), (1130, 2300, 1500, 5.0), (720, 470, 700, None)]
fs = lambda y: max(.05, (y - 540) / (1100 - 540))
for y, x0, x1, ts in WALK:
    t0 = ts if ts else T['cutWide'] - .6; t1 = T['cutMed'] + .4; H0 = 260 * fs(y); speed = abs(x1 - x0) / (t1 - t0); per = H0 * .55 / speed
    k = 1
    while t0 + k * per < T['cutMed']:
        t = t0 + k * per
        if t > T['cutWide']: x = x0 + (x1 - x0) * (t - t0) / (t1 - t0); put(fx, splish(.12 + .35 * fs(y), .7 + fs(y)), t, 1, np.clip((x - 1056) / 1100, -.9, .9))
        k += 1
# 3 medium: passers-by right past the lens (loud, fast), nobody stops
for t0, t1, p0, p1 in [(7.55, 8.75, -1, 1), (9.0, 10.05, 1, -1)]:
    t = t0 + .2
    while t < t1 - .1: put(fx, splish(.55, 1.4), t, 1, p0 + (p1 - p0) * (t - t0) / (t1 - t0)); t += np.pi / 7.5
    put(fx, fabric(.5, .35), (t0 + t1) / 2 - .25, 1, 0)
put(fx, rosin(.25), T['stop'] + .3, 1, -.1)                                     # the bow lifts off
put(fx, plink(.5, 1500), 11.15, 1, -.3)                                          # a single drip in the silence
for t in T['steps']: put(fx, splish(.3, .8), t, 1, .4)                            # small steps approaching (J-cut)
put(fx, big_splash(1.0), T['splash'] - .01, 1, 0)                                 # FIRST SOUND AFTER THE SILENCE
# 4 girl
put(fx, fabric(.35, .3), 14.8, 1, .1); put(fx, hp(noise(.02), 2500) * .5, 15.25, 1, .1)
put(fx, fwump(1.0, 1.4), T['pop'] - .01, 1, .05)
for k in range(10): put(fx, splish(.15, .5), T['pop'] + .15 + rng.random() * .6, 1, rng.random() * 1.6 - .8)   # paint splats landing
# 5 reaction: the bow comes up
put(fx, whoosh(.35, .25), T['bowIn'] - .5, 1, -.2)
# 6 street: each umbrella snaps into colour; a thin shimmer arrives just before
for i, p in enumerate(POPS):
    pan = [-.7, -.3, 0, -.8, .3, -.5, .5, .1, 0][i]
    put(fx, whoosh(.3, .12), p['t'] - .3, 1, pan * .5 + .4)
    put(fx, fwump(.6, .8), p['t'] - .01, 1, pan)
# 7 overhead: the crowd's waltz steps on every beat (1 louder), until the grand pause
t = TB[7]
while t < T['gp'] - .05:
    beat = round((t - TB[7]) / bB) % 3
    for k in range(3 if beat == 0 else 2): put(fx, splish(.28 if beat == 0 else .14, 1), t + rng.random() * .03, 1, rng.random() * 1.6 - .8)
    t += bB
# 8 finale: rain gone — drips, umbrellas furling, birds
closing = [TB[12] + bB + ((i * 4) % 9) * bB * .5 for i in range(9)]
for i, c in enumerate(closing): put(fx, fabric(.3, .22), c, 1, [-.7, -.3, 0, -.8, .3, -.5, .5, .1, 0][i])
for t, f in [(32.2, 1400), (33.0, 1900), (34.05, 1600), (35.1, 2100), (36.4, 1500)]: put(fx, plink(.35, f), t, 1, rng.random() - .5)
for t in [32.6, 33.35, 34.7, 36.2, 37.6]: put(fx, chirp(.18), t, 1, rng.random() * 1.2 - .6)

# ---------- mix: music first; effects/ambience duck under the music a little
env = np.abs(music).mean(1); from scipy.ndimage import uniform_filter1d
env = uniform_filter1d(env, int(.25 * SR)); duck = 1 - .35 * np.clip(env / (env.max() + 1e-9) * 2.5, 0, 1)
mix = music * 1.0 + fx * .55 + amb * .32 * duck[:, None]
# grand pause: absolute silence
g0, g1 = int((T['gp'] + .02) * SR), int((T['chord'] - .004) * SR); mix[g0:g1] = 0
mix = np.stack([limit(mix[:, 0], .92), limit(mix[:, 1], .92)], 1)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
print('mix', N / SR, 's peak', float(np.abs(mix).max()))
