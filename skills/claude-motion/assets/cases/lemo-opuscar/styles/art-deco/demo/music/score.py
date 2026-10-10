"""Original symphonic-jazz score for "Midnight at the Starlight Hotel" (art-deco demo).
Piano lead + clarinet + strings + muted trumpet + brushes, 116 BPM foxtrot → accelerating Charleston (116→138) → stop → 12 bells → the song (D♭).
All timings come from ../timeline.json. Run: .venv/bin/python styles/art-deco/demo/music/score.py
Outputs: score.wav, stems/{title,band,bells,whistle}.wav (sum = score.wav), score.json (sync keys + motif), CREDITS_music.txt"""
import sys, os, json
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR, add, bp, lp, hp
from scipy.signal import butter, sosfilt

S.seed(1930)
rng = np.random.default_rng(1930)
TL = json.load(open(os.path.join(HERE, '../timeline.json')))
B, BAR, DUR = TL['B'], TL['BAR'], TL['DUR']
T, SB, STR = TL['T'], TL['STAIR_BEATS'], TL['STRIKES']
KIT0, KB = TL['KIT0'], 60 / TL['K_BPM']
N = int(round(DUR * SR))
kb = lambda k: KIT0 + k * KB
bt = lambda k: k * B
def sbt(p):  # stairwell beat position (float) → time (interpolated on the accelerating grid)
    i = int(np.floor(p)); f = p - i
    if i >= 16: return SB[16] + (p - 16) * (SB[16] - SB[15])
    return SB[i] + f * (SB[i + 1] - SB[i])

def buf(): return np.zeros((N, 2), np.float32)
title, band, bells, whistle, wah = buf(), buf(), buf(), buf(), buf()
USED = set()
KEYS = {}

# sustained samples speak late (bow/breath attack): start them early so the note lands on the grid
LEAD = {'violins': .08, 'violas': .08, 'cellos': .08, 'violins_trem': .08, 'clarinet': .06, 'trombone': .035, 'alto_sax': .05, 'trumpet_mute': .012, 'violins_spic': .02}
def nt(b, t, inst, pitch, dur, vel=.7, pan=0., gain=1., **kw):
    USED.add(inst); x = S.note(inst, pitch, dur, vel, **kw); add(b, x, max(0, t - LEAD.get(inst, 0)), gain, pan); return x
def ht(b, t, inst, var=None, vel=.7, pan=0., gain=1., dur=None):
    USED.add(inst); x = S.hit(inst, var, vel, dur); add(b, x, t, gain, pan); return x
def ch(b, t, inst, pitches, dur, vel=.7, pan=0., gain=1., strum=0., **kw):
    for i, p in enumerate(pitches): nt(b, t + i * strum, inst, p, dur, vel * (1 - .03 * i), pan + (i - len(pitches) / 2) * .06, gain, **kw)
M = S.midi

# ---------- synthesized brushes ----------
def brush_swish(b, t, dur=.28, v=.5, pan=.15):
    n = int(dur * SR); x = rng.standard_normal(n)
    x = sosfilt(butter(2, [1800, 9000], 'band', fs=SR, output='sos'), x)
    tt = np.arange(n) / SR; env = np.minimum(1, tt / (dur * .45)) * np.exp(-np.maximum(0, tt - dur * .45) / (dur * .25))
    add(b, (x * env * .18 * v).astype(np.float32), t, 1, pan)
def brush_tap(b, t, v=.5, pan=.1):
    ht(b, t, 'snare2', 'taps', v, pan, .5)
    n = int(.09 * SR); x = sosfilt(butter(2, [2500, 8000], 'band', fs=SR, output='sos'), rng.standard_normal(n)) * np.exp(-np.arange(n) / SR / .025)
    add(b, (x * .12 * v).astype(np.float32), t, 1, pan)

