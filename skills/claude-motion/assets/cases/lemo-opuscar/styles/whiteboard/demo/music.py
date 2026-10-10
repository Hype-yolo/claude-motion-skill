"""Original score for "Einstein in Your Pocket" — clockwork minimalism, 120 BPM, D major / B minor.
Marimba ostinato + pizzicato + glockenspiel theme + woodblock clock. The relativity section runs a second
marimba at the orbit clock's tempo (×140/130.5) so the two layers drift apart (phasing); the fix snaps them back.
Writes music/score.wav (stereo 48k) and music/drift.wav (the march, for the tape-rewind effect)."""
import sys, os, json, numpy as np, soundfile as sf
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR
HERE = os.path.dirname(os.path.abspath(__file__))
ev = json.load(open(os.path.join(HERE, 'events.json')))
C = next(e for e in ev['ev'] if e['type'] == 'cues'); E = ev['ev']
T0, B = C['T0'], C['BEAT']; DUR = ev['dur']
S.seed(7)
N = []                                                   # score events
def n(t, inst, p, d, v=.7, pan=0., g=1., **kw): N.append(dict(t=t, inst=inst, pitch=p, dur=d, vel=v, pan=pan, gain=g, **kw))
bt = lambda b: T0 + b * B                                 # beat → seconds
EV = lambda typ: [e for e in E if e['type'] == typ]

# ── harmony
CH = {'D': ['D', 'F#', 'A'], 'A': ['A', 'C#', 'E'], 'Bm': ['B', 'D', 'F#'], 'G': ['G', 'B', 'D'], 'Em': ['E', 'G', 'B'], 'F#': ['F#', 'A#', 'C#'], 'A/C#': ['A', 'C#', 'E']}
ROOTB = {'D': 'D2', 'A': 'A1', 'A/C#': 'C#2', 'Bm': 'B1', 'G': 'G1', 'Em': 'E2', 'F#': 'F#1'}
def up(p, k): return S.name(S.midi(p) + k)
def arp(ch, oct=4):                                      # 8-eighth marimba figure: r 5 8 5 10 5 8 5
    r = S.midi(CH[ch][0] + str(oct)); t3 = S.midi(CH[ch][1] + str(oct)); f5 = S.midi(CH[ch][2] + str(oct))
    if t3 < r: t3 += 12
    if f5 < r: f5 += 12
    return [r, f5, r + 12, f5, t3 + 12, f5, r + 12, f5]

def groove(b0, chords, level=1., mar=True, pizz=True, clap=False, shaker=True, tick=True, glock=None, pan=-.15):
    """one bar per chord starting at beat b0"""
    for k, ch in enumerate(chords):
        b = b0 + 4 * k
        if mar:
            for i, m in enumerate(arp(ch)): n(bt(b + i * .5), 'marimba', m, .3, (.62 if i % 2 == 0 else .5) * level, pan, .9)
        if pizz:
            n(bt(b), 'cellos_pizz', up(ROOTB[ch], 12), .5, .75 * level, .05, 1.1)
            n(bt(b), 'contrabass_pizz', ROOTB[ch], .5, .7 * level, 0, 1.0)
            n(bt(b + 1.5), 'cellos_pizz', up(ROOTB[ch], 7 + 12), .3, .5 * level, .1, .9)
            n(bt(b + 2), 'cellos_pizz', up(ROOTB[ch], 12), .4, .6 * level, .05, 1.0)
        for i in range(4):
            if tick: n(bt(b + i), 'woodblock', 'a' if i % 2 == 0 else 'b', None, .38 * level, .35, .55)
            if clap and i % 2 == 1: n(bt(b + i), 'claps', 'group', None, .5 * level, 0, .5)
            if shaker:
                for h in (0, .5): n(bt(b + i + h), 'shaker', 'down' if h == 0 else 'up', None, .28 * level, -.3, .35)

