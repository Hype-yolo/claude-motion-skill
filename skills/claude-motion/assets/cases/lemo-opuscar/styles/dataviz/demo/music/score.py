"""A Hundred Summers — original score. Data sonification + modular-synth bed, 90 BPM, D.
Reads ../events.json (picture events are the score). Writes score.wav, stems/{data,pad,pulse}.wav, score.json.
All synthesis is numpy (no samples). Run: .venv/bin/python styles/dataviz/demo/music/score.py
"""
import os, sys, json, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp
from core.audio.sampler import room

EVJ = json.load(open(os.path.join(HERE, '..', 'events.json')))
EV, DUR = EVJ['ev'], EVJ['dur']
N = int(round(DUR * SR))
B = 60 / 90
T = lambda k: k * B
STOP, TAP26, HUSH = 31.0, 32.0, (42.667, 43.333)
rng = np.random.default_rng(1926)

def buf(): return np.zeros((N, 2), np.float32)
def put(dst, x, t, g=1.0, pan=0.0):
    i = int(round(t * SR)); x = np.asarray(x, np.float32)
    if i >= N: return
    n = min(len(x), N - i); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    if x.ndim == 1: dst[i:i + n, 0] += x[:n] * g * l * 1.414; dst[i:i + n, 1] += x[:n] * g * r * 1.414
    else: dst[i:i + n] += x[:n] * g
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
tt = lambda d: np.arange(int(round(d * SR))) / SR

# ---------- pitch map (TREATMENT §5) ----------
PENTA = [2, 4, 6, 9, 11]
def pitch(v):
    m = 62 + (v + .4) * 17
    if v < .25:
        best = min((abs(m - (o * 12 + pc)), o * 12 + pc) for o in range(4, 9) for pc in PENTA); return float(best[1])
    if v < .7: return float(round(m))
    return float(m)

# ---------- the data voice: low-pass-gate "plonk" ----------
def plonk(f, tau, vel=1.0, index=.3, detune_c=0.0, shadow=0.0, dur=None):
    dur = dur or min(4.5, tau * 7 + .05); t = tt(dur)
    env = np.exp(-t / tau); env[:int(.003 * SR)] *= np.linspace(0, 1, int(.003 * SR))
    benv = np.exp(-t / (tau * .55))                                   # brightness falls faster (vactrol)
    def osc(ff):
        mod = np.sin(2 * np.pi * ff * 2 * t) * index * benv
        return np.sin(2 * np.pi * ff * t + mod) + .22 * np.sin(4 * np.pi * ff * t + mod * .5) * benv
    x = osc(f)
    if detune_c: x = .62 * x + .5 * osc(f * 2 ** (detune_c / 1200))
    if shadow: x += shadow * osc(f * 2 ** (1 / 12))                  # minor-second shadow (most dissonant)
    x = x * env
    thump = np.sin(2 * np.pi * 110 * t) * np.exp(-t / .012) * .15    # felt-like gate thud
    return ((x + thump) * vel).astype(np.float32)

dots = [e for e in EV if e['type'] == 'dot']
dots.sort(key=lambda e: e['t'])
data, pad, pulse = buf(), buf(), buf()
data_post = buf()                # everything after the silence lives in its own buffer (no tails cross the cut)
keys, notes = {}, []
for i, e in enumerate(dots):
    y, v, t0 = e['year'], e['v'], e['t']
    gap_n = dots[i + 1]['t'] - t0 if i + 1 < len(dots) else 3.0
    gap_p = t0 - dots[i - 1]['t'] if i else 3.0
    gap = min(gap_n, gap_p) if y != 2026 else 3.0
    m = pitch(v); f = hz(m)
    tau = float(np.clip(1.5 * gap * .6, .07, .75))
    vel = float(np.interp(gap, [.083, .167, .333, .667], [.45, .56, .74, .9]))
    index = float(np.interp(v, [-.4, .25, .7, 1.3], [.3, .7, 1.6, 3.0]))
    det, sh = 0.0, 0.0
    if y >= 2011 and y <= 2025: det = 5 + 40 * (y - 2011) / 14          # detune only on the last ~15 summers
    if y == 2025: det, sh, vel, tau = 48.0, .45, .62, .45                # the most dissonant note, right before the silence
    if y == 1926: tau, vel, index = 1.6, .95, .35
    if y == 2026: tau, vel, index, det = 2.4, .85, .9, 0.0             # alone, highest, clean
    x = plonk(f, tau, vel, index, det, sh)
    pan = -.35 + .7 * (y - 1926) / 100
    put(data if t0 < STOP else data_post, x, t0, .5, pan)
    keys[f'dot_{y}'] = round(t0, 4); notes.append({'t': round(t0, 4), 'year': y, 'midi': round(m, 2), 'detune_c': round(det, 1)})

