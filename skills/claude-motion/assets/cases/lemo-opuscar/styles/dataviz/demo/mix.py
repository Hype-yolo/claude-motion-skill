"""A Hundred Summers — foley + ambience + narration + score → mix.wav (48 kHz stereo).
Three layers: ambience bed (room / crickets / sea / cicadas / wind), foley (graphite, paper, wood pencil), music stems.
Music ducks under narration (~−8 dB), cicadas duck (~−6 dB). Two true silences are enforced at the end.
"""
import os, sys, json, numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp, compress, whoosh
from core.audio import pluck as PL

EVJ = json.load(open(os.path.join(HERE, 'events.json'))); EV, DUR = EVJ['ev'], EVJ['dur']
N = int(round(DUR * SR)); B = 60 / 90; T = lambda k: k * B
STOP, TAP26, HUSH = 31.0, 32.0, (42.667, 43.333)
rng = np.random.default_rng(7)
tt = lambda d: np.arange(int(round(d * SR))) / SR
def buf(): return np.zeros((N, 2), np.float32)
def put(dst, x, t, g=1.0, pan=0.0):
    i = int(round(t * SR)); x = np.asarray(x, np.float32)
    if i < 0: x = x[-i:]; i = 0
    if i >= N: return
    n = min(len(x), N - i); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    if x.ndim == 1: dst[i:i + n, 0] += x[:n] * g * l * 1.414; dst[i:i + n, 1] += x[:n] * g * r * 1.414
    else: dst[i:i + n] += x[:n] * g
def nz(d): return rng.standard_normal(int(round(d * SR)))
def db(x): return 10 ** (x / 20)

amb, fol = buf(), buf()

# ---------- foley: graphite on paper ----------
def tap(v=1.0, bright=1.0):                     # pencil point on paper: tiny tick + paper body
    d = .07; t = tt(d)
    tick = bp(nz(d), 1800 * bright, 6500) * np.exp(-t / .0022)
    body = bp(nz(d), 180, 900) * np.exp(-t / .009) * .7 + np.sin(2 * np.pi * 150 * t) * np.exp(-t / .01) * .35
    return (tick + body) * v
def scratch(d, rate=10, v=1.0, lo=1800, hi=6500):   # handwriting: strokes of band-passed graphite noise
    t = tt(d); n = bp(nz(d), lo, hi) + .35 * bp(nz(d), 500, 1500)
    ph = np.cumsum(rate * (1 + .35 * np.sin(2 * np.pi * .9 * t + rng.random() * 6)) / SR)
    strokes = np.abs(np.sin(np.pi * ph)) ** 1.6 * (.6 + .4 * np.sin(2 * np.pi * 2.3 * t) ** 2)
    edge = np.minimum(1, t / .03) * np.minimum(1, (d - t) / .05)
    return n * strokes * edge * v
def ruler(d, v=1.0):                             # pencil along a ruler: steady hiss that brightens
    t = tt(d); n = nz(d); out = np.zeros_like(n)
    for i in range(0, len(n), 2400):
        f = 1200 + 2200 * i / len(n); out[i:i + 2400] = bp(n[max(0, i - 4800):i + 2400], f * .6, f * 1.6)[-len(n[i:i + 2400]):]
    return out * np.minimum(1, t / .04) * np.minimum(1, (d - t) / .08) * v
def snap(v=1.0):                                 # paper punctured: crack + tiny tear crackle
    d = .35; t = tt(d); x = hp(nz(d), 1500) * np.exp(-t / .004) * 1.2
    for k in range(9):
        s = int((.01 + (k / 9) ** 1.3 * .22) * SR); c = hp(nz(.012), 2500) * np.exp(-tt(.012) / .002) * (.6 - k * .05)
        x[s:s + len(c)] += c
    x += bp(nz(d), 200, 700) * np.exp(-t / .03) * .6
    return x * v
def wood(v=1.0, f=1.0):                          # pencil body landing / ratchet tooth
    d = .08; t = tt(d)
    return (sum(a * np.sin(2 * np.pi * fr * f * t) * np.exp(-t / tau) for fr, a, tau in [(820, .6, .018), (1650, .4, .01), (2900, .25, .006)])
            + hp(nz(d), 2000) * np.exp(-t / .002) * .5) * v