# ---------- chords & voicings ----------
CH = {  # name: (bass root midi, mid voicing)
    'Bb6': (M('Bb1'), ['D4', 'F4', 'G4', 'Bb4']), 'Bbmaj7': (M('Bb1'), ['D4', 'F4', 'A4']), 'G7': (M('G1'), ['B3', 'D4', 'F4']),
    'Gm7': (M('G1'), ['Bb3', 'D4', 'F4']), 'Cm7': (M('C2'), ['Bb3', 'Eb4', 'G4']), 'F7': (M('F1'), ['A3', 'Eb4', 'F4']),
    'Eb7': (M('Eb2'), ['G3', 'Db4', 'F4']), 'Bb/F': (M('F1'), ['D4', 'F4', 'Bb4']),
    'C6': (M('C2'), ['E4', 'G4', 'A4']), 'A7': (M('A1'), ['G3', 'C#4', 'E4']), 'Dm7': (M('D2'), ['C4', 'F4', 'A4']), 'G7c': (M('G1'), ['F3', 'B3', 'D4']),
    'Dbmaj7': (M('Db2'), ['F3', 'Ab3', 'C4']), 'Bbm7': (M('Bb1'), ['Ab3', 'Db4', 'F4']), 'Gb7': (M('Gb1'), ['Bb3', 'E4', 'Gb4']),
    'Db/Ab': (M('Ab1'), ['F3', 'Ab3', 'Db4']), 'Ebm7': (M('Eb2'), ['Db4', 'Gb4', 'Bb3']), 'Ab7': (M('Ab1'), ['Gb3', 'C4', 'Eb4']), 'Db6': (M('Db2'), ['F3', 'Ab3', 'Bb3']),
}
def stride(b, t, beat, name, vel=.55, gain=1.):
    """piano stride for one half-bar (2 beats): bass octave on beat 1, chord on beat 2."""
    r, v = CH[name]
    nt(b, t, 'piano', r + 12, beat * .8, vel, -.25, gain); nt(b, t, 'piano', r + 24, beat * .8, vel * .8, -.25, gain)
    for p in v: nt(b, t + beat, 'piano', p, beat * .6, vel * .7, .05, gain)
def walk(b, times, names, vel=.6, gain=1.):
    """walking bass: times = beat times; names = chord per beat (approach note on beats leading to a change)."""
    for i, t in enumerate(times):
        r = CH[names[i]][0] + 12
        nxt = CH[names[i + 1]][0] + 12 if i + 1 < len(names) else r
        pos = i % 2
        if i + 1 < len(names) and names[i + 1] != names[i]: p = nxt - 1 if (i % 3) else nxt + 1
        else: p = r + (0 if pos == 0 else 7)
        while p < M('E1'): p += 12
        while p > M('C3'): p -= 12
        nt(b, t, 'jazz_bass', p, (times[i + 1] - t if i + 1 < len(times) else B) * .95, vel * (1.08 if pos == 0 else .95), -.1, gain)

# ================= TITLE 0 → 6.207 (stems/title) =================
def clarinet_gliss():
    L = 2.75; n = int(L * SR); t = np.arange(n) / SR
    m = np.empty(n)
    a = t < .55
    tr = .5 + .5 * np.tanh(4 * np.sin(2 * np.pi * 11 * t))        # trill F3/G3
    m[a] = 53 + 2 * tr[a]
    g0, g1 = .55, T['titleHit']
    u = np.clip((t - g0) / (g1 - g0), 0, 1)
    smooth = 53 + 24 * u ** 1.9
    stepy = 53 + np.floor(24 * u ** 1.9)                              # starts as a chromatic run, melts into a smear
    blend = np.clip(1 - u * 1.6, 0, 1) * .55
    gl = (t >= g0) & (t < g1)
    m[gl] = (smooth * (1 - blend) + stepy * blend)[gl]
    hold = t >= g1
    m[hold] = 77 + .22 * np.sin(2 * np.pi * 5.6 * (t[hold] - g1)) * np.clip((t[hold] - g1) / .3, 0, 1)
    amp = np.where(t < .55, .35 + .15 * t / .55, .5 + .5 * np.clip((t - g0) / (g1 - g0), 0, 1) ** 1.3)
    amp = amp * np.where(t > g1 + .25, np.exp(-(t - g1 - .25) / .18), 1.0)
    amp[:int(.05 * SR)] *= np.linspace(0, 1, int(.05 * SR))
    out = np.zeros(n)
    srcs = [(53, S.note('clarinet', 'F3', 9, .75)), (65, S.note('clarinet', 'F4', 9, .8)), (77, S.note('clarinet', 'F5', 9, .85))]
    USED.add('clarinet')
    ws = [np.clip(1 - (m - 57) / 6, 0, 1), None, np.clip((m - 69) / 6, 0, 1)]
    ws[1] = np.clip(1 - ws[0] - ws[2], 0, 1)
    for (root, y), w in zip(srcs, ws):
        ratio = 2 ** ((m - root) / 12); pos = np.cumsum(ratio) + int(.03 * SR)
        pos = np.minimum(pos, len(y) - 2)
        out += np.interp(pos, np.arange(len(y)), y) * w
    return (out * amp * 1.6).astype(np.float32)