THEME = [  # (beat offset, pitch, dur beats) over 8 bars
    (0, 'A5', .5), (.5, 'F#5', .5), (1, 'A5', 1), (2, 'D6', .5), (2.5, 'C#6', .5), (3, 'B5', 1),
    (4, 'A5', 1.5), (5.5, 'F#5', .5), (6, 'E5', .5), (6.5, 'F#5', .5), (7, 'D5', 1),
    (8, 'A5', .5), (8.5, 'F#5', .5), (9, 'A5', 1), (10, 'D6', .5), (10.5, 'C#6', .5), (11, 'E6', 1),
    (12, 'F#6', 1), (13, 'E6', .5), (13.5, 'D6', .5), (14, 'C#6', 1), (15, 'A5', 1)]
def theme(b0, level=1., bars=4, inst='glockenspiel', oct=0, pan=.2):
    for (o, p, d) in THEME:
        if o < bars * 4: n(bt(b0 + o), inst, up(p, 12 * oct), d * B, .6 * level, pan, .8)

# ── 0–10: no music; pickup into the title
for i, b in enumerate([-4, -3, -2, -1]): n(bt(b), 'woodblock', 'a' if i % 2 == 0 else 'b', None, .3 + .12 * i, .2, .7)
for i, p in enumerate(['D5', 'F#5', 'A5', 'D6']): n(bt(-1 + i * .25), 'glockenspiel', p, .3, .45 + .08 * i, .25, .7)
n(bt(-1), 'sus_cymbal', 'cresc', None, .35, 0, .35)

# ── 10–14 TITLE (bars 1–2): full theme, no VO
n(bt(0), 'timpani', 'D3', 1.5, .55, 0, .8); n(bt(0), 'crash', None, None, .35, 0, .3)
groove(0, ['D', 'A/C#'], 1., clap=True)
theme(0, 1.05, bars=2)
n(bt(0), 'violins', 'D5', 3.8, .35, -.3, .5, attack=.3); n(bt(4), 'violins', 'C#5', 3.6, .33, -.3, .5, attack=.2)
n(bt(0), 'violas', 'A4', 3.8, .35, .3, .5, attack=.3); n(bt(4), 'violas', 'A4', 3.6, .33, .3, .5, attack=.2)

# ── 14–24 SATELLITES (bars 3–7): lighter under VO; pings on the broadcast ripples
groove(8, ['Bm', 'G', 'D', 'A', 'Bm'], .72, clap=False)
theme(8, .5, bars=2, inst='vibraphone', oct=-1, pan=.3)
for e in EV('ping'):
    k = e['k']; n(e['t'], 'glockenspiel', ['A5', 'E6', 'A6', 'E6', 'B6'][k], .6, .55 - .05 * k, .4, .75)
    n(e['t'] + .12, 'glockenspiel', ['E6', 'B6', 'E7', 'A6', 'E7'][k], .5, .35, .5, .5)

# ── 24–34 DELAY = DISTANCE (bars 8–12): the signal falls — harp glissando follows the dashed line down
groove(28, ['G', 'D', 'Em', 'A', 'D'], .68, clap=False, shaker=True)
sig = [e for e in E if e['type'] == 'dash' and e.get('pen') == 'blue' and 24.5 < e['t'] < 27.7]
scale = [S.midi(p) for p in ['D7', 'B6', 'A6', 'F#6', 'E6', 'D6', 'B5', 'A5', 'F#5', 'E5', 'D5', 'B4', 'A4', 'F#4', 'E4', 'D4']]
for i, e in enumerate(sig[::2]): n(e['t'], 'harp', scale[min(len(scale) - 1, int(i * len(scale) / max(1, len(sig[::2]))))], .8, .45, .3 - .6 * i / max(1, len(sig) / 2), .8)
eqEnd = max(e['t'] + e['dur'] for e in E if e['type'] == 'write' and e.get('pen') == 'black' and 30 < e['t'] < 34)
for i, p in enumerate(['D4', 'F#4', 'A4', 'D5']): n(eqEnd + .05 + i * .06, 'violins_pizz', p, .4, .7, -.2 + .15 * i, .9)

