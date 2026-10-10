"""Original score for 'The Dragon of the East Window' (D Dorian, plainchant / medieval church colour).
Run: .venv/bin/python styles/stained-glass/demo/music/score.py  ->  music/score.wav, music/stems/*.wav, music/cues.json
"""
import sys, os, json, numpy as np, soundfile as sf
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR
HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 56.5; N = int(DUR * SR); B = .75; E8 = .375
S.seed(7)

def stem(events, size=.82, mix=.3, damp=.5):
    x = S.render(events, dur=DUR, master=False)
    x = x[:N] if len(x) >= N else np.vstack([x, np.zeros((N - len(x), 2), np.float32)])
    return S.room(x, size=size, mix=mix, damp=damp).astype(np.float32)

def zero(x, a, b=DUR, fade=.015):
    i, j, f = int(a * SR), int(b * SR), int(fade * SR)
    if f and i - f > 0: x[i - f:i] *= np.linspace(1, 0, f)[:, None]
    x[i:j] = 0

def ramp(x, a, b, g0, g1):
    i, j = int(a * SR), int(b * SR); x[i:j] *= np.linspace(g0, g1, j - i)[:, None]

# ------------------------------------------------------------------ drone (organ pedal + soft organ)
drone = []
drone += [(.5, 'organ_pedal', 'D2', 15.3, .42, 0, .55, ), ]
drone += [dict(t=.5, inst='organ_soft', pitch='D3', dur=15.2, vel=.35, pan=-.2, attack=2.5), dict(t=.5, inst='organ_soft', pitch='A3', dur=15.2, vel=.3, pan=.2, attack=3.0)]
# dawn pad Dm -> G
drone += [dict(t=9.6, inst='organ_soft', pitch=p, dur=3.0, vel=.3, pan=0, attack=.6) for p in ('F3', 'D4')]
drone += [dict(t=12.6, inst='organ_soft', pitch=p, dur=3.0, vel=.3, pan=0, attack=.6) for p in ('G3', 'B3', 'D4')]
# noon chords F C G Dm (2 beats each)
for k, ch in enumerate([('F3', 'A3', 'C4'), ('E3', 'G3', 'C4'), ('D3', 'G3', 'B3'), ('D3', 'F3', 'A3')]):
    for p in ch: drone.append(dict(t=17.2 + k * 1.5, inst='organ_soft', pitch=p, dur=1.55, vel=.32, pan=0, attack=.15))
drone.append(dict(t=17.2, inst='organ_pedal', pitch='F2', dur=3.0, vel=.35, pan=0)); drone.append(dict(t=20.2, inst='organ_pedal', pitch='G2', dur=2.4, vel=.35, pan=0))
# ember chords (tender, free)
for t0, d, ch in [(33.8, 2.6, ('D3', 'A3', 'E4', 'F4')), (36.4, 2.4, ('Bb2', 'F3', 'D4', 'A4')), (38.8, 1.8, ('C3', 'F3', 'A3', 'C4')),
                  (40.6, 2.2, ('G2', 'D3', 'Bb3', 'D4')), (42.8, 1.8, ('A2', 'E3', 'A3', 'D4'))]:
    for p in ch: drone.append(dict(t=t0, inst='organ_soft', pitch=p, dur=d + .3, vel=.3, pan=0, attack=.9))
# nocturne drone + open fifth arrival
drone += [dict(t=47.2, inst='organ_soft', pitch='D3', dur=8.6, vel=.3, pan=-.15, attack=1.8), dict(t=47.8, inst='organ_soft', pitch='A3', dur=8.0, vel=.26, pan=.15, attack=1.8)]
drone += [dict(t=52.9, inst='organ_pedal', pitch='D2', dur=3.3, vel=.3, pan=0, attack=.8), dict(t=52.9, inst='organ_soft', pitch='A4', dur=3.2, vel=.22, pan=0, attack=.8)]
DRONE = stem(drone, .85, .32)
ramp(DRONE, .5, 2.5, 0, 1)

