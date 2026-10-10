"""Mix: score (music/score.wav) + Kokoro narration + material-true foley + room tone -> mix.wav
Run from the repo root: .venv/bin/python styles/midcentury-toon/demo/mix.py
(needs events.json from core/render/events.mjs, voices/ from core/tts/tts.py, music/score.wav from music/score.py)
Three layers: ambience (room tone + a quiet mantel clock on the half-note grid, the vacuum motor in the payoff),
foley (cardboard, plastic, paper, rubber stamp, cable), music; music ducks ~8 dB under the voice.
Silences: B (last beat before the press) is truly silent — ambience removed too; C (before the lockup) keeps room tone only."""
import sys, os, json, numpy as np, soundfile as sf, librosa
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, click, clack, whoosh, creak, thump, ding, pop, add, compress, limit
D = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(D, 'events.json')))
DUR = E['dur']; N = int(round(DUR * SR)); EV = E['ev']
BEAT = 60 / 132
rng = np.random.default_rng(48)
def nz(d): return rng.standard_normal(len(t_(d)))
def env_ad(d, a=.004, tau=.1):
    x = env_exp(d, tau); n = int(a * SR)
    if n: x[:n] *= np.linspace(0, 1, n)
    return x
def M(*xs):
    n = max(len(x) for x in xs); return sum(np.pad(x, (0, n - len(x))) for x in xs)
def sine(f, d): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, len(t_(d))).astype(float)) / SR)

# ---------------- foley by material ----------------
def cardboard_thump(p=0):          # a box flap landing: dull, papery low thud + fibre slap
    d = .35; tt = t_(d)
    return norm(M(sine(95 * 2 ** (p / 12) * (1 - .35 * tt), d) * env_exp(d, .06), lp(nz(d), 900) * env_exp(d, .03) * .8, bp(nz(d), 1500, 4000) * env_exp(d, .01) * .3))
def cardboard_creak():
    c = creak(1); d = len(c) / SR
    return norm(c * .7 + bp(nz(d), 700, 2500)[:len(c)] * env_ad(d, .05, .1)[:len(c)] * .2)
def box_fall():                    # back wall falls away: swish then soft slap
    d = .45; x = np.zeros(len(t_(d))); w = whoosh(.3, 1) * .5; x[:len(w)] += w
    s = cardboard_thump(-4) * .7; o = int(.18 * SR); x[o:o + len(s)] += s[:len(x) - o]; return norm(x)
def plastic(p=1.0, d=.18):         # appliance plastic: bright knock with short hollow body
    tt = t_(d)
    return norm(hp(nz(d), 1500) * env_exp(d, .003) + sine(620 * p, d) * env_exp(d, .025) * .6 + sine(1340 * p, d) * env_exp(d, .015) * .3)
def plastic_thock(): return norm(M(plastic(.8, .25), thump(.6, 85)[:int(.25 * SR)] * .6))
def plug_click(): return norm(M(clack(1.3, 1)[:int(.12 * SR)], plastic(1.6, .12) * .6))
def scrape(d=.5):                  # a plastic base dragged on a wooden floor
    x = bp(nz(d), 300, 2400) * (0.6 + .4 * np.abs(np.sin(2 * np.pi * 31 * t_(d))))
    return norm(x) * np.sin(np.pi * t_(d) / d) ** .7
def stamp():                       # rubber stamp: thick, damped, a little paper smack
    d = .3; tt = t_(d)
    return norm(sine(140 * (1 - .4 * tt), d) * env_exp(d, .035) + lp(nz(d), 1800) * env_exp(d, .012) * .9)
def paper_swish(d=.3): return norm(bp(nz(d), 1800, 8000)) * np.sin(np.pi * t_(d) / d) ** 2
def slide_whistle(up=True, d=.32):
    f = np.linspace(700, 1500, len(t_(d))) if up else np.linspace(1500, 800, len(t_(d)))
    return norm(sine(f * (1 + .01 * np.sin(2 * np.pi * 6 * t_(d))), d) + .1 * bp(nz(d), 1000, 3000)) * np.sin(np.pi * t_(d) / d) ** .6
