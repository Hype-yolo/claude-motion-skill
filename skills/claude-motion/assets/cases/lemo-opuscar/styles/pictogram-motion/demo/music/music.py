#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
20th Asian Games Aichi-Nagoya 2026 - sports intro film, original score.
"Wadaiko x Electronic"  |  150 BPM, 4/4  |  D miyako-bushi (D Eb G A Bb) over D minor harmony
101 bars = 161.6 s (+2 s ring-out).  Picture edit is read from timeline.json.

Run:   /usr/bin/python3 music.py
Out:   music_bed.wav, sfx.wav  (48 kHz / 24-bit stems, unmastered, sum 1:1 = pre-master mix)
       music.wav                (master, -14 LUFS, TP <= -1 dBTP)
       report.txt               (loudness, band energy, onset check)
Everything is synthesized here - no samples.
"""
import json, os, time, wave, subprocess
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

T_START = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
assert abs(TL['beat'] - 0.4) < 1e-9 and TL['bpm'] == 150
SPB = 19200                    # samples per beat (0.4 s)
S16 = SPB // 4                 # samples per 16th (0.1 s)
BARS = 4 * SPB                 # samples per bar (1.6 s)
N = int(round(163.6 * SR))     # render length (final hit rings ~2 s past 161.6)
MUSIC_END = int(round(TL['duration'] * SR))
FADE_START = int(round(161.0 * SR))
SHOTS = TL['shots']


def T(bar, step=0.0):
    return int(round(bar * BARS + step * S16))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def log(*a):
    print(f'[{time.time() - T_START:6.1f}s]', *a, flush=True)


# ---------------------------------------------------------------- DSP utils
_SOS = {}


def sos(kind, fc, order=2):
    key = (kind, fc if np.isscalar(fc) else tuple(fc), order)
    if key not in _SOS:
        ny = SR / 2
        if kind == 'bp':
            _SOS[key] = signal.butter(order, [fc[0] / ny, fc[1] / ny], 'bandpass', output='sos')
        elif kind == 'lp':
            _SOS[key] = signal.butter(order, fc / ny, 'lowpass', output='sos')
        else:
            _SOS[key] = signal.butter(order, fc / ny, 'highpass', output='sos')
    return _SOS[key]


def filt(x, kind, fc, order=2):
    return signal.sosfilt(sos(kind, fc, order), x, axis=-1)


def tt(n):
    return np.arange(n) / SR


def nz(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def normp(x, p=1.0):
    m = np.max(np.abs(x))
    return x * (p / m) if m > 0 else x


def fade_end(x, sec=0.004):
    k = min(x.shape[-1], int(sec * SR))
    x[..., x.shape[-1] - k:] *= np.linspace(1, 0, k)
    return x


def saw(f, n, ph0=0.0):
    """PolyBLEP band-limited saw."""
    dt = f / SR
    ph = (ph0 + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def rbj(kind, fc, q):
    w = 2 * np.pi * min(fc, SR * 0.45) / SR
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    if kind == 'bp':
        b = np.array([al, 0.0, -al])
    else:  # lp
        b = np.array([(1 - c) / 2, 1 - c, (1 - c) / 2])
    a = np.array([1 + al, -2 * c, 1 - al])
    return b / a[0], a / a[0]


def tv_filter(x, fcs, q, kind='bp', block=128):
    """Time-varying biquad (block-wise coefficient updates, state carried)."""
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), block):
        fc = fcs[min(i + block // 2, len(x) - 1)]
        b, a = rbj(kind, fc, q)
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y


def pan2(x, pan):
    th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return np.vstack([x * np.cos(th), x * np.sin(th)]) * np.sqrt(2)


# ---------------------------------------------------------------- buses
BUS_NAMES = ['kick', 'taiko', 'perc', 'drumsF', 'bass', 'pad', 'sham', 'koto', 'fx', 'sfx']
BUS = {k: np.zeros((2, N), np.float32) for k in BUS_NAMES}


def add(bus, x, s, gain=1.0, pan=0.0):
    if x.ndim == 1:
        x = pan2(x, pan)
    n = x.shape[1]
    a, b, xa = s, s + n, 0
    if a < 0:
        xa, a = -a, 0
    b = min(b, N)
    if b <= a:
        return
    BUS[bus][:, a:b] += (x[:, xa:xa + (b - a)] * gain).astype(np.float32)


# ---------------------------------------------------------------- one-shot drum synthesis
def taiko(f0, f1, decay, tau_p=0.03, p2=1.5, p2amt=0.35, skin=0.5, stick=0.25,
          skin_band=(120, 1600), seed=0):
    """Pitched membrane: sine with fast pitch drop + 2nd/3rd modes, skin noise, stick transient."""
    n = int(decay * 6 * SR)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / tau_p)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / decay)
    x += p2amt * np.sin(p2 * ph + 0.3) * np.exp(-t / (decay * 0.3))
    x += 0.12 * np.sin(2.7 * ph + 1.1) * np.exp(-t / (decay * 0.12))
    w = nz(n, seed)
    x += filt(w, 'bp', skin_band) * np.exp(-t / 0.03) * skin
    x += filt(w, 'hp', 2500) * np.exp(-t / 0.004) * stick
    return normp(np.tanh(1.3 * normp(x)))


def ka_click(seed):
    n = int(0.12 * SR)
    t = tt(n)
    x = filt(nz(n, seed), 'bp', (1800, 5000)) * np.exp(-t / 0.006)
    x += 0.5 * np.sin(2 * np.pi * 1100 * t) * np.exp(-t / 0.012)
    return normp(x)


def kick(seed):
    n = int(0.7 * SR)
    t = tt(n)
    f = 46 + (170 - 46) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.22)
    x += filt(nz(n, seed), 'hp', 3000) * np.exp(-t / 0.0025) * 0.35
    x += 0.3 * np.sin(2 * np.pi * 1200 * t) * np.exp(-t / 0.004)
    return normp(np.tanh(1.6 * x))


def clap(seed):
    n = int(0.45 * SR)
    t = tt(n)
    w = filt(nz(n, seed), 'bp', (900, 3200))
    env = np.zeros(n)
    for d in (0.0, 0.009, 0.018):
        env += np.where(t >= d, np.exp(-(t - d) / 0.006), 0)
    env += 0.6 * np.where(t >= 0.024, np.exp(-(t - 0.024) / 0.12), 0)
    return normp(w * env)


def snare(seed):
    n = int(0.5 * SR)
    t = tt(n)
    x = 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.07)
    x += filt(nz(n, seed), 'bp', (1200, 9000)) * np.exp(-t / 0.13)
    return normp(x)


def hat(decay, seed):
    n = int(max(0.2, decay * 6) * SR)
    t = tt(n)
    rng = np.random.default_rng(seed)
    fr = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) * rng.uniform(0.98, 1.02)
    sq = sum(np.sign(np.sin(2 * np.pi * f * t + rng.random() * 6.28)) for f in fr)
    x = filt(sq, 'hp', 7000, 4) * 0.5 + filt(nz(n, seed + 99), 'hp', 9000) * 0.4
    return normp(x * np.exp(-t / decay))


def shaker(seed):
    n = int(0.12 * SR)
    t = tt(n)
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.035)
    return normp(filt(nz(n, seed), 'bp', (4000, 10000)) * env)


def crash(seed, decay=1.5):
    n = int(decay * 4 * SR)
    t = tt(n)
    rng = np.random.default_rng(seed)
    x = filt(nz(n, seed), 'hp', 3000) * 0.7
    fr = rng.uniform(3000, 11000, 30)
    m = sum(np.sin(2 * np.pi * f * t + rng.random() * 6.28) for f in fr) / np.sqrt(30) * 0.5
    x = (x + filt(m, 'hp', 2500)) * np.exp(-t / decay)
    x += filt(nz(n, seed + 1), 'bp', (800, 4000)) * np.exp(-t / 0.03) * 0.8
    return normp(x)


def tick(f, seed):
    n = int(0.06 * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004) + filt(nz(n, seed), 'hp', 4000) * np.exp(-t / 0.0015) * 0.6
    return normp(x)


def pok(seed):
    n = int(0.15 * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * 1350 * t) * np.exp(-t / 0.03) + 0.35 * np.sin(2 * np.pi * 2650 * t) * np.exp(-t / 0.01)
    x += 0.4 * np.sin(2 * np.pi * 780 * t) * np.exp(-t / 0.02)
    x += filt(nz(n, seed), 'hp', 3000) * np.exp(-t / 0.0015) * 0.5
    return normp(x)


def clank(seed):
    n = int(1.4 * SR)
    t = tt(n)
    x = np.zeros(n)
    for r, d, a in zip([1, 2.76, 5.40, 8.93, 13.34], [0.9, 0.5, 0.3, 0.15, 0.08], [1, .6, .4, .3, .2]):
        x += a * np.sin(2 * np.pi * 420 * r * t) * np.exp(-t / d)
    x += filt(nz(n, seed), 'bp', (1500, 7000)) * np.exp(-t / 0.004)
    return normp(x)


def splash(seed):
    n = int(0.8 * SR)
    t = tt(n)
    x = filt(nz(n, seed), 'bp', (700, 6000)) * np.minimum(1, t / 0.002) * np.exp(-t / 0.15)
    rng = np.random.default_rng(seed)
    for k in range(4):
        d = rng.uniform(0.01, 0.12)
        f = 600 + 1400 * (1 - np.exp(-np.maximum(t - d, 0) / 0.02))
        x += 0.3 * np.where(t >= d, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-(t - d) / 0.03), 0)
    return normp(x)


def drop(seed):
    rng = np.random.default_rng(seed)
    n = int(0.25 * SR)
    t = tt(n)
    f0 = rng.uniform(650, 1100)
    f = f0 + f0 * 1.8 * (1 - np.exp(-t / 0.02))
    return normp(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05))


def pulse(seed):
    n = int(0.5 * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * 58 * t) * np.exp(-t / 0.15) + 0.4 * np.sin(2 * np.pi * 116 * t) * np.exp(-t / 0.08)
    x += filt(nz(n, seed), 'bp', (200, 800)) * np.exp(-t / 0.01) * 0.3
    return normp(x)


def crack(seed):
    n = int(0.08 * SR)
    t = tt(n)
    x = np.tanh(3 * filt(nz(n, seed), 'hp', 1200) * np.exp(-t / 0.006))
    x += 0.4 * np.sin(2 * np.pi * 2300 * t) * np.exp(-t / 0.008)
    return normp(x)


def tile(seed):
    n = int(0.1 * SR)
    t = tt(n)
    x = filt(nz(n, seed), 'bp', (2000, 7000)) * np.exp(-t / 0.008) + 0.5 * np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.012)
    return normp(x)


log('building one-shot bank')
BANK = {
    'nagado': [taiko(140 * r, 60 * r, 0.36, p2amt=.5, skin=.65, stick=.35, seed=i) for i, r in enumerate([1.0, .96, 1.04, .93, 1.07])],
    'odaiko': [taiko(108 * r, 46 * r, 0.8, tau_p=0.05, p2=1.45, p2amt=.3, skin=.55, stick=.12,
                     skin_band=(80, 900), seed=20 + i) for i, r in enumerate([1.0, .95, 1.05])],
    'shime': [taiko(560 * r, 430 * r, 0.07, tau_p=.008, p2=1.62, p2amt=.45, skin=.9, stick=.7,
                    skin_band=(1200, 6000), seed=40 + i) for i, r in enumerate([1.0, 1.03, .97])],
    'ka': [ka_click(60 + i) for i in range(3)],
    'kick': [kick(70 + i) for i in range(2)],
    'clap': [clap(80 + i) for i in range(3)],
    'snare': [snare(90 + i) for i in range(3)],
    'hat': [hat(0.035, 100 + i) for i in range(4)],
    'ohat': [hat(0.28, 110 + i) for i in range(2)],
    'shaker': [shaker(120 + i) for i in range(4)],
    'crash': [crash(130 + i) for i in range(2)],
    'tick': [tick(3200, 140 + i) for i in range(2)],
    'tock': [tick(2350, 145 + i) for i in range(2)],
    'pok': [pok(150 + i) for i in range(3)],
    'clank': [clank(160 + i) for i in range(2)],
    'splash': [splash(170 + i) for i in range(3)],
    'drop': [drop(180 + i) for i in range(6)],
    'pulse': [pulse(190)],
    'tile': [tile(200 + i) for i in range(3)],
    'crack': [crack(210 + i) for i in range(3)],
}
IG = dict(kick=.9, odaiko=.95, nagado=.75, shime=.32, ka=.28, clap=.42, snare=.45, hat=.13, ohat=.10,
          shaker=.07, crash=.28, tick=.22, tock=.16, pok=.40, clank=.30, splash=.30, drop=.14, pulse=.35, tile=.24, crack=.30)
DEFAULT_BUS = dict(kick='kick', odaiko='taiko', nagado='taiko', shime='taiko', ka='taiko')

# ---------------------------------------------------------------- event store
EV = {}          # (inst, sample, slot, bus) -> [vel, pan]
SHAM, KOTO, BASS, STABS, IMPACTS, RISERS, DRONES, GAPS = [], [], [], [], [], [], [], []


def hit(inst, s, vel=1.0, pan=0.0, bus=None, slot=0):
    if s < 0 or s >= N or vel <= 0:
        return
    key = (inst, int(s), slot, bus or DEFAULT_BUS.get(inst, 'perc'))
    if key in EV:
        EV[key][0] = max(EV[key][0], vel)
    else:
        EV[key] = [vel, pan]


def pat(inst, bar, p, vel=1.0, pan=0.0, bus=None, slot=0, alt_pan=0.0):
    j = 0
    for k, c in enumerate(p):
        if c == '.':
            continue
        v = 1.0 if c == 'X' else 0.6 if c == 'x' else int(c) / 9
        hit(inst, T(bar, k), v * vel, pan + (alt_pan if j % 2 else -alt_pan), bus, slot)
        j += 1


# ---------------------------------------------------------------- harmony
PROG = {}


def setp(b0, seq):
    for i, c in enumerate(seq):
        PROG[b0 + i] = c


L4 = ['Dm', 'Bb', 'Gm', 'Asus']
setp(0, ['D5'] * 4 + L4 + ['Bb', 'Gm', 'Eb', 'Asus'])
setp(12, L4 * 4)
setp(28, ['Bb', 'Gm', 'Dm', 'Eb', 'Bb', 'Gm', 'Asus'])
setp(35, L4 * 3 + ['Eb', 'Gm', 'Asus'])
setp(50, ['Dm', 'Dm', 'Eb', 'Dm'] * 2 + ['Bb', 'Eb', 'Asus'])
setp(61, ['D5', 'D5', 'Deb', 'D5', 'Gm', 'Gm', 'Eb', 'Eb', 'Asus'])
setp(70, L4 * 2 + ['Eb', 'Asus'])
setp(80, L4 * 2 + ['Eb'])
setp(89, L4 + ['Dm', 'Bb', 'Gm', 'Eb', 'Asus'] + ['D5'] * 3)
assert sorted(PROG) == list(range(101))

ROOT = dict(Dm=38, Bb=34, Gm=31, Asus=33, Eb=39, D5=38, Deb=38)
PAD_V = dict(Dm=[50, 57, 62, 65, 69], Bb=[53, 58, 62, 65, 70], Gm=[55, 58, 62, 67, 70],
             Asus=[52, 57, 62, 64, 69], Eb=[51, 58, 63, 67, 70], D5=[50, 57, 62, 69],
             Deb=[50, 57, 63, 69])
ARP = dict(Dm=[62, 69, 70, 74, 81], Bb=[58, 62, 67, 70, 74], Gm=[55, 62, 67, 70, 74],
           Asus=[57, 62, 67, 69, 74], Eb=[63, 67, 70, 75, 79], D5=[62, 69, 74, 81, 86],
           Deb=[62, 63, 69, 74, 75])
SEQ = [0, 1, 2, 3, 4, 3, 2, 1]

# the hook: 2-bar shamisen motif (A+B), answered by A + C.  (step16, midi, vel, len16)
HOOK = {
    'A': [(0, 74, 1.0, 3), (3, 74, .8, 3), (6, 69, .85, 2), (8, 70, .9, 2), (10, 69, .75, 2), (12, 67, .8, 2), (14, 69, .7, 2)],
    'B': [(0, 74, 1.0, 3), (3, 75, .85, 3), (6, 74, .85, 2), (8, 70, .9, 2), (10, 69, .75, 2), (12, 67, .9, 4)],
    'C': [(0, 69, .9, 3), (3, 69, .7, 3), (6, 67, .8, 2), (8, 69, .85, 2), (10, 74, .9, 2), (12, 75, .8, 1),
          (13, 74, .7, 1), (14, 70, .75, 1), (15, 69, .7, 1)],
}
PHRASE = ['A', 'B', 'A', 'C']
COUNTER = {
    'Dm': [(0, 81, 6, ('from', 2, .12)), (8, 79, 4, None), (12, 81, 4, None)],
    'Bb': [(0, 82, 8, None), (8, 81, 8, ('vib',))],
    'Gm': [(0, 79, 8, None), (8, 82, 4, None), (12, 81, 4, None)],
    'Asus': [(0, 81, 8, ('vib',)), (8, 86, 8, ('from', 1, .1))],
    'Eb': [(0, 79, 8, None), (8, 82, 8, ('vib',))],
}
COMBAT_RIFF = [(0, 62, 1.0, 2), (2, 62, .6, 1), (3, 74, .8, 1), (4, 62, .7, 2), (6, 63, .8, 1), (7, 62, .6, 1),
               (8, 62, .9, 2), (10, 67, .8, 1), (11, 69, .8, 1), (12, 62, .7, 2), (14, 70, .8, 1), (15, 69, .7, 1)]


def sham_notes(bar, notes, trans=0, vel=1.0, pan=0.1):
    for st, m, v, l in notes:
        SHAM.append((T(bar, st), m + trans, v * vel, l * 0.1, pan))


def koto_notes(bar, notes, trans=0, vel=1.0, pan=-0.15):
    for nt in notes:
        st, m, v, l = nt[:4]
        bend = nt[4] if len(nt) > 4 else None
        KOTO.append((T(bar, st), m + trans, v * vel, l * 0.1, pan, bend))


def hook_bar(bar, part, inst='sham', oct=0, vel=1.0):
    if inst == 'sham':
        sham_notes(bar, HOOK[part], 12 * oct, vel)
    else:
        koto_notes(bar, HOOK[part], 12 * oct, vel, pan=-0.25)


def koto_arp(bar, rate=1, oct=0, vel=0.3, spread=0.5):
    tones = ARP[PROG[bar]]
    for j, k in enumerate(range(0, 16, rate)):
        m = tones[SEQ[j % 8]] + 12 * oct
        acc = 1.0 if k % 4 == 0 else 0.75
        KOTO.append((T(bar, k), m, vel * acc, rate * 0.15, spread if j % 2 else -spread, None))


def koto_counter(bar, vel=0.5):
    for st, m, l, bend in COUNTER[PROG[bar]]:
        KOTO.append((T(bar, st), m, vel, l * 0.1, 0.3, bend))


def bass_bar(bar, patt, vel=1.0, soft=False):
    r = ROOT[PROG[bar]]
    for st, l, o in patt:
        BASS.append((T(bar, st), r + 12 * o, vel, l * 0.1 - 0.012, soft))


DRIVE = [(0, 3, 0), (3, 3, 0), (6, 2, 1), (8, 3, 0), (11, 3, 0), (14, 2, 1)]
HALF = [(0, 6, 0), (10, 4, 0)]
GROOVE = [(0, 2, 0), (3, 2, 1), (6, 3, 0), (10, 2, 0), (11, 2, 1), (13, 3, 0)]
COMBAT = [(0, 5, 0), (6, 2, 0), (8, 5, 0), (14, 2, 1)]
ROLL = [(k, 2, (k // 2) % 2) for k in range(0, 16, 2)]
FIN = [(0, 4, 0), (4, 4, 0), (8, 4, 0), (12, 4, 0)]
SUST = [(0, 16, 0)]


# ---------------------------------------------------------------- drum grooves
def fill_taiko(bar, big=1.0):
    for k, (st, v) in enumerate(zip([8, 10, 12, 13, 14, 15], [.55, .65, .7, .8, .9, 1.0])):
        hit('nagado', T(bar, st), v * big, -.35 if k % 2 else .35, slot=1)
    for st, v in zip([12, 13, 14, 15], [.4, .55, .7, .85]):
        hit('shime', T(bar, st), v)
    hit('odaiko', T(bar, 8), .7)


def fill_soft(bar):
    for st, v in zip([12, 14, 15], [.35, .45, .55]):
        hit('nagado', T(bar, st), v, .2 if st % 2 else -.2, slot=1)
    koto_notes(bar, [(12, 62, .4, 1), (13, 67, .42, 1), (14, 69, .45, 1), (15, 74, .5, 1)])


def fill_tick(bar):
    for st in range(8, 16):
        hit('tick', T(bar, st), .3 + .6 * (st - 8) / 7, .3 if st % 2 else -.3)
    hit('odaiko', T(bar, 12), .6)
    hit('nagado', T(bar, 14), .6, slot=1)
    hit('nagado', T(bar, 15), .8, slot=1)


def fill_heavy(bar):
    hit('odaiko', T(bar, 8), .9)
    hit('odaiko', T(bar, 12), 1.0, slot=1)
    for st in range(8, 16):
        hit('nagado', T(bar, st), .5 + .5 * (st - 8) / 7, -.3 if st % 2 else .3, slot=1)
    for st in range(12, 16):
        hit('snare', T(bar, st), .4 + .5 * (st - 12) / 3)


def groove_half(bar):
    pat('kick', bar, 'X.........X.....')
    pat('snare', bar, '........X.......', .9)
    pat('hat', bar, '5.3.5.3.5.3.5.3.')
    pat('nagado', bar, 'X.....6.......5.')
    pat('ka', bar, '....5.......5...')
    pat('shaker', bar, '2323232323232323')


def groove_drive(bar, i, strong=False, fill=False):
    h = 8 if fill else 16
    pat('kick', bar, 'X...X...X...X...')
    pat('clap', bar, '....X.......X...', .85)
    pat('hat', bar, '4262426242624262')
    pat('ohat', bar, '..6...6...6...6.')
    pat('nagado', bar, 'X.....7...8...6.'[:h])
    pat('ka', bar, '...5.......5....'[:h])
    if strong or i % 2 == 0:
        pat('odaiko', bar, ('X.......' + ('....6...' if strong else '........'))[:h])
    if strong:
        pat('shime', bar, '3232323232323232'[:h], alt_pan=.2)
    if fill:
        fill_taiko(bar)


def groove_ball(bar, fill=False):
    h = 8 if fill else 16
    pat('kick', bar, 'X..8..7...X..6..')
    pat('clap', bar, '....X.......X...', .85)
    pat('hat', bar, '4262426242624262')
    pat('ohat', bar, '..........6.....')
    pat('shaker', bar, '3232323232323232')
    pat('nagado', bar, 'X......6...5..6.'[:h])
    pat('ka', bar, '..5...5.....5...'[:h])
    if fill:
        fill_taiko(bar)


def rackets_drums(bar):
    pat('kick', bar, 'X.......X.......')
    pat('hat', bar, '4262426242624262')
    pat('ohat', bar, '..5.......5.....')
    pat('nagado', bar, '......5.......5.', alt_pan=.4)
    pat('clap', bar, '....7.......7...')
    pat('shaker', bar, '3232323232323232')
    pat('shime', bar, '......4.......4.')


def aqua_drums(bar, fill=False):
    pat('kick', bar, 'X.........X.....', .8, bus='drumsF')
    pat('shaker', bar, '4545454545454545', 1.3, bus='drumsF')
    pat('hat', bar, '..5...5...5...5.', bus='drumsF')
    pat('ka', bar, '....6.......6...', bus='drumsF')
    pat('nagado', bar, '........5.......', .6, bus='drumsF')
    if fill:
        fill_soft(bar)


def combat_drums(bar, fill=False):
    h = 8 if fill else 16
    pat('odaiko', bar, 'X.......X.......'[:h])
    pat('nagado', bar, 'X..6.7X.X..6.7X8'[:h], alt_pan=.3)
    pat('shime', bar, '5.3.5.3.5.3.5.3.'[:h])
    pat('kick', bar, 'X.....7.X..7....')
    pat('snare', bar, '....X.......X...', .9)
    pat('hat', bar, '..5...5...5...5.')
    pat('ka', bar, '..6.......6.....')
    if fill:
        fill_heavy(bar)


def roll_drums(bar, i, fill=False):
    h = 8 if fill else 16
    pat('nagado', bar, 'X.5.8.5.X.5.8.5.'[:h], alt_pan=.3)
    pat('odaiko', bar, 'X...............')
    pat('shime', bar, '3333333333333333'[:h], .8, alt_pan=.2)
    if i >= 4:
        pat('kick', bar, 'X...X...X...X...')
        pat('clap', bar, '....X.......X...', .8)
    if i >= 6:
        pat('hat', bar, '4262426242624262')
        pat('ohat', bar, '..5...5...5...5.')
    if fill:
        fill_taiko(bar)


def finale_beats(bar):
    pat('kick', bar, 'X...X...X...X...')
    pat('nagado', bar, 'X...X...X...X...', alt_pan=.3)
    pat('tile', bar, 'X...X...X...X...', alt_pan=.5)
    pat('odaiko', bar, 'X.......X.......')
    pat('clap', bar, '....X.......X...')
    pat('hat', bar, '4262426242624262')
    pat('ohat', bar, '..6...6...6...6.')
    pat('shime', bar, '3434343434343434', alt_pan=.2)


def shime_roll(bar, steps, v0, v1, snare_too=False):
    for k, st in enumerate(steps):
        v = v0 + (v1 - v0) * k / max(1, len(steps) - 1)
        hit('shime', T(bar, st), v, .25 if k % 2 else -.25)
        if snare_too:
            hit('snare', T(bar, st), v * .6)


# ---------------------------------------------------------------- accents & big hits
def big_hit(s, size=1.0, crash_=True, sub=True, stab=None, gap=True):
    ens = [('odaiko', -.35, 1.0), ('odaiko', .35, .95), ('nagado', -.55, .9), ('nagado', 0, 1.0),
           ('nagado', .55, .9), ('shime', .2, .6)]
    for k, (inst, pan, v) in enumerate(ens):
        hit(inst, s, v * min(size, 1.2), pan, bus='fx', slot=10 + k)
    hit('kick', s, 1.0)
    hit('crack', s, 1.0, slot=20)
    IMPACTS.append((s, size, crash_, sub))
    if stab:
        STABS.append((s, stab, min(size, 1.2)))
    if gap:
        GAPS.append(s)


def card_accent(sh, idx):
    s = sh['b0'] * SPB
    assert abs(s - sh['t0'] * SR) < 2, sh
    chap, two = sh['chap'], sh['beats'] == 2
    pan = .25 if idx % 2 else -.25
    hit('kick', s, 1.0)
    hit('nagado', s, 1.0, 0, slot=2)
    hit('crack', s, 1.0, -pan)
    bar = sh['b0'] // 4
    if chap == 'ath':
        hit('crash', s, .3, pan)
        hit('ka', s, .6)
    elif chap == 'aqua':
        hit('splash', s, .9 if two else .7, pan)
        hit('drop', s, .6, -pan * 2)
    elif chap == 'ball':
        if two:
            hit('pok', s, 1.0, pan * 2.4)
            hit('shime', s, .6)
        else:
            hit('clap', s, .8)
            hit('ohat', s, .5)
    elif chap == 'combat':
        hit('odaiko', s, 1.0)
        hit('snare', s, .7)
        STABS.append((s, PROG[bar], .8))
    elif chap == 'power':
        hit('odaiko', s, .9)
        hit('clank', s, .8, pan)
    elif chap == 'nature':
        if two:
            hit('crash', s, .35, pan * 2)
            hit('shime', s, .7)
        else:
            hit('ohat', s, .6)
            hit('odaiko', s, .6)
    elif chap == 'asia':
        hit('crash', s, .45, pan)
        hit('odaiko', s, .8)


# ---------------------------------------------------------------- composition
SEC_START = {'intro': 0}
for sh in SHOTS:
    if sh['kind'] in ('chapter', 'finale'):
        SEC_START[sh['chap']] = sh['b0'] // 4
EXPECTED = dict(intro=0, ath=12, aqua=28, ball=35, combat=50, power=61, nature=70, asia=80, finale=89)
assert SEC_START == EXPECTED, f'timeline section layout changed: {SEC_START}'
SEC_OF = {}
for name, b0 in sorted(SEC_START.items(), key=lambda kv: kv[1]):
    for b in range(b0, 101):
        SEC_OF[b] = name


def compose():
    rng = np.random.default_rng(7)
    # ---------- INTRO (bars 0-11)
    DRONES.append((0, T(4) + int(0.4 * SR), 1.0))
    IMPACTS.append((0, 0.5, False, True))                 # red sun ignites: sub bloom under the heartbeat
    for bar in (0, 1, 2):
        pat('odaiko', bar, 'X..5....7..4....')
    pat('odaiko', 3, 'X..4..5.7.5.7.6.', .85)
    pat('nagado', 3, '........4.5.6.7.')
    RISERS.append((T(4), 3.2, 'swell', 0.55))
    SHAM.extend([(T(2, 0), 74, .55, .6, .2), (T(2, 8), 69, .4, .4, -.2),
                 (T(3, 0), 74, .5, .3, .1), (T(3, 3), 74, .4, .3, .1), (T(3, 6), 69, .45, .4, .1)])
    KOTO.append((T(3, 10), 74, .4, .6, -.3, ('up', 1, .12, .1)))
    big_hit(T(4), 1.0, stab='Dm')
    teaser_sham = {4: [(0, 74, 1, 3), (3, 74, .8, 3), (6, 69, .85, 4)],
                   5: [(0, 70, .9, 3), (3, 69, .8, 3), (6, 67, .8, 4)],
                   6: [(0, 74, 1, 3), (3, 74, .8, 3), (6, 69, .85, 2), (8, 70, .9, 2), (10, 69, .75, 2), (12, 67, .8, 4)],
                   7: [(0, 67, .9, 3), (3, 69, .8, 5)]}
    teaser_koto = {4: [(12, 70, .6, 2), (14, 69, .55, 2)], 5: [(12, 62, .55, 4, ('from', 2, .15))],
                   6: [], 7: [(8, 69, .5, 2, ('up', 1, .05, .08)), (12, 62, .45, 1), (13, 67, .5, 1), (14, 69, .55, 1), (15, 74, .6, 1)]}
    for bar in range(4, 8):
        groove_half(bar)
        bass_bar(bar, HALF)
        sham_notes(bar, teaser_sham[bar], vel=.9)
        koto_notes(bar, teaser_koto[bar])
        koto_arp(bar, 2, 0, .22, .45)
    pat('nagado', 7, '............567.', alt_pan=.3)
    for bar in (8, 9, 10):
        big_hit(T(bar), 0.85, crash_=True, sub=True, stab=PROG[bar], gap=False)
        bass_bar(bar, SUST, .8)
        pat('pulse', bar, '....X...X...X...', .6)
    pat('hat', 8, '..4...4...4...4.')
    koto_arp(8, 2, 0, .28)
    pat('hat', 9, '2424242424242424')
    pat('ka', 9, '....5.......5...')
    koto_arp(9, 1, 0, .28)
    pat('hat', 10, '3535353535353535')
    pat('ohat', 10, '..4...4...4...4.')
    pat('kick', 10, '........X.......')
    pat('nagado', 10, '........6...6.6.', alt_pan=.3)
    koto_arp(10, 1, 1, .3)
    # bar 11: build - accelerating shime/snare roll + riser; last half-beat silent (gap from big_hit at 12)
    roll_steps = [0, 2, 4, 5, 6, 7, 8, 8 + 2 / 3, 8 + 4 / 3, 10, 10 + 2 / 3, 10 + 4 / 3, 12, 12.5, 13, 13.5]
    shime_roll(11, roll_steps, .3, 1.0, snare_too=True)
    pat('kick', 11, 'X...X...X...X...', .85)
    for st in range(14):
        hit('hat', T(11, st), .2 + .5 * st / 13)
        SHAM.append((T(11, st), 74, .22 + .05 * st, .1, .1 if st % 2 else -.1))
    bass_bar(11, [(0, 14, 0)], .85)
    RISERS.append((T(12), 1.6, 'build', 1.0))

    # ---------- CH1 ATHLETICS (12-27): the drop, main theme
    for bar in range(12, 28):
        i = bar - 12
        groove_drive(bar, i, strong=(i >= 12), fill=(i == 1))
        bass_bar(bar, DRIVE)
        hook_bar(bar, PHRASE[i % 4], vel=1.0)
        if 4 <= i < 8:
            koto_arp(bar, 1, 0, .24)
        elif 8 <= i < 12:
            koto_counter(bar, .5)
        elif i >= 12:
            hook_bar(bar, PHRASE[i % 4], inst='koto', oct=1, vel=.38)
            koto_arp(bar, 2, 1, .16)
    hit('crash', T(20), .45, -.3)
    hit('crash', T(24), .5, .3)
    RISERS.append((T(28), 1.6, 'sweep', .5))

    # ---------- CH2 AQUATICS (28-34): flowing, filtered drums, koto arps, water
    for bar in range(28, 35):
        i = bar - 28
        aqua_drums(bar, fill=(i == 1))
        bass_bar(bar, SUST, .55, soft=True)
        koto_arp(bar, 1, 0 if i % 2 == 0 else 1, .38, .65)
        for st in rng.choice(np.arange(1, 16), 3, replace=False):
            hit('drop', T(bar, int(st)), rng.uniform(.4, .8), rng.uniform(-.7, .7))
    koto_notes(32, [(0, 74, .55, 6, ('vib',)), (8, 75, .45, 4), (12, 74, .45, 4)], pan=.1)
    koto_notes(33, [(0, 70, .55, 8), (8, 69, .5, 8, ('vib',))], pan=.1)
    koto_notes(34, [(0, 67, .5, 4, ('up', 2, .1, .15)), (8, 69, .5, 8)], pan=.1)
    RISERS.append((T(35), 1.6, 'sweep', .45))

    # ---------- CH3 BALL GAMES (35-49): groovy, call & response, rackets 46-48
    for bar in range(35, 50):
        i = bar - 35
        if 11 <= i <= 13:
            rackets_drums(bar)
            bass_bar(bar, [(0, 3, 0), (8, 3, 0)])
        else:
            groove_ball(bar, fill=(i == 1))
            bass_bar(bar, GROOVE)
        if i in (0, 1):
            sham_notes(bar, [(2, 62, .55, 1), (6, 62, .45, 1), (10, 62, .55, 1), (14, 69, .5, 1)])
        elif i == 2:
            hook_bar(bar, 'A')
        elif i == 3:
            hook_bar(bar, 'C')
        elif 4 <= i <= 7:
            hook_bar(bar, PHRASE[i - 4])
        elif i == 8 or i == 10:
            hook_bar(bar, 'A')
        elif i == 9:   # koto answers with oshide bends
            koto_notes(bar, [(0, 74, .7, 3), (3, 74, .6, 3, ('up', 1, .05, .06)), (6, 74, .6, 2), (8, 70, .65, 2),
                             (10, 69, .55, 2), (12, 67, .65, 4, ('vib',))], pan=-.3)
        elif 11 <= i <= 13:  # rackets: ping-pong pings on every 2-beat cut
            hi_, lo_ = (81, 74) if bar % 2 else (74, 81)
            sham_notes(bar, [(0, hi_, .8, 1), (8, lo_, .8, 1)], pan=.35 if bar % 2 else -.35)
            koto_notes(bar, [(4, 86, .28, 2), (12, 81, .28, 2)], pan=-.4 if bar % 2 else .4)
        elif i == 14:
            hook_bar(bar, 'C')
        if 4 <= i <= 10:
            koto_arp(bar, 2, 1, .18)
    RISERS.append((T(50), 1.6, 'sweep', .55))

    # ---------- CH4 COMBAT (50-60): heaviest taiko, stabs
    for bar in range(50, 61):
        i = bar - 50
        combat_drums(bar, fill=(i == 1))
        bass_bar(bar, COMBAT)
        tr = {'Eb': 1, 'Bb': -4, 'Asus': -5}.get(PROG[bar], 0)
        sham_notes(bar, COMBAT_RIFF, tr, .8, pan=-.1)
    RISERS.append((T(61), 1.6, 'rev', .6))

    # ---------- CH5 POWER & PRECISION (61-69): breakdown, clock ticks, suspense
    for bar in range(61, 70):
        i = bar - 61
        if i == 0:
            pat('tick', bar, '........7...7...')
            pat('tock', bar, '..........4...4.')
        elif i == 1:
            pat('tick', bar, '7...7...')
            pat('tock', bar, '..4...4.')
            fill_tick(bar)
        else:
            pat('tick', bar, '7...7...7...7...', alt_pan=.15)
            pat('tock', bar, '..4...4...4...4.', alt_pan=.15)
            pat('pulse', bar, 'X...X...X...X...', .8)
        bass_bar(bar, SUST, .6, soft=True)
        if i >= 6:
            pat('hat', bar, '2323232323232323', (i - 5) * .35)
        if i == 8:
            pat('kick', bar, 'X...X...X...X...', .8)
            shime_roll(bar, [8, 9, 10, 11, 12, 13], .3, .9)
    koto_notes(63, [(0, 74, .5, 8, ('up', 1, .25, .2))], pan=.3)
    koto_notes(65, [(0, 69, .45, 8, ('vib',))], pan=-.3)
    koto_notes(67, [(0, 70, .5, 8, ('up', -1, .3, .25))], pan=.3)
    koto_notes(69, [(0, 75, .5, 4), (8, 74, .5, 4)], pan=-.2)
    for bar in (64, 66, 68):
        sham_notes(bar, [(8, 62, .5, 2)], pan=-.2)
    RISERS.append((T(70), 3.2, 'sweep', .65))

    # ---------- CH6 LAND & SEA (70-79): rebuild, rolling momentum
    for bar in range(70, 80):
        i = bar - 70
        roll_drums(bar, i, fill=(i == 1))
        bass_bar(bar, SUST if i < 2 else ROLL, .85 if i < 2 else 1.0, soft=(i < 2))
        koto_arp(bar, 2, 0 if i < 4 else 1, .28)
        if i == 2:
            hook_bar(bar, 'A', inst='koto', vel=.55)
        elif i == 3:
            hook_bar(bar, 'C', inst='koto', vel=.55)
        elif 4 <= i <= 7:
            hook_bar(bar, PHRASE[i - 4])
        elif i == 8:
            hook_bar(bar, 'B')
        elif i == 9:
            hook_bar(bar, 'C')
    RISERS.append((T(80), 1.6, 'sweep', .6))

    # ---------- CH7 ASIA & NEW WAVE (80-88): peak, final chorus
    for bar in range(80, 89):
        i = bar - 80
        groove_drive(bar, i, strong=True, fill=(i == 1))
        bass_bar(bar, DRIVE + [(15, 1, 1)])
        if i < 8:
            hook_bar(bar, PHRASE[i % 4])
            if i >= 4:
                hook_bar(bar, PHRASE[i % 4], oct=-1, vel=.45)
        else:
            hook_bar(bar, 'B')
        if i < 4:
            hook_bar(bar, PHRASE[i % 4], inst='koto', oct=1, vel=.38)
        elif i < 8:
            koto_counter(bar, .5)
            koto_arp(bar, 1, 1, .15)
        else:
            koto_arp(bar, 1, 1, .2)
    hit('crash', T(84), .5, .3)
    RISERS.append((T(89), 1.6, 'build', .8))

    # ---------- FINALE (89-100)
    for bar in range(89, 93):
        i = bar - 89
        finale_beats(bar)
        bass_bar(bar, FIN)
        hook_bar(bar, PHRASE[i])
        hook_bar(bar, PHRASE[i], oct=-1, vel=.45)
        hook_bar(bar, PHRASE[i], inst='koto', oct=1, vel=.4)
    RISERS.append((T(93), 1.6, 'rev', .7))
    big_hit(T(93), 1.25, stab='Dm')
    KOTO.append((T(93), 86, .5, 3.0, .2, ('vib',)))
    BASS.append((T(93), 38, .9, 3.0, True))
    outro = {94: [(0, 74, .6, 6), (6, 75, .45, 2), (8, 74, .5, 4, ('vib',)), (12, 70, .45, 4)],
             95: [(0, 67, .55, 8, ('up', 2, .15, .2)), (8, 67, .45, 4), (12, 69, .45, 4)],
             96: [(0, 70, .55, 6), (6, 69, .4, 2), (8, 67, .5, 8, ('vib',))],
             97: [(0, 69, .55, 8, ('vib',)), (8, 74, .5, 4), (12, 75, .5, 2), (14, 74, .5, 2)]}
    for bar in range(94, 98):
        i = bar - 94
        koto_notes(bar, outro[bar], vel=1.0, pan=.05)
        bass_bar(bar, SUST, .6, soft=True)
        pat('odaiko', bar, 'X...............', .55)
        if i % 2 == 1:
            pat('nagado', bar, '........4.......')
    pat('odaiko', 97, '...4....', .55)
    shime_roll(97, [8, 9, 10, 11, 12, 13], .2, .7)
    RISERS.append((T(98), 1.6, 'swell', .55))
    big_hit(T(98), 1.3, stab='D5')
    for k, m in enumerate([62, 69, 74, 81, 86]):
        KOTO.append((T(98) + k * int(0.012 * SR), m, .55, 4.0, -.5 + .25 * k, None))
    SHAM.append((T(98), 62, .7, 1.0, 0.0))
    BASS.append((T(98), 38, .9, 4.2, True))

    # ---------- per-shot accents from the locked edit
    for idx, sh in enumerate(SHOTS):
        s = sh['b0'] * SPB
        if sh['kind'] == 'intro':
            hit('odaiko', s, 1.0)
            hit('nagado', s, .7, slot=2)
        elif sh['kind'] in ('chapter', 'finale'):
            size = 1.1 if sh['kind'] == 'finale' else 1.0
            big_hit(s, size, stab=('Dm' if sh['chap'] == 'combat' else None))
        else:
            card_accent(sh, idx)


# ---------------------------------------------------------------- tonal synthesis
def ks_render(curve, f0, s_w, rho, excite):
    """Karplus-Strong, vectorised per period; pitch set exactly (and bent) by resampled read-out."""
    Nn = max(2, int(np.floor(SR / f0 - (1 - s_w))))
    fv = SR / (Nn + (1 - s_w))
    ratio = f0 * 2 ** (curve / 12) / fv
    pos = np.concatenate(([0.0], np.cumsum(ratio[:-1])))
    L = int(pos[-1]) + Nn + 4
    y = np.zeros(L)
    y[:Nn] = excite(Nn)
    k = Nn
    while k < L:
        b = min(k + Nn, L)
        m = b - k
        a_ = y[k - Nn:k - Nn + m]
        c_ = y[k - Nn - 1:k - Nn - 1 + m] if k - Nn - 1 >= 0 else np.concatenate(([0.0], y[0:m - 1]))
        y[k:b] = rho * (s_w * a_ + (1 - s_w) * c_)
        k = b
    return np.interp(pos, np.arange(L), y)


def bend_curve(n, spec):
    t = tt(n)
    c = np.zeros(n)
    if spec is None:
        return c
    kind = spec[0]
    if kind == 'up':            # oshide: pluck then press the string (semis may be negative = release)
        semis, t0, tl = spec[1:]
        x = np.clip((t - t0) / tl, 0, 1)
        c = semis * (0.5 - 0.5 * np.cos(np.pi * x))
    elif kind == 'from':        # pre-pressed, slides into pitch
        semis, tl = spec[1:]
        x = np.clip(t / tl, 0, 1)
        c = -semis * (0.5 + 0.5 * np.cos(np.pi * x))
    elif kind == 'vib':         # yuri
        c = 0.2 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
    return c


_KS_CACHE = {}


def sham_note(midi, dur, seed):
    key = ('s', midi, round(dur, 2), seed % 3)
    if key in _KS_CACHE:
        return _KS_CACHE[key]
    rng = np.random.default_rng(seed)
    f0 = mtof(midi)
    n = int((dur + 0.35) * SR)
    t = tt(n)

    def ex(m):
        e = rng.uniform(-1, 1, m)
        return e - np.roll(e, max(1, int(m * 0.13)))       # plucked near the bridge: bright
    y = ks_render(np.zeros(n), f0, 0.85, 0.994, ex)
    env = np.exp(-t / 0.30) * np.where(t > dur, np.exp(-(t - dur) / 0.04), 1.0)
    y = normp(y * env)
    buzz = filt(np.tanh(4 * y), 'hp', 1800) * np.exp(-t / 0.12) * 0.35      # sawari buzz
    click = filt(nz(n, seed + 5), 'hp', 3000) * np.exp(-t / 0.0015) * 0.5   # bachi strike
    body = filt(y, 'bp', (900, 3500)) * 0.4                                  # nasal skin body
    x = normp(fade_end(filt(y + buzz + body + click, 'hp', 150)))
    _KS_CACHE[key] = x
    return x


def koto_note(midi, dur, seed, bend):
    key = ('k', midi, round(dur, 2), bend, seed % 3)
    if key in _KS_CACHE:
        return _KS_CACHE[key]
    rng = np.random.default_rng(seed)
    f0 = mtof(midi)
    n = int((dur + 1.2) * SR)
    t = tt(n)

    def ex(m):
        e = signal.lfilter([0.5], [1, -0.5], rng.uniform(-1, 1, m))
        return e - np.roll(e, max(1, int(m * 0.22)))
    y = ks_render(bend_curve(n, bend), f0, 0.64, 0.9982, ex)
    env = np.exp(-t / 1.4) * np.where(t > dur + 0.25, np.exp(-(t - dur - 0.25) / 0.3), 1.0)
    y = normp(y * env)
    pick = filt(nz(n, seed + 7), 'hp', 2500) * np.exp(-t / 0.002) * 0.3
    body = filt(y, 'bp', (150, 500)) * 0.5
    x = normp(fade_end(filt(y + pick + body, 'hp', 110)))
    _KS_CACHE[key] = x
    return x


def bass_note(m, dur, soft):
    n = int((dur + 0.06) * SR)
    t = tt(n)
    f = mtof(m)
    ph = 2 * np.pi * f * t
    h2, h3, drive = (0.3, 0.12, 1.2) if soft else (0.5, 0.3, 1.8)
    x = np.sin(ph) + h2 * np.sin(2 * ph) + h3 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.002) * np.exp(-t / 1.4) * np.where(t > dur, np.exp(-(t - dur) / 0.015), 1.0)
    x = np.tanh(drive * x * env) / np.tanh(drive)
    if not soft:
        x += 0.15 * filt(nz(n, 3), 'bp', (800, 3000)) * np.exp(-t / 0.004)
    return fade_end(filt(x, 'lp', 1800))


def pad_seg(notes, dur, attack, release, cutoff, seed):
    rng = np.random.default_rng(seed)
    n = int((dur + release) * SR)
    t = tt(n)
    out = np.zeros((2, n))
    for m in notes:
        if m < 48:
            continue
        for v, det in enumerate((-13, -6, 0, 6, 13)):
            w = saw(mtof(m) * 2 ** (det / 1200), n, rng.random())
            th = (((v - 2) / 2 * 0.85) + 1) * np.pi / 4
            out[0] += w * np.cos(th)
            out[1] += w * np.sin(th)
    out = filt(filt(out, 'lp', cutoff), 'lp', cutoff * 1.3)
    rms = np.sqrt(np.mean(out ** 2)) + 1e-9
    env = np.minimum(1, t / max(attack, 0.005)) ** 1.5
    env *= np.where(t > dur, np.cos(np.clip((t - dur) / release, 0, 1) * np.pi / 2), 1.0)
    return out / rms * env


def stab_sig(chd, seed):
    rng = np.random.default_rng(seed)
    n = int(1.4 * SR)
    t = tt(n)
    x = np.zeros(n)
    for m in [q for q in PAD_V[chd] if q < 72][:4]:
        for det in (-9, 0, 9):
            x += saw(mtof(m) * 2 ** (det / 1200), n, rng.random())
    x = filt(x, 'lp', 3200)
    x = normp(x) + 0.8 * np.sin(2 * np.pi * mtof(ROOT[chd] + 12) * t)
    env = np.minimum(1, t / 0.002) * np.exp(-t / 0.3)
    x = np.tanh(1.5 * normp(x) * env)
    x += filt(nz(n, seed), 'bp', (600, 5000)) * np.exp(-t / 0.04) * 0.5
    return normp(x)


def impact_sig(size, crash_, sub, seed):
    n = int(4.5 * SR)
    t = tt(n)
    out = np.zeros((2, n))
    if sub:   # sub-drop
        f = 30 + (100 - 30) * np.exp(-t / 0.3)
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = np.sin(ph) * np.exp(-t / 1.2) + 0.3 * np.sin(2 * ph) * np.exp(-t / 0.5)
        out += s * 0.9
    out += filt(nz(n, seed), 'lp', 300) * np.exp(-t / 0.18) * 0.6
    if crash_:
        for ch in range(2):
            w = nz(n, seed + 11 + ch)
            out[ch] += filt(w, 'hp', 2000) * np.exp(-t / 1.0) * 0.35 + filt(w, 'bp', (500, 3000)) * np.exp(-t / 0.08) * 0.4
    return out * size


def riser_sig(kind, length, seed):
    n = int(length * SR)
    t = tt(n)
    x = t / length
    out = np.zeros((2, n))
    if kind == 'rev':          # reversed cymbal swell
        for ch in range(2):
            out[ch] = crash(seed + ch, decay=length / 2.2)[:n][::-1]
        out *= x ** 1.2
    else:
        f_end, curve = {'sweep': (9000, 2.2), 'build': (11000, 2.0), 'swell': (5000, 1.5)}[kind]
        fcs = 250 * (f_end / 250) ** (x ** 1.3)
        for ch in range(2):
            out[ch] = tv_filter(nz(n, seed + ch), fcs, 1.4)
        out = normp(out) * x ** curve
        if kind == 'build':    # pitched riser: detuned saws D3 -> D5
            f = mtof(50) * 2 ** (2 * x)
            ph0 = np.cumsum(f) / SR
            p = sum(((ph0 * r) % 1.0) * 2 - 1 for r in (1.0, 1.006, 0.994))
            p = tv_filter(p, 400 + 5000 * x ** 2, 0.8, kind='lp')
            out += normp(p) * x ** 2 * 0.6
        if kind == 'swell':
            rv = crash(seed + 5, decay=length / 2.5)[:n][::-1]
            out += normp(rv) * x ** 1.5 * 0.5
    out = normp(out)
    k = int(0.03 * SR)
    out[:, -k:] *= np.linspace(1, 0.3, k) ** 2
    return fade_end(out, 0.002)


def drone_sig(dur, seed):
    n = int(dur * SR)
    t = tt(n)
    rng = np.random.default_rng(seed)
    x = np.zeros((2, n))
    for ch in range(2):
        d = (ch - 0.5)
        s = saw(mtof(38) * (1 + 0.001 * d), n, rng.random()) + 0.7 * saw(mtof(45) * (1 - 0.0012 * d), n, rng.random())
        s += 0.4 * saw(mtof(50) * (1 + 0.002 * d), n, rng.random())
        s = filt(filt(s, 'lp', 320), 'lp', 320)
        s = normp(s) + 0.35 * np.sin(2 * np.pi * mtof(26) * t)
        w = filt(nz(n, seed + ch), 'bp', (250, 900)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.2 * t + ch)) * 0.15
        x[ch] = s + w
    env = np.minimum(1, t / 1.2) * np.where(t > dur - 0.6, np.clip((dur - t) / 0.6, 0, 1), 1)
    return normp(x * env)


# ---------------------------------------------------------------- reverb
def make_ir(t60, length, seed, predelay=0.012):
    n = int(length * SR)
    t = tt(n)
    rng = np.random.default_rng(seed)
    ir = np.zeros((2, n))
    pd = int(predelay * SR)
    for ch in range(2):
        w = rng.standard_normal(n)
        lo = filt(w, 'lp', 450)
        hi = filt(w, 'hp', 3500)
        mid = w - lo - hi
        r = lo * np.exp(-6.91 * t / (t60 * 1.15)) + mid * np.exp(-6.91 * t / t60) + hi * np.exp(-6.91 * t / (t60 * 0.45))
        r *= np.minimum(1, t / 0.008)
        er = np.zeros(n)
        for k in range(10):
            er[int(rng.uniform(0.004, 0.07) * SR)] += rng.uniform(-1, 1) * (1 - k / 12) * 3
        r = r + er
        r = np.concatenate((np.zeros(pd), r))[:n]
        ir[ch] = r / np.sqrt(np.sum(r ** 2))
    return ir


def convolve_st(mono, ir):
    return np.vstack([signal.oaconvolve(mono, ir[ch])[:N] for ch in range(2)])


# ---------------------------------------------------------------- render
def render():
    log('rendering drum events:', len(EV))
    kick_imp = np.zeros(N)
    for (inst, s, slot, bus), (vel, pan) in EV.items():
        bank = BANK[inst]
        smp = bank[(s // S16 + slot) % len(bank)]
        add(bus, smp, s, vel * IG[inst], pan)
        if inst == 'kick':
            kick_imp[s] += vel
    BUS['drumsF'][:] = filt(BUS['drumsF'], 'lp', 1100).astype(np.float32)

    log('shamisen notes:', len(SHAM))
    for k, (s, m, v, d, p) in enumerate(SHAM):
        add('sham', sham_note(m, d, k), s, v * 0.5, p)
    log('koto notes:', len(KOTO))
    for k, (s, m, v, d, p, bend) in enumerate(KOTO):
        add('koto', koto_note(m, d, k, bend), s, v * 0.33, p)
    log('bass notes:', len(BASS))
    for s, m, v, d, soft in BASS:
        add('bass', bass_note(m, d, soft), s, v * 0.55)
    for s, dur_end, g in DRONES:
        add('bass', drone_sig((dur_end - s) / SR, 5), s, g * 0.3)
    for k, (s, chd, v) in enumerate(STABS):
        add('fx', stab_sig(chd, 300 + k), s, v * 0.35, 0)
    for k, (s, size, cr, sub) in enumerate(IMPACTS):
        add('fx', impact_sig(size, cr, sub, 400 + k), s, 0.8)
    for k, (s_end, length, kind, g) in enumerate(RISERS):
        x = riser_sig(kind, length, 500 + k)
        add('fx', x, s_end - x.shape[1], g * 0.25)

    log('pads')
    PAD_STYLE = dict(intro=(.5, 1500, .3, .4), ath=(.5, 2400, .08, .55), aqua=(.6, 1500, .4, .3),
                     ball=(.5, 2200, .08, .5), combat=(.45, 1400, .05, .5), power=(.6, 950, .5, 0.0),
                     nature=(.55, 2000, .15, .45), asia=(.7, 3000, .08, .55), finale=(.7, 3000, .08, .55))
    style = {}
    for b in range(4, 101):
        st = PAD_STYLE[SEC_OF[b]]
        if b == 93:
            st = (.6, 2200, .02, 0)
        elif 94 <= b <= 97:
            st = (.75, 1800, .6, 0)
        elif b >= 98:
            st = (.7, 2000, .05, 0)
        style[b] = st
    segs, b = [], 4
    while b < 101:
        e = b + 1
        while e < 101 and PROG[e] == PROG[b] and style[e] == style[b] and SEC_OF[e] == SEC_OF[b] and e not in (93, 94, 98):
            e += 1
        segs.append((b, e))
        b = e
    for k, (b0, b1) in enumerate(segs):
        lvl, cut, att, _ = style[b0]
        s0 = T(b0)
        if b1 >= 101:
            dur, rel = (FADE_START - s0) / SR, 2.6
        else:
            dur, rel = (T(b1) - s0) / SR, 0.35
        add('pad', pad_seg(PAD_V[PROG[b0]], dur, att, rel, cut, 600 + k), s0, lvl * 0.05)

    # sidechain pump (kick-driven) on pad, lighter on bass
    kern_n = int(0.5 * SR)
    kt = tt(kern_n)
    kern = np.minimum(1, kt / 0.004) * np.exp(-kt / 0.14)
    duck = np.clip(signal.oaconvolve(kick_imp, kern)[:N], 0, 1)
    depth = np.zeros(N)
    for b in range(101):
        depth[T(b):T(b + 1)] = style.get(b, (0, 0, 0, 0))[3]
    BUS['pad'] *= (1 - depth * duck).astype(np.float32)
    bk = np.exp(-kt / 0.06) * np.minimum(1, kt / 0.002)
    duck_b = np.clip(signal.oaconvolve(kick_imp, bk)[:N], 0, 1)
    BUS['bass'] *= (1 - 0.3 * duck_b).astype(np.float32)

    # pre-hit gaps: drums & bass drop out for the half-beat before each big hit
    gate = np.ones(N, np.float32)
    for s in GAPS:
        a = s - int(0.2 * SR)
        fo = int(0.004 * SR)
        gate[a - fo:a] = np.minimum(gate[a - fo:a], np.linspace(1, 0, fo))
        gate[a:s - 48] = 0
        gate[s - 48:s] = np.minimum(gate[s - 48:s], np.linspace(0, 1, 48))
    for b in ('kick', 'taiko', 'perc', 'drumsF', 'bass', 'sham'):
        BUS[b] *= gate
    BUS['koto'] *= 0.25 + 0.75 * gate
    BUS['pad'] *= 0.35 + 0.65 * gate
    return gate


# ---------------------------------------------------------------- SFX layer
def whoosh(length, seed, direction):
    n = int(length * SR)
    t = tt(n)
    x = t / length
    fcs = 500 * (4500 / 500) ** (x ** 1.6)
    y = 0.7 * tv_filter(nz(n, seed), fcs, 0.9) + 0.3 * tv_filter(nz(n, seed + 1), fcs * 1.3, 1.5)
    env = x ** 2.5
    p = direction * (-0.6 + 1.2 * x)
    th = (p + 1) * np.pi / 4
    out = normp(np.vstack([y * env * np.cos(th), y * env * np.sin(th)]))
    k = int(0.02 * SR)
    out[:, -k:] *= np.linspace(1, 0.3, k) ** 2
    return fade_end(out, 0.0015)


def rev_swell(length, seed, ir):
    n = int(length * SR)
    x = tt(n) / length
    hitsig = BANK['nagado'][0][:int(1.0 * SR)]
    tail = np.vstack([signal.oaconvolve(hitsig, ir[ch]) for ch in range(2)])[:, :n]
    tail = normp(tail[:, ::-1])
    cr = np.vstack([crash(700 + seed + ch, decay=length / 2.2)[:n][::-1] for ch in range(2)])
    out = normp((0.6 * tail + 0.5 * normp(cr)) * x ** 1.3)
    k = int(0.02 * SR)
    out[:, -k:] *= np.linspace(1, 0.3, k) ** 2
    return fade_end(out, 0.0015)


def sfx_impact(seed, size, ir):
    n = int(3.5 * SR)
    t = tt(n)
    f = 32 + (70 - 32) * np.exp(-t / 0.25)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    crack = np.tanh(3 * filt(nz(n, seed), 'hp', 1000) * np.exp(-t / 0.012)) * 0.6
    body = filt(nz(n, seed + 1), 'bp', (150, 1200)) * np.exp(-t / 0.12) * 0.6
    dry = 0.45 * boom + crack + body
    wet = np.vstack([signal.oaconvolve(crack + body, ir[ch])[:n] for ch in range(2)])
    return normp(np.vstack([dry, dry]) + 0.5 * normp(wet)) * size


def build_sfx(ir_hall, ir_big):
    events = []
    for k, sh in enumerate(SHOTS):
        s = sh['b0'] * SPB
        if s == 0:
            add('sfx', sfx_impact(900, 0.5, ir_hall), 0)
            events.append(0)
            continue
        prev = SHOTS[k - 1]
        d = 1 if k % 2 else -1
        if sh['kind'] in ('chapter', 'finale'):
            x = rev_swell(1.4, k, ir_big)
            add('sfx', x, s - x.shape[1], 0.7)
            add('sfx', sfx_impact(900 + k, 1.0, ir_hall), s)
        w = whoosh(0.34 if prev['beats'] >= 4 else 0.24, 800 + k, d)
        add('sfx', w, s - w.shape[1], 0.6 if sh['kind'] == 'card' else 0.5)
        events.append(s)
    for k, (bar, size) in enumerate([(4, .9), (93, 1.1), (98, 1.2)]):
        s = T(bar)
        x = rev_swell(1.4, 50 + k, ir_big)
        add('sfx', x, s - x.shape[1], 0.7)
        add('sfx', sfx_impact(950 + k, size, ir_hall), s)
        events.append(s)
    return events


# ---------------------------------------------------------------- analysis helpers
BANDS = [(20, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 16000)]


def band_table(x):
    f, P = signal.welch(x.astype(np.float64), SR, nperseg=16384, axis=-1)
    P = P.sum(0)
    tot = P[(f >= 20) & (f <= 20000)].sum()
    return [10 * np.log10(P[(f >= lo) & (f < hi)].sum() / tot + 1e-20) for lo, hi in BANDS]


def kw(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def lufs(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x.astype(np.float64), axis=-1), axis=-1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    cs = np.cumsum(np.pad(y ** 2, ((0, 0), (1, 0))), axis=1)
    st = np.arange(0, y.shape[1] - blk + 1, hop)
    z = ((cs[:, st + blk] - cs[:, st]) / blk).sum(0)
    l = -0.691 + 10 * np.log10(z + 1e-20)
    g1 = l > -70
    rel = -0.691 + 10 * np.log10(z[g1].mean()) - 10
    g2 = g1 & (l > rel)
    return -0.691 + 10 * np.log10(z[g2].mean())


def true_peak_db(x):
    xo = signal.resample_poly(x.astype(np.float64), 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(xo)) + 1e-12)


def glue(x, ratio=2.0, knee=6.0):
    p = (x.astype(np.float64) ** 2).mean(0)
    a = np.exp(-1 / (0.03 * SR))
    env = signal.lfilter([1 - a], [1, -a], p)
    lvl = 10 * np.log10(env + 1e-12)
    thr = np.percentile(lvl[lvl > -60], 95) - 1.0
    over = lvl - thr
    gr = np.where(over > knee / 2, (1 - 1 / ratio) * over,
                  np.where(over > -knee / 2, (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee), 0.0))
    a2 = np.exp(-1 / (0.1 * SR))
    gr = signal.lfilter([1 - a2], [1, -a2], gr)
    return x * 10 ** (-gr / 20), float(np.max(gr)), float(np.mean(gr[lvl > thr - 10]))


def limiter(x, ceiling_db, look=0.003, release=0.08):
    c = 10 ** (ceiling_db / 20)
    n = x.shape[1]
    xo = signal.resample_poly(x, 4, 1, axis=1)
    pk = np.max(np.abs(xo), axis=0)[:4 * n].reshape(n, 4).max(1)
    pk = np.maximum(pk, np.max(np.abs(x), axis=0))
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    L = int(look * SR)
    h = minimum_filter1d(g, size=2 * L + 1)
    B = 16
    nb = int(np.ceil(n / B))
    hb = np.pad(h, (0, nb * B - n), constant_values=1.0).reshape(nb, B).min(1)
    rc = 1 - np.exp(-B / (release * SR))
    r = np.empty(nb)
    cur = 1.0
    for i in range(nb):
        cur = cur + (1 - cur) * rc
        if hb[i] < cur:
            cur = hb[i]
        r[i] = cur
    r = np.repeat(r, B)[:n]
    r = uniform_filter1d(r, size=L)
    r = np.minimum(r, h)
    return x * r


def write24(path, x):
    y = np.clip(np.asarray(x, np.float64), -1.0, 1.0 - 1.0 / 8388608)
    i = np.ascontiguousarray(np.round(y.T * 8388607).astype('<i4'))
    b = i.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)


def onset_check(x, times):
    """Onset = strongest energy rise in the transient band (1.5-12 kHz, 2 ms window vs preceding 5 ms)
    within +/-30 ms of the cut.  Also reports the low-band (40-200 Hz, 10 ms windows) rise = body weight."""
    m = x.astype(np.float64).mean(0)
    hb = signal.sosfiltfilt(sos('bp', (1500, 12000), 2), m)
    lb = signal.sosfiltfilt(sos('bp', (40, 200), 2), m)
    ch = np.concatenate(([0.0], np.cumsum(hb ** 2)))
    cl = np.concatenate(([0.0], np.cumsum(lb ** 2)))
    res = []
    for s in times:
        if s == 0:   # start of file: onset = first sample above -40 dBFS
            first = np.argmax(np.abs(m[:int(0.05 * SR)]) > 0.01)
            res.append((first / SR * 1000, 99.0, 99.0, first / SR * 1000))
            continue
        idx = np.arange(s - int(0.03 * SR), min(N - 480, s + int(0.03 * SR)))
        d = 10 * np.log10(((ch[idx + 96] - ch[idx]) / 96 + 1e-12) / ((ch[idx] - ch[idx - 240]) / 240 + 1e-12))
        j = int(np.argmax(d))
        e_f = (cl[s + 480] - cl[s]) / 480
        e_p = (cl[s - 240] - cl[s - 720]) / 480
        low_rise = 10 * np.log10((e_f + 1e-12) / (e_p + 1e-12))
        seg = np.abs(m[s - int(0.005 * SR): s + int(0.04 * SR)])
        pk = (int(np.argmax(seg)) - int(0.005 * SR)) / SR * 1000
        res.append(((idx[j] - s) / SR * 1000, float(d[j]), float(low_rise), pk))
    return res


# ---------------------------------------------------------------- main
def main():
    compose()
    log(f'composed: {len(EV)} drum events, {len(SHAM)} shamisen, {len(KOTO)} koto, {len(BASS)} bass')
    gate = render()

    log('reverbs')
    ir_room = make_ir(0.9, 1.4, 11)
    ir_hall = make_ir(2.4, 3.5, 12)
    ir_big = make_ir(4.2, 6.0, 13)
    BG = dict(kick=.5, taiko=.5, perc=.9, drumsF=.45, bass=.6, pad=3.5, sham=2.2, koto=3.6, fx=.6)
    SENDS = {'room': ({'taiko': .30, 'perc': .12, 'drumsF': .25, 'sham': .20}, ir_room, .8, 200),
             'hall': ({'koto': .40, 'pad': .22, 'sham': .14, 'taiko': .10, 'fx': .12}, ir_hall, .8, 200),
             'big': ({'fx': .45, 'koto': .08}, ir_big, .7, 90)}
    rets = {}
    for name, (amts, ir, g, hp) in SENDS.items():
        mono = sum(BUS[b].astype(np.float64).mean(0) * a * BG[b] for b, a in amts.items())
        mono = filt(mono, 'hp', hp)
        rets[name] = convolve_st(mono, ir) * g
        log('  reverb', name)

    drums = sum(BUS[b].astype(np.float64) * BG[b] for b in ('kick', 'taiko', 'perc', 'drumsF'))
    ref = np.percentile(np.abs(drums), 99.95) + 1e-9
    drums = np.tanh(1.1 * drums / ref) / np.tanh(1.1) * ref      # gentle drum-bus saturation
    def widen(x, k):   # mid/side width
        mid = (x[0] + x[1]) / 2
        side = (x[0] - x[1]) / 2 * k
        return np.vstack([mid + side, mid - side])
    WIDTH = dict(pad=1.6, koto=1.4)
    bed = drums.copy()
    for b in ('bass', 'pad', 'sham', 'koto', 'fx'):
        v = BUS[b].astype(np.float64) * BG[b]
        bed += widen(v, WIDTH[b]) if b in WIDTH else v
    for r in rets.values():
        bed += widen(r, 1.3)

    # per-bus diagnostics (section RMS)
    diag = []
    secs = [('intro', 0, 12), ('ath', 12, 28), ('aqua', 28, 35), ('ball', 35, 50), ('combat', 50, 61),
            ('power', 61, 70), ('nature', 70, 80), ('asia', 80, 89), ('finale', 89, 101)]
    stems = {'drums': drums, 'bass': BUS['bass'] * BG['bass'], 'pad': BUS['pad'] * BG['pad'],
             'sham': BUS['sham'] * BG['sham'], 'koto': BUS['koto'] * BG['koto'],
             'fx': BUS['fx'] * BG['fx'], 'reverb': sum(rets.values())}
    hdr = 'section  ' + ''.join(f'{k:>8}' for k in stems)
    diag.append(hdr)
    for nm, b0, b1 in secs:
        a, b = T(b0), min(T(b1), N)
        row = f'{nm:<9}'
        for k, v in stems.items():
            seg = kw(np.asarray(v[:, a:b], np.float64))
            rms = np.sqrt(np.mean(seg ** 2)) + 1e-12
            row += f'{20 * np.log10(rms):8.1f}'
        diag.append(row)
    lowsum = {}
    for k, v in stems.items():
        lb = signal.sosfilt(sos('lp', 120, 4), np.asarray(v, np.float64), axis=-1)
        lowsum[k] = np.mean(lb ** 2)
    tot_low = sum(lowsum.values())
    diag.append('share of 20-120 Hz energy: ' + ', '.join(f'{k} {100 * v / tot_low:.0f}%' for k, v in lowsum.items()))
    print('\n'.join(diag))

    # mix automation (dB per bar): lighter aquatics / breakdown / outro, lift for the final chorus.
    # Changes ramp inside the 0.2 s pre-hit gap (or 50 ms before the bar) so they are masked.
    AUTO = {}
    for b in range(101):
        sec = SEC_OF[b]
        AUTO[b] = {'intro': 0.0, 'ath': -0.5, 'aqua': -2.5, 'ball': -0.5, 'combat': 0.0, 'power': -2.0,
                   'nature': -0.5, 'asia': 1.0, 'finale': 1.0}[sec]
    for b in range(46, 49):
        AUTO[b] = 1.5
    AUTO[69] = -1.0
    for b in (70, 71, 72, 73):
        AUTO[b] = -1.0
    AUTO[93] = 0.5
    for b in range(94, 98):
        AUTO[b] = -2.5
    for b in range(98, 101):
        AUTO[b] = 0.0
    auto = np.zeros(N)
    auto[:] = AUTO[0]
    for b in range(1, 101):
        if AUTO[b] == AUTO[b - 1]:
            auto[T(b):] = AUTO[b]
            continue
        s1 = T(b)
        s0 = s1 - (int(0.2 * SR) if s1 in GAPS else int(0.05 * SR))
        auto[s0:s1] = np.linspace(AUTO[b - 1], AUTO[b], s1 - s0)
        auto[s1:] = AUTO[b]
    bed *= 10 ** (auto / 20)
    drums *= 10 ** (auto / 20)
    bt0 = band_table(bed)
    # SFX stem
    sfx_events = build_sfx(ir_hall, ir_big)
    sfx = BUS['sfx'].astype(np.float64)
    # calibrate sfx ~6 dB under the drums at the transition points
    w = int(0.1 * SR)
    dr, sf = [], []
    for s in sfx_events:
        a, b = max(0, s - w), min(N, s + w)
        dr.append(np.mean(drums[:, a:b] ** 2))
        sf.append(np.mean(sfx[:, a:b] ** 2))
    diff = 10 * np.log10(np.mean(sf) / np.mean(dr))
    g_sfx = 10 ** ((-6.0 - diff) / 20)
    sfx *= g_sfx
    log(f'sfx gain {20 * np.log10(g_sfx):+.1f} dB (sfx vs drums at transitions: -6.0 dB)')

    # low-band rebalance: zero-phase split at 120 Hz, scale low band of BOTH stems so the
    # combined mix has 20-120 Hz at ~-3 dB of total (same linear op on each stem keeps them summable)
    low_b = signal.sosfiltfilt(sos('lp', 120, 2), bed, axis=-1)
    low_s = signal.sosfiltfilt(sos('lp', 120, 2), sfx, axis=-1)
    tot = bed + sfx
    low_t = low_b + low_s
    lo_g, hi_g = 0.1, 1.5
    for _ in range(14):
        g = (lo_g + hi_g) / 2
        v = band_table(tot + (g - 1) * low_t)[0]
        if v > -3.0:
            hi_g = g
        else:
            lo_g = g
    g_low = (lo_g + hi_g) / 2
    bed = bed + (g_low - 1) * low_b
    sfx = sfx + (g_low - 1) * low_s
    del low_b, low_s, low_t, tot
    bt1 = band_table(bed)
    log(f'low band (bed) {bt0[0]:.1f} dB -> {bt1[0]:.1f} dB (low gain {20 * np.log10(g_low):+.1f} dB)')

    fade = np.ones(N)
    fade[FADE_START:] = np.cos(np.linspace(0, np.pi / 2, N - FADE_START)) ** 2
    bed *= fade
    sfx *= fade
    mix = bed + sfx

    # stems: common gain so each stem and their 1:1 sum stay <= -1 dBFS
    c = 10 ** (-1 / 20) / max(np.max(np.abs(mix)), np.max(np.abs(bed)), np.max(np.abs(sfx)))
    write24(os.path.join(HERE, 'music_bed.wav'), bed * c)
    write24(os.path.join(HERE, 'sfx.wav'), sfx * c)
    log(f'stems written (common stem gain {20 * np.log10(c):+.1f} dB)')

    # master: glue compression -> loudness -> true-peak limiter (iterate to -14 LUFS)
    y, gr_max, gr_avg = glue(mix * c)
    y = y * 10 ** ((-14 - lufs(y)) / 20)
    ceiling = -1.3
    for it in range(6):
        z = limiter(y, ceiling)
        L = lufs(z)
        tp = true_peak_db(z)
        log(f'  master iter {it}: {L:.2f} LUFS, TP {tp:.2f} dBTP')
        if tp > -1.05:
            ceiling -= 0.2
            continue
        if abs(L + 14) < 0.05:
            break
        y = y * 10 ** ((-14 - L) / 20)
    master = z
    write24(os.path.join(HERE, 'music.wav'), master)
    log('master written')

    # ------------------------------------------------ report
    def ff(path):
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
                            'loudnorm=I=-14:TP=-1:print_format=json', '-f', 'null', '-'],
                           capture_output=True, text=True)
        txt = r.stderr
        j = json.loads(txt[txt.rfind('{'):txt.rfind('}') + 1])
        return j
    fm = ff(os.path.join(HERE, 'music.wav'))
    fb = ff(os.path.join(HERE, 'music_bed.wav'))
    fs = ff(os.path.join(HERE, 'sfx.wav'))

    R = []
    R.append('ASIAD 2026 - ORIGINAL SCORE - RENDER REPORT')
    R.append('=' * 64)
    R.append(f'150 BPM, 4/4, beat 0.4 s; 101 bars = 161.6 s; files {N / SR:.1f} s @ 48 kHz / 24-bit stereo')
    R.append(f'Shots in timeline: {len(SHOTS)}   gaps (pre-hit silences): {len(GAPS)}')
    R.append('')
    R.append('LOUDNESS (ffmpeg loudnorm analysis, first pass)')
    for nm, j in (('music.wav (master)', fm), ('music_bed.wav', fb), ('sfx.wav', fs)):
        R.append(f'  {nm:<20} I = {float(j["input_i"]):6.2f} LUFS   TP = {float(j["input_tp"]):6.2f} dBTP   '
                 f'LRA = {float(j["input_lra"]):5.2f} LU')
    R.append(f'  internal BS.1770 meter on master: {lufs(master):.2f} LUFS, true peak (4x) {true_peak_db(master):.2f} dBTP')
    R.append(f'  glue compressor: 2:1, max GR {gr_max:.1f} dB, avg GR on loud passages {gr_avg:.1f} dB; limiter ceiling {ceiling:.1f} dBTP')
    R.append(f'  stem peaks: bed {20 * np.log10(np.max(np.abs(bed * c))):.1f} dBFS, sfx {20 * np.log10(np.max(np.abs(sfx * c))):.1f} dBFS '
             '(stems summed 1:1 = pre-master mix)')
    R.append(f'  stereo: master L/R correlation {np.corrcoef(master[0], master[1])[0, 1]:.2f}, side/mid '
             f'{20 * np.log10(np.std(master[0] - master[1]) / np.std(master[0] + master[1])):.1f} dB')
    R.append(f'  sfx level: set so sfx RMS is 6.0 dB under the drum bus in +/-100 ms around each transition')
    R.append('')
    R.append('BAND ENERGY (dB relative to total 20 Hz-20 kHz energy)')
    R.append('  band            bed(pre-EQ)   bed      sfx     master')
    btm = band_table(master)
    bts = band_table(sfx)
    for k, (lo, hi) in enumerate(BANDS):
        R.append(f'  {lo:>5}-{hi:<6} Hz   {bt0[k]:7.1f}  {bt1[k]:7.1f}  {bts[k]:7.1f}  {btm[k]:7.1f}')
    R.append(f'  low-band rebalance applied to both stems: {20 * np.log10(g_low):+.1f} dB below 120 Hz (zero-phase split)')
    R.append('')
    R.append('SECTION LEVEL BY BUS (K-weighted RMS dB, pre-master, before section automation, diagnostic)')
    R.extend('  ' + d for d in diag)
    R.append('')
    R.append('ONSET CHECK on music.wav: for each shot t0, strongest transient-band (1.5-12 kHz) energy rise within +/-30 ms')
    R.append('  onset = measured onset - t0 (2 ms window vs preceding 5 ms); pass = |onset| <= 15 ms and rise >= 6 dB')
    R.append('  low dB = 40-200 Hz energy in the 10 ms after t0 vs the 10 ms ending 5 ms before t0 (body weight of the hit)')
    R.append('  peak = position of max |x| within t0-5..+40 ms')
    R.append(f'  {"#":>3} {"id":<14}{"kind":<8}{"t0 (s)":>8}{"onset ms":>10}{"rise dB":>9}{"low dB":>8}{"peak ms":>9}  status')
    res = onset_check(master, [sh['b0'] * SPB for sh in SHOTS])
    misses = []
    for k, (sh, (off, rise, lowr, pk)) in enumerate(zip(SHOTS, res)):
        ok = abs(off) <= 15 and rise >= 6
        if not ok:
            misses.append(sh['id'])
        R.append(f'  {k:>3} {sh["id"]:<14}{sh["kind"]:<8}{sh["t0"]:8.2f}{off:10.1f}{rise:9.1f}{lowr:8.1f}{pk:9.1f}  {"OK" if ok else "MISS"}')
    R.append(f'  => {len(SHOTS) - len(misses)}/{len(SHOTS)} shots pass' + (f'; misses: {", ".join(misses)}' if misses else '; no misses'))
    R.append('')
    R.append('EXTRA HITS (not shots): title slam bar 4, number accents bars 8/9/10, huge hit bar 93, final hit bar 98')
    extra = [4, 8, 9, 10, 93, 98]
    for bar, (off, rise, lowr, pk) in zip(extra, onset_check(master, [T(b) for b in extra])):
        R.append(f'  bar {bar:>3} t={T(bar) / SR:7.2f}s  onset {off:6.1f} ms  rise {rise:5.1f} dB  low {lowr:5.1f} dB')
    R.append('')
    R.append('PRE-HIT GAPS (bed RMS in the 0.2 s before each big hit vs the 0.4 s before that; drums+bass muted)')
    for s in sorted(GAPS):
        a1, b1 = s - int(0.18 * SR), s - int(0.02 * SR)
        a0, b0 = s - int(0.6 * SR), s - int(0.22 * SR)
        r1 = np.sqrt(np.mean(bed[:, a1:b1] ** 2)) + 1e-12
        r0 = np.sqrt(np.mean(bed[:, a0:b0] ** 2)) + 1e-12
        R.append(f'  hit @ {s / SR:7.2f}s (bar {s // BARS:>3})  gap level {20 * np.log10(r1 / r0):6.1f} dB vs groove')
    R.append('')
    R.append('NOTES')
    R.append('  * Timeline has the cycling 2-beat cards at beats 308-314 = bars 77-78 (brief said 76-77); accents follow the timeline.')
    R.append('  * Shot 0 (t=0) cannot carry a lead-in whoosh; it gets an sfx impact + odaiko heartbeat at sample 0 instead.')
    R.append(f'  * Render time {time.time() - T_START:.0f} s.')
    open(os.path.join(HERE, 'report.txt'), 'w').write('\n'.join(R) + '\n')
    log('report written')
    print('\n'.join(R))


if __name__ == '__main__':
    main()