# ── 34–42 TRILATERATION (bars 13–16): sparse; each circle steps up; "Right here" lands
groove(48, ['Bm', 'G', 'Em'], .5, clap=False, shaker=False, pizz=True)
circles = sorted([e for e in E if e['type'] == 'stroke' and e.get('pen') == 'blue' and 35 < e['t'] < 41.5 and e['len'] > 500], key=lambda e: e['t'])
for k, e in enumerate(circles[:3]):
    for p in [['B3', 'D4', 'F#4'], ['C#4', 'E4', 'A4'], ['D4', 'F#4', 'A4', 'C#5']][k]: n(e['t'], 'vibraphone', p, 1.4, .5 + .08 * k, .1 * k - .1, .8)
    n(e['t'], 'contrabass', ['B1', 'A1', 'G1'][k], 2.2, .4, 0, .6, attack=.2)
ph = C['pinOnAt']
n(ph, 'timpani', 'D3', 2, .8, 0, 1.0); n(ph, 'crash', None, None, .5, 0, .45)
for p in ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']: n(ph, 'harp', p, 2.5, .6, .0, .7)
for p, pan in [('D5', -.3), ('F#5', 0), ('A5', .3)]: n(ph, 'violins', p, 1.8, .5, pan, .55, attack=.02)
n(ph, 'glockenspiel', 'D7', 1.5, .6, .3, .6)
# 43.6–46.4 silence (only the room clock and VO) — see mix.py

# ── 46.45 THE WHIP LANDS: the first sound after the silence is the orbit clock's bell
w = 46.45
n(w, 'tubular_bells', 'D5', 3.5, .7, .2, .9); n(w, 'gran_cassa', 'hit', None, .5, 0, .6)
n(w, 'contrabass', 'B1', 3.6, .45, 0, .7, attack=.4); n(w, 'vibraphone_bowed', 'F#4', 3.5, .4, -.3, .7, attack=.6)
n(w + .02, 'vibraphone_bowed', 'D5', 3.4, .35, .3, .6, attack=.6)

# ── 50–70 RELATIVITY: two marimbas, same figure, two clocks. Ground = 120 BPM (left), orbit = ×140/130.5 (right)
FIG = ['B4', 'E5', 'F#5', 'B5', 'C#6', 'E5', 'F#5', 'B5', 'C#6', 'E5', 'F#5', 'D6']
def phase_layer(t0, t1, ratio, pan, level, inst='marimba'):
    step = B / 2 / ratio; i = 0; t = t0
    while t < t1:
        v = level * (.62 if i % 3 == 0 else .48)
        n(t, inst, FIG[i % len(FIG)], .25, v, pan, .8); i += 1; t = t0 + i * step
duet0, dEnd = C['duet0'], 70.0
R = 140 / 130.5
phase_layer(duet0, dEnd, 1.0, -.55, .8)
phase_layer(duet0, dEnd, R, .55, .8)
for e in EV('tickG'): n(e['t'], 'woodblock', 'a', None, .6, -.5, .8)
for e in EV('tickO'): n(e['t'], 'woodblock', 'c', None, .6, .5, .8)
pads = [(50, 'Bm'), (54, 'G'), (58, 'Em'), (62, 'F#'), (66, 'Bm')]
for t, ch in pads:
    for k, p in enumerate(CH[ch]): n(t, 'vibraphone_bowed', p + '4', 4.1, .32, (k - 1) * .4, .6, attack=.5)
    n(t, 'contrabass', ROOTB[ch], 4.2, .42, 0, .7, attack=.3)
for e in EV('write'):
    pass