# ------------------------------------------------------------------ melody (recorder chant)
mel = []
chantA = [(0, 'D5', .7), (.7, 'F5', .45), (1.15, 'G5', .45), (1.6, 'A5', .9), (2.5, 'C6', .5), (3.0, 'B5', .4), (3.4, 'A5', .5), (3.9, 'G5', .4), (4.3, 'A5', 1.2)]
for dt, p, d in chantA: mel.append(dict(t=4.7 + dt, inst='recorder', pitch=p, dur=d, vel=.5, pan=.1, attack=.04))
for dt, p, d in [(0, 'A5', .38), (.375, 'B5', .38), (.75, 'C6', .7), (1.5, 'A5', .9)]: mel.append(dict(t=13.95 + dt, inst='recorder', pitch=p, dur=d, vel=.4, pan=.1, attack=.04))
for dt, p, d in [(0, 'D6', .35), (.375, 'E6', .35), (.75, 'D6', .5)]: mel.append(dict(t=17.2 + dt, inst='recorder', pitch=p, dur=d, vel=.45, pan=.1, attack=.03))
for dt, p, d in [(0, 'C6', .36), (.375, 'D6', .36), (.75, 'E6', .36), (1.125, 'D6', .36)]: mel.append(dict(t=21.3 + dt, inst='recorder', pitch=p, dur=d, vel=.45, pan=.1, attack=.03))
# nocturne reprise (slower, softer), first half before the voice, arrival on the end card
for dt, p, d in [(0, 'D5', .9), (.9, 'F5', .6), (1.5, 'G5', .6), (2.1, 'A5', 1.4)]: mel.append(dict(t=47.4 + dt, inst='recorder', pitch=p, dur=d, vel=.36, pan=.1, attack=.08))
for dt, p, d in [(0, 'G5', .5), (.5, 'E5', .5), (1.0, 'D5', 2.2)]: mel.append(dict(t=52.4 + dt, inst='recorder', pitch=p, dur=d, vel=.34, pan=.1, attack=.08))
MEL = stem(mel, .82, .3)

# ------------------------------------------------------------------ harp + chimes (+ welds)
hc = []
arpDm = ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3']; arpG = ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3']
for bar, arp in [(9.6, arpDm), (12.6, arpG)]:
    for k in range(8): hc.append(dict(t=bar + k * E8, inst='harp', pitch=arp[k], dur=1.2, vel=.42 + (.08 if k == 0 else 0), pan=-.3))
hc += [dict(t=9.6, inst='hand_chimes', pitch='D5', dur=3, vel=.35, pan=.3), dict(t=9.6, inst='hand_chimes', pitch='A5', dur=3, vel=.3, pan=.35),
       dict(t=12.6, inst='hand_chimes', pitch='G5', dur=3, vel=.35, pan=.3), dict(t=12.6, inst='hand_chimes', pitch='D6', dur=3, vel=.28, pan=.35),
       dict(t=11.1, inst='hand_chimes', pitch='D6', dur=2.5, vel=.55, pan=.2)]
