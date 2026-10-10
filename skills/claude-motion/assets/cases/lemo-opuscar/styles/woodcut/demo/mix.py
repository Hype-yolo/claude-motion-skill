"""The Bell Founder — foley (synthesised by material), ambience, voice, score, ducking, silences → mix.wav
python styles/woodcut/demo/mix.py   (any cwd)"""
import sys, os, json
import numpy as np, soundfile as sf
from scipy.signal import resample_poly, fftconvolve
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp, add, limit, creak, whoosh as sfx_whoosh

rng = np.random.default_rng(7)
EV = json.load(open(os.path.join(D, 'events.json')))['ev']
TL = json.load(open(os.path.join(D, 'timeline.json'))); K = TL['keys']; DUR = TL['dur']
N = int(DUR * SR)
amb = np.zeros((N, 2)); fol = np.zeros((N, 2)); vox = np.zeros((N, 2))

def t_(d): return np.arange(int(d * SR)) / SR
def nz(d): return rng.standard_normal(int(d * SR))
def env(d, a=.005, tau=.1):
    t = t_(d); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / tau)
def modal(parts, d, noise_amt=.0, click=.0):
    """parts: [(freq, amp, decay_s), ...] → struck object"""
    t = t_(d); y = np.zeros_like(t)
    for f, a, tau in parts: y += a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / tau)
    y *= np.minimum(1, t / .0015)
    if click: y[:int(.006 * SR)] += click * hp(nz(.006), 2500) * np.linspace(1, 0, int(.006 * SR))
    return y
def crackle(d, rate, lo=1500, hi=7000, amp=1., dec=.004):
    y = np.zeros(int(d * SR)); n = int(rate * d)
    for _ in range(n):
        i = rng.integers(0, len(y) - 400); L = int(rng.uniform(.6, 2.5) * dec * SR); g = rng.uniform(.3, 1)
        ins(y, g * rng.standard_normal(L) * np.exp(-np.arange(L) / (dec * SR * .5)), i)
    return bp(y, lo, min(hi, SR / 2 - 100)) * amp
def ins(y, s, i):
    i = max(0, i); e = min(len(y), i + len(s))
    if e > i: y[i:e] += s[:e - i]
    return y
def norm(x, p=1.): m = np.abs(x).max(); return x * p / m if m > 0 else x

# ------------------------------------------------------------------ wood / knife
def knife_bite(): return norm(modal([(180, 1, .04), (910, .5, .03), (2300, .3, .015)], .15, click=1.4) + .4 * bp(nz(.15), 2000, 6000) * env(.15, .001, .012), .9)
def knife_run(d, bright=1.):
    t = t_(d); spd = np.clip(np.interp(t / d, [0, .3, .45, 1], [.25, .45, 1, .9]), 0, 1)
    grain = 1 + .8 * np.sin(2 * np.pi * (35 + 10 * np.sin(t * 3)) * t) * rng.uniform(.5, 1)
    y = bp(nz(d), 1400 * bright, 5200 * bright) * grain * spd ** .7 + crackle(d, 90 * d, 2500, 8000, .5)
    y *= np.minimum(1, t / .02) * np.minimum(1, (d - t) / .04)
    return norm(y, .55)
def gouge(u=True):
    d = .24 if u else .16
    y = bp(nz(d), 500 if u else 1300, 2600 if u else 6000) * env(d, .01, d * .45) + .6 * modal([(150 if u else 260, 1, .03)], d, click=.8)
    return norm(y, .6)
def stabs():
    y = np.zeros(int(.2 * SR))
    for k in range(3): i = int(k * .05 * SR); s = modal([(1800 + 400 * k, 1, .01)], .03, click=1); ins(y, s, i)
    return norm(y, .4)
def fine_scratch(d, dens=14):
    y = np.zeros(int(d * SR) + SR)
    for k in range(int(dens * d)):
        i = int(rng.uniform(0, d) * SR); s = knife_run(rng.uniform(.06, .14), 1.25) * rng.uniform(.3, .7); ins(y, s, i)
    return y[:int(d * SR) + int(.2 * SR)]
# ------------------------------------------------------------------ paper / ink
def brayer(d):
    t = t_(d); y = lp(nz(d), 2800) * (.5 + .5 * np.abs(np.sin(2 * np.pi * 7 * t))) + crackle(d, 380, 1200, 6000, .9, .002) + .5 * lp(nz(d), 200)
    return norm(y * np.minimum(1, t / .05) * np.minimum(1, (d - t) / .08), .5)
