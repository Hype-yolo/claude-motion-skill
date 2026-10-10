"""The Bell Founder — original score (woodcut demo).

Solemn, minimal: low strings (contrabass / cellos / spiccato / pizz; violas only after the bell),
wooden percussion (log drum, woodblock, frame drum), gran cassa / timpani, one low tam-tam at 39.0,
and a SYNTHESISED ANVIL (numpy modal synthesis) for the forge rhythm.
CORE RULE: no bell-like tone anywhere before the foley bell at 47.333; tubular bells / hand chimes only after 48.333.
Key: D minor (dorian colour) -> D major after 48.333. Motif A: D-F-E-A(down)-D  /  D-F#-E-A(down)-D.

Run (any cwd):  .venv/bin/python styles/woodcut/demo/music/score.py
Writes: score.wav, stems/{strings,perc,bells,forge}.wav, score.json, CREDITS.txt  (all 48 kHz stereo, 58.5 s)
Timing comes from ../timeline.json (single source of truth).
"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from core.audio import sampler as S
from core.audio.sfx import SR

os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
S.seed(11)
rng = np.random.default_rng(1911)

# ---------------- timeline ----------------
TL = json.load(open(os.path.join(HERE, '..', 'timeline.json')))

def snap(t):
    """timeline stores thirds as 4-decimal values (28.3333) -> snap to exact thirds"""
    r = round(t * 3) / 3
    return r if abs(r - t) < 1e-3 else float(t)

K = {k: snap(v) for k, v in TL['keys'].items()}
G = {g['id']: dict(g, t0=snap(g['t0']), t1=snap(g['t1'])) for g in TL['grid']}
DUR = float(TL['dur'])
N = int(round(DUR * SR))

T_B = G['B']['t0']            # 3.0     60 BPM
T_C = G['C']['t0']            # 23.0    90 BPM
T_CUT = K['clunk']            # 28.3333 dead cut
T_D = G['D']['t0']            # 32.3333 60 BPM
T_E = G['E']['t0']            # 36.3333 90 BPM
T_F = G['F']['t0']            # 44.3333 digital silence
T_H = G['H']['t0']            # 48.3333 60 BPM, strings in the bell decay
T_END = K['endcard']          # 55.0    final chord
B60, B90 = 1.0, 2 / 3
E90, S90 = B90 / 2, B90 / 4   # 8th, 16th at 90

def idx(t):
    return int(round(t * SR))

STEMS = {k: np.zeros((N, 2), np.float32) for k in ['strings', 'perc', 'bells', 'forge']}
EV = []
KEY = {}

def key(name, t):
    if isinstance(t, (list, tuple)):
        KEY[name] = [round(float(x), 4) for x in t]
    elif name in KEY:
        v = KEY[name]
        KEY[name] = (v if isinstance(v, list) else [v]) + [round(t, 4)]
    else:
        KEY[name] = round(t, 4)

# ---------------- placement ----------------
def section_end(t):
    """every event is hard-cropped at the end of its section so no tail leaks into a silence"""
    if t < T_CUT: return T_CUT
    if t < T_F: return T_F
    return DUR

def onset_of(x):
    a = np.abs(x[:int(.3 * SR)])
    if a.max() <= 0: return 0
    return int(np.argmax(a > .1 * a.max()))

def place(stem, x, t, gain=1.0, pan=0.0, comp=True, jitter=0.0):
    """put mono x at time t (its own detected onset lands on t when comp=True)"""
    t_eff = t + (rng.uniform(-jitter, jitter) if jitter else 0.0)
    s = idx(t_eff) - (onset_of(x) if comp else 0)
    end = idx(section_end(t))
    x = np.asarray(x, np.float32).copy()
    if s < 0: x = x[-s:]; s = 0
    if s + len(x) > end:
        n = max(0, end - s); x = x[:n]
        f = min(n, int(.02 * SR))
        if f: x[-f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
    if not len(x): return
    EV.append((stem, t, s, x[:int(.5 * SR)] * gain))   # dry probe copy for the onset self-check
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    STEMS[stem][s:s + len(x), 0] += x * gain * l
    STEMS[stem][s:s + len(x), 1] += x * gain * r

def shape(x, pts):
    """multiply by piecewise-linear gain envelope [(t, g), ...]"""
    tt = np.arange(len(x)) / SR
    a, b = zip(*pts)
    return (x * np.interp(tt, a, b)).astype(np.float32)

def vv(v, a=.05):
    return float(np.clip(v + rng.uniform(-a, a), .05, 1))

# instrument shorthands ---------------------------------------------------
def cb(t, p, d, v=.4, g=1.0, att=.3, pan=.2):            # contrabass long
    place('strings', S.note('contrabass', p, d, vel=v, attack=att), t, g, pan, comp=att < .05)

def vc(t, p, d, v=.45, g=1.0, att=.15, pan=-.15):         # cellos long
    place('strings', S.note('cellos', p, d, vel=v, attack=att), t, g, pan, comp=att < .05)

def va(t, p, d, v=.4, g=1.0, att=.8, pan=-.4):            # violas (after the bell only)
    assert t >= T_H
    place('strings', S.note('violas', p, d, vel=v, attack=att), t, g, pan, comp=att < .05)

def spic(t, p, v=.55, g=1.0, pan=-.2, j=0.0):
    place('strings', S.note('cellos_spic', p, .3, vel=vv(v)), t, g, pan, jitter=j)

def cbpizz(t, p, v=.55, g=1.0, pan=.2):
    place('strings', S.note('contrabass_pizz', p, 1.6, vel=vv(v, .03)), t, g, pan)

def fdrum(t, kind='large', v=.4, g=1.0, pan=-.1, j=0.0):
    place('perc', S.hit('frame_drum', kind, vel=vv(v, .03)), t, g, pan, jitter=j)

def logd(t, kind='lo', v=.4, g=1.0, pan=.2):
    place('perc', S.hit('log_drum', kind, vel=vv(v, .03)), t, g, pan)

def wblock(t, v=.45, var='a', g=1.0, pan=.35):
    place('perc', S.hit('woodblock', var, vel=vv(v, .03)), t, g, pan)

def gcassa(t, kind='hit', v=.7, g=1.0, pan=0.0):
    place('perc', S.hit('gran_cassa', kind, vel=v), t, g, pan)

def timp(t, p, v=.6, g=1.0, pan=.1, d=2.5, j=0.0):
    place('perc', S.note('timpani', p, d, vel=vv(v, .03)), t, g, pan, jitter=j)

# ---------------- synthetic anvil (modal synthesis, short & dry = struck iron, not a bell) -------------
RATIOS = np.array([1.0, 2.76, 5.40, 8.93, 13.34])
ANVIL = {  # amps, T60 (s) per partial, hammer thud, click
    'ting': (np.array([.40, .70, .50, .28, .12]), np.array([.30, .20, .13, .08, .05]), .00, .45),
    'TANG': (np.array([1.0, .55, .38, .22, .10]), np.array([.55, .36, .22, .13, .07]), .35, .60),
    'BIG':  (np.array([1.0, .65, .48, .32, .16]), np.array([.80, .50, .30, .18, .10]), .70, .80),
}
F_ANVIL = 1175.0   # ~D6: iron clang sits in the key, but with inharmonic partials & fast decay

def anvil(kind='ting', vel=.7):
    amps, t60, thud, click = ANVIL[kind]
    L = int((t60.max() * 1.4 + .05) * SR)
    t = np.arange(L) / SR
    f0 = F_ANVIL * (1 + rng.normal(0, .0015))
    bright = .55 + .45 * vel                      # harder hit -> more upper partials
    y = np.zeros(L)
    for i, (r, a, T) in enumerate(zip(RATIOS, amps, t60)):
        f = f0 * r * (1 + rng.normal(0, .001))
        if f > 20000: continue
        y += a * bright ** i * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * np.exp(-6.91 * t / T)
    # hammer click: 4 ms high-passed noise burst
    nc = int(.004 * SR)
    c = rng.normal(0, 1, nc + 1); c = np.diff(c) * np.exp(-np.arange(nc) / (nc / 4))
    y[:nc] += click * vel * c
    # hammer mass thud (iron on iron has a dull body under the ring)
    if thud:
        y += thud * np.sin(2 * np.pi * 150 * t) * np.exp(-t / .03)
    # short metallic rattle in the first 40 ms (keeps it 'iron', not 'bell')
    nr = int(.04 * SR)
    y[:nr] += .06 * rng.normal(0, 1, nr) * np.exp(-np.arange(nr) / (nr / 5))
    y[:48] *= np.linspace(0, 1, 48)
    y = y / np.abs(y).max() * (vel ** 1.2)
    return y.astype(np.float32)

def forge(t, kind='ting', v=.6, g=1.0, pan=.25, j=0.0):
    place('forge', anvil(kind, vv(v, .04)), t, g, pan, jitter=j)

# ============================================================================
# C0  0 - 3.0 : nothing
# ============================================================================

# ============================================================================
# C1  3.0 - 9.0  contrabass D drone pp fading in; frame drum 3 / 5 / 7
# ============================================================================
cb(T_B, 'D2', 6.6, v=.35, g=.85, att=3.0, pan=.15)           # D2 drone, fades in over 3 s
cb(T_B, 'D1', 15.6, v=.4, g=.75, att=4.0, pan=.25)           # D1 floor to 19.0 (transposed from F#1)
key('C1_bass_in', T_B)
for t in [T_B, T_B + 2, T_B + 4]:
    fdrum(t, 'large', .28, .55)
key('C1_frame', [T_B, T_B + 2, T_B + 4])

# ============================================================================
# C2  9.0 - 15.0  motif A (cellos, low) D2-F2-E2-A1-D2, contrabass unison shadow; log drum 9 / 13
# ============================================================================
T2 = K['print_land']                                          # 9.0
MOTIF_C2 = [('D2', 0.0, 1.5), ('F2', 1.5, 1.5), ('E2', 3.0, 1.5), ('A1', 4.5, 1.5), ('D2', 6.0, 1.0)]
for i, (p, o, d) in enumerate(MOTIF_C2):
    v = .34 + .05 * min(i, 2)                                  # pp -> p
    at = .04 if i == 0 else .12                                # first note onset-aligned to exactly 9.0
    vc(T2 + o, p, d + .15, v=v, g=.95, att=at)
    cb(T2 + o, p, d + .15, v=v * .8, g=.45, att=at, pan=.2)   # celli e bassi (carries the A1)
key('C2_motif_start', T2)
key('C2_motif_notes', [T2 + o for _, o, _ in MOTIF_C2])
logd(T2, 'lo', .35, .8)
logd(T2 + 4, 'lo', .28, .7)
key('C2_log', [T2, T2 + 4])

# ============================================================================
# C3  15.0 - 19.0  solo-ish cello long notes A2 -> D3; frame drum large_muted heartbeat each beat
# ============================================================================
T3 = K['cut_hands']                                           # 15.0
vc(T3 + 1.0, 'A2', 1.6, v=.38, g=.9, att=.25, pan=-.2)
vc(T3 + 2.5, 'D3', 1.9, v=.4, g=.9, att=.3, pan=-.2)
cb(T3, 'D2', 4.1, v=.3, g=.6, att=.8, pan=.15)                # pedal returns under the solo line
key('C3_cello', [T3 + 1.0, T3 + 2.5])
for k in range(4):
    fdrum(T3 + k, 'large_muted', .3, .5, pan=0)
    fdrum(T3 + k + .22, 'large_muted', .18, .32, pan=0)       # "lub-dub"
key('C3_heartbeat', [T3 + k for k in range(4)])

# ============================================================================
# C4  19.0 - 23.0  contrabass pizz each beat; woodblock accelerating run from 22.0 into 23.0
# ============================================================================
T4 = K['gift_pot']                                            # 19.0
for k, p in enumerate(['D2', 'A1', 'D2', 'A1']):
    cbpizz(T4 + k, p, .55 if k % 2 == 0 else .48, 1.5)
key('C4_pizz', [T4 + k for k in range(4)])
vc(T4, 'A2', 4.0, v=.3, g=.45, att=1.2, pan=-.25)             # faint held fifth (keeps it thin under L2)
RUN = [22.0, 22.25, 22.5, 22.0 + 2 / 3, 22.0 + 5 / 6, 22.0 + 11 / 12]   # 16ths @60 -> 16ths @90 -> 32nd
RUN = [T4 + 3 + (t - 22.0) for t in RUN]
for i, t in enumerate(RUN):
    wblock(t, .32 + .07 * i, 'a' if i % 2 == 0 else 'b', .95)
key('C4_woodblock_run', RUN)

# ============================================================================
# C5  23.0 - 28.3333 (90 BPM)  forge rhythm: anvil "ting-ting-TANG", frame drum 8ths, cellos spiccato
# ============================================================================
T5 = K['furnace']                                             # 23.0
BAR90 = 4 * B90
# anvil: [TANG . ting ting TANG . ting ting] per bar (8ths)
PAT5 = {0: 'TANG', 2: 'ting', 3: 'ting', 4: 'TANG', 6: 'ting', 7: 'ting'}
n8 = int(round((T_CUT - T5) / E90))                           # 16 eighths
for k in range(n8):
    t = T5 + k * E90
    kind = PAT5.get(k % 8)
    if kind:
        v = (.78 if kind == 'TANG' else .42 + .06 * (k % 8 in (3, 7))) + .04 * (k // 8)
        forge(t, kind, v, .9, j=0 if kind == 'TANG' else .004)
    fdrum(t, 'large' if k % 2 == 0 else 'small', .45 if k % 2 == 0 else .3, .8, j=0 if k % 2 == 0 else .004)
key('C5_anvil_first', T5)
key('C5_forge_tang', [T5 + k * E90 for k in range(n8) if PAT5.get(k % 8) == 'TANG'])
# spiccato ostinato (8ths)
OST5 = ['D3', 'D3', 'A2', 'D3', 'F3', 'D3', 'E3', 'D3',        # bar 1  Dm
        'D3', 'D3', 'A2', 'D3', 'C3', 'C3', 'A2', 'C#3']       # bar 2  Dm | C (smash) -> A (V, never resolved)
for k, p in enumerate(OST5):
    t = T5 + k * E90
    spic(t, p, .5 + (.12 if k % 2 == 0 else 0) + .03 * (k // 8), .95)
    if k >= 4: spic(t, S.midi(p) - 12, .45, .55, pan=-.05)     # low octave joins with the colour
key('C5_spic_start', T5)
# 24.3333 low string chord swell (first colour)
TG = K['glow']
cb(TG, 'D2', (K['pour1'] - TG) + .1, v=.5, g=.8, att=1.1)
vc(TG, 'D3', (K['pour1'] - TG) + .1, v=.45, g=.75, att=1.1, pan=-.25)
vc(TG, 'A3', (K['pour1'] - TG) + .1, v=.42, g=.6, att=1.2, pan=-.05)
key('C5_glow_swell', TG)
# 25.6667 pour 1: gran cassa + low strings sfz
TP = K['pour1']
gcassa(TP, 'hit', .8, 1.1)
sfz = [(0, 1.0), (.18, 1.0), (.45, .38), (5, .38)]
for inst, p, g, pan in [('contrabass', 'D2', .9, .2), ('contrabass', 'D1', .55, .25), ('cellos', 'D2', .8, -.2),
                        ('cellos', 'A2', .7, -.1), ('cellos', 'F3', .55, -.3)]:
    place('strings', shape(S.note(inst, p, K['smash'] - TP + .05, vel=.9), sfz), TP, g, pan)
key('C5_pour1_hit', TP)
# 27.0 mould smash: accent (C chord stab + drum + heavy anvil already on the grid)
TS = K['smash']
gcassa(TS, 'hit', .6, .75)
fdrum(TS, 'large', .8, 1.0)
for inst, p, g, pan in [('contrabass', 'C2', .8, .2), ('cellos', 'C3', .7, -.2), ('cellos', 'G3', .55, -.3)]:
    place('strings', shape(S.note(inst, p, .5, vel=.85), [(0, 1), (.12, 1), (.4, .2), (1, 0)]), TS, g, pan)
key('C5_smash', TS)
# 27.6667 reveal: dominant A swells ... and is cut dead at 28.3333
TR = K['reveal1']
cb(TR, 'A1', T_CUT - TR + .1, v=.55, g=.85, att=.5)
vc(TR, 'A2', T_CUT - TR + .1, v=.5, g=.7, att=.5, pan=-.2)
vc(TR, 'E3', T_CUT - TR + .1, v=.45, g=.55, att=.5, pan=-.3)
key('C5_reveal_dominant', TR)
key('C5_cut', T_CUT)

# ============================================================================
# C8  32.3333 - 36.3333 (60 BPM)  fragile solo cello motif A, octave up: D3-F3-E3-A2-(D3 on 36.333)
# ============================================================================
T8 = K['click']                                               # 32.3333
MOTIF_C8 = [('D3', 0.0, 1.5), ('F3', 1.5, 1.0), ('E3', 2.5, 1.0), ('A2', 3.5, .5)]
for i, (p, o, d) in enumerate(MOTIF_C8):
    x = S.note('cellos', p, d + .12, vel=.36, attack=.4 if i == 0 else .1)
    if p == 'E3':      # E3 is held across 35.5 (compass drop): dip under the foley instead of a new attack
        x = shape(x, [(0, 1), (.45, 1), (.67, .55), (.9, .8), (5, .8)])
    place('strings', x, T8 + o, 1.25, -.25, comp=False)
place('strings', S.note('cellos', 'D3', 2.2, vel=.42, attack=.08), T_E, 1.0, -.25, comp=False)  # resolves on C9 downbeat
cb(T8 + .25, 'D2', T_E - T8 + .5, v=.3, g=.85, att=1.2, pan=.15)
key('C8_cello_in', T8)
key('C8_motif_notes', [T8 + o for _, o, _ in MOTIF_C8] + [T_E])

# ============================================================================
# C9  36.3333 - 44.3333 (90 BPM)  anvil 16ths + frame drum + doubled spiccato; roll 37.667-39.0;
#     39.0 low strings ff + the only gong + big anvil; energy to 41.667; D drone; fade 43.0-44.333
# ============================================================================
T9 = K['bellows2']                                            # 36.3333
TL2, TP2, TR2 = K['lift'], K['pour2'], K['reveal2']           # 37.6667, 39.0, 41.6667
n16 = int(round((TR2 - T9) / S90))                            # 32 sixteenths (2 bars)
ACC = [1.0, .34, .55, .42]
for k in range(n16):
    t = T9 + k * S90
    if abs(t - TP2) < 1e-6:
        forge(t, 'BIG', 1.0, 1.25, pan=.2)
        continue
    cres = .62 + .3 * min(1, k / 16)                          # bar 1 crescendo, bar 2 full
    kind = 'TANG' if k % 4 == 0 else 'ting'
    forge(t, kind, ACC[k % 4] * cres + (.05 if kind == 'TANG' else 0), .95, j=0 if kind == 'TANG' else .003)
forge(TR2, 'TANG', .85, 1.0, pan=.2)                          # last blow marks the drop
key('C9_anvil16_start', T9)
key('C9_big_anvil', TP2)
key('C9_last_anvil', TR2)
# frame drum 8ths
n8 = int(round((TR2 - T9) / E90))
for k in range(n8):
    t = T9 + k * E90
    fdrum(t, 'large' if k % 2 == 0 else 'small', (.5 if k % 2 == 0 else .34) + .1 * (t >= TP2), .85,
          j=0 if k % 2 == 0 else .004)
fdrum(TR2, 'large', .6, .9)
# doubled spiccato ostinato (8ths, octaves)
HARM9 = {0: 'D', 12: 'G', 14: 'C'}   # bar 2: Dm (39.0) -> G (40.333, dorian IV) -> C (41.0) -> D drone 41.667
OST9 = {'D': ['D3', 'D3', 'A2', 'D3', 'F3', 'D3', 'E3', 'D3'], 'G': ['G2', 'B2', 'D3', 'B2'], 'C': ['C3', 'E3', 'G2', 'E3']}
cur, pos = 'D', 0
for k in range(n8):
    if k in HARM9 and (k != 0): cur, pos = HARM9[k], 0
    if k == 8: pos = 0
    p = OST9[cur][pos % len(OST9[cur])]; pos += 1
    t = T9 + k * E90
    acc = .12 if k % 2 == 0 else 0
    spic(t, p, .58 + acc + .08 * (t >= TP2), 1.0, pan=-.25)
    spic(t, S.midi(p) - 12, .52 + acc + .08 * (t >= TP2), .8, pan=-.05)
key('C9_spic_start', T9)
# roll 37.6667 -> 39.0: timpani (A2) + gran cassa roll, crescendo
nroll = int(round((TP2 - TL2) / (S90 / 3)))                    # 24 strokes
for i in range(nroll):
    t = TL2 + i * (S90 / 3)
    timp(t, 'A2', .25 + .6 * (i / nroll) ** 1.5, .8, pan=.15, d=1.2, j=0 if i == 0 else .004)
roll = S.hit('gran_cassa', 'roll', vel=.8)[:int((TP2 - TL2) * SR) + 2000]
roll = shape(roll, [(0, .15), (TP2 - TL2 - .02, 1.0), (TP2 - TL2, 0), (99, 0)])
place('perc', roll, TL2, 1.0, 0)
key('C9_roll_start', TL2)
# 39.0 pour 2 : full low strings ff + low gong (the ONLY gong) + gran cassa + timpani D
gcassa(TP2, 'hit', 1.0, 1.2)
timp(TP2, 'D3', .95, 1.1, d=3.0)
gong = S.hit('gong', None, vel=.95)
gong = resample_poly(gong, 4, 3).astype(np.float32)            # down a fourth -> low tam-tam
place('perc', gong, TP2, 1.05, -.05)
key('C9_gong', TP2)
ff = [(0, 1.0), (1.2, .85), (99, .85)]
for inst, p, g, pan in [('contrabass', 'D2', 1.0, .2), ('contrabass', 'D1', .6, .25), ('cellos', 'D2', .9, -.15),
                        ('cellos', 'A2', .8, -.1), ('cellos', 'D3', .75, -.25), ('cellos', 'F3', .6, -.3)]:
    place('strings', shape(S.note(inst, p, 4 * E90 + .1, vel=.95, attack=.02), ff), TP2, g, pan)
for t0, t1, notes in [(TP2 + 4 * E90, TP2 + 6 * E90, [('contrabass', 'G1'), ('cellos', 'G2'), ('cellos', 'B2'), ('cellos', 'D3')]),
                      (TP2 + 6 * E90, TR2, [('contrabass', 'C2'), ('cellos', 'C3'), ('cellos', 'E3'), ('cellos', 'G3')])]:
    for j, (inst, p) in enumerate(notes):
        place('strings', S.note(inst, p, t1 - t0 + .1, vel=.9, attack=.03), t0, .9 - .08 * j, .2 if inst == 'contrabass' else -.2)
key('C9_pour2_hit', TP2)
key('C9_strings_ff', TP2)
key('C9_chords', [TP2, TP2 + 4 * E90, TP2 + 6 * E90])
# 41.6667 drop to a D drone
cb(TR2, 'D2', T_F - TR2 + .5, v=.5, g=.9, att=.04)
vc(TR2, 'D3', T_F - TR2 + .5, v=.4, g=.7, att=.04, pan=-.2)
vc(TR2, 'A2', T_F - TR2 + .5, v=.36, g=.6, att=.04, pan=-.1)
key('C9_drop_drone', TR2)
key('C9_fade', [K['pull2'], T_F])

# ============================================================================
# C12 48.3333 - 58.5 (60 BPM)  strings in the bell's decay, D major; motif A major (D-F#-E-A-D) slow;
#      tubular bells D4/A4 + hand chime D5 echo the bell; final D major chord on 55.0
# ============================================================================
TH = T_H
MOTIF_H = [('D3', 0.0, 2.0), ('F#3', 2.0, 1.5), ('E3', 3.5, 1.5), ('A2', 5.0, T_END - TH - 5.0)]
for i, (p, o, d) in enumerate(MOTIF_H):
    v = .42 if i < 2 else .34                                   # thinner under L4 (51.8-54.2)
    place('strings', S.note('cellos', p, d + .2, vel=v, attack=.8 if i == 0 else .35), TH + o, 1.25, -.2, comp=False)
key('H_strings_in', TH)
key('H_motif_notes', [TH + o for _, o, _ in MOTIF_H] + [T_END])
cb(TH, 'D2', 5.2, v=.36, g=.8, att=1.0)
cb(TH + 5.0, 'A1', T_END - TH - 5.0 + .2, v=.32, g=.75, att=.6)
va(TH, 'A3', 3.6, v=.34, g=.7, att=1.0, pan=-.45)
va(TH + 1.0, 'F#4', 2.6, v=.32, g=.6, att=1.0, pan=-.35)
va(TH + 3.5, 'C#4', T_END - TH - 3.5 + .2, v=.3, g=.55, att=.9, pan=-.4)
va(TH + 3.5, 'E4', T_END - TH - 3.5 + .2, v=.28, g=.5, att=.9, pan=-.3)
key('H_violas_in', TH)
# bell echoes
TB1, TB2 = TH + 1.0, TH + 3.0                                  # 49.3333, 51.3333
place('bells', S.note('tubular_bells', 'D4', 6.0, vel=.35), TB1, .45, -.3)
place('bells', S.note('tubular_bells', 'A4', 6.0, vel=.3), TB2, .38, .3)
place('bells', S.note('hand_chimes', 'D5', 5.0, vel=.35), TB2, .45, .1)
key('H_tubular', [TB1, TB2])
key('H_hand_chime', TB2)
# 55.0 final cadence: D major with low D, rings to 58.5
FIN = [('contrabass', 'D1', .55, .25), ('contrabass', 'D2', .75, .2), ('cellos', 'D3', .7, -.15), ('cellos', 'A3', .6, -.1),
       ('violas', 'F#4', .55, -.35), ('violas', 'D4', .5, -.45), ('violas', 'A4', .45, -.3)]
for inst, p, g, pan in FIN:
    place('strings', S.note(inst, p, DUR - T_END - .3, vel=.5, attack=.03, release=1.2), T_END, g * .65, pan, comp=True)
key('H_final_chord', T_END)
key('end', DUR)

# ============================================================================
# reverb, silence gates (AFTER reverb), export
# ============================================================================
REV = {'strings': (.55, .17), 'perc': (.48, .14), 'bells': (.6, .2), 'forge': (.35, .1)}
GAIN = {'strings': 1.0, 'perc': .95, 'bells': 1.4, 'forge': .8}
tt = np.arange(N) / SR
env = np.ones(N)
def ramp(a, b, g0, g1):
    i0, i1 = idx(a), idx(b)
    x = np.linspace(0, 1, i1 - i0, endpoint=False)
    env[i0:i1] = np.minimum(env[i0:i1], g0 + (g1 - g0) * (0.5 - 0.5 * np.cos(np.pi * x)))   # raised cosine
def zero(a, b):
    env[idx(a):idx(b)] = 0
zero(0, T_B)                                  # 0 - 3.0 nothing
ramp(T_CUT - .02, T_CUT, 1, 0)                # 20 ms dead cut ending exactly at 28.3333
zero(T_CUT, T_D)                              # silence 1 (digital)
ramp(K['pull2'], T_F, 1, 0)                   # 43.0 -> 44.3333 fade
zero(T_F, T_H)                                # silence 2 + the bell alone
ramp(DUR - 1.0, DUR, 1, 0)                    # last-second taper
env[-1] = 0
ENV = {k: env.copy() for k in STEMS}
ENV['bells'][:idx(T_H)] = 0                   # bell family: hard zero before 48.3333 (kills FFT-reverb noise floor)

out = {}
for k, x in STEMS.items():
    y = S.room(x, *REV[k]) * GAIN[k]
    out[k] = (y * ENV[k][:, None]).astype(np.float32)
mix = sum(out.values())
pk = float(np.abs(mix).max())
g = (10 ** (-1.3 / 20)) / pk
for k in out:
    out[k] = (out[k] * g).astype(np.float32)
    sf.write(os.path.join(HERE, 'stems', k + '.wav'), out[k], SR, subtype='FLOAT')
mix = sum(out.values()).astype(np.float32)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR, subtype='FLOAT')
json.dump({'sr': SR, 'dur': DUR, 'keys': KEY}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
USED = ['contrabass', 'cellos', 'cellos_spic', 'contrabass_pizz', 'violas', 'log_drum', 'woodblock', 'frame_drum',
        'gran_cassa', 'timpani', 'gong', 'tubular_bells', 'hand_chimes']
open(os.path.join(HERE, 'CREDITS.txt'), 'w').write(
    'The Bell Founder - original score (woodcut demo)\n\n' + '\n'.join(S.credits(USED)) +
    '\nAnvil: original numpy modal synthesis (styles/woodcut/demo/music/score.py), no samples.\n')

# ============================================================================
# self-check
# ============================================================================
db = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x, dtype=np.float64))) + 1e-12)
seg = lambda x, a, b: x[idx(a):idx(b)]
print('== level ==')
print('peak dBFS %.2f   NaN %s   len %.4f s' % (20 * np.log10(np.abs(mix).max()), bool(np.isnan(mix).any()), len(mix) / SR))
print('stems sum == mix: max diff %.2e' % np.abs(sum(out.values()) - mix).max())
print('== RMS per section (score.wav) ==')
SECS = [('C0', 0, T_B), ('C1', T_B, 9), ('C2', 9, 15), ('C3', 15, 19), ('C4', 19, 23), ('C5', 23, T_CUT),
        ('sil1', T_CUT, T_D), ('C8', T_D, T_E), ('C9a', T_E, K['pour2']), ('C9b', K['pour2'], K['reveal2']),
        ('C9c', K['reveal2'], T_F), ('sil2', T_F, T_H), ('H', T_H, T_END), ('Hend', T_END, DUR)]
for n, a, b in SECS:
    print('  %-5s %7.3f-%7.3f  RMS %6.1f dBFS' % (n, a, b, db(seg(mix, a, b))))
print('== silence windows: max abs (must be < 1e-6) ==')
for a, b in [(0, T_B), (T_CUT, T_D), (T_F, T_H)]:
    print('  %.4f-%.4f  mix %.1e  ' % (a, b, np.abs(seg(mix, a, b)).max()) +
          '  '.join('%s %.1e' % (k, np.abs(seg(out[k], a, b)).max()) for k in out))
print('  28.36 tail check: mix max abs after 28.36 until 32.3333 = %.1e' % np.abs(seg(mix, 28.36, T_D)).max())
print('  bells stem before 48.3333 max abs = %.1e' % np.abs(out['bells'][:idx(T_H)]).max())

from scipy.signal import butter, sosfilt
HP = butter(4, 300, 'hp', fs=SR, output='sos')
HPOUT = {k: np.abs(sosfilt(HP, v.mean(1))) for k, v in out.items()}
def detect(stem, t, win=(-.03, .04)):
    """onset = first 0.5 ms frame whose rise over the previous 10 ms reaches 50% of the largest rise in the
    window (on a 300 Hz high-passed stem so sustained drones / previous tails don't mask the attack)"""
    x = HPOUT[stem]; hop = int(.0005 * SR); lb = 20
    a, b = idx(t + win[0]) - lb * hop, idx(t + win[1])
    fr = x[a:b][:((b - a) // hop) * hop].reshape(-1, hop).max(1)
    rise = np.array([fr[i] - fr[i - lb:i].min() for i in range(lb, len(fr))])
    if rise.max() < 1e-6: return None
    i = np.argmax(rise > .5 * rise.max())
    return (a + (i + lb) * hop) / SR

def probe(stem, t):
    """isolated dry sum of every event scheduled at t (±1 ms) in that stem -> first sample above 10% of its peak"""
    evs = [(s0, x) for st, te, s0, x in EV if st == stem and abs(te - t) < 1e-3]
    if not evs: return None
    a = min(s0 for s0, _ in evs); buf = np.zeros(int(.5 * SR) + max(s0 - a for s0, _ in evs))
    for s0, x in evs: buf[s0 - a:s0 - a + len(x)] += x
    b = np.abs(buf[:int(.3 * SR)])
    return (a + np.argmax(b > .1 * b.max())) / SR

print('== onset check: A = detected in rendered stem (post-reverb, masked by other parts),'
      ' B = isolated dry event of that key (all ms) ==')
CHECK = [('C1_frame', 'perc'), ('C2_log', 'perc'), ('C3_heartbeat', 'perc'), ('C3_cello', 'strings'), ('C4_pizz', 'strings'),
         ('C4_woodblock_run', 'perc'), ('C5_anvil_first', 'forge'), ('C5_forge_tang', 'forge'), ('C5_spic_start', 'strings'),
         ('C5_glow_swell', 'strings'), ('C5_pour1_hit', 'perc'), ('C5_smash', 'perc'), ('C8_cello_in', 'strings'),
         ('C9_anvil16_start', 'forge'), ('C9_spic_start', 'strings'), ('C9_roll_start', 'perc'),
         ('C9_pour2_hit', 'perc'), ('C9_big_anvil', 'forge'), ('C9_strings_ff', 'strings'), ('C9_last_anvil', 'forge'),
         ('C9_drop_drone', 'strings'), ('H_strings_in', 'strings'), ('H_tubular', 'bells'), ('H_hand_chime', 'bells'),
         ('H_final_chord', 'strings'), ('C2_motif_start', 'strings')]
for name, stem in CHECK:
    ts = KEY[name] if isinstance(KEY[name], list) else [KEY[name]]
    ea, eb = [], []
    for t in ts:
        d = detect(stem, t); ea.append(np.nan if d is None else (d - t) * 1000)
        d = probe(stem, t); eb.append(np.nan if d is None else (d - t) * 1000)
    wa = max(ea, key=lambda e: abs(e) if e == e else -1); wb_ = max(eb, key=lambda e: abs(e) if e == e else -1)
    print('  %-18s %-8s n=%-2d  A worst %+6.1f   B worst %+6.1f' % (name, stem, len(ts), wa, wb_))
f_in = lambda st, t: np.argmax(np.abs(out[st][idx(t) - 10:, 0]) > 0) + idx(t) - 10
print('  first nonzero sample after silences: C8 strings %.4f s, H strings %.4f s, H bells %.4f s' % (
    f_in('strings', T_D) / SR, f_in('strings', T_H) / SR, f_in('bells', T_H) / SR))