seven = next(e['t'] for e in E if e['type'] == 'write' and 59 < e['t'] < 60.5 and e.get('pen') == 'black')
for i, p in enumerate(['F#3', 'E3', 'D3']): n(seven + i * .12, 'cellos_pizz', p, .4, .7, -.2, 1.0)
f45 = next(e['t'] for e in E if e['type'] == 'write' and 63.4 < e['t'] < 64.3 and e.get('pen') == 'black')
for i, p in enumerate(['F#5', 'A5', 'C#6']): n(f45 + i * .1, 'glockenspiel', p, .4, .5, .3, .6)
s38 = next(e['t'] for e in E if e['type'] == 'write' and 65.8 < e['t'] < 66.3 and e.get('pen') == 'orange')
for p in ['F#3', 'C#4', 'F#4', 'A#4', 'C#5']: n(s38, 'violins_pizz' if S.midi(p) > 60 else 'cellos_pizz', p, .5, .75, 0, .9)
n(s38, 'timpani', 'F#2', 1.5, .5, 0, .7)
circ = next(e['t'] for e in E if e['type'] == 'stroke' and e.get('pen') == 'orange' and 67.9 < e['t'] < 68.8)
n(circ, 'sus_cymbal', 'roll', None, .35, 0, .35)

# ── 70–78 CONSEQUENCE: the ground clock alone again, calm
groove(120, ['Bm', 'G', 'D', 'A'], .6, clap=False, shaker=True, tick=True)
km = next(e['t'] for e in E if e['type'] == 'stroke' and e.get('pen') == 'orange' and 74.5 < e['t'] < 76.5)
for i, p in enumerate(['A4', 'D5', 'F#5']): n(km + i * .07, 'violins_pizz', p, .4, .65, .2, .9)
for i, p in enumerate(['A1', 'B1', 'C#2', 'D2']): n(bt(132 + i), 'contrabass_pizz', p, .45, .7, 0, 1.1)   # 76–78 walk up

# ── 78–85 THE DRIFT: a little march, one day per step, sliding downhill
dT = C['dayT']
walk = ['D3', 'C#3', 'C3', 'B2', 'A#2', 'A2', 'G#2']
for d, t in enumerate(dT):
    n(t, 'tuba_stac', up(walk[d], -12), .35, .8, 0, 1.2); n(t, 'bassoon_stac', walk[d], .3, .7, -.2, .9)
    n(t + .5, 'bassoon_stac', up(walk[d], 7), .25, .55, -.2, .8)
    n(t + .25, 'snare2', 'taps', None, .35, .25, .45); n(t + .75, 'snare2', 'taps', None, .3, .25, .4)
    n(t, 'clarinet_stac', up(walk[d], 24), .2, .5, .3, .7); n(t + .5, 'clarinet_stac', up(walk[d], 19), .2, .45, .3, .6)
    n(t, 'woodblock', 'a', None, .4, -.3, .5)
n(C['driftEnd'] - .5, 'tuba_stac', 'G#1', .6, .8, 0, 1.2)          # last step onto the water…

# ── 85–87: splash; bubbles and a fish's question
sp = C['driftEnd']
rng = np.random.default_rng(3)
for i in range(7): n(sp + .35 + i * .16 + rng.uniform(0, .05), 'glass', S.name(int(rng.integers(76, 88))), .35, .35, rng.uniform(-.4, .4), .5)
q = sp + 1.3
n(q, 'clarinet', 'A4', .28, .55, .25, .7); n(q + .3, 'clarinet', 'D5', .5, .55, .25, .7)