evs = sorted(EV, key=lambda e: e['t'])
dots = [e for e in evs if e['type'] == 'dot']
for i, e in enumerate(dots):
    gap = min(e['t'] - dots[i - 1]['t'] if i else 3, dots[i + 1]['t'] - e['t'] if i + 1 < len(dots) else 3)
    g = float(np.interp(gap, [.083, .167, .5], [.16, .24, .34]))
    pan = -.35 + .7 * e['idx'] / 100
    if e['year'] in (1926,): g = .42
    if e['year'] == 2026: continue
    put(fol, tap(g, 1.0 + .3 * rng.random()), e['t'] - .004, 1.0, pan)
    if gap < .1: put(fol, scratch(gap, 30, .05, 2500, 7000), e['t'] - gap, 1.0, pan)   # needle scratch between dense dots
for e in evs:
    ty, t0 = e['type'], e['t']
    if ty == 'ring': put(fol, scratch(e['d'], 7, .1), t0)
    elif ty == 'leader': put(fol, scratch(e['d'], 3, .09), t0)
    elif ty == 'write': put(fol, scratch(e['d'], 11, .12), t0, 1.0, e.get('pan', 0))
    elif ty == 'doodle': put(fol, scratch(e['d'], 9 if e['kind'] == 'wave' else 5, .11), t0, 1.0, -.1)
    elif ty == 'ruler': put(fol, ruler(e['d'], .07), t0, 1.0, .1)
    elif ty == 'break': put(fol, snap(.5 if abs(t0 - 26.667) < .05 else .32), t0 - .003, 1.0, .15)
    elif ty == 'startle': put(fol, wood(.1, 1.3), t0)
    elif ty == 'flip': put(fol, whoosh(.36, .12), t0, 1.0, .1)
    elif ty == 'flipland': put(fol, wood(.26, .9), t0, 1.0, .1)
    elif ty == 'ratchet': put(fol, wood(.2, 1.4 + .15 * e['i']), t0, 1.0, -.3)
    elif ty == 'tap2026': put(fol, tap(.62, 1.1), t0 - .004, 1.0, .25)   # the clearest, driest tap of the film
    elif ty == 'rescale2': put(fol, ruler(e['d'], .035), t0, 1.0, -.2)
    elif ty == 'celltap': put(fol, tap(.3, 1.2), t0 - .004, 1.0, .35); put(fol, scratch(.14, 8, .06), t0 + .01, 1.0, .35)
# morph: a paper sweep that travels left → right with the transformation, plus a hush of tiny flicks
mo = [e for e in evs if e['type'] == 'morph']
sw = whoosh(1.0, .2); d = len(sw) / SR; t = tt(d); L = sw * np.cos(t / d * np.pi / 2); R = sw * np.sin(t / d * np.pi / 2)
put(fol, np.stack([L, R], 1), mo[0]['t'] - .1)
for e in mo: put(fol, bp(nz(.015), 3000, 8000) * np.exp(-tt(.015) / .003) * .035, e['t'], 1.0, -.5 + e['idx'] / 100)
# 1958: one music-box note instead of a voice (coordinator note)
put(fol, PL.pluck('music_box', 'D6', 2.5, .5), T(29.75), .16, .1)
put(fol, PL.pluck('music_box', 'A5', 2.5, .4), T(29.75) + .33, .12, .15)

# ---------- ambience ----------
def cricket(d):                                   # one cricket: 4.6 kHz trills
    x = np.zeros(int(d * SR)); t0 = rng.random() * .8; f = 4300 + rng.random() * 700
    while t0 < d - .2:
        for p in range(3 + rng.integers(2)):
            s = int((t0 + p * .03) * SR); tp = tt(.018); c = np.sin(2 * np.pi * f * tp) * np.sin(np.pi * tp / .018)
            x[s:s + len(c)] += c[:len(x) - s]
        t0 += .6 + rng.random() * .5
    return x
