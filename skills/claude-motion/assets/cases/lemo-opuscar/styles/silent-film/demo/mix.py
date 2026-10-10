"""Mix: the photoplay score + the projector in the booth (the only 'room sound' a silent film has) → mix.wav
There is no foley on purpose: the piano plays every gag. The projector is the ambience: it spins up before the curtain,
purrs under the whole reel, is the only thing left in the SILENCE, and flaps the tail of the film at the end."""
import sys, os, json
import numpy as np, soundfile as sf
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp, noise, add, limit, t_
rng = np.random.default_rng(7)
TL = json.load(open(os.path.join(D, 'timeline.json'))); SEC, HIT, DUR = TL['SEC'], TL['HIT'], TL['DUR']
N = int(round(DUR * SR))
score, sr = sf.read(os.path.join(D, 'music/score.wav')); assert sr == SR
score = np.pad(score, ((0, max(0, N - len(score))), (0, 0)))[:N]

def claw(v=1.0):
    """one intermittent-claw pull-down: a tiny metallic tick + a soft body thump"""
    d = .05; tt = t_(d)
    x = bp(rng.standard_normal(len(tt)), 1200, 5200) * np.exp(-tt / .004) * .9
    x += np.sin(2 * np.pi * 190 * tt) * np.exp(-tt / .012) * .5
    return x * v
# projector speed curve (frames/s of the claw): spins up in PRE, steady 18, winds down after the curtain closes
end0 = HIT['curtainOut'] + 1.2
def fps(t):
    if t < .15: return 0
    if t < 1.3: return 18 * min(1, (t - .15) / 1.0) ** .7
    if t < end0: return 18
    return max(0, 18 * (1 - (t - end0) / 1.6))
proj = np.zeros(N); t = .15
while t < DUR - .05:
    f = fps(t)
    if f < 1: t += .02; continue
    c = claw(.8 + .2 * rng.random()); s = int(t * SR); e = min(N, s + len(c)); proj[s:e] += c[:e - s]
    t += 1 / f * (1 + (rng.random() - .5) * .04)
# motor + fan hum (60 Hz family, band-limited noise for the fan), follows the speed
tt = np.arange(N) / SR; sp = np.array([fps(x) for x in tt[::480]]); sp = np.interp(tt, tt[::480], sp) / 18
hum = (np.sin(2 * np.pi * 60 * tt) * .5 + np.sin(2 * np.pi * 120 * tt) * .3 + np.sin(2 * np.pi * 180 * tt) * .12) * sp
fan = bp(rng.standard_normal(N), 300, 1800) * .25 * sp
proj = proj * .5 + hum * .05 + fan * .35
# the tail of the film flapping on the take-up reel after the end
t = end0 + .1
while t < DUR - .1:
    f = max(4, 14 - (t - end0) * 5); x = bp(rng.standard_normal(int(.03 * SR)), 600, 4000) * np.exp(-t_(.03) / .006) * 1.2
    s = int(t * SR); e = min(N, s + len(x)); proj[s:e] += x[:e - s]; t += 1 / f
# the lamp strikes (a click + relay) just before the curtains part
k = int(.08 * SR); proj[k:k + int(.03 * SR)] += bp(rng.standard_normal(int(.03 * SR)), 900, 6000) * np.exp(-t_(.03) / .004) * 2
# level: the projector sits low under the piano, comes forward in PRE, the SILENCE and the runout
lev_pts = [(0, 1.0), (SEC['TITLE']['t0'], 1.0), (SEC['TITLE']['t0'] + .4, .35), (SEC['SIL']['t0'] - .2, .35), (SEC['SIL']['t0'] + .2, .9),
           (SEC['CARD3']['t0'], .9), (SEC['CARD3']['t0'] + 1, .3), (HIT['curtainOut'], .3), (HIT['curtainOut'] + .8, 1.0), (DUR + 1, 1.0)]
lev = np.interp(tt, [p[0] for p in lev_pts], [p[1] for p in lev_pts])
proj = proj * lev * .13
# the booth is behind the audience: slightly narrow, a touch of room
pr = np.stack([proj * .9, proj * 1.0], 1)
# tame the piano's hammer transients a little (period recordings are never this peaky) so loudness can reach −14 LUFS
from core.audio.sfx import compress
sc = score * .9; lk = np.abs(sc).max(1); gk = compress(lk, thr=.18, ratio=3, att=.002, rel=.12) / np.maximum(lk, 1e-9)
mix = sc * gk[:, None] * 1.5 + pr
for c in (0, 1): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix.wav', round(len(mix) / SR, 2), 's  peak', round(float(np.abs(mix).max()), 3))
