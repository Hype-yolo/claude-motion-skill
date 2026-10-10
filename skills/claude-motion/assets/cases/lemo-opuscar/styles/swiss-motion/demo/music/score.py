"""Five Rules for a Poster — original motorik score (120 BPM, A dorian).
Melody data comes from ../score.json (the same file that draws the poster).
Run: .venv/bin/python styles/swiss-motion/demo/music/score.py  → score.wav + stems/*.wav + score_meta.json
"""
import sys, os, json
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR, add, limit, lp, hp

S.seed(1961); rng = np.random.default_rng(1961)
SC = json.load(open(os.path.join(HERE, '..', 'score.json')))
MIDI = SC['midi']                       # 7 columns = A B C D E F# G (A3..G4)
E8, E16, BAR = .25, .125, 2.0
DUR = 44.5; N = int(DUR * SR)
st = {k: np.zeros((N, 2), np.float32) for k in ['drums', 'bass', 'arp', 'lead', 'fx']}
glk = np.zeros((N, 2), np.float32); cym = np.zeros((N, 2), np.float32)   # bright parts, filtered before summing

# ---------------- drums (MuldjordKit) ----------------
def kit(v, t, vel, gain=1.0, pan=0.0): add(st['drums'], S.hit('drum_kit', v, vel), t, gain, pan)
def kick(t, vel=.85, g=1.0): kit('kick_drum_left', t, vel, g)
def snare(t, vel=.7, g=.8): kit('snare_1', t, vel, g, .05)
def hat(t, vel=.45, g=.42): add(cym, S.hit('drum_kit', 'hi_hat_closed', vel), t, g, .25)
def crash(t, vel=.8, g=.55, pan=-.2): add(cym, S.hit('drum_kit', 'crash_left', vel), t, g, pan)

def motorik_bar(t0, hats=True, full=True):
    for b in (0, 1.0, 1.25): kick(t0 + b, .9 if b != 1.25 else .7)
    if full:
        snare(t0 + .5); snare(t0 + 1.5)
    if hats:
        for i in range(8): hat(t0 + i * E8, .55 if i % 2 else .38, .40 if i % 2 else .30)

for i in range(12): hat(.5 + i * E16, .22, .16)                    # 0–2 grid ticks
for i in range(8): hat(2.0 + i * E8, .5 if i % 2 else .35, .34)    # 2–4
kick(2.0, .8)
for t0 in np.arange(4.0, 24.0, BAR): motorik_bar(t0)
crash(10.0); crash(16.0, .7, .45); crash(20.0, .9, .6)
for t0 in (26.0, 28.0, 36.0, 38.0): motorik_bar(t0)
crash(26.0, .95, .65); crash(36.0, .8, .5, .2)
for i in range(4): hat(30.0 + i * .5, .3, .22)                     # 30–32 metronome ticks
for i in range(8): kick(32.0 + i * .5, .75, .85)                   # 32–36 quarters only
kick(40.0, 1.0, 1.1); crash(40.0, 1.0, .7); crash(40.0, .8, .4, .3)

# ---------------- bass (FreePats finger bass) ----------------
def bnote(t, m, d=.22, vel=.75, g=1.0): add(st['bass'], S.note('electric_bass', m, d, vel, release=.05), t, g, -.05)
A1 = MIDI[0] - 24
for t0 in np.arange(8.0, 24.0, BAR):                               # A pedal, octave jump on the last eighth
    for i in range(8): bnote(t0 + i * E8, A1 + (12 if i == 7 else 0), vel=.8 if i % 2 == 0 else .68)
for i in range(4): bnote(24.0 + i * .5, A1, .45, .35, .45)          # 24–26 soft pulse
def bass_phrase(p0, lay=SC['final']['bass']):
    for c, r, l in lay:
        for k in range(l): bnote(p0 + (r + k) * E8, MIDI[c] - 24, vel=.8 if k % 2 == 0 else .68)
for p0 in (26.0, 32.0, 36.0): bass_phrase(p0)
bnote(30.0, A1, 1.9, .6, .9); bnote(31.0, A1, .95, .45, .7)       # 30–32 held low A
bnote(40.0, A1, 3.5, .95, 1.2)