room_tone = lp(np.cumsum(nz(DUR)) * .01, 300); room_tone -= lp(room_tone, 20); room_tone /= np.abs(room_tone).max()
put(amb, room_tone * db(-52), 0)
cr = sum(cricket(21.5) * g for g in (1, .6, .4)); crt = tt(21.5)[:len(cr)]
put(amb, np.stack([cr * .8, np.roll(cr, 9000) * .8], 1) * (np.minimum(1, crt / 1.0) * np.clip((21.5 - crt) / 3, 0, 1))[:, None] * db(-44), 0)
# the sea (J-cut before "1933", L-cut into the next bar)
d = 12.8 - 8.6; t = tt(d); n = nz(d); sea = lp(n, 900) * (.35 + .65 * np.sin(np.pi * np.clip(t / 2.6, 0, 1)) ** 2 * (1 - .4 * np.sin(2 * np.pi * t / 3.1)))
sea += hp(lp(nz(d), 5000), 1500) * .18 * np.sin(np.pi * np.clip((t - 1.0) / 2.2, 0, 1)) ** 2
env = np.minimum(1, t / 1.2) * np.clip((d - t) / 1.6, 0, 1)
put(amb, np.stack([sea * env, np.roll(sea, 3000) * env], 1) * db(-31), 8.6)
# cicadas (J-cut at 20.0, louder and denser as it warms; hard stop at the cut)
d = STOP - 20.0; t = tt(d); c = bp(nz(d), 3800, 6800) * (.55 + .45 * np.sin(2 * np.pi * (42 + 10 * t / d) * t) ** 2)
c *= (.25 + .75 * (t / d) ** 1.6) * np.minimum(1, t / 2.0); c = lp(c, 7000)
cic = np.stack([c, np.roll(c, 5000) * .85], 1) * db(-35)
# wind after the silence (open, clear), gone for the hush, room tone after
d = HUSH[0] - 32.3; t = tt(d); w = lp(nz(d), 500) * (.6 + .4 * np.sin(2 * np.pi * .13 * t)) * np.minimum(1, t / 1.5) * np.clip((d - t) / .8, 0, 1)
put(amb, np.stack([w, np.roll(w, 7000)], 1) * db(-40), 32.3)

# ---------- narration ----------
lines = json.load(open(os.path.join(HERE, 'lines.json'))); vox = buf(); vmask = np.zeros(N)
for Lh in lines:
    y, sr = sf.read(os.path.join(HERE, 'voices', Lh['id'] + '.wav'))
    y = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=SR)
    y = compress(y / np.abs(y).max() * .8, thr=.2, ratio=3.0); y = y / np.abs(y).max() * .9
    put(vox, y, Lh['t'], db(1), 0)
    a, b = int(Lh['t'] * SR), int((Lh['t'] + len(y) / SR) * SR); vmask[a:b] = 1
def smooth_env(m, att=.06, rel=.25):
    out = np.zeros_like(m); a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); v = 0.0
    # vectorised-ish: process in blocks of 48 samples
    blk = 48; o = np.zeros(len(m) // blk + 1)
    for i in range(len(o)):
        x = m[i * blk:(i + 1) * blk].max() if i * blk < len(m) else 0
        c = a ** blk if x > v else r ** blk; v = x + (v - x) * c; o[i] = v
    return np.repeat(o, blk)[:len(m)]
de = smooth_env(vmask)
music = sum(sf.read(os.path.join(HERE, 'music', 'stems', n + '.wav'))[0] for n in ('data', 'pad', 'pulse')).astype(np.float32)
music = music[:N] if len(music) >= N else np.pad(music, ((0, N - len(music)), (0, 0)))
music *= (1 - de * (1 - db(-11)))[:, None] * db(-3)
put(amb, cic * (1 - de[int(20 * SR):int(20 * SR) + len(cic)] * (1 - db(-6)))[:, None], 20.0)
fol *= db(-2)

mix = music + amb + fol + vox
# enforce the two silences on every layer (true silence, then near-silence)
i0, i1, nf = int(STOP * SR), int(TAP26 * SR) - 200, 240
mix[i0 - nf:i0] *= np.linspace(1, 0, nf)[:, None]; mix[i0:i1] = 0
h0, h1 = int(HUSH[0] * SR), int(HUSH[1] * SR)
mix[h0:h1] *= .03
pk = np.abs(mix).max(); mix = mix / pk * db(-1)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
# stems for inspection
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
def r(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
print('mix peak', round(20 * np.log10(np.abs(mix).max()), 2), 'dBFS; silence 31–32 peak', round(20 * np.log10(np.abs(mix[i0:i1]).max() + 1e-12), 1), '; hush peak', round(20 * np.log10(np.abs(mix[h0:h1]).max() + 1e-12), 1))
# narration SNR (300–4000 Hz) per line
bg = (music + amb + fol) / pk * db(-1); vv = vox / pk * db(-1)
for Lh in lines:
    a = int(Lh['t'] * SR); b = a + int(2 * SR)
    s1 = bp(vv[a:b].mean(1), 300, 4000); s2 = bp(bg[a:b].mean(1), 300, 4000)
    print(Lh['id'], 'voice/bg SNR %.1f dB' % (r(s1) - r(s2)))
