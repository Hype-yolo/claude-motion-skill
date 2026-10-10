"""Mix: score stems (band with distance automation) + 5-level radio voices + foley by material + ambience beds + ducking → mix.wav
python styles/art-deco/demo/mix.py   (run from anywhere)"""
import os, sys, json, numpy as np, soundfile as sf, soxr
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp, noise, norm, t_, env_exp, brown, whoosh, thump, step, ding, add, limit, compress
from core.audio import sampler as S

TL = json.load(open(os.path.join(D, 'timeline.json'))); T = TL['T']; B = TL['B']; DUR = TL['DUR']; KB = 60 / TL['K_BPM']
N = int(DUR * SR) + SR
rng = np.random.default_rng(1930)
def st(): return np.zeros((N, 2), np.float32)
def ld(p):
    x, sr = sf.read(p, dtype='float32')
    if sr != SR: x = soxr.resample(x, sr, SR)
    if x.ndim == 1: x = np.stack([x, x], 1)
    y = np.zeros((N, 2), np.float32); y[:min(N, len(x))] = x[:N]; return y
def env_curve(pts):  # [(t, v)] → per-sample linear curve
    ts = np.array([p[0] for p in pts]); vs = np.array([p[1] for p in pts]); return np.interp(np.arange(N) / SR, ts, vs).astype(np.float32)
def room(x, size=.5, mix=.25): return S.room(x, size=size, mix=mix)
def mono_room(x, size=.5, mix=.3):
    y = S.room(np.stack([x, x], 1).astype(np.float32), size=size, mix=mix); return y

# ---------------- music ----------------
title = ld(os.path.join(D, 'music/stems/title.wav'))
band = ld(os.path.join(D, 'music/stems/band.wav'))
bells = ld(os.path.join(D, 'music/stems/bells.wav'))
whistle = ld(os.path.join(D, 'music/stems/whistle.wav'))
# distance automation on the band: the band plays on the roof; we climb toward it.
cut_pts = [(0, 2400), (T['street'], 2400), (T['wing1'], 2400), (T['wing2'], 1100), (T['snare'] - .01, 1100), (T['snare'], 1300), (T['stair'], 1300),
           (T['zoomOut'], 2600), (T['zoomIn'], 5000), (T['kitchen'], 8000), (T['roof'] - .6, 9000), (T['roof'], 20000), (DUR + 1, 20000)]
cut = env_curve(cut_pts)
banks = [(1100, None), (2400, None), (5000, None), (9000, None), (20000, None)]
filt = {}
for f, _ in banks: filt[f] = band if f >= 20000 else np.stack([lp(lp(band[:, c], f), f) for c in (0, 1)], 1).astype(np.float32)
freqs = np.array([f for f, _ in banks], float); lc = np.log(np.clip(cut, 1100, 20000)); lf = np.log(freqs)
band_d = np.zeros_like(band)
idx = np.clip(np.searchsorted(lf, lc) - 1, 0, len(lf) - 2); w = (lc - lf[idx]) / (lf[idx + 1] - lf[idx])
for i in range(len(lf) - 1):
    m = (idx == i)
    band_d[m] += filt[freqs[i]][m] * (1 - w[m, None]) + filt[freqs[i + 1]][m] * w[m, None]
wet = env_curve([(0, .0), (T['street'], .5), (T['wing2'], .35), (T['stair'], .45), (T['kitchen'], .15), (T['roof'], .05), (DUR + 1, .05)])
band_rev = room(band_d, size=.75, mix=1.0)
band_d = band_d * (1 - .3 * wet[:, None]) + band_rev * (wet[:, None] * .6)
bgain = env_curve([(0, 1), (T['street'], .72), (T['wing2'], .62), (T['stair'], .7), (T['kitchen'], .95), (T['roof'], 1.0), (DUR + 1, 1.0)])
band_d *= bgain[:, None]
bells_d = bells * 1.1 + room(bells, size=.9, mix=1.0) * .35
music = title + band_d + bells_d + whistle * 1.15