# ── 89–91.5: orbit layer creeps back (still out of step) under v18; 91.5 SNAP into step
phase_layer(89.0, C['fix0'], 1.0, -.55, .55)
phase_layer(89.0 + .11, C['fix0'], R, .55, .55)
n(89.0, 'contrabass', 'B1', 2.6, .4, 0, .6, attack=.5); n(89.0, 'vibraphone_bowed', 'F#4', 2.5, .3, 0, .5, attack=.6)
f0 = C['fix0']
n(f0, 'crash', None, None, .3, 0, .3); n(f0, 'timpani', 'D3', 1, .55, 0, .7)
for e in EV('tickFix'): n(e['t'], 'woodblock', 'a', None, .55, -.4, .7); n(e['t'], 'woodblock', 'c', None, .5, .4, .6)
groove(163, ['G', 'A', 'D'][:1], .75, clap=False)                    # 91.5–93.5
for i, m in enumerate(arp('A')): n(bt(167 + i * .5), 'marimba', m, .3, .55, -.1, .9)   # 93.5–95.5 both layers now one
fe = C['fixEnd']
n(fe + .05, 'glockenspiel', 'D6', 1.2, .7, .3, .8); n(fe + .05, 'glockenspiel', 'A6', 1.2, .6, .3, .7)
n(bt(171), 'sus_cymbal', 'cresc', None, .45, 0, .4)                   # 95.5 swell into the finale

# ── 96–102 FINALE: full theme, crescendo into the wide shot
groove(172, ['D', 'A/C#', 'Bm'], 1.0, clap=True)
theme(172, 1.1, bars=3)
for k, (ch, p) in enumerate([('D', 'D5'), ('A/C#', 'E5'), ('Bm', 'F#5')]):
    n(bt(172 + 4 * k), 'violins', p, 1.95, .4 + .08 * k, -.3, .6, attack=.2); n(bt(172 + 4 * k), 'violas', up(p, -5), 1.95, .38 + .08 * k, .3, .55, attack=.2)
    n(bt(172 + 4 * k), 'horn', up(p, -12), 1.95, .35 + .1 * k, 0, .45, attack=.15)
# 101.5 / 102 / 102.5 — tray clacks are part of the rhythm (mix.py); landing chord on the downbeat 102.0
L = bt(184)
n(L, 'timpani', 'D3', 3, .75, 0, .9); n(L, 'crash', None, None, .45, 0, .4)
for p in ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5']: n(L, 'harp', p, 4, .6, 0, .6)
for p, pan in [('D4', -.3), ('A4', .3), ('F#5', 0), ('D5', -.1)]: n(L, 'violins' if S.midi(p) > 64 else 'violas', p, 4.5, .45, pan, .5, attack=.05)
n(L, 'contrabass', 'D2', 4.5, .5, 0, .7)

# ── 102.5–112 OUTRO: the theme once more, softly, under the credits
for (o, p, d) in THEME[:11]: n(bt(186 + o), 'glockenspiel', p, d * B, .38, .25, .6) if o < 8 else None
for i, m in enumerate(arp('D') + arp('G')): n(bt(186 + i * .5), 'marimba', m, .3, .34, -.2, .7)
n(bt(196), 'vibraphone', 'D4', 4, .4, -.2, .7); n(bt(196), 'vibraphone', 'A4', 4, .38, .2, .7); n(bt(196), 'vibraphone', 'F#5', 4, .36, 0, .7)
n(bt(196), 'contrabass', 'D2', 4, .35, 0, .6, attack=.3); n(bt(196), 'glockenspiel', 'D6', 3, .4, .3, .6)

N.sort(key=lambda e: e['t'])
mix = S.render(N, dur=DUR + 1, master=False)
mix = S.room(mix, size=.42, mix=.16)
os.makedirs(os.path.join(HERE, 'music'), exist_ok=True)
sf.write(os.path.join(HERE, 'music/score.wav'), mix.astype(np.float32), SR)
# drift march alone (for the rewind effect)
drift = S.render([e for e in N if C['dayT'][0] - .1 <= e['t'] < C['driftEnd']], dur=DUR + 1, master=False)
sf.write(os.path.join(HERE, 'music/drift.wav'), drift.astype(np.float32), SR)
print('notes', len(N), 'peak', float(np.abs(mix).max()))
print('\n'.join(S.credits(sorted({e['inst'] for e in N}))))