noon = [['F3', 'C4', 'F4', 'A4'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3'], ['D3', 'A3', 'D4', 'F4']]
for k in range(15):
    t0 = 17.2 + k * E8
    if t0 >= 22.6: break
    ch = noon[min(3, int((t0 - 17.2) / 1.5))]; hc.append(dict(t=t0, inst='harp', pitch=ch[k % 4], dur=1.0, vel=.45 if k % 2 == 0 else .36, pan=-.3))
hc += [dict(t=17.2, inst='tubular_bells', pitch='D5', dur=4, vel=.45, pan=.2), dict(t=17.2, inst='hand_chimes', pitch='F5', dur=3, vel=.32, pan=.35),
       dict(t=20.2, inst='hand_chimes', pitch='G5', dur=2.5, vel=.3, pan=.35), dict(t=20.2, inst='glockenspiel', pitch='D6', dur=1.5, vel=.25, pan=.4)]
# ember: sparse chimes, harp harmonics (high soft notes)
hc += [dict(t=35.2, inst='hand_chimes', pitch='A5', dur=3, vel=.28, pan=.3), dict(t=37.8, inst='hand_chimes', pitch='F5', dur=3, vel=.26, pan=-.2),
       dict(t=40.2, inst='hand_chimes', pitch='D6', dur=3, vel=.26, pan=.3), dict(t=34.5, inst='harp', pitch='D6', dur=2, vel=.22, pan=-.3),
       dict(t=39.5, inst='harp', pitch='A5', dur=2, vel=.22, pan=-.3)]
WELDS = [41.75, 42.5, 43.25, 44.0]
for t0, p, q in zip(WELDS, ['D5', 'E5', 'F5', 'G5'], ['D6', 'E6', 'F6', 'G6']):
    hc += [dict(t=t0, inst='glass', pitch=p, dur=1.2, vel=.5, pan=.15), dict(t=t0, inst='hand_chimes', pitch=q, dur=1.2, vel=.32, pan=-.15)]
# nocturne harp harmonics + end-card arrival
hc += [dict(t=48.2, inst='harp', pitch='A5', dur=2, vel=.2, pan=-.3), dict(t=52.9, inst='harp', pitch='D5', dur=3, vel=.28, pan=-.3), dict(t=52.9, inst='harp', pitch='A5', dur=3, vel=.24, pan=.3)]
HC = stem(hc, .82, .3)

# ------------------------------------------------------------------ battle (organ full + pedal + timpani)
bt = []
for k, (r, ped) in enumerate([('D3', 'D2'), ('C3', 'C2'), ('Bb2', 'Bb1'), ('C3', 'C2')] * 3):
    t0 = 22.6 + k * 1.5
    if t0 >= 31.8: break
    bt.append(dict(t=t0, inst='organ_pedal', pitch=ped, dur=1.55, vel=.5, pan=0))
    for j in range(4):
        tt = t0 + j * E8
        if tt < 31.8: bt.append(dict(t=tt, inst='organ', pitch=r, dur=.3, vel=.5 + (.1 if j == 0 else 0), pan=-.1))
for tc, p in [(24.75, 'D3'), (26.25, 'A2'), (27.75, 'D3'), (29.25, 'A2')]:
    bt.append(dict(t=tc, inst='timpani', pitch=p, dur=2, vel=.9, pan=0))
    for q in ('D4', 'F4', 'A4'): bt.append(dict(t=tc, inst='organ', pitch=q, dur=.55, vel=.45, pan=.1))
tt, rate = 30.0, 7.0
while tt < 31.75:
    u = (tt - 30.0) / 1.8
    bt.append(dict(t=tt, inst='timpani', pitch='D3', dur=.5, vel=.3 + .65 * u, pan=0)); rate = 7 + 15 * u; tt += 1 / rate
BT = stem(bt, .8, .26)
ramp(BT, 22.6, 23.4, 0, 1)

# ------------------------------------------------------------------ bell + glass (the 'light')
gl = [dict(t=.5, inst='glass', pitch='D6', dur=3, vel=.45, pan=0), dict(t=5.4, inst='glass', pitch='D6', dur=2.5, vel=.4, pan=-.2),
      dict(t=5.45, inst='glass', pitch='A5', dur=2.5, vel=.35, pan=.2), dict(t=5.4, inst='hand_chimes', pitch='D6', dur=3, vel=.3, pan=.3),
      dict(t=5.5, inst='hand_chimes', pitch='A6', dur=3, vel=.24, pan=-.3)]
for k, p in enumerate(['D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6']): gl.append(dict(t=15.6 + k * .2, inst='glass', pitch=p, dur=1.4, vel=.32 + k * .02, pan=-.4 + k * .1))
gl.append(dict(t=55.2, inst='glass', pitch='D6', dur=2.5, vel=.42, pan=0))
GL = stem(gl, .85, .32)
bell = S.render([dict(t=44.6, inst='tubular_bells', pitch='D4', dur=9, vel=.8, pan=0, release=6)], dur=DUR, master=False)[:N]
bell = S.room(bell, size=.96, mix=.55, damp=.35).astype(np.float32)
BG = GL + bell

# ------------------------------------------------------------------ hard windows
stems = {'drone': DRONE, 'melody': MEL, 'harp_chimes': HC, 'battle': BT, 'bell_glass': BG}
for k, x in stems.items(): zero(x, 0, .5, fade=0)
zero(BT, 31.8)                          # battle ends dead at the blow, reverb included
for k, x in stems.items(): zero(x, 31.8, 33.8)   # true silence for the crack
for k in ('drone', 'melody', 'harp_chimes', 'battle'): zero(stems[k], 44.6, 47.2, fade=.04)   # only the bell
GL_part = BG - bell; zero(GL_part, 44.6, 47.2); stems['bell_glass'] = GL_part + bell * (np.arange(N) >= int(44.6 * SR))[:, None]
zero(stems['bell_glass'], 0, .5, fade=0); zero(stems['bell_glass'], 31.8, 33.8)
for x in stems.values(): ramp(x, 55.6, DUR, 1, 0)
gains = {'drone': .9, 'melody': 1.0, 'harp_chimes': .95, 'battle': 1.0, 'bell_glass': 1.0}
mix = sum(stems[k] * gains[k] for k in stems)
pk = np.abs(mix).max(); norm = .9 / pk if pk > .9 else 1.0
mix *= norm
for k, x in stems.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), (x * gains[k] * norm).astype(np.float32), SR, subtype='FLOAT')
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
cues = {'C1_incipit': .5, 'title': 5.4, 'C2_dawn': 9.6, 'sword': 11.1, 'T1_glass_rise': 15.6, 'C3_noon': 17.2, 'C4_battle': 22.6,
        'clashes': [24.75, 26.25, 27.75, 29.25], 'roll': [30.0, 31.8], 'hard_stop': 31.8, 'silence': [31.8, 33.8], 'C5_ember': 33.8,
        'welds': WELDS, 'bell': 44.6, 'bell_only': [44.6, 47.2], 'C7_nocturne': 47.2, 'endcard_fifth': 52.9, 'dawn_glass': 55.2, 'fade': [55.6, 56.5], 'norm_gain': norm}