def paper_lay():
    d = .45; t = t_(d); y = lp(nz(d), 700) * np.sin(np.pi * t / d) ** 2 * .7
    th = modal([(95, 1, .05)], .2) * .5; ins(y, th, int(.3 * SR))
    return norm(y, .45)
def baren(d):
    t = t_(d); y = bp(nz(d), 700, 3200) * (.35 + .65 * np.abs(np.sin(2 * np.pi * 2.1 * t))) * np.minimum(1, t / .04) * np.minimum(1, (d - t) / .06)
    return norm(y, .4)
def peel(d):
    t = t_(d); y = crackle(d, 900, 1500, 7000, 1., .0015) * np.linspace(.3, 1, len(t)) ** 1.5 + .5 * lp(nz(d), 500) * np.sin(np.pi * t / d)
    return norm(y, .5)
def paper_land(): return norm(modal([(88, 1, .06)], .25) + .6 * bp(nz(.25), 400, 2200) * env(.25, .002, .03), .6)
# ------------------------------------------------------------------ clay / metal / fire
def clay_rasp(d):
    t = t_(d); y = bp(nz(d), 280, 1700) * (.6 + .4 * np.sin(2 * np.pi * 11 * t)) * np.sin(np.pi * t / d) ** .8
    return norm(y + crackle(d, 60, 400, 2500, .3), .5)
GIFTS = {
    'pot': lambda: norm(modal([(196, 1, .9), (463, .7, .6), (802, .5, .4), (1213, .35, .3), (1690, .2, .2)], 2.0, click=.8), .95),
    'candle': lambda: norm(modal([(612, 1, .7), (1488, .5, .45), (2634, .3, .25)], 1.6, click=.8), .7),
    'keys': lambda: sum_shift([(modal([(rng.uniform(2600, 5200), 1, .15), (rng.uniform(5000, 8000), .4, .08)], .4, click=.6), rng.uniform(0, .22), rng.uniform(.3, .8)) for _ in range(7)], .8),
    'ring': lambda: norm(modal([(3240, 1, 1.1), (7820, .35, .5), (1610, .15, .6)], 2.0, click=.4), .55),
    'spoon': lambda: sum_shift([(modal([(1310, 1, .15), (3150, .6, .1)], .4, click=.7), dt, g) for dt, g in [(0, 1), (.12, .5), (.2, .25)]], .7),
    'bracelet': lambda: sum_shift([(modal([(rng.uniform(1800, 3200), 1, .12)], .3, click=.6), dt, g) for dt, g in [(0, 1), (.05, .7), (.1, .6), (.16, .4), (.22, .3)]], .65),
}
def sum_shift(items, p):
    L = max(int((dt + len(y) / SR) * SR) for y, dt, g in items) + 10; out = np.zeros(L)
    for y, dt, g in items: i = int(dt * SR); ins(out, g * y, i)
    return norm(out, p)
def heap_rattle(): return sum_shift([(modal([(rng.uniform(900, 2600), 1, .05)], .12, click=.4), rng.uniform(.03, .3), rng.uniform(.1, .35)) for _ in range(6)], .25)
def bellows():
    d = .55; t = t_(d); air = lp(nz(d), 900) * np.sin(np.pi * t / d) ** 1.5
    y = air * .8; c = creak(.5); ins(y, .25 * c, 0)
    return norm(y, .5)
def fire(d, g=1.):
    t = t_(d); roar = lp(nz(d), 350) * (.7 + .3 * np.sin(2 * np.pi * .6 * t + 1))
    y = roar * .6 + crackle(d, 22 * d, 800, 6000, .9, .003)
    return y * np.minimum(1, t / .3) * np.minimum(1, (d - t) / .3) * g
def bubbles(d):
    y = np.zeros(int(d * SR) + SR)
    for _ in range(int(9 * d)):
        i = int(rng.uniform(0, d) * SR); L = int(.07 * SR); tt = np.arange(L) / SR; f = np.linspace(rng.uniform(50, 80), rng.uniform(150, 260), L)
        ins(y, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / tt[-1]) * rng.uniform(.4, 1), i)
    return norm(lp(y, 900), .5)
def clank(): return norm(modal([(880, 1, .12), (2120, .6, .08), (3390, .4, .05)], .5, click=1), .6)
def pour(d, g=1.):
    t = t_(d); y = bp(nz(d), 90, 900) * np.minimum(1, t / .08) * np.minimum(1, (d - t) / .3) + .35 * lp(nz(d), 120)
    return norm(y + crackle(d, 50 * d, 2000, 8000, .5), .8) * g