# ---------------- voices (five spaces) ----------------
lines = json.load(open(os.path.join(D, 'lines.json'))); dur = json.load(open(os.path.join(D, 'voices/dur.json')))
voice = st()
def vload(i):
    x, sr = sf.read(os.path.join(D, 'voices', i + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    x = soxr.resample(x, sr, SR); return compress(norm(x, .8), thr=.3, ratio=3).astype(np.float32)
def drive(x, k=2.4): return np.tanh(x * k) / np.tanh(k)
def space(x, kind):
    if kind == 'street':   # a street loudspeaker horn, slap echo off the buildings
        y = drive(bp(x, 320, 3800, 3), 1.7) * .9
        y = np.concatenate([y, np.zeros(int(.6 * SR), np.float32)]); e = np.zeros_like(y); d = int(.19 * SR); e[d:] = y[:-d] * .2
        return mono_room(y + e, .5, .24), 1.15
    if kind == 'radio':    # the desk / kitchen radio: small speaker, crackle
        y = drive(bp(x, 450, 3800, 3), 1.7); y = y + bp(rng.standard_normal(len(y)), 1500, 5000) * .012
        return mono_room(np.concatenate([y, np.zeros(int(.3 * SR), np.float32)]), .3, .15), 1.1
    if kind == 'hall':     # stairwell PA horn, long concrete reverb
        y = drive(bp(x, 420, 3300, 3), 2.0)
        return mono_room(np.concatenate([y, np.zeros(int(1.4 * SR), np.float32)]), .9, .5), 1.0
    if kind == 'live':     # at the microphone: full range, a little air
        return mono_room(np.concatenate([x, np.zeros(int(.5 * SR), np.float32)]), .35, .12), 1.15
    if kind == 'wind':
        return mono_room(np.concatenate([x, np.zeros(int(.4 * SR), np.float32)]), .5, .12), 1.05
    return mono_room(np.concatenate([x, np.zeros(int(.5 * SR), np.float32)]), .45, .16), 1.05
for L in TL['LINES']:
    x = vload(L['id']); y, gain = space(x, L['space'])
    s = int(L['t'] * SR); e = min(N, s + len(y)); voice[s:e] += y[:e - s] * gain
# L-cut: the echo of "Out of order?!" rolls up the stairwell after the doors burst open
x = vload('B1'); y = mono_room(np.concatenate([bp(x, 500, 3000), np.zeros(SR, np.float32)]), .95, .85)
s = int((T['stair'] + .05) * SR); voice[s:s + len(y)] += y[:N - s] * .22

# ---------------- foley (by material) ----------------
fx = st()
def metal(f0=2400, d=.35, v=1.0, tau=.08):   # struck metal (brass, iron tread)
    tt = t_(d); parts = [(1, 1), (2.76, .5), (5.4, .3), (8.9, .15)]
    x = sum(a * np.sin(2 * np.pi * f0 * r * tt + rng.random() * 6) * env_exp(d, tau / (r ** .5)) for r, a in parts)
    return norm(x + hp(noise(d), 3000) * env_exp(d, .004) * .6) * v
def tread(v=1.0):   # iron stair tread under a hard shoe
    d = .12; tt = t_(d); x = lp(noise(d), 1800) * env_exp(d, .01) + np.sin(2 * np.pi * 180 * tt) * env_exp(d, .025) * .6 + metal(900 + rng.random() * 300, d, .3, .04)
    return norm(x) * v
def marble(v=1.0):  # heel click on marble (with room)
    d = .09; tt = t_(d); x = hp(noise(d), 2500) * env_exp(d, .005) + np.sin(2 * np.pi * (2600 + rng.random() * 400) * tt) * env_exp(d, .01) * .5
    return norm(x) * v
def wood(f=180, v=1.0, d=.25):   # thunk (block, door, chopping board)
    tt = t_(d); x = np.sin(2 * np.pi * f * tt) * env_exp(d, .03) + bp(noise(d), 400, 2200) * env_exp(d, .012) * .8
    return norm(x) * v
def paper(d=.3, v=1.0, bright=4000):
    n = noise(d); g = (rng.random(len(n)) > .985).astype(float); g = lp(g, 60) * 30
    return norm(bp(n, 1200, bright) * (np.clip(g, 0, 1) * .7 + .3) * np.sin(np.pi * t_(d) / d)) * v
def klaxon(f=330, d=.7, v=1.0):   # 1930 car horn (two-tone ah-oo-gah-ish, original)
    tt = t_(d); fm = f * (1 + .25 * np.minimum(1, tt / (d * .5)) - .1 * np.maximum(0, tt - d * .5) / d)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(fm) / SR)) * .6 + np.sin(4 * np.pi * np.cumsum(fm) / SR) * .4
    return norm(bp(x, 300, 2500) * np.minimum(1, tt / .03) * np.minimum(1, (d - tt) / .08)) * v
def crowd(d, v=1.0, bright=1.0):  # murmur: many band-passed noise voices with syllable modulation
    out = np.zeros(int(d * SR))
    for k in range(10):
        f = 300 + rng.random() * 700; n = bp(noise(d), f, f * 2.2); m = lp(rng.random(len(n)) > .9985, 8) * 40
        out += n * np.clip(lp(np.abs(noise(d)), 4) * 6, 0, 1)
    return norm(out) * v
