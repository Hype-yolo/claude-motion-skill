# "The Colour of Rain" — score. Part A: solo cello (D minor, 3/4, 80). Part B: street musette waltz (D major, 3/4, 132).
import sys, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR, add, limit
HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '../out/timeline.json')))
T, NA, NB, POPS, TB, bB = TL['T'], TL['NA'], TL['NB'], TL['POPS'], TL['TB'], TL['BEAT_B']
DUR = TL['DUR'] + .5
S.seed(7)
tb = lambda bar, beat=1: TB[bar] + (beat - 1) * bB
CH = {'D': (['D4', 'F#4', 'A4'], 'D2'), 'G': (['D4', 'G4', 'B4'], 'G2'), 'A7': (['C#4', 'E4', 'G4'], 'A2'), 'Bm': (['D4', 'F#4', 'B4'], 'B2')}
ev = []            # (t, inst, pitch, dur, vel, pan[, gain])
stems = {}
def E(*a): ev.append(a)

# ---------- Part A: alone under the arch
for i, n in enumerate(NA):
    v = .62 + .08 * np.sin(i * 1.3)
    E(n['t'] - .02, 'cellos', n['pitch'], n['d'] * (.98 if i < len(NA) - 1 else .9), v, -.1)
partA = S.render(ev, dur=DUR); ev.clear()
partA = S.room(partA, size=.55, mix=.28)
# the unresolved E is cut off by the bow lifting: hard gate after it
cut = int((T['stop'] + .3) * SR); partA[cut:] *= np.exp(-np.arange(len(partA) - cut) / SR / .09)[:, None]

# ---------- Part B
# pickup bar: the POP
E(T['pop'], 'glockenspiel', 'D6', 1.5, .9, .1); E(T['pop'], 'glockenspiel', 'A6', 1.5, .7, .2)
E(T['pop'], 'triangle', 'open', None, .5, .3)
for k, p in enumerate(['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6']):
    E(T['pop'] + .05 + k * .045, 'harp', p, 1.2, .5 + k * .04, -.2)
E(tb(0, 3), 'accordion', 'A3', .35, .45, .15); E(tb(0, 3), 'accordion', 'C#4', .35, .45, .15); E(tb(0, 3), 'accordion', 'G4', .35, .4, .15)
# vamp: bass pizz on 1, accordion + violin pizz on 2 & 3, shaker brush
for bar in range(1, 12):
    ch, root = CH[TL['CHORDS_B'][str(bar)]]
    E(tb(bar, 1), 'contrabass_pizz', root, .9, .85, -.05)
    if bar >= 2: E(tb(bar, 1), 'cellos_pizz', root.replace('2', '3'), .6, .45, -.1)
    for bt in (2, 3):
        if bar == 11 and bt == 3: continue           # grand pause
        for p in ch: E(tb(bar, bt), 'accordion', p, bB * .55, .5 if bt == 2 else .42, .15)
        if bar >= 3:
            for p in ch[1:]: E(tb(bar, bt), 'violins_pizz', p.replace('4', '5'), .4, .32, .35)
        E(tb(bar, bt), 'shaker', 'down' if bt == 2 else 'up', None, .28, .25)
# melody: cello (all of it), accordion doubles an octave up for the overhead dance
for i, n in enumerate(NB):
    if n['t'] >= T['chord'] - .01: continue
    E(n['t'] - .015, 'cellos', n['pitch'], n['d'] * .95, .78, -.1)
    if tb(6) - .01 <= n['t'] < T['gp']:
        p = n['pitch']; oct_ = p[:-1] + str(int(p[-1]) + 1)
        E(n['t'], 'accordion', oct_, n['d'] * .9, .5, .2)
# umbrella pops: rising glockenspiel arpeggio, one per beat
for p in POPS: E(p['t'], 'glockenspiel', p['pitch'], 1.4, .85, .15)
# overhead: harp arpeggio each bar, glock on the downbeat
for bar in range(6, 11):
    ch, root = CH[TL['CHORDS_B'][str(bar)]]
    for k, p in enumerate([root.replace('2', '3')] + ch + [c.replace('4', '5') for c in ch]):
        E(tb(bar) + k * bB * 3 / 8, 'harp', p, .8, .45, -.35)
    E(tb(bar), 'glockenspiel', ch[-1].replace('4', '6'), 1.2, .6, .1)
# bar 11: two tutti accents, then silence
for bt in (1, 2):
    for p in ['A3', 'C#4', 'E4', 'G4']: E(tb(11, bt), 'accordion', p, bB * .6, .7, .1)
    E(tb(11, bt), 'contrabass_pizz', 'A2', .5, .9, 0); E(tb(11, bt), 'timpani', 'A2', .6, .7, 0)
    E(tb(11, bt), 'glockenspiel', 'A6' if bt == 1 else 'C#7', .8, .7, .2)
# bar 12: THE CHORD — everyone
c0 = T['chord']
for p in ['D2', 'A2']: E(c0, 'contrabass', p, 2.6, .8, 0)
for p in ['D3', 'A3', 'F#4', 'D4']: E(c0, 'cellos', p, 2.6, .75, -.15)
for p in ['D5', 'F#5', 'A5']: E(c0, 'violins', p, 2.4, .6, .3)
for p in ['D4', 'F#4', 'A4', 'D5']: E(c0, 'accordion', p, 1.8, .6, .15)
E(c0, 'timpani', 'D3', 2, .9, 0); E(c0, 'sus_cymbal', 'hit', None, .45, .1)
for p in ['D6', 'F#6', 'A6']: E(c0, 'glockenspiel', p, 2.5, .75, .2)
for k, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6', 'F#6']): E(c0 + .02 + k * .05, 'harp', p, 2, .55, -.25)
# coda: the phrase that broke off at the start now resolves (F# E ... D)
for n in NB:
    if n['t'] >= tb(13) - .01: E(n['t'], 'cellos', n['pitch'], n['d'] * .98, .55, -.1)
for p in ['D4', 'G4', 'B4']: E(tb(13), 'accordion', p, bB * 3 * .95, .28, .2)
for p in ['C#4', 'E4', 'G4', 'A3']: E(tb(14), 'accordion', p, bB * 3 * .9, .28, .2)
for k, p in enumerate(['A2', 'E3', 'A3', 'C#4', 'E4', 'G4']): E(tb(14) + k * .12, 'harp', p, 1.2, .38, -.25)
# last beat: pizz D + glock, ring out
lt = T['last']
E(lt, 'contrabass_pizz', 'D2', 2, .8, 0); E(lt, 'cellos_pizz', 'D3', 2, .7, -.1); E(lt, 'glockenspiel', 'D6', 3, .6, .15)
for k, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']): E(lt + .03 + k * .07, 'harp', p, 3, .42, -.2)
partB = S.render(ev, dur=DUR)
partB = S.room(partB, size=.45, mix=.2)
mix = partA + partB
# grand pause: true digital silence (reverb tails cut)
g0, g1 = int((T['gp'] + .02) * SR), int((T['chord'] - .004) * SR)
mix[g0 - 240:g0] *= np.linspace(1, 0, 240)[:, None]; mix[g0:g1] = 0
mix = limit(mix, .9)
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR)
print('score', mix.shape[0] / SR, 's', 'peak', np.abs(mix).max())