def sizzle(d, g=1.):
    t = t_(d); return norm(hp(nz(d), 4000) * (.6 + .4 * np.sin(2 * np.pi * 3 * t)) * np.minimum(1, t / .05) * np.exp(-t / (d * .6)), .35) * g
def smash():
    d = .9; y = hp(nz(d), 200) * env(d, .001, .09) + 1.2 * modal([(58, 1, .12), (120, .5, .08)], d) + crackle(d, 90, 500, 5000, 1.2, .005) * np.exp(-t_(d) / .25)
    return norm(y, 1.)
def debris(d): return norm(lp(crackle(d, 45 * d, 300, 3500, 1, .006), 2500) * np.exp(-t_(d) / (d * .6)), .45)
def clunk():
    d = 1.0; t = t_(d)
    y = modal([(178, 1, .22), (241, .8, .16), (389, .6, .1), (522, .5, .07), (627, .4, .05)], d, click=1.2)
    buzz = bp(nz(d), 300, 2000) * (np.sign(np.sin(2 * np.pi * 31 * t)) * .5 + .5) * np.exp(-t / .12)
    return norm(y + .5 * buzz + .6 * modal([(70, 1, .1)], d), 1.)
def crack(d):
    y = np.zeros(int(d * SR) + int(.1 * SR)); n = 26
    for k in range(n):
        u = k / n; ti = d * (u ** .8)
        s = modal([(rng.uniform(2200, 4200), 1, .012), (rng.uniform(900, 1500), .5, .02)], .06, click=.7) * rng.uniform(.4, 1) * (1 - .6 * u)
        i = int(ti * SR); ins(y, s, i)
    return norm(y, .6)
def compass_click():
    y = np.zeros(int(.12 * SR))
    for dt, f, g in [(0, 5200, 1), (.005, 3400, .8), (.022, 7100, .35)]:
        s = modal([(f, 1, .01), (f * 1.9, .4, .006)], .05, click=.9); i = int(dt * SR); ins(y, g * s, i)
    return norm(y, .85)
def compass_drop(): return sum_shift([(modal([(2480, 1, .25), (5930, .4, .12)], .6, click=.7), 0, 1), (heap_rattle(), .02, .8), (modal([(2600, 1, .1)], .2, click=.5), .16, .35)], .7)
def rays():
    y = np.zeros(int(.8 * SR))
    for k in range(12): s = gouge(k % 2 == 0) * (1 - k / 14); i = int(k * .035 * SR); ins(y, s, i)
    return norm(y, .85)
def steam(d): t = t_(d); return norm(hp(nz(d), 2500) * np.minimum(1, t / .04) * np.exp(-t / (d * .45)), .45)
def wind(d, gust=1., lo=200, hi=1400):
    t = t_(d); x = nz(d); y = np.zeros_like(x)
    for f0, ph in [(lo, 0), (lo * 1.7, 2), (hi * .6, 4)]:
        y += bp(x, f0, f0 * 2.2) * (.5 + .5 * np.sin(2 * np.pi * (.13 + .05 * rng.random()) * t + ph)) ** 2
    return y * (.7 + .3 * gust * np.sin(2 * np.pi * .4 * t) ** 2)
def ink_dot(): return norm(modal([(1400, 1, .015), (600, .5, .03)], .06), .25)

# ------------------------------------------------------------------ the bell (tuned to D)
def big_bell():
    d = 11.5; t = t_(d)
    parts = [(73.4, .55, 9.0), (146.8, .9, 6.5), (174.6, .5, 5.0), (220.0, .45, 4.2), (293.7, .8, 3.8), (296.0, .3, 3.5),
             (440.0, .35, 2.6), (587.3, .3, 2.0), (741, .18, 1.4), (1011, .12, .9), (1370, .07, .5)]
    y = np.zeros_like(t)
    for f, a, tau in parts:
        y += a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / tau) * (1 + .08 * np.sin(2 * np.pi * 1.3 * t))
    y *= np.minimum(1, t / .002)
    thunk = lp(nz(.08), 1200) * env(.08, .001, .015); ins(y, 1.4 * thunk, 0)
    y[:int(.012 * SR)] += .6 * hp(nz(.012), 3000)
    return norm(y, 1.)
def reverb(x, rt=3.2, mix=.35, pre=.02):
    L = int(rt * SR); t = np.arange(L) / SR
    ir = np.stack([rng.standard_normal(L) * np.exp(-6.9 * t / rt) for _ in range(2)], 1); ir[:, :] = lp(ir.T, 5000).T
    ir /= np.sqrt((ir ** 2).sum(0)); p = int(pre * SR)
    wet = np.stack([fftconvolve(x, ir[:, c])[:len(x)] for c in range(2)], 1)
    wet = np.roll(wet, p, 0); wet[:p] = 0
    return np.stack([x, x], 1) * (1 - mix) + wet * mix * 2.2