def cheer(d=2.2, v=1.0):
    tt = t_(d); c = crowd(d, 1) + bp(noise(d), 1500, 6000) * .6
    claps = np.zeros(int(d * SR))
    for i in range(160): s = int(rng.random() * (d - .1) * SR); cl = hp(noise(.03), 800) * env_exp(.03, .004); claps[s:s + len(cl)] += cl * (.4 + rng.random())
    return norm((c * .8 + claps * .7) * np.minimum(1, tt / .15) * np.exp(-tt / (d * .7))) * v
def wind(d, v=1.0, gust=.5, lo=150, hi=900):
    b = bp(brown(d) + noise(d) * .15, lo, hi); g = 1 + gust * np.sin(2 * np.pi * t_(d) * .23 + 1) * np.sin(2 * np.pi * t_(d) * .07)
    return norm(b * g) * v
def sizzle(d, v=1.0):
    n = hp(noise(d), 3000); c = (rng.random(len(n)) > .993) * 3; return norm(n * .3 + hp(c * noise(d), 4000)) * v
def hum(d, f=120, v=1.0):
    tt = t_(d); return norm(np.sin(2 * np.pi * f * tt) * .6 + np.sin(2 * np.pi * f * 2 * tt) * .3 + lp(noise(d), 400) * .4) * v
def swish(d=.3, v=1.0, lo=1000, hi=6000):   # glass / fabric air swish
    n = noise(d); tt = t_(d); return norm(bp(n, lo, hi) * np.sin(np.pi * tt / d) ** 2) * v
def clunk(v=1.0):   # big clock mechanism: ratchet + heavy iron clunk
    d = .6; tt = t_(d); x = np.sin(2 * np.pi * 70 * tt) * env_exp(d, .09) + lp(noise(d), 900) * env_exp(d, .03) + metal(620, d, .6, .12)
    r = np.zeros(len(x))
    for i in range(5): s0 = int(i * .018 * SR); r[s0:s0 + 300] += hp(noise(300 / SR), 2000) * .4
    return norm(x + r * .5) * v
def switch(v=1.0):  # knife switch ka-chunk + filament swell
    d = .7; tt = t_(d); x = wood(260, 1, d) * .6 + metal(1500, d, .5, .05)
    fil = (np.sin(2 * np.pi * 60 * tt) + .4 * np.sin(2 * np.pi * 180 * tt)) * np.minimum(1, tt / .1) * np.exp(-tt / .5) * .35
    return norm(x + fil) * v
def firework(v=1.0):
    d = 1.6; tt = t_(d); up = np.zeros(int(d * SR)); wl = int(.45 * SR)
    f = np.linspace(900, 2400, wl); up[:wl] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.linspace(.1, .5, wl)
    boom = np.zeros(int(d * SR)); s = wl; bb = thump(1, 48) + lp(noise(.35), 1500) * env_exp(.35, .06); boom[s:s + len(bb)] += bb[:len(boom) - s]
    crk = np.zeros(int(d * SR))
    for _ in range(30):
        s0 = int((.5 + rng.random() * 1) * SR); crk[s0:s0 + 200] += hp(noise(200 / SR), 3000)[:len(crk[s0:s0 + 200])] * .5
    return norm(up * .5 + boom + crk * .4) * v

