"""Original photoplay score for "The Runaway Loaf" — a cinema upright piano playing to a cue sheet
(Maestoso → Andante 'Loaf theme' → Hurry → stop-time → Misterioso walk → crash → Agitato → ritardando → SILENCE
→ reed organ enters → Tenderly → the wink → finale). The piano does the sound effects, as it did in 1925:
glissandi for falls and launches, a cluster for the plank, tremolo for suspense, a crash chord for the melon.
All timings come from ../timeline.json. Run: .venv/bin/python styles/silent-film/demo/music/score.py
Outputs: score.wav, score.json (sync keys), CREDITS_music.txt"""
import sys, os, json
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR

S.seed(1925)
TL = json.load(open(os.path.join(HERE, '../timeline.json')))
SEC, HIT, DUR = TL['SEC'], TL['HIT'], TL['DUR']
def at(name, b=0.0): return SEC[name]['t0'] + b * SEC[name]['beat']
def bt(name): return SEC[name]['beat']

EV = []            # (t, inst, pitch, dur, vel, pan)
KEYS = {}          # sync points actually written (for the cue check)
P = 'upright'
def n(t, p, d, v=.6, pan=0., inst=P): EV.append((t, inst, p, d, v, pan))
def chord(t, ps, d, v=.6, pan=0., roll=0., inst=P):
    for i, p in enumerate(ps): n(t + i * roll, p, d, v * (1 - .04 * i), pan, inst)