# morph glissando: every summer again, short and light, in order
mo = sorted([e for e in EV if e['type'] == 'morph'], key=lambda e: e['t'])
gl = buf()
for e in mo:
    put(gl, plonk(hz(pitch(e['v'])), .11, .3, .5, 0, 0, .7), e['t'], .5, -.4 + .8 * e['idx'] / 100)
keys['morph_start'] = round(mo[0]['t'], 4)
# prior record 1880–1925: a light low rain
for e in [e for e in EV if e['type'] == 'prior']:
    put(gl, plonk(hz(pitch(e['v']) - 12), .28, .2, .3, 0, 0, 1.5), e['t'], .45, -.6 + .5 * (e['year'] - 1880) / 45)
# final note: the 1926 note again
FIN = [e for e in EV if e['type'] == 'end'][0]['t']
put(data_post, plonk(hz(pitch(dots[0]['v'])), 2.8, .8, .35, 0, 0, 4.6), FIN, .5, 0)
keys['final_note'] = round(FIN, 4)

# light room on the data voice (tails are gated at the silences below)
data = room(data, size=.35, mix=.16); data[int(STOP * SR):] = 0
data_post = room(data_post, size=.35, mix=.16)
gl = room(gl, size=.55, mix=.3)
data += data_post + gl

# ---------- pad: detuned saws through a low-pass ----------
def saw(f, d, cents=(-7, 0, 7)):
    t = tt(d); out = np.zeros_like(t)
    for c in cents:
        ph = (t * f * 2 ** (c / 1200) + rng.random()) % 1.0; out += 2 * ph - 1
    return out / len(cents)
def chord(notes_, t0, t1, cut, g=.12, att=.6, rel=.8):
    d = t1 - t0 + rel; x = np.zeros(int(round(d * SR)))
    for m in notes_: x[:len(saw(hz(m), d))] += saw(hz(m), d)
    x = lp(x, cut, 2); t = tt(d)[:len(x)]
    env = np.minimum(1, t / att) * np.clip((t1 - t0 + rel - t) / rel, 0, 1) ** 1.5
    wob = 1 + .06 * np.sin(2 * np.pi * .23 * t)
    put(pad, x * env * wob * g, t0, 1.0, 0)
bar = 4 * B
CH = [(T(4), T(12), [50, 57, 64, 66], 900), (T(12), T(16), [50, 55, 59, 66], 900)]
for i, ch in enumerate([[50, 57, 62, 66], [47, 54, 59, 62], [43, 55, 59, 62], [45, 57, 61, 64]]):
    CH.append((T(16) + i * bar, T(16) + (i + 1) * bar, ch, 1000))
CH += [(T(32), T(36), [50, 58, 62, 65], 760), (T(36), T(40), [50, 57, 62, 65], 740),
       (T(40), T(43), [50, 57, 63, 65], 820)]