# ---------------- arp (additive saw, harmonic count = filter) ----------------
def saw(f, d, fc, amp=1.0):
    t = np.arange(int(d * SR)) / SR; y = np.zeros_like(t)
    for k in range(1, 40):
        if k * f > 16000: break
        w = 1 / (1 + (k * f / fc) ** 4); 
        if w < 1e-3: break
        y += w * np.sin(2 * np.pi * k * f * t + rng.uniform(0, .2)) / k
    env = np.exp(-t / .07) * np.minimum(1, t / .003); env[-120:] *= np.linspace(1, 0, 120)
    return (y * env * amp).astype(np.float32)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
CH = {57: [57, 60, 64, 69], 60: [60, 64, 67, 72], 62: [62, 66, 69, 74]}   # Am, C, D (dorian IV)
def root_at(t):
    if 26 <= t < 30 or 36 <= t < 40:
        row = ((t - (26 if t < 30 else 36)) / E8) % 16
        for c, r, l in SC['final']['bass']:
            if r <= row < r + l: return MIDI[c]
    return 57
def arp_span(a, b, fc0, fc1, g0=.18, g1=.18):
    n = int(round((b - a) / E16))
    for i in range(n):
        t = a + i * E16; u = i / max(1, n - 1)
        notes = CH[root_at(t)]; m = notes[i % 4] - 12 * (i // 4 % 2 == 1)
        fc = fc0 * (fc1 / fc0) ** u
        add(st['arp'], saw(hz(m), .2, fc, g0 + (g1 - g0) * u), t, 1.0, .35 if i % 2 else -.35)
arp_span(12.0, 24.0, 500, 2600)
arp_span(24.0, 26.0, 600, 4200, .03, .09)                          # riser
arp_span(26.0, 30.0, 2600, 2600)
arp_span(36.0, 40.0, 3200, 3200, .23, .23)

# ---------------- lead: glockenspiel + soft square ----------------
def square(m, d, amp=.1):
    f = hz(m); t = np.arange(int((d + .08) * SR)) / SR; y = np.zeros_like(t)
    for k in range(1, 30, 2):
        if k * f > 6000: break
        y += np.sin(2 * np.pi * k * f * t) / k * (1 / (1 + (k * f / 2200) ** 2))
    env = np.minimum(1, t / .004) * (.55 + .45 * np.exp(-t / .12))
    rel = t > d; env[rel] *= np.exp(-(t[rel] - d) / .025)
    return (y * env * amp).astype(np.float32)
def lnote(t, c, d, gvel=.72, sq=.09, glock=1.0):
    m = MIDI[c]
    add(glk, S.note('glockenspiel', m + 24, max(d, .6), gvel), t, glock, .1)
    add(st['lead'], square(m + 12, d * .92, sq), t, 1.0, -.1)
def phrase(p0, lay, sq=.09, g=1.0):
    for c, r, l in lay: lnote(p0 + r * E8, c, l * E8, sq=sq, glock=g)
stiff = sorted(SC['stiff']['lead'], key=lambda n: n[1])
for k, (c, r, l) in enumerate(stiff): lnote(18.0 + k * E16, c, E16, .6, .07)      # run on 16ths
phrase(20.0, stiff)
def accent(t, m, vel=.95, cym=True):
    add(glk, S.note('glockenspiel', m, 1.5, vel), t, 1.35, 0)
    if cym: crash(t, .35, .22, .3)
accent(20.0, 79)
add(st['fx'], S.note('glockenspiel', 79 - .4, .5, .4), 23.5, .6, .2)                # hesitation grace note
FIN = SC['final']['lead']; ACC_ROW = SC['final']['circle'][1]
for p0, sq, g in ((26.0, .09, 1.0), (32.0, .11, 1.2), (36.0, .09, 1.0)):
    phrase(p0, FIN, sq, g); accent(p0 + ACC_ROW * E8, 81)
accent(40.0, 81, 1.0, False); add(glk, S.note('glockenspiel', 69 + 12, 1.2, .35), 42.0, .5, .3)

# ---------------- fx: the circle's sine glide ----------------
def glide():
    t = np.arange(int(1.5 * SR)) / SR + 24.5
    m = np.interp(t, [24.5, 25.0, 25.25, 26.0], [79, 74, 74, 69])
    ph = 2 * np.pi * np.cumsum(hz(m)) / SR
    y = np.sin(ph) + .15 * np.sin(2 * ph)
    env = np.minimum(1, (t - 24.5) / .03) * np.minimum(1, (26.0 - t) / .02)
    return (y * env * .12).astype(np.float32)
add(st['fx'], glide(), 24.5, 1.0, .15)

# ---------------- tame the bright parts (glockenspiel partials, cymbals) ----------------
st['lead'] += np.stack([lp(glk[:, i], 5200, 2) for i in range(2)], 1).astype(np.float32)
st['drums'] += np.stack([lp(cym[:, i], 7500, 1) for i in range(2)], 1).astype(np.float32)
# ---------------- gain staging per section ----------------
def sec_gain(stem, pts):
    t = np.arange(N) / SR; g = np.interp(t, [p[0] for p in pts], [p[1] for p in pts]).astype(np.float32)
    st[stem] *= g[:, None]
sec_gain('drums', [(0, .9), (36, .9), (36.01, 1.0), (40, 1.0)])
sec_gain('lead', [(0, .85), (24, .85), (24.01, 1.0), (32, 1.0), (32.01, 1.2), (36, 1.2), (36.01, 1.05), (44, 1.05)])
sec_gain('drums', [(0, 1.0), (20, 1.0), (20.01, .85), (24, .85), (24.01, 1.0), (36, 1.0), (36.01, 1.12), (40, 1.12), (40.01, 1.0)])

mix = sum(st.values())
peak = np.abs(mix).max(); g = .89 / peak
for k in st: st[k] *= g
mix = limit(mix * g, .9)
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR, subtype='PCM_24')
for k, v in st.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), v, SR, subtype='PCM_24')