json.dump(cues, open(os.path.join(HERE, 'cues.json'), 'w'), indent=1)

# ------------------------------------------------------------------ self-check
def rms(x, a, b): s = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12)
secs = [(0, .5), (.5, 9.6), (9.6, 15.6), (15.6, 17.2), (17.2, 22.6), (22.6, 31.8), (31.8, 33.8), (33.8, 44.6), (44.6, 47.2), (47.2, 52.9), (52.9, 56.5)]
print('section        ' + ' '.join(f'{k[:9]:>10}' for k in stems) + '       mix')
for a, b in secs: print(f'{a:5.1f}-{b:5.1f}  ' + ' '.join(f'{rms(stems[k] * gains[k] * norm, a, b):10.1f}' for k in stems) + f'{rms(mix, a, b):10.1f}')
print('silence 31.8-33.8 max abs per stem:', {k: float(np.abs(x[int(31.8 * SR):int(33.8 * SR)]).max()) for k, x in stems.items()})
print('44.6-47.2 max abs (non-bell stems):', {k: float(np.abs(stems[k][int(44.6 * SR):int(47.2 * SR)]).max()) for k in ('drone', 'melody', 'harp_chimes', 'battle')})
print('peak', float(np.abs(mix).max()), 'len', len(mix) / SR)
print(S.credits(['recorder', 'organ', 'organ_soft', 'organ_pedal', 'harp', 'hand_chimes', 'tubular_bells', 'timpani', 'glass', 'glockenspiel']))