for t0, t1, ns, cut in CH: chord(ns, t0, t1, cut)
# 28.67–31.0: semitone cluster opening up
d = STOP - T(43); x = sum(saw(hz(m), d) for m in [50, 57, 63, 64, 65]) / 5
x = np.concatenate([lp(x[i:i + 4800], 800 + 1400 * i / len(x)) for i in range(0, len(x), 4800)])
put(pad, x * np.minimum(1, tt(d)[:len(x)] / .3) * .14, T(43))
# rising drone 21.33–31.0
d = STOP - T(32); t = tt(d); fr = 73.4 * 2 ** (t / d * 1.0); ph = np.cumsum(fr) / SR
dr = (np.sin(2 * np.pi * ph) + .35 * (2 * ((ph * 2) % 1) - 1)) * np.minimum(1, t / 3) * (.25 + .75 * t / d)
put(pad, lp(dr, 600) * .1, T(32))
pad[int(STOP * SR) - 480:int(STOP * SR)] *= np.linspace(1, 0, 480)[:, None]; pad[int(STOP * SR):] = 0
# after the silence
chord([38, 50, 57], T(52), T(56), 700, g=.09, att=1.2, rel=1.0)
chord([50, 57, 64], T(57), T(60), 800, g=.09, att=.8)
chord([38, 43, 55, 59, 61, 66], T(60), 42.35, 900, g=.085, att=.8, rel=.3)
chord([38, 45, 50, 57], FIN, DUR - 1.0, 700, g=.1, att=.9, rel=1.0)

# ---------- pulse: soft kick, shaker, hats, sub bass, sample & hold ----------
def kick(v=1.0):
    t = tt(.35); f = 48 + 70 * np.exp(-t / .03); ph = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph) * np.exp(-t / .16) * v
def shaker(v=1.0):
    t = tt(.09); return bp(rng.standard_normal(len(t)), 3500, 8000) * np.exp(-t / .02) * v
def hat(v=1.0):
    t = tt(.05); return lp(hp(rng.standard_normal(len(t)), 6000), 9500) * np.exp(-t / .012) * v
kb = 8
while T(kb) < STOP - .01:
    k = kb
    if k < 43 or True:
        put(pulse, kick(.55 if k < 32 else .7), T(k), .5)
    if k >= 43: put(pulse, kick(.5), T(k + .5), .5) if T(k + .5) < STOP else None
    kb += 2 if kb < 43 else 1
for j in range(int(16 * 2), int(46.5 * 2)):                       # eighth shakers from k16
    k = j / 2
    if T(k) < STOP: put(pulse, shaker(.16 if j % 2 else .1), T(k), 1.0, .25)
for j in range(32 * 4, int(46.5 * 4)):                              # sixteenth hats from k32
    k = j / 4
    if T(k) < STOP: put(pulse, hat(.07 + (.03 if j % 2 == 0 else 0) + .04 * (k - 32) / 14.5), T(k), 1.0, -.2)
# sub bass (roots), quarter pulses with glide
ROOTS = [(16, 38), (20, 35), (24, 31), (28, 33), (32, 34), (36, 38), (40, 38)]
for i, (k0, m) in enumerate(ROOTS):
    k1 = ROOTS[i + 1][0] if i + 1 < len(ROOTS) else 46.5
    kk = k0
    while kk < k1 - 1e-6 and T(kk) < STOP:
        step = 1 if kk < 40 else .5
        d = step * B * .95; t = tt(d); x = np.sin(2 * np.pi * hz(m) * t) * np.minimum(1, t / .01) * np.exp(-t / (d * .8))
        put(pulse, x * .22, T(kk)); kk += step
# sample-and-hold blips from k32
SH = [74, 77, 79, 81, 84, 86]
for j in range(32 * 4, int(46.5 * 4)):
    if rng.random() < .28:
        m = SH[rng.integers(len(SH))]; t = tt(.08); sq = np.sign(np.sin(2 * np.pi * hz(m) * t))
        put(pulse, lp(sq, 1800 + rng.random() * 1500) * np.exp(-t / .025) * .05, T(j / 4), 1.0, rng.uniform(-.6, .6))