# title: the gold lines "hiss" as they draw (rising shimmer)
d = T['titleHit']; tt = t_(d); sh = bp(noise(d), 4000, 12000) * (tt / d) ** 1.5 * .35; add(fx, sh, 0, .5)
add(fx, whoosh(1.0, 1), T['archOpen'], .5); add(fx, lp(brown(1.1), 180) * np.sin(np.pi * t_(1.1) / 1.1), T['archOpen'], .5)   # heavy bronze doors part
# street
add(fx, paper(.5, 1), T['envelope'] - .05, .35); add(fx, paper(.35, 1), T['envelope'] + 1.2, .2)
add(fx, klaxon(330, .7, 1), 7.7, .12, -.6); add(fx, klaxon(262, .9, 1), 9.6, .08, .7)
# revolving door: two glass wings + rubber seal
for tw in (T['wing1'], T['wing2']): add(fx, swish(.45, 1, 800, 5000), tw - .15, .55); add(fx, wood(140, 1, .2), tw + .18, .18)
# lobby footsteps (running on marble, 12 fps stride)
for i in range(9): add(fx, marble(1), T['wing2'] + .05 + i * .17, .22 * (1 - i / 14), .1)
for tp, v in ((T['press1'], .5), (T['press2'], .45), (T['press3'], .55)): add(fx, metal(3100, .15, 1, .02), tp, v, .2)
add(fx, metal(820, 1.4, 1, .35), T['plaque'], .9, .05); add(fx, metal(1230, 1.0, 1, .2), T['plaque'] + .01, .5)   # brass plaque CLANG
for i in range(8): add(fx, metal(3500 + rng.random() * 1500, .08, 1, .01), T['plaque'] - .08 + i * .03, .12)   # chain rattle
add(fx, np.concatenate([np.zeros(int(.4 * SR)), swish(.5, 1, 300, 1200)]), T['plaque'], .12)   # swing creak-air
for tk in (T['tick1'], T['tick2']): add(fx, mono_room(np.concatenate([wood(1400, 1, .06), np.zeros(int(.6 * SR))]), .7, .45)[:, 0], tk, .3)   # the lobby clock, alone in the silence
add(fx, swish(.35, 1, 500, 2500), T['capFix'] - .25, .18)   # cloth: fixing the cap
add(fx, wood(110, 1, .5), T['snare'], .55); add(fx, whoosh(.5, 1), T['snare'] - .05, .3)   # stair doors burst open
# stairwell: iron treads on eighths (C1), fast ticks in the time-lapse, slowing at the top
SB = TL['STAIR_BEATS']
for k in range(8):
    for h in (0, .5): add(fx, tread(1), SB[k] + (SB[k + 1] - SB[k]) * h, .38 if h == 0 else .28, -.2 + .4 * ((k * 2 + h * 2) % 2))
for k in range(8, 12):
    for q in range(4): add(fx, tread(.6), SB[k] + (SB[k + 1] - SB[k]) * q / 4, .14)
for k in range(12, 14):
    for h in (0, .5): add(fx, tread(1), SB[k] + (SB[k + 1] - SB[k]) * h, .3)
add(fx, whoosh(.8, 1), T['vortex'] + .1, .4)
# kitchen
add(fx, metal(4200, .9, 1, .25), T['kitchen'], .25)   # the tray "shing" of the match cut
for k in range(1, 12, 2): add(fx, wood(210 + rng.random() * 30, 1, .18), T['kitchen'] + k * KB, .55, -.3)   # cleavers on the backbeats
for k in range(4): add(fx, metal(5200 + k * 300, .25, 1, .05), T['trays'] + k * .09, .12, .3)   # silverware on the trays
add(fx, swish(.5, 1, 1500, 7000), T['trays'] - .1, .3); add(fx, bp(noise(.4), 1800, 4000) * np.sin(np.pi * t_(.4) / .4) * .6, T['trays'] + .02, .25)   # slide squeak-ish
add(fx, metal(3800, .6, 1, .1), T['capHit'], .45)   # tray knocks the cap: tink
d = T['capLand'] - T['capHit']; tt = t_(d); wh = bp(noise(d), 600, 2400) * (0.5 + .5 * np.sin(2 * np.pi * 9 * tt)) * np.sin(np.pi * tt / d); add(fx, wh, T['capHit'], .15)   # whirling cap
add(fx, wood(300, 1, .15), T['capLand'], .25)   # cap lands (soft felt tap; the cymbal is in the band)
add(fx, wood(95, 1, .6), T['doors'], .7); add(fx, metal(420, .8, 1, .15), T['doors'] + .02, .3)   # swing doors bang + spring
# roof run: steps on the metal catwalk
for i in range(8): add(fx, tread(1), T['roof'] + .06 + i * KB / 2, .3, -.3 + .6 * (i % 2))
add(fx, clunk(1), T['clock'], 1.0)
add(fx, swish(.35, 1, 400, 3000), T['release'] - .12, .5)   # throw
d = TL['STRIKES'][0] - T['release']; n = int(d * SR); fl = np.zeros(n)
for i in range(int(d * 7)): s = int((i / 7 + rng.random() * .02) * SR); pp = paper(.07, 1, 6000); fl[s:s + len(pp)] += pp[:n - s] * (.6 + .4 * np.sin(i))
add(fx, fl, T['release'] + .05, .16)   # the letter flutters down in the silence
add(fx, wood(420, 1, .08), TL['STRIKES'][0], .35)   # glove catches it
S2 = TL['STRIKES']
add(fx, paper(.35, 1, 6000), S2[1] - .05, .5); add(fx, paper(.5, 1, 5000), S2[2] - .1, .35); add(fx, swish(.3, 1, 1000, 6000), S2[3] - .1, .4)   # seal torn, sheet out, baton up
for i, s in enumerate(S2): add(fx, switch(1), s + .02, .38, -.6 + i * .1)   # each letter: the knife switch + filament
# the song: crowd cheer on the downbeat; fireworks during the pull-back; relay ticking of the chase
add(fx, cheer(3.0, 1), T['tutti'] - .02, .28)
for i in range(10): add(fx, firework(1), T['pull'] + .5 + i * B - .45, .22, (-1) ** i * .5)
for i in range(int((T['final'] - T['pull']) / .09)): add(fx, metal(6000, .02, 1, .004), T['pull'] + i * .09, .03)
# ending
add(fx, ding(1), T['ding'], .5); add(fx, wood(700, 1, .08), T['ding'] + .25, .25)   # the elevator ding (too late) + plaque flips
add(fx, lp(brown(.55), 300) * np.sin(np.pi * t_(.55) / .55), T['doors0'], .45); add(fx, wood(80, 1, .6), T['doors1'], .6)