def key(name, t): KEYS[name] = round(t, 4)
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
def m2n(m): return NAMES[m % 12] + str(m // 12 - 1)
def midi(p): return int(round(S.midi(p)))
WHITE = [0, 2, 4, 5, 7, 9, 11]
def gliss(t, p0, p1, d, v0=.55, v1=.75, white=True):
    """a piano glissando between two pitches over d seconds (white keys like a real thumb-slide)"""
    a, b = midi(p0), midi(p1); step = 1 if b > a else -1
    notes = [m for m in range(a, b + step, step) if (not white or m % 12 in WHITE)]
    for i, m in enumerate(notes):
        u = i / max(1, len(notes) - 1)
        n(t + u * d, m2n(m), .25, v0 + (v1 - v0) * u, (u - .5) * .4)
def trem(t, ps, d, rate=14, v=.5, cres=0.):
    """tremolo: alternate two chord halves rapidly"""
    k = 0; tt = t
    while tt < t + d - 1e-6:
        u = (tt - t) / d
        for p in ps[k % 2]: n(tt, p, 1 / rate * 1.2, v + cres * u, 0)
        tt += 1 / rate; k += 1
def stride(name, b0, b1, bass, chords, v=.5):
    """stride left hand: bass note on the beat, mid chord on the off-beat (per beat)"""
    B = bt(name); b = b0
    while b < b1 - 1e-6:
        i = int(b - b0)
        bn = bass[i % len(bass)]; ch = chords[i % len(chords)]
        n(at(name, b), bn, B * .45, v, -.25); chord(at(name, b + .5), ch, B * .35, v * .72, -.1)
        b += 1

# ---------------- TITLE · Maestoso ----------------
key('title', at('TITLE'))
chord(at('TITLE', 0), ['F1', 'F2', 'C3'], 2.2, .85, -.3); chord(at('TITLE', 0), ['A4', 'C5', 'F5', 'A5'], 1.4, .82, .2, roll=.012)
chord(at('TITLE', 2), ['Bb1', 'Bb2', 'F3'], 1.1, .7, -.3); chord(at('TITLE', 2), ['D5', 'F5', 'Bb5'], .9, .72, .2, roll=.012)
chord(at('TITLE', 3), ['C2', 'C3', 'G3'], 1.1, .7, -.3); chord(at('TITLE', 3), ['E5', 'G5', 'C6'], .9, .72, .2, roll=.012)
gliss(at('TITLE', 4), 'C4', 'C6', bt('TITLE') * 1.3, .45, .7)
chord(at('TITLE', 5.5), ['C2', 'E3', 'G3', 'Bb3'], .5, .6, -.2)          # dominant pickup into the Loaf theme

# ---------------- BAKERY · Andante, the Loaf theme (proud) ----------------
# melody per (beat, pitch, len-beats, vel)
LOAF = [(0, 'C5', 1, .6), (1, 'A4', .5, .55), (1.5, 'F4', .5, .55), (2, 'A4', 1, .58), (3, 'C5', 1, .62),
        (4, 'D5', 1, .64), (5, 'C5', .5, .58), (5.5, 'Bb4', .5, .55), (6, 'A4', 1, .6), (7, 'G4', 1, .52)]
key('lift', at('BAKERY', 1))
for b, p, l, v in LOAF: n(at('BAKERY', b), p, l * bt('BAKERY') * .95, v, .15)
chord(at('BAKERY', 1), ['F5', 'A5'], bt('BAKERY') * 2, .5, .25)            # the lift: a bright upper third blooms
stride('BAKERY', 0, 7, ['F2', 'C2', 'F2', 'C2', 'Bb1', 'F2', 'C2'], [['A3', 'C4', 'F4'], ['A3', 'C4', 'F4'], ['A3', 'C4', 'F4'], ['G3', 'Bb3', 'E4'],
                                                                   ['Bb3', 'D4', 'F4'], ['A3', 'C4', 'F4'], ['G3', 'Bb3', 'E4']], .42)
key('pat', at('BAKERY', 6)); n(at('BAKERY', 6), 'F5', .3, .5, .3)           # a little tap
# the wobble: a nervous trill (G4–A4) that speeds up
key('wobble', at('BAKERY', 7)); tt = at('BAKERY', 7); k = 0
while tt < at('BAKERY', 8) - .02:
    n(tt, 'G4' if k % 2 == 0 else 'Ab4', .12, .42 + .1 * (tt - at('BAKERY', 7)), .1); k += 1
    tt += .09 - .035 * (tt - at('BAKERY', 7)) / bt('BAKERY')
# the fall: glissando down off the sill, a low 'boing' on the bounce, then the double-take sforzando
key('fall', at('BAKERY', 8)); gliss(at('BAKERY', 8), 'C6', 'F3', bt('BAKERY') * .48, .7, .5)
key('bounce', at('BAKERY', 8.5)); chord(at('BAKERY', 8.5), ['F1', 'C2'], .25, .75, -.3); n(at('BAKERY', 8.75), 'C3', .15, .45, -.2)
key('take', at('BAKERY', 9)); chord(at('BAKERY', 9), ['B1', 'F2'], .9, .9, -.3); chord(at('BAKERY', 9), ['Ab4', 'B4', 'D5', 'F5'], .15, .88, .2)
trem(at('BAKERY', 9.2), [['Ab4', 'D5'], ['B4', 'F5']], bt('BAKERY') * .8, 16, .45)

# ---------------- CARD1 · "uh-oh" + accelerando pickup ----------------
key('card1', at('CARD1'))
n(at('CARD1', .3), 'Ab3', bt('CARD1') * .9, .5, 0); n(at('CARD1', 1.3), 'G3', bt('CARD1') * 1.4, .45, 0)   # a sagging "oh-oh"
n(at('CARD1', .3), 'D3', bt('CARD1') * .9, .4, -.2); n(at('CARD1', 1.3), 'C#3', bt('CARD1') * 1.4, .38, -.2)
# chromatic run accelerating into the chase (A minor)
tt = at('CARD1', 2.7); m = midi('E3'); end = at('CARD1', 4.5); dt = .14
while tt < end - .02 and m < midi('E5'):
    n(tt, m2n(m), .12, .4 + .3 * (tt - at('CARD1', 2.7)) / (end - at('CARD1', 2.7)), .1); m += 1; tt += dt; dt = max(.045, dt * .86)

# ---------------- CHASE · Hurry (A minor, 144) ----------------
def hurry(name, b0, b1, v=.5):
    B = bt(name); b = b0
    run = ['A4', 'B4', 'C5', 'D5', 'E5', 'D5', 'C5', 'B4', 'C5', 'D5', 'E5', 'F5', 'E5', 'D5', 'C5', 'B4']
    bass = ['A1', 'E2', 'A1', 'E2', 'F1', 'C2', 'E1', 'B1']; chs = [['A3', 'C4', 'E4'], ['A3', 'C4', 'E4'], ['A3', 'C4', 'F4'], ['G#3', 'B3', 'E4']]
    i = 0
    while b < b1 - 1e-6:
        bi = int(b)
        n(at(name, b), bass[bi % 8], B * .4, v, -.3); n(at(name, b), bass[bi % 8].replace('1', '2').replace('2', '3') if False else bass[bi % 8], B * .4, v * .6, -.3)
        chord(at(name, b + .5), chs[(bi // 2) % 4], B * .3, v * .7, -.1)
        for q in range(4):                                     # right hand in 16ths, in octaves every other bar
            p = run[(i + q) % 16]; n(at(name, b + q * .25), p, B * .24, v * (.85 + .15 * (q == 0)), .2)
            if (bi // 4) % 2: n(at(name, b + q * .25), m2n(midi(p) + 12), B * .22, v * .55, .25)
        i += 4; b += 1
key('chase', at('CHASE')); hurry('CHASE', 0, 6)
key('grab', at('CHASE', 6)); chord(at('CHASE', 6), ['E5', 'A5', 'C6'], .12, .8, .2); gliss(at('CHASE', 6.05), 'A4', 'A6', bt('CHASE') * .8, .5, .7)
key('miss', at('CHASE', 7)); n(at('CHASE', 7), 'E6', .2, .6, .2); n(at('CHASE', 7.5), 'C#6', .35, .5, .2)         # "plink … plonk"
chord(at('CHASE', 7), ['A1', 'E2'], bt('CHASE') * .5, .5, -.3)
hurry('CHASE', 8, 12, .52)

# ---------------- MARKET · Hurry → plank → suspense (stop-time) → crash → tag ----------------
key('market', at('MARKET')); hurry('MARKET', 0, 5, .5)
key('plank', at('MARKET', 5)); chord(at('MARKET', 5), ['C1', 'C#1', 'D1', 'D#1', 'E1', 'C2'], .6, .9, -.3)       # the see-saw: a forearm cluster
gliss(at('MARKET', 5.08), 'C4', 'C7', bt('MARKET') * 1.1, .5, .75)                                              # the melon goes up
# stop-time suspense: a soft diminished tremolo swelling while the audience waits for the melon
trem(at('MARKET', 6.3), [['C#4', 'G4'], ['E4', 'A#4']], at('MARKET', 11.3) - at('MARKET', 6.3), 12, .22, .25)
# the constable's walk (Misterioso): staccato low steps on the beat
key('copIn', at('MARKET', 8))
for i, p in enumerate(['A1', 'C2', 'E2', 'C2', 'A1']): n(at('MARKET', 8 + i * .5), p, .18, .48, -.3)
key('copLook', at('MARKET', 10)); n(at('MARKET', 10), 'E2', .3, .5, -.3); n(at('MARKET', 10.5), 'F2', .3, .5, -.3); n(at('MARKET', 11), 'F#2', .3, .55, -.3)
gliss(at('MARKET', 11.3), 'C7', 'C5', at('MARKET', 12) - at('MARKET', 11.3) - .02, .55, .7)                        # the melon comes down
key('melonDown', at('MARKET', 12))
chord(at('MARKET', 12), ['C1', 'F#1', 'C2', 'F#2'], 1.2, .95, -.3); chord(at('MARKET', 12), ['C5', 'F#5', 'A5', 'C6', 'F#6'], .8, .9, .25)
n(at('MARKET', 12.5), 'A1', .4, .6, -.3)                                                                        # knees buckle
# the fist-shaking tag: agitated octave stabs
for i in range(6): chord(at('MARKET', 13.2 + i * .45), ['E4', 'E5'] if i % 2 == 0 else ['F4', 'F5'], .16, .62, .2)
for i in range(6): n(at('MARKET', 13.2 + i * .45), 'A1' if i % 2 == 0 else 'E1', .16, .55, -.3)

# ---------------- CARD2 · Agitato tremolo (the card shakes) ----------------
key('card2', at('CARD2'))
trem(at('CARD2'), [['D4', 'G#4', 'D5'], ['F4', 'B4', 'F5']], SEC['CARD2']['dur'] * .92, 16, .55, .15)
for i in range(6): n(at('CARD2', i), 'A1' if i % 2 == 0 else 'A2', .2, .62, -.3)

# ---------------- ROLL · ritardando (88) — the theme slows with the loaf ----------------
key('roll', at('ROLL'))
for b, p, v in [(0, 'C5', .5), (1.1, 'A4', .46), (2.3, 'G4', .42), (3.6, 'F4', .38)]:
    n(at('ROLL', b), p, 1.0, v, .15); n(at('ROLL', b), ['F2', 'F2', 'C2', 'D2'][int(b) % 4], 1.0, v * .7, -.25)
key('stop', at('ROLL', 5)); chord(at('ROLL', 5), ['F2', 'C3', 'A3'], 2.2, .34, -.1); n(at('ROLL', 5.35), 'F4', .5, .22, .1); n(at('ROLL', 5.65), 'F4', .5, .16, .1)

# ---------------- SIL · silence (projector only) ----------------
key('silence', at('SIL'))

# ---------------- CARD3 · reed organ enters pp ----------------
key('card3', at('CARD3'))
ORG = 'accordion'
EV.append(dict(t=at('CARD3', .1), inst=ORG, pitch='F3', dur=SEC['CARD3']['dur'] + .3, vel=.22, pan=-.15, attack=1.2))
EV.append(dict(t=at('CARD3', .1), inst=ORG, pitch='A3', dur=SEC['CARD3']['dur'] + .3, vel=.2, pan=.15, attack=1.4))
EV.append(dict(t=at('CARD3', .1), inst=ORG, pitch='C4', dur=SEC['CARD3']['dur'] + .3, vel=.18, pan=0, attack=1.6))

# ---------------- TENDER · Tenderly (72) — the Loaf theme, slow, with reed organ ----------------
key('tender', at('TENDER'))
TB = bt('TENDER')
TEND = [(0, 'C5', 1, .44), (1, 'A4', .5, .4), (1.5, 'F4', .5, .38), (2, 'A4', 1, .42), (3, 'C5', 1, .45),
        (4, 'D5', 1, .46), (5.5, 'C5', .5, .42), (6, 'Bb4', .5, .42), (6.5, 'A4', .5, .42),
        (7, 'C5', .5, .5), (7.5, 'F5', 1.5, .55), (9, 'E5', .5, .45), (9.5, 'F5', 2.5, .5)]
for b, p, l, v in TEND: n(at('TENDER', b), p, l * TB * .98, v, .12)
HARM = [(0, ['F3', 'A3', 'C4']), (2, ['F3', 'A3', 'C4']), (4, ['Bb2', 'D3', 'F3']), (6, ['C3', 'E3', 'G3', 'Bb3']), (8, ['F3', 'A3', 'C4']), (10, ['Bb2', 'D3', 'F3']), (12, ['C3', 'F3', 'A3'])]
for b, ch in HARM:
    for i, p in enumerate(ch): EV.append(dict(t=at('TENDER', b), inst=ORG, pitch=p, dur=2 * TB + .15, vel=.2, pan=(i - 1) * .15, attack=.25))
# broken-chord left hand in eighths
LH = {0: ['F2', 'C3', 'A3', 'C3'], 2: ['F2', 'C3', 'A3', 'C3'], 4: ['Bb1', 'F2', 'D3', 'F2'], 6: ['C2', 'G2', 'Bb2', 'G2'], 8: ['F2', 'C3', 'A3', 'C3'], 10: ['Bb1', 'F2', 'D3', 'F2'], 12: ['C2', 'F2', 'A2', 'C3']}
for b0, ps in LH.items():
    for i in range(4): n(at('TENDER', b0 + i * .5), ps[i], TB * .6, .3, -.2)
key('crack', at('TENDER', 5)); chord(at('TENDER', 5), ['E6', 'F6'], .09, .55, .3)            # the crust cracks: a crisp little rest
key('herLift', at('TENDER', 7)); key('hisLift', at('TENDER', 8))
# IRIS: the theme resolves; the wink = a grace note up top
key('wink', HIT['wink']); n(HIT['wink'] - .06, 'C7', .15, .35, .3); n(HIT['wink'], 'E7', .5, .42, .3)

# ---------------- END · finale + runout ----------------
key('end', at('END'))
chord(at('END', 0), ['F1', 'F2', 'C3', 'F3'], 3.5, .6, -.2); chord(at('END', 0), ['A4', 'C5', 'F5', 'A5', 'C6'], 3.0, .55, .2, roll=.03)
EV.append(dict(t=at('END', 0), inst=ORG, pitch='F3', dur=3.2, vel=.2, pan=0, attack=.05))

mix = S.render(EV, dur=DUR + 1.5)
mix = S.room(mix, size=.28, mix=.14)          # a small picture house
mix = mix[:int(round(DUR * SR))]
# section gains: lift the quiet final act (it is played softly, but must not sink under the projector),
# and let the stop chord die away inside the SILENCE so the silence is real
tt = np.arange(len(mix)) / SR
pts = [(0, 0), (at('ROLL'), 0), (at('ROLL') + .3, 3.5), (at('SIL') + .1, 3.5), (at('SIL') + .9, -30), (at('CARD3'), -30), (at('CARD3') + .05, 5), (DUR + 1, 5)]
gdb = np.interp(tt, [p[0] for p in pts], [p[1] for p in pts])
mix = (mix * (10 ** (gdb / 20))[:, None]).astype(np.float32)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR)
json.dump({'keys': KEYS}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
open(os.path.join(HERE, 'CREDITS_music.txt'), 'w').write('\n'.join(S.credits([P, ORG])) + '\n')
print('score.wav', round(len(mix) / SR, 2), 's, events', len(EV), 'peak', round(float(np.abs(mix).max()), 3))