# ------------------------------------------------------------------ place events
def put(buf, y, t, g=1., pan=0.):
    if y is None: return
    if y.ndim == 2:
        s = int(t * SR); e = min(len(buf), s + len(y)); buf[s:e] += y[:e - s] * g
    else: add(buf, y, t, g, pan)
tip_pan = lambda t: np.clip(-.8 + 1.6 * (t - 1.0) / 1.8, -.8, .8)
for e in EV:
    t, ty, d, g = e['t'], e['type'], e.get('dur', 0), e.get('gain', 1)
    if ty == 'knife_bite': put(fol, knife_bite(), t, .9 * g, -.6 if t < 5 else 0)
    elif ty == 'knife_run':
        y = knife_run(d)
        seg = 4800;
        for i in range(0, len(y), seg): put(fol, y[i:i + seg], t + i / SR, .8 * g, float(tip_pan(t + i / SR)) if t < 5 else 0)
    elif ty == 'knife_flick': put(fol, gouge(False) * .5, t, .7, .75); put(fol, stabs() * .5, t + .1, .5, .8)
    elif ty == 'gouge_u': put(fol, gouge(True), t, .75 * g, rng.uniform(-.6, .6))
    elif ty == 'gouge_v': put(fol, gouge(False), t, .65 * g, rng.uniform(-.6, .6))
    elif ty == 'carve_fine': put(fol, fine_scratch(d), t, .55 * g, 0)
    elif ty == 'carve_title': put(fol, fine_scratch(d, 22), t, .6 * g, .2)
    elif ty == 'stab': put(fol, stabs(), t, .6 * g, rng.uniform(-.5, .5))
    elif ty == 'brayer':
        y = brayer(d); seg = 4800
        for i in range(0, len(y), seg): put(fol, y[i:i + seg], t + i / SR, .8, -.8 + 1.6 * i / len(y))
    elif ty == 'paper_lay': put(fol, paper_lay(), t, .8)
    elif ty == 'baren': put(fol, baren(d), t, .7)
    elif ty == 'peel': put(fol, peel(d), t, .8, .3)
    elif ty == 'paper_land': put(fol, paper_land(), t, .8)
    elif ty == 'beam_creak': put(fol, creak(.5), t, .25, .5)
    elif ty == 'clay_rasp': put(fol, clay_rasp(d), t, .6 * g, .2)
    elif ty.startswith('gift_'):
        put(fol, GIFTS[ty[5:]](), t, (.95 if ty == 'gift_pot' else .5 if ty == 'gift_keys' else .75) * g, .45 if ty == 'gift_keys' else rng.uniform(-.2, .2))   # keys land on L2's "it": softer, off to the side; put(fol, heap_rattle(), t + .02, .7)
    elif ty == 'cloth_grip': put(fol, norm(bp(nz(.35), 900, 4000) * env(.35, .03, .12), .35), t, .7); put(fol, creak(.3) * .2, t + .1, .5)
    elif ty == 'bellows': put(fol, bellows(), t, .7 * g, -.4)
    elif ty == 'fire_roar': put(amb, fire(d, g), t, .35, -.3)
    elif ty == 'molten_bubble': put(fol, bubbles(d), t, .6 * g, -.3)
    elif ty == 'tongs_clank': put(fol, clank(), t, .6, 0)
    elif ty == 'pour': put(fol, pour(d, g), t, .75, .1)
    elif ty == 'sizzle': put(fol, sizzle(d, g), t, .7, .2)
    elif ty == 'sparks': put(fol, crackle(d, 70 * d, 2500, 9000, 1, .002) * np.exp(-t_(d) / d), t, .35, .2)
    elif ty == 'whoosh': put(fol, sfx_whoosh(.22, .8), t, .6, .3)
    elif ty == 'mould_smash': put(fol, smash(), t, 1.0, .15)
    elif ty == 'debris': put(fol, debris(d), t, .7 * g, .2)
    elif ty == 'dust': put(fol, steam(d) * .4, t, .5, .2)
    elif ty == 'clunk': put(fol, clunk(), t, 1.0, .1)
    elif ty == 'crack': put(fol, crack(d), t, .8, .25)
    elif ty == 'compass_click': put(fol, compass_click(), t, .9, 0)
    elif ty == 'throw_whoosh': put(fol, sfx_whoosh(.28, .6), t, .5, .2)
    elif ty == 'compass_drop': put(fol, compass_drop(), t, .85, 0)
    elif ty == 'rays_carve': put(fol, rays(), t, .8, 0)
    elif ty == 'steam': put(fol, steam(d), t, .6, .1)
    elif ty == 'ink_dot': put(fol, ink_dot(), t, .5 * g, rng.uniform(-.6, .6))