add(title, clarinet_gliss(), 0.0, 1.0, -.08)
# string tremolo bed under the gliss
for p, pan in (('Bb2', -.3), ('F3', -.1)): nt(title, 0.05, 'cellos', p, 2.1, .35, pan, .55, attack=.9)
for p, pan in (('F4', .2), ('D5', .35)): nt(title, 0.1, 'violins_trem', p, 2.0, .3, pan, .45, attack=1.2)
ht(title, T['titleHit'] - .55, 'sus_cymbal', 'roll', .35, .3, .5)
KEYS['titleHit'] = T['titleHit']
# 2.069 full hit: B♭6/9
th = T['titleHit']
ch(title, th, 'piano', ['Bb1', 'Bb2', 'F3', 'D4', 'G4', 'C5', 'D5'], 1.6, .95, 0, .8)
ch(title, th, 'violins', ['D5', 'F5', 'Bb5'], 1.9, .8, .3, .55, release=.8)
ch(title, th, 'violas', ['F4', 'G4'], 1.9, .75, .1, .5, release=.8)
ch(title, th, 'cellos', ['Bb2', 'F3'], 2.0, .8, -.2, .6, release=.9)
ch(title, th, 'trombone', ['Bb2', 'D3', 'G3'], .9, .75, -.1, .45)
ht(title, th, 'crash', None, .85, .25, .6)
ht(title, th, 'bass_drum', None, .7, 0, .6)
# piano states the motif bar 1 over the hit, bar 2 starts then dissolves
for bp_, p, d in ((0, 'F4', 1), (1, 'D5', 1.5), (2.5, 'C5', .5), (3, 'Bb4', 1)):
    nt(title, th + bp_ * B, 'piano', p, d * B * .95, .82, .05, .95); nt(title, th + bp_ * B, 'piano', M(p) + 12, d * B * .95, .55, .15, .6)
nt(title, th + 4 * B, 'piano', 'Db5', B * 1.1, .85, .05, .95); nt(title, th + 4 * B, 'piano', 'Db6', B, .55, .15, .6)
for i, p in enumerate(['Eb5', 'G5', 'Bb5', 'Db6', 'F6', 'G6', 'Bb6', 'Db7']):   # dissolving run
    nt(title, th + 4.5 * B + i * .07, 'piano', p, .4, .5 - i * .03, .1 + i * .05, .7)
KEYS['archOpen'] = T['archOpen']
ao = T['archOpen']
for i, p in enumerate(['Bb4', 'C5', 'D5', 'Eb5', 'F5', 'G5', 'A5', 'Bb5', 'C6', 'D6']):  # string rush up
    nt(title, ao - .36 + i * .04, 'violins_spic', p, .12, .45 + i * .03, .2, .5)
nt(title, ao, 'violins', 'Eb6', 1.0, .5, .3, .45, attack=.05, release=.6)
for i, p in enumerate(['F2', 'Bb3', 'Eb4', 'G4', 'C5']):           # suspended F9sus, hangs over the cut
    nt(title, ao + .1, 'violins' if M(p) > 64 else ('violas' if M(p) > 55 else 'cellos'), p, 1.0, .5, -.2 + i * .1, .45, attack=.25, release=.7)
nt(title, ao + .1, 'harp', 'F2', 1.5, .5, -.3, .5)
for i, p in enumerate(['F3', 'Bb3', 'Eb4', 'G4', 'C5', 'Eb5', 'G5', 'C6']): nt(title, ao + .1 + i * .045, 'harp', p, .9, .5, -.2 + i * .06, .45)

# ================= STREET + LOBBY VAMP 6.207 → 15.517 (band) =================
vamp = buf()
prog = ['Bb6', 'G7', 'Cm7', 'F7']
t0 = bt(12); t_end = T['plaque']
hb = 0
while t0 + hb * 2 * B < t_end - 1e-6:
    t = t0 + hb * 2 * B; name = prog[hb % 4]
    stride(vamp, t, B, name, .5, .8)
    hb += 1
