# Sound for "The Honeybee, Plate VII": three layers (room tone, foley keyed to the film's events, the baroque score),
# the narrator on top with the score ducked under him. Run from the repo root:
#   .venv/bin/python styles/engraving/demo/mix.py
# reads demo/events.json (node core/render/events.mjs), demo/voices/*.wav, demo/music/stems/*.wav; writes demo/mix.wav
import sys, os, json, numpy as np, soundfile as sf, soxr
sys.path.insert(0, '.')
from core.audio.sfx import SR, add, bp, lp, hp, noise, brown, env_exp, t_, limit, compress, norm

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('ENG_WORK') or HERE     # ENG_WORK: work folder with events.json, voices/, music/stems (alt content)
E = json.load(open(os.path.join(WORK, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int(DUR * SR)
rng = np.random.default_rng(53)
room, foley, voice = np.zeros((N, 2)), np.zeros((N, 2)), np.zeros((N, 2))
first = lambda typ: next(e for e in EV if e['type'] == typ)
allof = lambda typ: [e for e in EV if e['type'] == typ]
fade = lambda x, a=0.01, b=0.02: x * np.minimum(1, np.minimum(np.arange(len(x)) / max(1, int(a * SR)), (len(x) - np.arange(len(x))) / max(1, int(b * SR))))

# ---------------- room tone: the engraver's workroom, then paper (both near-silent) ----------------
def roomtone(d, lo, hi, gain):
    x = bp(brown(d) * 0.6 + noise(d) * 0.05, lo, hi); return norm(x, 1) * gain
peel = first('peel')['t']; sil = first('silence')
rt = roomtone(DUR, 60, 1800, 0.012)
envr = np.ones(N); s0, s1 = int(sil['t'] * SR), int(sil['until'] * SR); r_ = int(0.05 * SR)
envr[s0:s1] = 0.25                                             # the silence: the room nearly vanishes too
envr[s0 - r_:s0] = np.linspace(1, 0.25, r_); envr[s1:s1 + r_] = np.linspace(0.25, 1, r_)
add(room, rt * envr, 0, 1.0, 0)
# a faint clock in the workroom during the copper close-up
for i, tt in enumerate(np.arange(0.15, peel, 0.5)):
    tick = hp(noise(0.012), 2500) * env_exp(0.012, 0.002) * (0.012 if i % 2 else 0.009); add(room, tick, tt, 1.0, -0.6)

# ---------------- the burin in copper ----------------
b = first('burin'); d = b['until'] - b['t'] + 0.02
sc = bp(noise(d), 2600, 9000, 2) * 0.55 + bp(noise(d), 900, 1800, 2) * 0.25          # the hiss of metal being ploughed
tt = t_(d); am = 0.7 + 0.3 * np.sin(2 * np.pi * 5.3 * tt) * np.sin(2 * np.pi * 0.7 * tt) + 0.15 * rng.standard_normal(len(tt)).cumsum()[:len(tt)] * 0
chatter = np.zeros(len(tt))
for c in np.cumsum(rng.uniform(0.012, 0.045, 400)):
    if c >= d: break
    k = int(c * SR); L = min(len(chatter) - k, 120); chatter[k:k + L] += np.exp(-np.arange(L) / 18) * rng.uniform(0.3, 1)
sc = sc * am + hp(chatter * rng.standard_normal(len(chatter)), 3000) * 0.5
sc = fade(norm(sc, 1), 0.04, 0.03) * 0.16
ring_ = sum(np.sin(2 * np.pi * f * tt) * a for f, a in [(1180, 1), (2310, 0.5), (3470, 0.3)]) * 0.012 * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * tt))  # plate resonance
add(foley, sc + ring_, b['t'], 1.0, 0.15)
# swarf: tiny bright pings as the curl grows
for c in np.cumsum(rng.uniform(0.07, 0.2, 40)):
    if c >= d: break
    f = rng.uniform(5200, 8800); p = np.sin(2 * np.pi * f * t_(0.05)) * env_exp(0.05, 0.008); add(foley, p * 0.02, b['t'] + c, 1.0, rng.uniform(-0.2, 0.4))
# the lift: a small metallic tick, then air
lf = first('lift')['t']
add(foley, hp(noise(0.02), 3000) * env_exp(0.02, 0.003) * 0.18, lf, 1.0, 0.2)
add(foley, np.sin(2 * np.pi * 2310 * t_(0.35)) * env_exp(0.35, 0.09) * 0.02, lf, 1.0, 0.2)

# ---------------- the press and the pulled proof ----------------
pr = first('press')['t']
roll = lp(brown(0.6), 180) ; roll = norm(roll, 1) * np.linspace(0, 1, len(roll)) ** 1.5 * 0.2
add(foley, roll, pr - 0.35, 1.0, 0)                                        # J-cut: the roller before the image
thump = np.sin(2 * np.pi * 58 * t_(0.35) * (1 - 0.3 * t_(0.35))) * env_exp(0.35, 0.08) * 0.35
add(foley, thump, peel, 1.0, 0)
pd = 0.72; crack = np.zeros(int(pd * SR))
for c in np.cumsum(rng.exponential(0.006, 400)):
    if c >= pd: break
    k = int(c * SR); L = min(len(crack) - k, 200); crack[k:k + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / 40) * rng.uniform(0.2, 1)
crack = bp(crack, 900, 7000) * np.sin(np.pi * np.linspace(0, 1, len(crack))) ** 0.6
add(foley, norm(crack, 1) * 0.16, peel + 0.02, 1.0, -0.2)
add(foley, fade(bp(noise(0.6), 300, 2500)) * np.sin(np.pi * np.linspace(0, 1, int(0.6 * SR))) * 0.05, peel + 0.1, 1.0, -0.5)
# the burin's hiss tails into the paper (L-cut): a soft echo of the scrape under the first printed line
add(foley, sc[-int(0.5 * SR):] * np.linspace(0.6, 0, int(0.5 * SR)), peel + 0.05, 0.5, 0.15)

# ---------------- engraving on the plate: fine granular scratching, one layer per pass ----------------
def scratches(t0, t1, dens, gain, lo=3000, hi=10000, pan=0.0, seed=1):
    r = np.random.default_rng(seed); d = t1 - t0; x = np.zeros(int(d * SR) + 400)
    for c in np.cumsum(r.exponential(1 / dens, int(dens * d * 2) + 10)):
        if c >= d: break
        k = int(c * SR); L = int(r.uniform(0.004, 0.03) * SR); seg = r.standard_normal(L) * np.hanning(L) * r.uniform(0.2, 1)
        x[k:k + L] += seg[:len(x) - k]
    x = bp(x, lo, hi); env = np.sin(np.pi * np.linspace(0, 1, len(x))) ** 0.35
    return norm(x * env, 1) * gain
hat = first('hatch')
passes = {e['g']: e['t'] for e in allof('pass')}
add(foley, scratches(passes['ol'], passes['h1'] + 0.4, 60, 0.07, pan=0, seed=2), passes['ol'], 1.0, -0.1)
add(foley, scratches(passes['h1'], passes['h2'] + 0.6, 180, 0.09, seed=3), passes['h1'], 1.0, 0.1)
add(foley, scratches(passes['h2'], passes['h3'] + 0.8, 260, 0.085, lo=3500, seed=4), passes['h2'], 1.0, -0.15)
add(foley, scratches(passes['h3'], hat['until'], 320, 0.07, lo=4500, hi=12000, seed=5), passes['h3'], 1.0, 0.2)
for g, tt0 in passes.items():                                                  # each pass opens with a soft scrape
    add(foley, fade(bp(noise(0.18), 1800, 6000)) * env_exp(0.18, 0.06) * 0.05, tt0, 1.0, 0)

def ticks(t0, n, dur, gain, pan=0.0, seed=7):
    r = np.random.default_rng(seed)
    for i in range(n):
        x = hp(r.standard_normal(int(0.008 * SR)), 2500) * env_exp(0.008, 0.0015) * r.uniform(0.6, 1)
        add(foley, x * gain, t0 + dur * i / max(1, n), 1.0, pan + r.uniform(-0.1, 0.1))
ti = first('title'); ticks(ti['t'], ti['n'], ti['dur'], 0.07)

# ---------------- the magnified details ----------------
def whoosh(d, lo, hi, gain):
    x = bp(noise(d), lo, hi); e = np.sin(np.pi * np.linspace(0, 1, len(x))) ** 1.5; return x * e * gain
for e in allof('push'): add(foley, whoosh(0.9, 150, 900, 0.05), e['t'], 1.0, 0)
for e in allof('ring'):                                                         # the burin scribing a circle
    d = 0.4; x = bp(noise(d), 3500, 9000) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t_(d))); add(foley, fade(x) * 0.06, e['t'], 1.0, 0.1)