def soft_tap(): return norm(M(plastic(1.9, .08) * .7, lp(nz(.08), 2000) * env_exp(.08, .006)))
def beep(n):                       # three rising "connected" pips (sine + a touch of bell)
    d = .22; f = [1318.5, 1568, 2093][n]; return norm(sine(f, d) * env_ad(d, .004, .07) + sine(f * 2.01, d) * env_exp(d, .03) * .2)
def pen_write(d=.5): x = bp(nz(d), 2000, 7000) * (0.5 + .5 * np.abs(np.sin(2 * np.pi * 11 * t_(d)))); return norm(x) * np.sin(np.pi * t_(d) / d)
def wood_tick(): return norm(clack(1.1, 1)[:int(.1 * SR)])
def btn_soft(): return norm(plastic(1.2, .1)) * .6
def hold_hiss(d): return norm(bp(nz(d), 3000, 9000)) * env_ad(d, .05, d) * .4
def click_big():                   # THE button: two-stage mechanical click + rising chime
    d = .6; x = np.zeros(len(t_(d)))
    a = norm(clack(.9, 1)[:int(.1 * SR)]); x[:len(a)] += a
    b = plastic(1.4, .12); o = int(.035 * SR); x[o:o + len(b)] += b * .8
    ch = ding(1)[:len(x)]; x[:len(ch)] += ch * .5
    return norm(x)
def motor(d):                      # vacuum motor: saw hum + brushes, gentle LFO
    tt = t_(d); f = 118 * (1 + .01 * np.sin(2 * np.pi * .7 * tt))
    saw = (np.cumsum(f) / SR) % 1 * 2 - 1
    x = bp(saw, 200, 2600) * .5 + bp(nz(d), 3000, 8000) * .12 * (0.7 + .3 * np.sin(2 * np.pi * 9 * tt))
    e = np.minimum(1, tt / .25) * np.minimum(1, (d - tt) / .4)
    return norm(x) * e
def zone_swish(): return norm(M(pen_write(.6) * .8, paper_swish(.6) * .5))
def dock_clunk(): return norm(M(plastic_thock(), np.pad(ding(.7), (int(.06 * SR), 0))[:int(.25 * SR)] * .3))
def grab(): return norm(lp(nz(.12), 1500) * env_exp(.12, .02))
def peel(d):                       # the ink line lifting off paper: sticky tearing hiss that rises
    tt = t_(d); x = bp(nz(d), 1200, 6000) * (0.4 + .6 * (rng.random(len(tt)) > .7)) * np.linspace(.4, 1, len(tt))
    return norm(lp(x, 7000)) * np.sin(np.pi * tt / d) ** .5
def roll(d): x = M(lp(nz(d), 600) * .6, motor(d) * .3); return norm(x) * np.sin(np.pi * np.arange(len(x)) / len(x))
def wood_block(): return norm(M(clack(.8, 1)[:int(.14 * SR)], thump(.5, 110)[:int(.14 * SR)] * .5))
def iris(d): tt = t_(d); return norm(bp(nz(d), 1000, 6000) * np.linspace(1, .2, len(tt))) * np.sin(np.pi * tt / d)