beats = [t0 + k * B for k in range(int(round((t_end - t0) / B)))]
walk(vamp, beats, [prog[(k // 2) % 4] for k in range(len(beats))], .62, .9)
for k, t in enumerate(beats):
    brush_swish(vamp, t, .3 if k % 2 else .22, .8 if k % 2 else .55)
    if k % 2: brush_tap(vamp, t, .45); ht(vamp, t, 'hihat', 'pedal', .35, .3, .5)
# muted trumpet "rehearsal": motif 2 bars from 8.276, cut off on bar 2 beat 2
r0 = bt(16)
for bp_, p, d in ((0, 'F4', 1), (1, 'D5', 1.5), (2.5, 'C5', .5), (3, 'Bb4', 1), (4, 'Db5', 1)):
    nt(vamp, r0 + bp_ * B, 'trumpet_mute', p, d * B * .9, .7, .25, .9)
nt(vamp, r0 + 5 * B, 'trumpet_mute', 'C5', .07, .6, .25, .7, release=.02)          # the note that gets choked
KEYS['sealGlint'] = T['sealGlint']
nt(vamp, T['sealGlint'], 'glockenspiel', 'F6', .8, .75, .35, .7)
nt(vamp, T['sealGlint'] + .06, 'glockenspiel', 'Bb6', .8, .5, .4, .5)
# lobby: soft strings join as he runs in
nt(vamp, bt(24), 'violins', 'D5', 2.6, .3, .3, .3, attack=.6)
nt(vamp, bt(24), 'violas', 'F4', 2.6, .3, .1, .3, attack=.6)
vamp = S.room(vamp, size=.35, mix=.16)
# hard stop at 15.517 (band chokes): 8 ms fade
k0 = int(T['plaque'] * SR); f = int(.008 * SR)
vamp[k0:k0 + f] *= np.linspace(1, 0, f)[:, None]; vamp[k0 + f:] = 0
band += vamp * .9
KEYS['plaque'] = T['plaque']
# wah-wah-waaah (muted trumpet, filter-envelope wah)
def wah_note(t, p, dur, opens):
    x = S.note('trumpet_mute', p, dur, .8, release=.08); USED.add('trumpet_mute')
    dark = lp(x, 650, 2); bright = lp(x, 4200, 1)
    tt = np.arange(len(x)) / SR; env = np.zeros(len(x))
    for (a, w) in opens: env += np.exp(-((tt - a) / w) ** 2)
    env = np.clip(env, 0, 1)
    y = dark * (1 - env) + bright * env
    if dur > .4:   # droop on the last note
        y = y * np.clip(1 - (tt - (dur - .15)) / .2, 0, 1)
    add(band, (y * 1.35).astype(np.float32), t, 1, .2)
wah_note(T['plaque'], 'Bb4', .23, [(.07, .06)])
wah_note(T['plaque'] + B / 2, 'A4', .23, [(.07, .06)])
wah_note(T['plaque'] + B, 'Ab4', .62, [(.08, .07), (.34, .12)])
# make sure 16.75 → 18.103 is digital silence
band[int(16.75 * SR):int(T['snare'] * SR)] = 0

# ================= CHARLESTON (stairwell) 18.103 → 26.199 =================
ch_b = buf()
KEYS['snare'] = T['snare']
ht(ch_b, T['snare'], 'snare2', 'stick', .95, .05, 1.2)
ht(ch_b, T['snare'], 'snare2', 'on', .8, .05, .8)
ch(ch_b, T['snare'], 'piano', ['C3', 'E4', 'G4', 'A4', 'D5'], .25, .9, 0, .9)
ch(ch_b, T['snare'], 'trumpet_mute', ['E5', 'G5'], .2, .8, .25, .6)
cprog = ['C6', 'C6', 'A7', 'A7', 'Dm7', 'G7c', 'C6', 'C6', 'Dm7', 'G7c', 'C6', 'A7', 'Dm7', 'G7c', 'C6', 'G7c']   # per 2 beats (8 half-bars … 16 beats → use per beat below)
bprog = []
for k in range(16): bprog.append(['C6', 'A7', 'Dm7', 'G7c'][(k // 4) % 4] if k < 8 else ['Dm7', 'G7c', 'C6', 'A7', 'Dm7', 'G7c', 'C6', 'G7c'][(k - 8) // 1 % 8])
for k in range(16):
    KEYS[f'stair_{k}'] = SB[k]
duck = lambda t: .45 if 24.85 <= t < 26.45 else 1.0          # make room for L4
for bar in range(4):
    b0 = bar * 4
    names = bprog[b0:b0 + 4]
    # Charleston rhythm: beat 1 and the "and" of 2
    for pos in (b0, b0 + 1.5):
        t = sbt(pos); nm = names[0] if pos == b0 else names[1]
        r, v = CH[nm]
        nt(ch_b, t, 'piano', r + 12, .22, .7, -.25, .9 * duck(t)); nt(ch_b, t, 'piano', r + 24, .22, .6, -.25, .8 * duck(t))
        for p in v: nt(ch_b, t, 'piano', p, .18, .72, .05, .85 * duck(t))
walk(ch_b, [SB[k] for k in range(16)] + [], bprog, .7, .95)
for k in range(16):
    t = SB[k]; d = duck(t)
    if k < 4:
        brush_swish(ch_b, t, .2, .7 if k % 2 else .5)
        if k % 2: brush_tap(ch_b, t, .6)
    else:
        if k % 2: ht(ch_b, t, 'snare2', 'on', .62, .05, .75 * d)
        ht(ch_b, t, 'hihat', 'closed', .5, .3, .5 * d); ht(ch_b, sbt(k + .5), 'hihat', 'closed', .35, .3, .4 * d)
        if k % 2 == 0: ht(ch_b, t, 'bass_drum', None, .5, 0, .55 * d)
# clarinet: motif squeezed into syncopation (C: G4 E5 D5 C5), bars 1–2
cl = [(.5, 'G4', .5), (1, 'E5', 1), (2, 'D5', .5), (2.5, 'C5', 1), (4.5, 'G4', .5), (5, 'E5', .5), (5.5, 'F5', .5), (6, 'Eb5', .5), (6.5, 'D5', .5), (7, 'C5', 1)]
for bp_, p, d in cl:
    t = sbt(bp_); nt(ch_b, t, 'clarinet', p, sbt(bp_ + d) - t, .75, -.2, .75)
# beats 8–11: snare roll crescendo + clarinet chromatic climb + timpani roll
roll_t0, roll_t1 = SB[8], SB[12]
n_r = int((roll_t1 - roll_t0) * 28)
for i in range(n_r):
    t = roll_t0 + i / 28; v = .25 + .6 * i / n_r
    ht(ch_b, t, 'snare2', 'on', v, .05, .45 * (.4 + .6 * i / n_r), dur=.12)
for i in range(16):
    t = roll_t0 + i * (roll_t1 - roll_t0) / 16; nt(ch_b, t, 'clarinet', M('C5') + i, (roll_t1 - roll_t0) / 16 * .95, .6 + i * .02, -.2, .7)
for i in range(4): ht(ch_b, SB[8 + i], 'timpani', 'drum2', .4 + i * .12, -.1, .6)
ht(ch_b, SB[12], 'crash', None, .7, .3, .6)
nt(ch_b, SB[12], 'clarinet', 'C6', (SB[13] - SB[12]) * .9, .85, -.2, .7)
ch_b = S.room(ch_b, size=.3, mix=.14)
band += ch_b

# ================= KITCHEN + ROOF RUN 26.199 → 33.155 (138) =================
kt = buf()
kprog = ['C6', 'C6', 'A7', 'A7', 'Dm7', 'G7c', 'C6', 'G7c', 'C6', 'C6', 'Dm7', 'G7c', 'C6', 'A7', 'Dm7', 'G7c']
stop0, stop1 = kb(8.5), kb(11)                      # stop-time (whistle only)
def live(t): return not (stop0 - .01 <= t < stop1 - .01)
for k in range(16):
    t = kb(k); nm = kprog[k]
    if not live(t): continue
    r, v = CH[nm]
    if k % 4 in (0, 2):
        nt(kt, t, 'piano', r + 12, .2, .75, -.25, .9); nt(kt, t, 'piano', r + 24, .2, .6, -.25, .8)
    else:
        for p in v: nt(kt, t, 'piano', p, .17, .72, .05, .85)
    if k % 2: ht(kt, t, 'snare2', 'on', .7, .05, .8)
    else: ht(kt, t, 'bass_drum', None, .6, 0, .6)
    for s in (0, .5):
        if live(t + s * KB): ht(kt, t + s * KB, 'hihat', 'closed', .5 - s * .2, .3, .5)
walk(kt, [kb(k) for k in range(16) if live(kb(k))], [kprog[k] for k in range(16) if live(kb(k))], .72, .95)
# muted trumpet riff (bar 1)
for bp_, p, d in ((.5, 'G4', .5), (1, 'C5', .5), (1.5, 'E5', .5), (2, 'G5', 1), (3.5, 'E5', .5)):
    nt(kt, kb(bp_), 'trumpet_mute', p, d * KB * .9, .72, .25, .8)
KEYS['trays'] = T['trays']
ch(kt, T['trays'], 'trumpet_mute', ['E5', 'G5', 'C6'], .18, .85, .25, .7); ht(kt, T['trays'], 'crash', None, .55, .3, .45)
KEYS['capHit'] = T['capHit']
x = S.note('trumpet_mute', 'G4', .5, .8); USED.add('trumpet_mute')      # upward rip = resample glide
tt = np.arange(len(x)) / SR; ratio = 2 ** (np.clip(tt / .3, 0, 1) * 12 / 12); pos = np.minimum(np.cumsum(ratio), len(x) - 2)
add(kt, (np.interp(pos, np.arange(len(x)), x) * np.exp(-tt / .5)).astype(np.float32), T['capHit'], .9, .25)
KEYS['capLand'] = T['capLand']
ch(kt, T['capLand'], 'piano', ['C2', 'C3', 'E4', 'G4', 'A4', 'D5'], .3, .92, 0, .95)
ch(kt, T['capLand'], 'trumpet_mute', ['E5', 'A5'], .25, .85, .25, .7)
ht(kt, T['capLand'], 'crash', None, .8, .3, .65); ht(kt, T['capLand'], 'bass_drum', None, .8, 0, .7)
# fill back in (doors)
for i, s in enumerate((9.5, 10, 10.5, 10.75)): ht(kt, kb(s), 'snare2', 'on', .55 + i * .1, .05, .8)
KEYS['doors'] = T['doors']
ht(kt, T['doors'], 'crash', None, .9, .3, .75); ht(kt, T['doors'], 'bass_drum', None, .9, 0, .8)
ch(kt, T['doors'], 'piano', ['A1', 'A2', 'G3', 'C#4', 'E4'], .25, .9, 0, .9)
ch(kt, T['doors'], 'trumpet_mute', ['C#5', 'G5'], .22, .85, .25, .7)
# roof run: fullest, closest (strings + clarinet + trumpet on top)
for i, p in enumerate(['E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6']): nt(kt, kb(12 + i * .5), 'violins', p, KB * .45, .6, .3, .45)
for bp_, p, d in ((12, 'G4', 1), (13, 'E5', 1.5), (14.5, 'D5', .5), (15, 'C5', .8)):
    nt(kt, kb(bp_), 'clarinet', p, d * KB * .9, .8, -.2, .7)
kt = S.room(kt, size=.28, mix=.12)
k1 = int(T['clock'] * SR); f = int(.006 * SR)
kt[k1:k1 + f] *= np.linspace(1, 0, f)[:, None]; kt[k1 + f:] = 0
band += kt
KEYS['stop'] = T['clock']

# ---- whistle (Pip): G5 E6 D6 C6 with glides, breath, vibrato ----
wn = [(29.894, 79, .19), (30.112, 88, .19), (30.329, 86, .19), (30.547, 84, .36)]
for i, (t, m, d) in enumerate(wn): KEYS[f'whistle_{i}'] = t
L = wn[-1][0] + wn[-1][2] + .1 - wn[0][0]; n = int(L * SR); tt = np.arange(n) / SR + wn[0][0]
mcur = np.full(n, float(wn[0][1])); amp = np.zeros(n)
for i, (t, m, d) in enumerate(wn):
    a = (tt >= t - .025)
    prev = wn[i - 1][1] if i else m
    g = np.clip((tt - (t - .025)) / .035, 0, 1)
    mcur = np.where(a, prev + (m - prev) * g, mcur)
    e = np.clip((tt - t) / .025, 0, 1) * np.clip((t + d - tt) / .05, 0, 1)
    amp = np.maximum(amp, e)
vib = .2 * np.sin(2 * np.pi * 6 * tt) * np.clip((tt - 30.62) / .1, 0, 1)
fr = 440 * 2 ** ((mcur + vib - 69) / 12)
ph = np.cumsum(2 * np.pi * fr / SR)
tone = np.sin(ph) + .06 * np.sin(2 * ph)
br = bp(rng.standard_normal(n), 1500, 9000) * .12
wv = ((tone * .8 + br) * amp * .5).astype(np.float32)
add(whistle, wv, wn[0][0], 1, .05)
whistle = S.room(whistle, size=.2, mix=.12)

# ================= TWELVE BELLS (stems/bells) =================
for i, t in enumerate(STR):
    KEYS[f'strike_{i + 1}'] = t
    nt(bells, t, 'tubular_bells', 'Bb4', 3.5, .85 if i < 11 else .95, 0, 1.3)
    ht(bells, t, 'gong', None, .22, 0, .35)
    ht(bells, t, 'bass_drum', None, .35, 0, .4)
bells = S.room(bells, size=.75, mix=.3)
bells[:int(STR[0] * SR)] = 0
# strings creep in on A♭ (dominant of D♭) under bells 11–12
pre = buf()
nt(pre, STR[10], 'cellos', 'Ab2', TL['T']['tutti'] - STR[10] + .1, .35, -.2, .5, attack=.9, release=.3)
nt(pre, STR[10], 'violins', 'Eb5', TL['T']['tutti'] - STR[10] + .1, .28, .3, .35, attack=1.0, release=.3)
nt(pre, STR[10], 'violas', 'C4', TL['T']['tutti'] - STR[10] + .1, .3, .1, .4, attack=1.0, release=.3)
band += pre

# ================= THE SONG (D♭) 42.067 → 52.412 =================
song = buf()
T0 = T['tutti']; KEYS['tutti'] = T0
MOTIF = [(0, 'F4', 1), (1, 'D5', 1.5), (2.5, 'C5', .5), (3, 'Bb4', 1),
         (4, 'Db5', 1), (5, 'C5', .5), (5.5, 'A4', .5), (6, 'Bb4', 2),
         (8, 'G4', 1), (9, 'Eb5', 1.5), (10.5, 'D5', .5), (11, 'C5', 1),
         (12, 'F5', 1), (13, 'D5', .5), (13.5, 'C5', .5), (14, 'Bb4', 2)]
up = 3   # B♭ → D♭
sprog = ['Dbmaj7', 'Bbm7', 'Dbmaj7', 'Bbm7', 'Gb7', 'Db/Ab', 'Gb7', 'Db/Ab', 'Ebm7', 'Ab7', 'Ebm7', 'Ab7', 'Ab7', 'Db6', 'Db6', 'Db6']  # per beat pairs → per beat index //1
# melody: violins 8va + piano octaves + alto sax an octave below
for bp_, p, d in MOTIF:
    t = T0 + bp_ * B; m = M(p) + up; dd = d * B
    nt(song, t, 'violins', m + 12, dd * .98, .85, .3, .75, release=.25)
    nt(song, t, 'violins', m, dd * .98, .7, .2, .45, release=.25)
    nt(song, t, 'piano', m, dd * .9, .82, .05, .8); nt(song, t, 'piano', m + 12, dd * .9, .7, .1, .6)
    nt(song, t, 'alto_sax', m - 12 + 12, dd * .95, .55, -.25, .4)
# harmony per half-bar: strings pad + trombones
half = ['Dbmaj7', 'Bbm7', 'Gb7', 'Db/Ab', 'Ebm7', 'Ab7', 'Ab7', 'Db6']
for h, nm in enumerate(half):
    t = T0 + h * 2 * B; r, v = CH[nm]
    for i, p in enumerate(v): nt(song, t, 'violas' if i else 'cellos', M(p) if i else r + 12, 2 * B * .98, .55, -.1 + i * .1, .45, release=.3)
    for i, p in enumerate(v[:3]): nt(song, t, 'trombone', M(p) - 12 if M(p) - 12 >= M('A#1') else M(p), 2 * B * .9, .6, -.2 + i * .1, .35)
    # stride piano left hand
    nt(song, t, 'piano', r + 12, B * .8, .7, -.25, .8); nt(song, t, 'piano', r, B * .8, .6, -.25, .7)
    for p in v: nt(song, t + B, 'piano', p, B * .6, .6, 0, .6)
beats_song = [T0 + k * B for k in range(20)]
walk(song, beats_song, [half[min(k // 2, 7)] if k < 16 else 'Db6' for k in range(20)], .75, 1.0)
for k in range(20):
    t = beats_song[k]
    if k % 2: ht(song, t, 'snare2', 'on', .7, .05, .75)
    else: ht(song, t, 'bass_drum', None, .65, 0, .65)
    ht(song, t, 'sus_cymbal', 'stick', .45, .35, .4); ht(song, t + B * 2 / 3, 'sus_cymbal', 'stick', .3, .35, .3)   # swung ride
ht(song, T0, 'crash', None, 1.0, .3, .8); ht(song, T0, 'bass_drum', None, .95, 0, .85)
ch(song, T0, 'trombone', ['Db2', 'Ab2', 'F3'], .6, .9, -.2, .5)
# bar 1: 8 eighth notes rising on harp + glock (fans open one by one)
fan_notes = ['Ab4', 'C5', 'Db5', 'F5', 'Ab5', 'C6', 'Db6', 'F6']
for i, p in enumerate(fan_notes):
    t = T0 + i * B / 2; KEYS[f'fan_{i}'] = t
    nt(song, t, 'harp', p, .8, .7, -.3 + i * .08, .7); nt(song, t, 'glockenspiel', M(p) + 12, .6, .5, .3, .35)
KEYS['clockForm'] = T['clockForm']
ht(song, T['clockForm'], 'sus_cymbal', 'hit', .9, .3, .75); ht(song, T['clockForm'], 'crash', None, .6, -.3, .4)
nt(song, T['clockForm'], 'tubular_bells', 'Db5', 2.5, .6, 0, .45)
# bar 5 tag: brass + strings rising to the final chord
b5 = T0 + 16 * B
for i, p in enumerate(['Ab4', 'Bb4', 'C5', 'Db5', 'Eb5', 'F5', 'Ab5', 'Bb5']):
    t = b5 + i * B / 2; nt(song, t, 'violins', M(p) + 12, B / 2 * .9, .7 + i * .03, .3, .55); nt(song, t, 'trumpet_mute', p, B / 2 * .85, .7, .2, .45)
    nt(song, t, 'trombone', M(p) - 12, B / 2 * .85, .65, -.2, .35)
ht(song, b5 + 3 * B, 'timpani', 'drum1', .6, -.1, .6); ht(song, b5 + 3.5 * B, 'timpani', 'drum1', .75, -.1, .7)
FIN = T['final']; KEYS['final'] = FIN
ch(song, FIN, 'piano', ['Db1', 'Db2', 'Ab2', 'F3', 'Bb3', 'Eb4', 'Ab4', 'Db5'], 3.5, .95, 0, .9)
ch(song, FIN, 'violins', ['F5', 'Ab5', 'Db6'], 2.8, .85, .3, .6, release=1.4)
ch(song, FIN, 'violas', ['Bb4', 'Eb4'], 2.8, .8, .1, .5, release=1.4)
ch(song, FIN, 'cellos', ['Db2', 'Ab2'], 3.0, .85, -.2, .6, release=1.5)
ch(song, FIN, 'trombone', ['Db2', 'Ab2', 'F3'], 1.8, .85, -.2, .45, release=.8)
nt(song, FIN, 'alto_sax', 'F4', 1.8, .7, -.25, .4, release=.6)
ht(song, FIN, 'crash', None, .95, .3, .75); ht(song, FIN, 'timpani', 'drum1', .9, -.1, .8); ht(song, FIN, 'gong', None, .4, 0, .4)
# tail: quiet piano + clarinet button (motif head in D♭), 53.963 →
tb = T['card']
for bp_, p, d in ((0, 'Ab4', 1), (1, 'F5', 1.5), (2.5, 'Eb5', .5), (3, 'Db5', 1.5)):
    nt(song, tb + bp_ * B, 'clarinet', p, d * B * .9, .55, -.15, .5)
for bp_, nm in ((0, 'Dbmaj7'), (2, 'Ebm7'), (4, 'Db6')):
    r, v = CH[nm]; nt(song, tb + bp_ * B, 'piano', r + 12, B * .8, .45, -.2, .5)
    for p in v: nt(song, tb + bp_ * B + B, 'piano', M(p) + 12, B * .5, .4, .1, .45)
nt(song, tb + 5.5 * B, 'jazz_bass', 'Db2', 1.2, .55, -.1, .7); nt(song, tb + 5.5 * B, 'piano', 'Db6', 1.5, .45, .2, .45)
song = S.room(song, size=.4, mix=.17)
song[:int(T0 * SR) - 10] = 0
band += song * 1.45

# ================= master =================
for st in (title, band, bells, whistle):
    st[int(T['clock'] * SR):int(STR[0] * SR)] = 0            # digital silence (the throw)
    st[int(16.75 * SR):int(T['snare'] * SR)] = 0              # silence after 'Out of order'
title[int(7.2 * SR):] *= 0
# fade tails to zero at DUR
fo = int(.4 * SR)
for st in (title, band, bells, whistle): st[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = title + band + bells + whistle
pk = np.abs(mix).max(); g = 10 ** (-1 / 20) / pk
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
for nm, st in (('title', title), ('band', band), ('bells', bells), ('whistle', whistle)):
    sf.write(os.path.join(HERE, 'stems', nm + '.wav'), (st * g).astype(np.float32), SR)
mix = (mix * g).astype(np.float32)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR)
motif_json = [[bp_, p, d] for bp_, p, d in MOTIF]
json.dump({'keys': {k: round(float(v), 4) for k, v in KEYS.items()}, 'motif': motif_json, 'motif_key': 'Bb major (song finale transposed +3 to Db)',
           'bpm': 116, 'dur': DUR}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
open(os.path.join(HERE, 'CREDITS_music.txt'), 'w').write('Original score "Midnight at the Starlight" (Lemo-Opuscar art-deco demo), composed in code.\n' + '\n'.join(S.credits(sorted(USED))) + '\n')
print('score.wav', round(len(mix) / SR, 3), 's  gain', round(g, 3), ' instruments:', ', '.join(sorted(USED)))