# ---------------- ambience beds ----------------
amb = st()
def bed(x, t0, t1, g=1.0, fi=.4, fo=.4, pan=0):
    n = int((t1 - t0) * SR); x = x[:n]; e = np.minimum(1, np.minimum(t_(len(x) / SR) / fi, (len(x) / SR - t_(len(x) / SR)) / fo)); add(amb, x * e, t0, g, pan)
bed(wind(8, 1, .6, 120, 700) * .6 + crowd(8, 1) * .5, T['archOpen'], T['wing2'], .18)                    # city night
bed(mono_room(np.concatenate([lp(noise(6), 500) * .3 + crowd(6, 1) * .6, np.zeros(SR)]), .8, .5)[:, 0], T['wing1'], T['plaque'] + .8, .16, .3, .8)   # lobby room + murmurs
for i in range(6): add(amb, metal(5000 + rng.random() * 2000, .5, 1, .1), T['wing2'] + .4 + i * .52 + rng.random() * .2, .05, rng.random() - .5)   # glasses
bed(lp(noise(2), 300) * .15, T['plaque'] + .8, T['snare'], .08, .5, .05)                                  # near-silence: only the faintest room
bed(wind(8.5, 1, .4, 180, 520), T['stair'] - .1, T['kitchen'], .12)                                     # hollow stair shaft
bed(hum(5.4, 118, 1) * .5 + sizzle(5.4, 1) * .5 + crowd(5.4, .5) * .3, T['kitchen'], T['doors'] + .2, .2, .1, .3)   # kitchen
bed(wind(30, 1, .8, 100, 800), T['capLand'], DUR - 5.6, .22, 1.2, 1.5)                                  # rooftop wind (J-cut from the kitchen)
bed(crowd(5, 1) * .7, T['roof'], T['clock'] + .1, .12, .3, .2)                                          # the party below …
hush = hp(noise(1.2), 2500) * np.sin(np.pi * t_(1.2) / 1.2) ** 2; add(amb, hush, T['clock'] + .15, .06)   # … "shhh"
bed(lp(noise(5), 400) * .2 + crowd(5, .5) * .3, T['final'], DUR, .12, .2, 1.5)                            # lobby at the end

# ---------------- ducking & bus ----------------
venv = np.abs(voice).max(1); from scipy.ndimage import maximum_filter1d, uniform_filter1d
ve = uniform_filter1d(maximum_filter1d(venv, int(.12 * SR)), int(.2 * SR)); ve = np.clip(ve / (ve.max() + 1e-9) * 1.6, 0, 1)
live = env_curve([(0, 0), (T['pull'], 0), (T['pull'] + .01, 1), (DUR + 1, 1)])
duck_m = 1 - ve * (.64 - .2 * live)      # ≈ −9 dB, −6 dB under the live announcer
duck_f = 1 - ve * .5
# the two true silences: pull the beds right down so the ticks / the fluttering letter are nearly alone
quiet = env_curve([(0, 1), (T['plaque'] + 1.1, 1), (T['plaque'] + 1.5, .25), (T['snare'] - .02, .25), (T['snare'], 1), (T['clock'] - .05, 1), (T['clock'] + .6, .3), (TL['STRIKES'][0] - .05, .3), (TL['STRIKES'][0] + .3, .8), (T['tutti'], 1), (DUR + 1, 1)])
mix = music * duck_m[:, None] * .78 + amb * (duck_f * quiet)[:, None] + fx * duck_f[:, None] * .9 + voice * 1.05
# hard digital silence inside the true-silence windows except what we put there (ticks / wind / flutter are fx/amb)
for c in (0, 1): mix[:, c] = limit(mix[:, c], .96)
mix = mix[:int(DUR * SR)]
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix.wav', round(len(mix) / SR, 3), 's  peak', round(float(np.abs(mix).max()), 3))