for e in allof('burnish'): add(foley, fade(lp(brown(0.3), 900)) * np.sin(np.pi * np.linspace(0, 1, int(0.3 * SR))) * 0.05, e['t'], 1.0, 0)
for e in allof('cut'): add(foley, scratches(e['t'], e['until'], 140, 0.05, lo=4000, seed=10 + e['i']), e['t'], 1.0, [-.4, -.4, .4, .4][e['i']])
for e in allof('travel'): add(foley, whoosh(e['until'] - e['t'], 400, 3000, 0.035), e['t'], 1.0, 0)
for e in allof('land'):
    x = (lp(noise(0.06), 1200) * env_exp(0.06, 0.012)) * 0.14; add(foley, x, e['t'], 1.0, [-.5, -.5, .5, .5][e['i']])
for e in allof('letters'): ticks(e['t'], 12, e['dur'], 0.045, seed=int(e['t'] * 10))
for e in allof('quill'):                                                        # a pen scratching the script note
    d = e['dur']; tt = t_(d); x = bp(noise(d), 2200, 6500) * (0.35 + 0.65 * np.abs(np.sin(2 * np.pi * 4.2 * tt)) ** 2)
    add(foley, fade(x, 0.03, 0.1) * 0.03, e['t'], 1.0, [-.5, -.5, .5, .5][e['i']])