# the break: low boom + metal clang; smaller hit on the second break
def clang(v=1.0, d=1.6):
    t = tt(d); return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, a, tau in [(523, .5, .9), (1310, .35, .5), (2011, .25, .35), (2780, .15, .25)]) * v
def boom(v=1.0):
    t = tt(1.2); return np.sin(2 * np.pi * (40 + 30 * np.exp(-t / .05)) * t) * np.exp(-t / .45) * v
b1 = [e for e in EV if e['type'] == 'break']
put(pulse, boom(.9), b1[0]['t'], .6); put(pulse, clang(.5), b1[0]['t'], .5, .1)
put(pulse, boom(.5), b1[1]['t'], .6); put(pulse, clang(.3, 1.0), b1[1]['t'], .5, .2)
keys['break1'] = round(b1[0]['t'], 4); keys['break2'] = round(b1[1]['t'], 4)

pulse[int(STOP * SR) - 480:int(STOP * SR)] *= np.linspace(1, 0, 480)[:, None]; pulse[int(STOP * SR):] = 0
pulse *= 10 ** (-4.5 / 20)
# ---------- silences (hard) ----------
def gate(x, a, b, floor=0.0, fade=.01):
    ia, ib, nf = int(a * SR), int(b * SR), int(fade * SR)
    x[ia - nf:ia] *= np.linspace(1, floor, nf)[:, None]; x[ia:ib] *= floor
def duck_to(x, a, b, fade=.35):                                     # near-silence: fade out before a, back after b
    ia, ib, nf = int(a * SR), int(b * SR), int(fade * SR)
    x[ia - nf:ia] *= np.linspace(1, 0, nf)[:, None] ** 2; x[ia:ib] = 0
for s in (data, pad, pulse):
    gate(s, STOP, TAP26)
    duck_to(s, *HUSH)
# pulse and pad never come back before 32.0 except the planned material; clear any tail of the 2026-era pad beyond
keys['stop'] = STOP; keys['tap2026'] = TAP26

# ---------- write ----------
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
mix = data + pad + pulse
pk = np.abs(mix).max(); g = (10 ** (-1.2 / 20)) / pk
for nm, s in (('data', data), ('pad', pad), ('pulse', pulse)):
    sf.write(os.path.join(HERE, 'stems', nm + '.wav'), (s * g).astype(np.float32), SR, subtype='PCM_16')
sf.write(os.path.join(HERE, 'score.wav'), (mix * g).astype(np.float32), SR, subtype='PCM_16')
json.dump({'bpm': 90, 'keys': keys, 'silences': [[STOP, TAP26], list(HUSH)], 'notes': notes}, open(os.path.join(HERE, 'score.json'), 'w'), indent=0)

# ---------- self-check ----------
def rms(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
def band_share(x, lo, hi):
    X = np.abs(np.fft.rfft(x.mean(1))) ** 2; f = np.fft.rfftfreq(len(x), 1 / SR); return X[(f >= lo) & (f < hi)].sum() / X.sum()
M = mix * g
print('peak dBFS %.2f' % (20 * np.log10(np.abs(M).max())))
for a, b in [[STOP, TAP26], HUSH]: seg = M[int(a * SR):int(b * SR)]; print('silence %.2f–%.2f peak %.1f dBFS' % (a, b, 20 * np.log10(np.abs(seg).max() + 1e-12)))
print('whole: >6k %.4f  2–6k %.4f' % (band_share(M, 6000, 24000), band_share(M, 2000, 6000)))
R = M[int(T(43.1) * SR):int(STOP * SR)]; print('32nd rush: >6k %.4f  2–6k %.4f' % (band_share(R, 6000, 24000), band_share(R, 2000, 6000)))
for nm, s in (('data', data), ('pad', pad), ('pulse', pulse)): print(nm, 'peak %.1f  rms %.1f dBFS' % (20 * np.log10(np.abs(s * g).max() + 1e-12), rms(s * g)))