# ---------------- meta + self check ----------------
import librosa
lead = st['lead'].mean(1).astype(np.float64)
exp = [32.0 + r * E8 for c, r, l in FIN] + [32.0 + ACC_ROW * E8]
on = librosa.onset.onset_detect(y=lead, sr=SR, units='time', hop_length=128, backtrack=True)
def near(x): return float(on[np.argmin(np.abs(on - x))]) if len(on) else None
err = []
for x in exp:
    s = int(x * SR); pre = np.sqrt(np.mean(lead[s - 240:s] ** 2))      # level of the 5 ms before the expected onset
    w = np.abs(lead[s - 480:s + 960]); i = int(np.argmax(w > max(3 * pre, 1e-4)))
    err.append(round((i - 480) / SR * 1000, 2))             # first sample 3x above the previous level
rms = lambda a, b: round(float(20 * np.log10(np.sqrt(np.mean(mix[int(a * SR):int(b * SR)] ** 2)) + 1e-9)), 1)
segs = [(0, 2), (2, 4), (4, 8), (8, 12), (12, 16), (16, 20), (20, 24), (24, 26), (26, 30), (30, 32), (32, 36), (36, 40), (40, 44)]
spec = np.abs(np.fft.rfft(mix.mean(1))) ** 2; fr = np.fft.rfftfreq(N, 1 / SR)
band = lambda a, b: spec[(fr >= a) & (fr < b)].sum()
meta = dict(bpm=120, dur=DUR,
            sweep_onsets_expected=exp, sweep_onset_error_ms=err, sweep_onsets_librosa=[near(x) for x in exp],
            accents=[20.0] + [p + ACC_ROW * E8 for p in (26.0, 32.0, 36.0)], land=26.0, end_hit=40.0,
            section_rms_dbfs={f'{a}-{b}': rms(a, b) for a, b in segs},
            peak_dbfs=round(float(20 * np.log10(np.abs(mix).max())), 2),
            hf_8k_20k_vs_2k_8k_db=round(float(10 * np.log10(band(8000, 20000) / band(2000, 8000))), 1))
json.dump(meta, open(os.path.join(HERE, 'score_meta.json'), 'w'), indent=1)
print(json.dumps(meta, indent=1))