ns = first('natsize'); add(foley, scratches(ns['t'], ns['t'] + 1.1, 200, 0.03, lo=5000, seed=20), ns['t'], 1.0, 0.5)

# ---------------- hand colouring: a drop, then the wet brush ----------------
pans = {'abdomen': 0, 'thorax': 0, 'head': 0, 'eyes': -0.2, 'wings': 0.3, 'legs': -0.3, 'pollen': 0.35}
for i, e in enumerate(allof('drop')):
    d = 0.22; tt = t_(d); f = 1500 * np.exp(-tt * 9) + 520
    plip = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.035) * (0.22 if i == 0 else 0.07)
    add(foley, plip + hp(noise(d), 4000) * env_exp(d, 0.003) * 0.05, e['t'], 1.0, pans.get(e['region'], 0))
    w = bp(noise(0.8), 500, 4000) * np.sin(np.pi * np.linspace(0, 1, int(0.8 * SR))) ** 2
    add(foley, w * (0.028 if i else 0.04), e['t'] + 0.05, 1.0, pans.get(e['region'], 0))
lnd = first('landing')
for e in allof('dot'): add(foley, hp(noise(0.01), 2000) * env_exp(0.01, 0.002) * 0.08, e['t'], 1.0, 0)
tis = first('tissue')
tissue = np.zeros(int(1.2 * SR))
for c in np.cumsum(rng.exponential(0.01, 200)):
    if c >= 1.15: break
    k = int(c * SR); L = min(len(tissue) - k, 300); tissue[k:k + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / 70) * rng.uniform(0.2, 1)
tissue = bp(tissue, 1500, 9000) * np.sin(np.pi * np.linspace(0, 1, len(tissue))) ** 0.8
add(foley, norm(tissue, 1) * 0.1, tis['t'], 1.0, 0)
add(foley, whoosh(0.7, 200, 1500, 0.05), tis['t'] + 0.1, 1.0, 0)

# ---------------- voice ----------------
vd = os.path.join(WORK, 'voices'); vwin = []
for e in allof('vo'):
    y, sr = sf.read(os.path.join(vd, e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = soxr.resample(y, sr, SR); y = hp(y, 90)
    y = compress(y / (np.abs(y).max() + 1e-9) * 0.8, thr=0.3, ratio=3)
    add(voice, y, e['t'], 0.62, 0); vwin.append((e['t'], e['t'] + len(y) / SR))

# ---------------- music, ducked under the voice (stems: the bowed strings duck least) ----------------
st = os.path.join(WORK, 'music', 'stems')
def load(n):
    y, sr = sf.read(os.path.join(st, n)); y = y if y.ndim > 1 else np.stack([y, y], 1)
    if sr != SR: y = soxr.resample(y, sr, SR)
    out = np.zeros((N, 2)); out[:min(N, len(y))] = y[:N]; return out
duck = np.ones(N)
for a, b2 in vwin:
    i0, i1 = int((a - 0.15) * SR), int((b2 + 0.25) * SR); duck[max(0, i0):i1] = np.minimum(duck[max(0, i0):i1], 0.5)
k = int(0.12 * SR); duck = np.convolve(duck, np.ones(k) / k, mode='same')
music = load('harpsichord.wav') * duck[:, None] ** 0.8 + load('pizz.wav') * duck[:, None] + load('bowed.wav') * (0.3 + 0.7 * duck[:, None])
music *= 0.9

mix = room + foley * 1.0 + music + voice
mix = limit(mix, 0.95)
sf.write(os.path.join(WORK, 'mix.wav'), mix.astype(np.float32), SR)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True); json.dump([dict(t0=a, t1=b2) for a, b2 in vwin], open(os.path.join(HERE, 'out', 'vo_windows.json'), 'w'))
print('mix.wav', mix.shape, 'peak', float(np.abs(mix).max()))