fx = np.zeros((N, 2)); vo = np.zeros((N, 2)); amb = np.zeros((N, 2))
g = lambda e, k: e.get(k)
for e in EV:
    t, ty, gn, pan = e['t'], e['type'], e.get('gain', 1.0), e.get('pan', 0.0)
    if ty == 'vo': continue
    if ty == 'creak': add(fx, cardboard_creak(), t, .35 * gn, pan)
    elif ty == 'box_thump': add(fx, cardboard_thump(e.get('pitch', 0)), t, .7, pan)
    elif ty == 'box_fall': add(fx, box_fall(), t - .18, .55)   # the slap lands on the beat
    elif ty == 'ding': add(fx, ding(1), t, .35 * gn, .1)
    elif ty == 'plastic_land': add(fx, plastic(.9, .2), t, .4)
    elif ty == 'wood_tick': add(fx, wood_tick(), t, .25)
    elif ty == 'pen_write': add(fx, pen_write(e.get('dur', .5)), t, .18, -.3)
    elif ty == 'stamp': add(fx, stamp(), t, .75 * gn)
    elif ty == 'whoosh': add(fx, whoosh(e.get('dur', .35), 1), t, .3 * gn)
    elif ty == 'slide': add(fx, paper_swish(.25), t, .2 * gn, -.4)
    elif ty == 'pop': add(fx, pop(1), t, .3 * gn, .3)
    elif ty == 'scrape': add(fx, scrape(e.get('dur', .5)), t, .4 * gn, .1)
    elif ty == 'plastic_thock': add(fx, plastic_thock(), t, .8, .2)
    elif ty == 'plug_click': add(fx, plug_click(), t, .6, .35)
    elif ty == 'flip': add(fx, paper_swish(.25), t, .25, .3)
    elif ty == 'whistle': add(fx, slide_whistle(e.get('up', 0) == 1), t, .22, pan)
    elif ty == 'tap': add(fx, soft_tap(), t, .55, .2)
    elif ty == 'beep': add(fx, beep(e.get('n', 0)), t, .3, -.2 + .3 * e.get("n", 0))
    elif ty == 'btn_soft': add(fx, btn_soft(), t, .5)
    elif ty == 'hold': add(fx, hold_hiss(e.get('dur', .9)), t, .12)
    elif ty == 'click_big': add(fx, click_big(), t, 1.0)
    elif ty == 'motor': add(amb, motor(e.get('dur', 5)), t, .16)
    elif ty == 'zone': add(fx, zone_swish(), t, .3, [-.4, 0, .4, 0][e.get('n', 0) % 4])
    elif ty == 'dock': add(fx, dock_clunk(), t, .6, -.4)
    elif ty == 'paper_swish': add(fx, paper_swish(.3), t, .35 * gn, .4)
    elif ty == 'grab': add(fx, grab(), t, .4)
    elif ty == 'peel': add(fx, peel(e.get('dur', 1)), t, .35)
    elif ty == 'roll': add(fx, roll(e.get('dur', .45)), t, .25, .4)
    elif ty == 'wood_block': add(fx, wood_block(), t, .6)
    elif ty == 'iris': add(fx, iris(e.get('dur', .5)), t, .25)

# ---------------- narration ----------------
voice_env = np.zeros(N)
for e in EV:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    y = compress(norm(y, .9), thr=.3, ratio=3.0)
    add(vo, y, e['t'], .85, 0)
    s = int(e['t'] * SR); voice_env[s:s + len(y)] = 1

# ---------------- ambience ----------------
room = lp(brown(DUR), 900) * .018
amb += np.stack([room, np.roll(room, 311)], 1)
for k in range(int(DUR / (2 * BEAT))):          # mantel clock, very quiet, on the half-note grid
    t = k * 2 * BEAT
    if 21.2 < t < 27.3: continue                   # the motor owns the payoff
    add(amb, wood_tick(), t, .03, -.6)

# ---------------- music + ducking ----------------
mus, msr = sf.read(os.path.join(D, 'music', 'score.wav'))
if msr != SR: mus = librosa.resample(mus.T, orig_sr=msr, target_sr=SR).T
mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
k = int(.12 * SR); sm = np.convolve(voice_env, np.ones(k) / k, 'same')
duck = 1 - sm * (1 - 10 ** (-8 / 20))
mus = mus * duck[:, None]

# ---------------- silences ----------------
def gate(buf, a, b, keep=0.0, fade=.03):
    s, e = int(a * SR), int(b * SR); f = int(fade * SR)
    m = np.ones(N); m[s:e] = keep
    m[max(0, s - f):s] = np.linspace(1, keep, min(f, s)); m[e:e + f] = np.linspace(keep, 1, len(m[e:e + f]))
    buf *= m[:, None]
gate(amb, 20.909, 21.80)           # B: true silence (the first sound after it is the button)
gate(fx, 20.95, 21.80)
gate(fx, 30.2, 30.905)             # C: room tone only

mix = mus * .9 + fx * .9 + vo + amb
mix = limit(mix, .95)
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
print('mix.wav', mix.shape, 'peak', float(np.abs(mix).max()))
