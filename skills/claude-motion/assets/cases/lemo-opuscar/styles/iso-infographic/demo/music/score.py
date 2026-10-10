"""From Bean to Cup — original score (acoustic world groove). Run from the repo root:
.venv/bin/python styles/iso-infographic/demo/music/score.py
→ music/score.wav (48 kHz stereo), music/stems/*.wav, music/score.json (cue keys for tools/cuecheck.py)
Grid and cues come from demo/timeline.js (read through node) so picture and music share one source of truth."""
import sys, os, json, subprocess
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(DEMO, '../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR, add

TL = json.loads(subprocess.check_output(['node', '-e', "import('./timeline.js').then(m=>console.log(JSON.stringify(m.TL)))"], cwd=DEMO))
DUR = TL['END']; N = int(DUR * SR) + SR
S.seed(7)
stems = {k: np.zeros((N, 2), np.float32) for k in ['guitar', 'kalimba', 'perc', 'bass']}
keys = {}
def put(stem, x, t, g=1.0, pan=0.0):
    if t < 0 or t >= DUR: return
    add(stems[stem], x.astype(np.float32), t, g, pan)
def gtr(p, t, v=.6, d=1.2, pan=-.22, g=1.0): put('guitar', S.note('guitar_nylon', p, d, vel=v), t, g, pan)
def kal(p, t, v=.6, d=1.6, pan=.25, g=1.0): put('kalimba', S.note('kalimba', p, d, vel=v), t, g, pan)
def bas(p, t, v=.7, d=1.0, g=1.0): put('bass', S.note('jazz_bass', p, d, vel=v), t, g, 0)
def hit(inst, var, t, v=.7, pan=0., g=1.0): put('perc', S.hit(inst, var, vel=v), t, g, pan)

B = .6; BAR = 2.4; B2 = .75
CH = {'D': ['D3', 'A3', 'D4', 'F#4'], 'A': ['A2', 'E3', 'A3', 'C#4'], 'Bm': ['B2', 'F#3', 'B3', 'D4'], 'G': ['G2', 'D3', 'G3', 'B3'], 'Em': ['E2', 'B2', 'E3', 'G3'], 'F#m': ['F#2', 'C#3', 'F#3', 'A3']}
ROOTB = {'D': 'D2', 'A': 'A1', 'Bm': 'B1', 'G': 'G1', 'Em': 'E2', 'F#m': 'F#1'}
PROG = ['D', 'A', 'Bm', 'G']
def chord_at(t, prog=PROG): return prog[int(t // BAR) % len(prog)]
def pick_bar(t0, ch, v=.55, g=1.0, half=False, n=8):   # fingerpicked eighths: bass, 5th, octave, 3rd, 5th, octave, 3rd, octave
    c = CH[ch]; pat = [0, 1, 2, 3, 1, 2, 3, 2][:n]
    for i, q in enumerate(pat):
        if half and i % 2: continue
        gtr(c[q], t0 + i * B / 2, v * (1.0 if i in (0, 4) else .72), 1.4 if i == 0 else .9, g=g)
def strum(t, ch, v=.55, up=False, g=1.0):
    c = CH[ch] + [CH[ch][2]]; order = c[::-1] if up else c
    for i, p in enumerate(order): gtr(p, t + i * .012, v * (.8 if up else 1), .5, g=g)

# ---------- A 0–4.8: harmonics + the bean motif ----------
for t, p in [(0.0, 'D5'), (0.6, 'A4'), (1.2, 'F#5')]: gtr(p, t, .28, 2.5, pan=-.1)
for t, p in [(TL['LAND'], 'A4'), (TL['LAND'] + .3, 'F#4'), (TL['LAND'] + .6, 'D4')]: kal(p, t, .75)
keys['land'] = TL['LAND']
gtr('D3', 3.6, .35, 2.0); gtr('A3', 3.9, .3, 1.8); gtr('D4', 4.2, .3, 1.6)
# ---------- B 4.8–10.8 ----------
keys['groove_in'] = 4.8
for b in range(int(4.8 / B * 2), int(43.8 / B * 2)):                                 # shaker eighths 4.8 → 43.8 (gaps set below)
    t = b * B / 2
    if 22.8 <= t < 25.2 or 27.6 + 1.2 <= t < 34.8 or 33.6 <= t < 34.8: continue
    hit('shaker', 'down' if b % 2 == 0 else 'up', t, .42 if b % 2 == 0 else .3, .4, .55)
for bt in [4.8, 7.2, 9.6, 12.0, 14.4, 16.8, 19.2]: pick_bar(bt, chord_at(bt), .5 if bt < 16 else .45)
pick_bar(21.6, chord_at(21.6), .45, n=4)
keys['title'] = TL['TITLE_WORDS']
for i, t in enumerate(TL['TITLE_WORDS']): kal(['D5', 'E5', 'F#5', 'A5'][i], t, .32, .8, pan=.4, g=.7)
keys['cut'] = TL['CUT']; hit('world_perc', 'claves', TL['CUT'], .55, .2, .6)
mel_b = [(7.2, 'F#4'), (7.5, 'A4'), (7.8, 'B4'), (8.4, 'A4'), (9.6, 'D5'), (9.9, 'B4'), (10.2, 'A4')]
for t, p in mel_b: kal(p, t, .45)
# ---------- C 10.8–15.6: + bongo, rakes, suns ----------
for b in range(int(10.8 / B), int(15.6 / B)):
    t = b * B
    hit('world_perc', 'bongo_high', t + B / 2, .38, -.35, .7)
    if b % 2: hit('world_perc', 'bongo_muted', t + .75 * B, .3, -.35, .6)
keys['rakes'] = TL['RAKES']
for t in TL['RAKES']: hit('world_perc', 'bongo_low_high_velocity', t, .7, -.3, .9)
keys['suns'] = TL['SUNS']
sun_notes = ['D5', 'E5', 'F#5', 'A5', 'B5']
for i, t in enumerate(TL['SUNS']): kal(sun_notes[i % 5] if i < 20 else 'D6', t, .18 + .1 * (i / 20), .5, pan=.45, g=.55)
pick_bar(6 * BAR, 'Bm', .45);
for bar in range(7, 16): pass
# ---------- D 15.6–22.8: bass, cajon, congas; containers ----------
keys['bass_in'] = 18.0
for b in range(int(15.6 / B), int(22.8 / B)):
    t = b * B
    beat = b % 4
    hit('cajon', 'bass' if beat in (0, 2) else 'slap', t, .55 if beat in (0, 2) else .45, 0, .75)
    hit('conga', 'conga' if beat % 2 else 'muted', t + B / 2, .35, -.3, .6)
    if t >= 18.0: bas(ROOTB[chord_at(t)] if beat in (0, 2) else (ROOTB[chord_at(t)][:-1] + str(int(ROOTB[chord_at(t)][-1]) + 1)), t, .6 if beat in (0, 2) else .45, .5)
keys['load'] = [TL['LOAD0']] + TL['DECK_CRANE'] + TL['DECK_EIGHTH']
for t in keys['load']: hit('cajon', 'bass', t, .85, 0, 1.0); bas('D2', t, .8, .4, 1.1)
keys['cascade'] = TL['CASCADE']
for i in range(4): hit('conga', 'quinto', TL['CASCADE'] + i * .15, .45 + i * .1, -.2, .8); hit('conga', 'tumba', TL['CASCADE'] + i * .15 + .075, .4 + i * .1, .2, .7)
keys['depart'] = TL['DEPART']; hit('cajon', 'bass', TL['DEPART'], .8); bas('D2', TL['DEPART'], .8, 1.4)
# ---------- E1 22.8–25.2: breath ----------
keys['sea'] = TL['SEA0']
bas('D2', 22.8, .6, 2.4); bas('D2', 24.0, .45, 1.2)
for t, p in [(22.8, 'A4'), (23.4, 'B4'), (23.7, 'A4'), (24.0, 'F#4'), (24.6, 'E4'), (24.9, 'F#4')]: kal(p, t, .5, 2.0)
# ---------- E2 25.2–27.6: full band, B minor colour ----------
keys['ff'] = TL['FF0']
FF = ['Bm', 'G', 'D', 'A']
for b in range(int(25.2 / (B / 4)), int(30.0 / (B / 4)) + 1):
    t = b * B / 4
    if t < 25.2 - 1e-6 or t >= 30.0: continue
    q = b % 4
    if t < 28.8:
        hit('conga', 'conga' if q in (0, 3) else 'muted', t, .5 if q == 0 else .33, -.3, .7)
        hit('shaker', 'down' if q % 2 == 0 else 'up', t, .35, .4, .5)
for i, t in enumerate(np.arange(25.2, 27.9 - 1e-6, B / 2)):
    ch = FF[int((t - 25.2) // 1.2) % 4]
    if t < 27.9: strum(t, ch, .5 if i % 2 == 0 else .38, up=i % 2 == 1)
for b in range(int(25.2 / B), int(30.0 / B)):
    t = b * B; ch = FF[int((t - 25.2) // 1.2) % 4]
    bas(ROOTB[ch], t, .7 if b % 2 == 0 else .5, .5)
    if t < 28.8: hit('cajon', 'bass' if b % 2 == 0 else 'slap', t, .6, 0, .8)
for t, p in [(25.2, 'D5'), (25.5, 'B4'), (25.8, 'A4'), (26.4, 'F#4'), (26.7, 'A4'), (27.0, 'B4'), (27.3, 'C#5')]: kal(p, t, .5, 1.0)
keys['dive'] = [TL['DIVE0'], TL['HULL'], TL['BOX_CUT'], TL['SACK_CUT']]; keys['silence'] = TL['SIL0']
bas('D1', 29.4, .7, .9); bas('D1', 29.7, .5, .5)
# ---------- G 33.6: horn hit, then the city groove ----------
keys['horn'] = TL['HORN']
bas('D1', 33.6, .95, 2.2, 1.3); hit('cajon', 'bass', 33.6, 1.0, 0, 1.1); hit('conga', 'tumba', 33.6, .7, 0, .8)
keys['groove_back'] = 34.8
for b in range(int(34.8 / B), int(40.8 / B)):
    t = b * B; beat = b % 4
    hit('world_perc', 'darbuka_doom' if beat in (0, 2) else 'darbuka_tak', t, .55 if beat in (0, 2) else .4, -.25, .75)
    if beat == 3: hit('world_perc', 'darbuka_pa', t + B / 2, .35, -.25, .6)
    bas(ROOTB[chord_at(t)], t, .6 if beat in (0, 2) else .42, .5)
for bar_t in [34.8, 37.2]: pick_bar(bar_t, chord_at(bar_t), .45)
pick_bar(39.6, 'G', .4, half=True)
keys['pour'] = TL['POUR']; kal('A4', TL['POUR'], .45); kal('D5', TL['POUR'] + .3, .4)
keys['cracks'] = TL['CRACKS']
for t in TL['CRACKS']: hit('world_perc', 'darbuka_tak', t, .5, .3, .7)
# ---------- H 40.8–45.3: café, lighter, ritardando to a stop ----------
keys['cafe'] = TL['CAFE0']
for bar_t in [40.8]: pick_bar(bar_t, 'D', .45)
for t, p in [(40.8, 'F#4'), (41.1, 'A4'), (41.4, 'B4'), (42.0, 'A4'), (42.6, 'F#4'), (43.2, 'E4')]: kal(p, t, .42, 1.2)
keys['grind'] = TL['GRIND']
for i, (t, p) in enumerate([(43.2, 'G2'), (43.5, 'D3'), (43.8, 'G3'), (44.2, 'B3'), (44.7, 'D4')]): gtr(p, t, .45 - i * .04, 1.4)   # rit: gaps widen
keys['tamp'] = TL['TAMP']; keys['lock'] = TL['LOCK']; keys['stop'] = TL['SIL2']
# ---------- I 45.9 → : 80 BPM, one guitar ----------
keys['drop'] = TL['DROP']
t0 = TL['DROP'] + B2
solo = [('D3', 0), ('A3', .5), ('F#4', 1), ('A3', 1.5), ('E4', 2), ('A3', 2.5), ('D4', 3), ('A3', 3.5),
        ('B2', 4), ('F#3', 4.5), ('D4', 5), ('F#3', 5.5), ('C#4', 6), ('F#3', 6.5), ('B3', 7), ('F#3', 7.5),
        ('G2', 8), ('D3', 8.5), ('B3', 9), ('D3', 9.5), ('A3', 10), ('D3', 10.5), ('G3', 11), ('D3', 11.5)]
for p, bt in solo:
    t = t0 + bt * B2
    if t < TL['CARD'] - .05: gtr(p, t, .5 if bt % 1 == 0 else .36, 1.6, pan=-.15)
keys['clink'] = TL['CLINK']
keys['hand'] = TL['HAND']
for i, p in enumerate(['A4', 'F#4', 'D4']): kal(p, TL['HAND'] + i * .375, .7, 2.0)
keys['stations'] = TL['FULL_STATIONS']
for i, t in enumerate(TL['FULL_STATIONS']): kal(['D4', 'E4', 'F#4', 'A4', 'B4', 'C#5', 'D5'][i], t, .5 + .03 * i, 1.8, pan=-.3 + .1 * i)
# ---------- tail: D add9 ----------
keys['card'] = TL['CARD']
for i, p in enumerate(['D3', 'A3', 'D4', 'E4', 'F#4', 'A4']): gtr(p, TL['CARD'] + i * .06, .5, 4.0, pan=-.15)
kal('E5', TL['CARD'] + .4, .45, 3.0); kal('A4', TL['CARD'] + .75, .4, 3.0)

# ---------- mix: dive low-pass sweep, hard silences, balance ----------
def lp(x, f): sos = butter(2, f, 'low', fs=SR, output='sos'); return sosfilt(sos, x, axis=0).astype(np.float32)
def env(times, vals):
    tt = np.arange(N) / SR; return np.interp(tt, times, vals).astype(np.float32)[:, None]
# dive: guitar out at HULL, perc out at BOX_CUT, low-pass the whole music bus 27.6 → 30.0
stems['guitar'] *= env([0, TL['HULL'], TL['HULL'] + .25, DUR], [1, 1, 0, 0]) + env([0, TL['HORN'] - .01, TL['HORN'], DUR], [0, 0, 1, 1])
stems['perc'] *= env([0, TL['BOX_CUT'], TL['BOX_CUT'] + .2, TL['HORN'] - .01, TL['HORN'], DUR], [1, 1, 0, 0, 1, 1])
stems['kalimba'] *= env([0, TL['BOX_CUT'], TL['BOX_CUT'] + .3, TL['HORN'] - .01, TL['HORN'], DUR], [1, 1, 0, 0, 1, 1])
mix = sum(stems[k] * g for k, g in [('guitar', .8), ('kalimba', 1.45), ('perc', .9), ('bass', .6)])
fs = [18000, 5000, 1500, 600, 300]; lps = [mix] + [lp(mix, f) for f in fs[1:]]
tt = np.arange(N) / SR; w = np.clip((tt - TL['DIVE0']) / (TL['SIL0'] - TL['DIVE0']), 0, 1) * (len(fs) - 1)
w[tt >= TL['HORN']] = 0
out = np.zeros_like(mix)
for i, x in enumerate(lps): out += x * np.clip(1 - np.abs(w - i), 0, 1)[:, None]
# the two real silences + the tail fade
gate = env([0, TL['SIL0'] - .06, TL['SIL0'], TL['HORN'] - .005, TL['HORN'], TL['SIL2'] - .12, TL['SIL2'], TL['DROP'] - .005, TL['DROP'], DUR - .5, DUR], [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0])
out *= gate
for k in stems: stems[k] *= gate
out = out[:int(DUR * SR)]
pk = np.abs(out).max(); out *= .9 / pk
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), out, SR)
for k, x in stems.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), (x[:int(DUR * SR)] * .9 / pk).astype(np.float32), SR)
json.dump({'dur': DUR, 'keys': keys}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
# band check
def band(lo, hi):
    X = np.abs(np.fft.rfft(out.mean(1)[::4])) ** 2; f = np.fft.rfftfreq(len(out[::4]), 4 / SR); return 10 * np.log10(X[(f >= lo) & (f < hi)].sum() / X.sum() + 1e-12)
print('score.wav', round(DUR, 2), 's  peak→0.9  low(20–120 Hz) %.1f dB of total' % band(20, 120))
print('silence rms 30.5–33.0:', float(np.sqrt((out[int(30.5 * SR):int(33 * SR)] ** 2).mean())), ' 45.35–45.85:', float(np.sqrt((out[int(45.35 * SR):int(45.85 * SR)] ** 2).mean())))