# ------------------------------------------------------------------ ambience beds
put(amb, lp(nz(9.0), 250) * .05 + wind(9.0) * .05, 0, 1)                         # room + far wind under the block
w = wind(6.2, 1.3) * .45; w *= np.minimum(1, t_(6.2) / .4); put(amb, w, 8.9, 1, 0)          # the valley in snow
mw = lp(wind(4.0), 500) * .25; put(amb, mw * np.minimum(1, (4.0 - t_(4.0)) / .5), 15.0, 1)   # outside, through the door (L-cut)
put(amb, fire(15.2, .7), K['fire_jcut'], .28, -.2)                                # forge bed (J-cut at 14.5)
put(amb, fire(10.9, .8), K['click'] - .1, .3, -.2)                                # forge again after the silence
fw = wind(2.66) * .035; put(amb, fw, K['silence1'], 1)                             # the only sound in silence 1
we = wind(1.34, 1.5) * .35; we *= np.minimum(1, t_(1.34) / .5); put(amb, we, K['pull2'], 1, .2)
night = lp(nz(10.2), 180) * .012; put(amb, night, 48.3, 1)
# the bell + the valley answering
bell = big_bell(); bw = reverb(bell, 3.6, .42)
put(fol, bw, K['bell'], 1.0)
for key, g, dl in [('echo1', .32, 1200), ('echo2', .18, 800)]:
    ec = lp(bell[:int(4 * SR)], dl); ec = reverb(ec, 2.5, .6); put(fol, ec, K[key], g)
# the last knife
# ------------------------------------------------------------------ voice
DURS = json.load(open(os.path.join(D, 'voices/dur.json')))
vo_win = []
for e in EV:
    if e['type'] != 'vo': continue
    x, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav'))
    if x.ndim > 1: x = x.mean(1)
    x = resample_poly(x, SR, sr) if sr != SR else x
    x = norm(x, .8)
    put(vox, reverb(x, .5, .08), e['t'], 1.0)
    vo_win.append((e['t'], e['t'] + len(x) / SR))
# ------------------------------------------------------------------ music + ducking
mus, msr = sf.read(os.path.join(D, 'music/score.wav')); mus = mus[:N]
if len(mus) < N: mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
tt = np.arange(N) / SR; duck = np.ones(N)
for a, b in vo_win:
    depth = .40 if a < K['bell'] else .5
    w_ = np.clip(np.minimum((tt - (a - .25)) / .25, ((b + .3) - tt) / .35), 0, 1)
    duck = np.minimum(duck, 1 - (1 - depth) * w_)
for key in ['knife_first', 'clunk', 'click', 'bell']:           # key foley: music steps aside
    a = K[key]; w_ = np.clip(np.minimum((tt - (a - .05)) / .05, ((a + .6) - tt) / .4), 0, 1); duck = np.minimum(duck, 1 - .35 * w_)
fduck = 1 - .3 * (1 - duck) / .6
for a, b in vo_win:                                   # foley steps back under the voice too (the gift clangs sit on L2's words)
    w_ = np.clip(np.minimum((tt - (a - .1)) / .1, ((b + .15) - tt) / .2), 0, 1); fduck = np.minimum(fduck, 1 - (.65 if abs(a - K["L2"]) < .01 else .45) * w_)
mix = mus * 1.0 * duck[:, None] + amb * fduck[:, None] + fol * fduck[:, None] + vox * 1.35
# absolute silences
def zero(a, b, fade=.02):
    i, j = int(a * SR), int(b * SR); f = int(fade * SR)
    mix[i:j] = 0
    mix[i - f:i] *= np.linspace(1, 0, f)[:, None]
zero(K['silence2'], K['bell'] - .002)
s1a, s1b = int(K['silence1'] * SR), int(K['click'] * SR)
keep = np.zeros_like(mix); put(keep, fw, K['silence1'], 1)
tail = mix[s1a - int(.03 * SR):s1a].copy()
mix[s1a:s1b] = keep[s1a:s1b]
pk = np.abs(mix).max(); mix = mix / pk * .89
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
print('mix.wav', mix.shape, 'peak', pk, 'vo', vo_win)
