#!/usr/bin/env python
"""The Island That Grew — score synthesizer.

"Building = composing": every build event in ../events.json carries a MIDI note and
the melody voice is synthesized directly from those events, sample-accurate.
Everything is synthesized from scratch with numpy (modal synthesis, band-limited saws,
filtered noise). Deterministic: all randomness is seeded.

Outputs (next to this file):
  score.wav                48 kHz stereo 24-bit, 53.0 s, peak -3 dBFS
  stems/melody.wav         event-driven notes (dry+wet)
  stems/melody_dry.wav     event-driven notes, dry, no reverb, mono-compatible (for check.py)
  stems/backing.wav        pad, ostinato, bass, countermelody, final chord
  stems/perc.wav           shaker, kick
  score.json               key times + every synthesized note
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
DUR = 53.0
N = int(round(DUR * SR))
BEAT = 0.625
BAR = 2.5
G0 = 6.25                      # groove bar 0
SIL0, SIL1 = 36.0, 36.25       # true-silence window
FADE_SIL = 0.03
SPLIT = 36.1                   # sources starting before this belong to the "pre" world
RNG = np.random.default_rng(20260925)

CHORDS = ["D", "Bm", "G", "A", "D", "Bm", "G", "D", "D", "Bm", "D", "A",
          "D", "Bm", "G", "D", "D", "D"]
TRIAD = {"D": (62, 66, 69), "Bm": (59, 62, 66), "G": (55, 59, 62), "A": (57, 61, 64),
         "Asus4": (57, 62, 64)}
ROOT_BASS = {"D": 38, "Bm": 47, "G": 43, "A": 45, "Asus4": 45}
PAD_VOICING = {"D": (57, 62, 66), "Bm": (59, 62, 66), "G": (59, 62, 67),
               "A": (57, 61, 64), "Asus4": (57, 62, 64)}

NOTES_LOG = []


def m2f(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def log(t, typ, midi, inst, src="event"):
    NOTES_LOG.append({"t": round(float(t), 5), "type": typ,
                      "midi": None if midi is None else int(midi),
                      "instrument": inst, "src": src})


def harmony(t):
    """Chord at time t (half-bar resolution where the arrangement refines the given map)."""
    if t < G0:
        return "D"
    n = int((t - G0) // BAR)
    n = min(n, len(CHORDS) - 1)
    pos = (t - G0) - n * BAR
    # Day groove refinement: the island-complete chord hit at 21.25 is D major,
    # so bar 6 is played D|G and bar 7 D|A (turnaround into the dusk D at 26.25).
    if n == 6:
        return "D" if pos < BAR / 2 else "G"
    if n == 7:
        return "D" if pos < BAR / 2 else "A"
    if n == 11:
        return "Asus4" if t < 36.0 else "A"
    return CHORDS[n]


# ---------------------------------------------------------------- DSP helpers
def lp(x, fc, order=2, zero_phase=False):
    sos = butter(order, fc, "lowpass", fs=SR, output="sos")
    return sosfiltfilt(sos, x, axis=-1) if zero_phase else sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2, zero_phase=False):
    sos = butter(order, fc, "highpass", fs=SR, output="sos")
    return sosfiltfilt(sos, x, axis=-1) if zero_phase else sosfilt(sos, x, axis=-1)


def bp(x, f1, f2, order=2, zero_phase=False):
    sos = butter(order, [f1, f2], "bandpass", fs=SR, output="sos")
    return sosfiltfilt(sos, x, axis=-1) if zero_phase else sosfilt(sos, x, axis=-1)


def tarr(dur):
    return np.arange(int(dur * SR)) / SR


def auto(points, n=N):
    """Piecewise-linear automation from [(t, value), ...]."""
    ts = np.array([p[0] for p in points]) * SR
    vs = np.array([p[1] for p in points], dtype=float)
    return np.interp(np.arange(n), ts, vs)


def soft_attack(t, att):
    return 1.0 - np.exp(-t / max(att, 1e-5))


def partial_gain(fr):
    """Tame partials above ~6 kHz (no harsh highs) and drop those near Nyquist."""
    if fr > SR * 0.45:
        return 0.0
    return 1.0 if fr < 6000 else (6000.0 / fr) ** 1.6


def noise_burst(dur, f1, f2, tau, seed_amp=1.0):
    t = tarr(dur)
    nz = RNG.standard_normal(len(t))
    nz = bp(nz, f1, min(f2, SR * 0.45))
    return nz * np.exp(-t / tau) * soft_attack(t, 0.0004) * seed_amp


def modal(f, ratios, amps, taus, dur, att=0.002, beat=0.0):
    t = tarr(dur)
    y = np.zeros_like(t)
    for r, a, tau in zip(ratios, amps, taus):
        fr = f * r
        g = partial_gain(fr) * a
        if g <= 0:
            continue
        ph = RNG.uniform(0, 2 * np.pi) * 0  # zero phase: deterministic, clean sine onset
        env = np.exp(-t / tau)
        if beat > 0:
            y += 0.5 * g * env * (np.sin(2 * np.pi * (fr - beat) * t + ph) +
                                  np.sin(2 * np.pi * (fr + beat) * t + ph))
        else:
            y += g * env * np.sin(2 * np.pi * fr * t + ph)
    return y * soft_attack(t, att)


# ---------------------------------------------------------------- instruments
def kalimba(m, v=0.7, tail=1.0, bright=1.0):
    f = m2f(m)
    tau0 = np.clip(1.5 * (440.0 / f) ** 0.35, 0.5, 2.4) * tail
    b = (0.55 + 0.6 * v) * bright
    dur = min(6 * tau0, 9.0)
    y = modal(f, [1.0, 5.4, 12.6], [1.0, 0.26 * b, 0.07 * b], [tau0, 0.16, 0.045], dur, att=0.0018)
    # tiny warm doubling of the tine (slow beating)
    t = tarr(dur)
    y += 0.12 * np.sin(2 * np.pi * f * 1.0012 * t) * np.exp(-t / (tau0 * 0.8)) * soft_attack(t, 0.004)
    # soft attack click
    c = noise_burst(0.012, 1800, 5200, 0.0025, 0.08 * b)
    y[:len(c)] += c
    return y * (v ** 1.1)


def marimba(m, v=0.7, tau_scale=1.0, bright=1.0):
    f = m2f(m)
    tau0 = np.clip(0.55 * (440.0 / f) ** 0.5, 0.22, 1.6) * tau_scale
    b = (0.5 + 0.7 * v) * bright
    dur = min(6 * tau0, 8.0)
    y = modal(f, [1.0, 3.9, 9.2, 2.0], [1.0, 0.38 * b, 0.10 * b, 0.05],
              [tau0, tau0 * 0.16, 0.022, tau0 * 0.5], dur,
              att=0.0022 if f > 200 else 0.0035)
    # soft mallet thump
    c = noise_burst(0.02, 150, 1600, 0.004, 0.06 * b)
    y[:len(c)] += c
    return y * (v ** 1.1)


def woodblock(m, v=0.7):
    f = m2f(m)
    y = modal(f, [1.0, 2.61, 4.3, 6.9], [1.0, 0.5, 0.45, 0.15], [0.055, 0.03, 0.02, 0.01],
              0.35, att=0.0006)
    c = noise_burst(0.02, 1200, 4000, 0.003, 0.25)
    y[:len(c)] += c
    return y * v


BELL_R = [0.56, 0.92, 1.19, 1.71, 2.0, 2.74, 3.0, 3.76, 4.07]
BELL_A = [0.30, 0.16, 0.26, 0.10, 1.00, 0.22, 0.42, 0.12, 0.28]
BELL_T = [7.0, 4.5, 3.6, 2.2, 3.2, 1.5, 1.8, 0.85, 1.0]


def bell(m, v=0.8, decay=1.0, warm=0.0):
    f = m2f(m)
    taus = [x * decay for x in BELL_T]
    amps = list(BELL_A)
    amps[0] *= (1 + warm)       # hum
    amps[2] *= (1 + 0.5 * warm)
    dur = min(max(taus) * 1.3, 9.5)
    y = modal(f, BELL_R, amps, taus, dur, att=0.0012, beat=0.35)
    c = noise_burst(0.02, 2500, 9000, 0.002, 0.10)
    y[:len(c)] += c
    return y * v


def glass(m, v=0.5, dur=1.6):
    f = m2f(m)
    y = modal(f, [1.0, 2.76, 5.4], [1.0, 0.3, 0.08], [0.55, 0.2, 0.06], dur, att=0.0008)
    return y * v


def sub_sine(m, v=0.5, dur=2.5, att=0.02, tau=1.2):
    t = tarr(dur)
    return v * np.sin(2 * np.pi * m2f(m) * t) * np.exp(-t / tau) * soft_attack(t, att)


def bloom_swell(m, v=0.2, dur=2.5):
    """Short soft sine-cluster swell (fifth + octave) — the 'bloom' of big events."""
    t = tarr(dur)
    env = (1 - np.exp(-t / 0.18)) * np.exp(-t / 0.9)
    y = sum(a * np.sin(2 * np.pi * m2f(m + k) * t) for k, a in ((12, 1.0), (19, 0.6), (24, 0.35)))
    return v * env * y


_SHAKER_BUF = None


def shaker(v=0.3):
    global _SHAKER_BUF
    if _SHAKER_BUF is None:
        _SHAKER_BUF = bp(RNG.standard_normal(SR * 2), 3800, 8200, order=2)
    n = int(0.09 * SR)
    o = int(RNG.integers(0, len(_SHAKER_BUF) - n))
    t = np.arange(n) / SR
    env = soft_attack(t, 0.006) * np.exp(-t / 0.028)
    return _SHAKER_BUF[o:o + n] * env * v


def kick(v=0.5):
    t = tarr(0.7)
    f = 55 + 55 * np.exp(-t / 0.025)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.22) * soft_attack(t, 0.002)
    return y * v


def noise_swell(dur=2.5, v=0.05):
    """Soft 'air' after the ignite hit: decays, never builds into the silence."""
    t = tarr(dur)
    nz = bp(RNG.standard_normal(len(t)), 2500, 7000)
    env = soft_attack(t, 0.12) * np.exp(-t / 0.7)
    return nz * env * v


def polyblep_saw(freq):
    dt = freq / SR
    ph = np.cumsum(dt) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt[m2]
    y[m2] -= x * x + x + x + 1
    return y


def pad_note(m, dur, att=0.5, rel=1.0):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    env = np.ones(n)
    a = t < att
    env[a] = 0.5 - 0.5 * np.cos(np.pi * t[a] / att)
    r = t > dur
    env[r] = 0.5 + 0.5 * np.cos(np.pi * np.minimum((t[r] - dur) / rel, 1.0))
    f = m2f(m)
    out = np.zeros((2, n))
    dets = [(-8.0, 0.0, 7.0), (-6.0, 1.5, 9.0)]
    for ch in range(2):
        for d in dets[ch]:
            rate = RNG.uniform(0.12, 0.33)
            lfo = 3.0 * np.sin(2 * np.pi * rate * t + RNG.uniform(0, 6.28))
            fr = f * 2 ** ((d + lfo) / 1200.0)
            out[ch] += polyblep_saw(fr)
    return out * env / 3.0


# ---------------------------------------------------------------- buses
class Bus:
    def __init__(self, name):
        self.name = name
        self.dry = {w: np.zeros((2, N)) for w in ("pre", "post")}
        self.send = {w: np.zeros((2, N)) for w in ("pre", "post")}
        self.drycheck = np.zeros(N)   # dry mono reference (melody only)

    def place(self, sig, t, gain=1.0, pan=0.0, send=0.2, dry=1.0, check=True):
        world = "pre" if t < SPLIT else "post"
        i0 = int(round(t * SR))
        if sig.ndim == 1:
            sig = sig[None, :]
            th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
            g2 = np.array([[np.cos(th)], [np.sin(th)]]) * np.sqrt(2)
            st = g2 * sig
        else:
            st = sig
        n = min(st.shape[1], N - i0)
        if n <= 0:
            return
        seg = st[:, :n] * gain
        self.dry[world][:, i0:i0 + n] += seg * dry
        self.send[world][:, i0:i0 + n] += seg * send
        if check:
            self.drycheck[i0:i0 + n] += seg.mean(axis=0) * dry


def make_ir(rt=1.8, length=2.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    ir = np.zeros((2, n))
    pre = int(0.014 * SR)
    for ch in range(2):
        nz = rng.standard_normal(n)
        lo = lp(nz, 2600, order=2)
        hi = nz - lo
        e = lo * np.exp(-6.91 * t / rt) + 0.45 * hi * np.exp(-6.91 * t / (rt * 0.4))
        e *= soft_attack(t, 0.012)
        ir[ch, pre:] = e[:n - pre]
        # a few early reflections
        for k in range(6):
            d = int(rng.uniform(0.006, 0.045) * SR)
            ir[ch, d] += rng.uniform(0.2, 0.5) * (1 if rng.random() > 0.5 else -1)
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return ir


IR = make_ir()


def reverb(x):
    out = np.zeros_like(x)
    for ch in range(2):
        out[ch] = fftconvolve(x[ch], IR[ch])[:N]
    out = hp(out, 170, order=2)
    out = lp(out, 7500, order=2)
    return out


# ---------------------------------------------------------------- build
def main():
    ev = json.load(open(os.path.join(HERE, "..", "events.json")))
    events = ev["ev"]
    mel = Bus("melody")
    bak = Bus("backing")
    per = Bus("perc")

    # ---------------- melody: every musical build event --------------
    for e in events:
        typ = e["type"]
        t = float(e["t"])
        v = float(e.get("v", 0.7))
        m = e.get("note")
        if typ == "bell":
            if e.get("far"):
                y = lp(bell(m, v, decay=1.15, warm=0.3), 1900, order=2)
                mel.place(y, t, gain=0.6, pan=-0.35, send=1.1, dry=0.45)
                log(t, typ, m, "buoy bell (far: lowpassed, wet)")
            else:
                mel.place(bell(m, v, decay=1.0, warm=0.2), t, gain=0.5, pan=-0.25, send=0.45)
                log(t, typ, m, "buoy bell")
        elif typ == "rise":
            nn = int(e.get("n", 1))
            if e.get("big"):
                y = marimba(m, v, tau_scale=1.4)
                y = np.pad(y, (0, max(0, int(3 * SR) - len(y))))
                s = sub_sine(m - 12, 0.55 * v, dur=3.0, att=0.015, tau=1.1)
                bl = bloom_swell(m, 0.12 * v, dur=3.0)
                y[:len(s)] += s
                y[:len(bl)] += bl
                mel.place(y, t, gain=0.75, pan=0.0, send=0.35)
                log(t, typ, m, "marimba + sub sine (oct below) + bloom")
            else:
                pan = ((m % 12) / 11.0 - 0.5) * 0.6
                mel.place(marimba(m, v), t, gain=0.6, pan=pan, send=0.22)
                log(t, typ, m, "marimba")
                if nn >= 3:
                    mel.place(marimba(m + 7, v * 0.45), t, gain=0.5, pan=-pan, send=0.22)
                    log(t, typ, m + 7, "marimba (fifth, n>=3)")
        elif typ == "pop":
            pan = ((m % 12) / 11.0 - 0.5) * 0.8
            mel.place(kalimba(m, v, bright=1.15), t, gain=0.45, pan=pan, send=0.25)
            log(t, typ, m, "kalimba")
        elif typ == "floor":
            mel.place(woodblock(m, v), t, gain=0.32, pan=0.15, send=0.1)
            log(t, typ, m, "woodblock")
        elif typ == "roof":
            h = e.get("house")
            pan = 0.0 if h is None else -0.5 + float(h) / 7.0
            mel.place(kalimba(m, v), t, gain=0.5, pan=pan, send=0.25)
            mel.place(marimba(m, v * 0.8), t, gain=0.4, pan=pan, send=0.2)
            log(t, typ, m, "kalimba + marimba unison")
        elif typ == "plank":
            mel.place(marimba(m, v, tau_scale=0.45), t, gain=0.45, pan=0.35, send=0.06)
            log(t, typ, m, "marimba (dry, short)")
        elif typ == "splash":
            mel.place(kalimba(m, v, bright=1.2), t, gain=0.45, pan=0.3, send=0.35)
            mel.place(kalimba(m + 12, v * 0.5, tail=0.6), t + 0.035, gain=0.35, pan=0.45, send=0.4)
            log(t, typ, m, "kalimba")
            log(t + 0.035, typ, m + 12, "kalimba grace (oct up)")
        elif typ == "sparkle":
            dmaj = [o * 12 + d for o in range(11) for d in (2, 4, 6, 7, 9, 11, 13)]
            if m in dmaj:
                i = dmaj.index(m)
                steps = [dmaj[i - 2], dmaj[i - 1], m]
            else:
                steps = [m - 3, m - 1, m]
            for i, s in enumerate(steps):
                tt = t + i * 0.045
                mel.place(kalimba(s + 12, v * (0.6 + 0.2 * i), tail=0.5, bright=1.2), tt,
                          gain=0.3, pan=0.2 + 0.15 * i, send=0.45)
                mel.place(glass(s + 24, v * 0.12), tt, gain=0.3, pan=0.3, send=0.5)
                log(tt, typ, s + 12, "kalimba + glass (sparkle gliss)")
        elif typ == "chord":
            for k, (mm, g) in enumerate(((38, 0.55), (50, 0.5), (57, 0.4), (62, 0.45), (66, 0.4), (69, 0.4))):
                mel.place(marimba(mm, v * 0.8, tau_scale=1.3), t, gain=g * 0.7, pan=-0.3 + 0.12 * k, send=0.3)
                log(t, typ, mm, "marimba (D chord)")
            for k, mm in enumerate((74, 78, 81)):
                mel.place(kalimba(mm, 0.6), t + 0.012 * k, gain=0.35, pan=-0.2 + 0.2 * k, send=0.35)
                log(t + 0.012 * k, typ, mm, "kalimba (D chord)")
        elif typ == "window":
            mel.place(kalimba(m, v, tail=1.6 if t < 29 else 1.1), t, gain=0.4, pan=((m - 74) / 9.0) * 0.5, send=0.42)
            mel.place(glass(m + 24, v * 0.10, dur=2.0), t + 0.01, gain=0.4, pan=0.3, send=0.6)
            log(t, typ, m, "kalimba (long tail) + glass shimmer")
        elif typ == "boatbell":
            if e.get("answer"):
                mel.place(bell(m, v, decay=0.8, warm=0.6), t, gain=0.42, pan=0.45, send=0.4)
                log(t, typ, m, "ship bell (answer, warm)")
            else:
                mel.place(bell(m, v, decay=0.55, warm=0.0), t, gain=0.35, pan=0.5, send=0.35)
                log(t, typ, m, "ship bell (small)")
        elif typ == "ring":
            k = [69, 71, 74, 78].index(m) if m in (69, 71, 74, 78) else 0
            mel.place(marimba(m, v * (0.8 + 0.07 * k), tau_scale=1.2 + 0.15 * k), t,
                      gain=0.55, pan=-0.2 + 0.13 * k, send=0.3 + 0.07 * k)
            log(t, typ, m, "marimba (rising arpeggio)")
            if k > 0:
                mel.place(marimba(m - 12, v * (0.2 + 0.12 * k)), t, gain=0.5, pan=0, send=0.3)
                log(t, typ, m - 12, "marimba (warmth, oct below)")
        elif typ == "lamproom":
            mel.place(glass(98, 0.35 * v / 0.5, dur=0.8), t, gain=0.35, pan=0.2, send=0.5)
            log(t, typ, 98, "glass tink")
        elif typ == "ignite":
            for mm, g in ((38, 0.75), (50, 0.6), (57, 0.3), (62, 0.3), (66, 0.25)):
                mel.place(marimba(mm, v * 0.9, tau_scale=1.5), t, gain=g * 0.7, pan=0.0, send=0.35)
                log(t, typ, mm, "marimba (ignite bloom)")
            mel.place(sub_sine(38, 0.25, dur=3.0, att=0.01, tau=1.3), t, gain=1.0, send=0.0)
            log(t, typ, 38, "sub sine")
            for k, mm in enumerate((86, 90, 93, 98)):
                mel.place(glass(mm, 0.22), t + 0.06 * k, gain=0.35, pan=-0.4 + 0.27 * k, send=0.6)
                log(t + 0.06 * k, typ, mm, "glass shimmer")
            ns = noise_swell(3.0, 0.035)
            mel.place(ns, t, gain=1.0, pan=0.0, send=0.6, check=False)
            log(t, typ, None, "air swell (decaying)")
        elif typ == "beamhit":
            rev = int(e.get("rev", 0))
            if rev == 0:
                pan = -0.6 + 1.2 * np.clip((t - 36.25) / 6.25, 0, 1)
            else:
                pan = 0.6 - 1.2 * np.clip((t - 43.75) / 6.25, 0, 1)
            mel.place(kalimba(m, v, tail=1.5), t, gain=0.6, pan=pan, send=0.35)
            mel.place(marimba(m - 12, v * 0.75, tau_scale=1.2), t, gain=0.45, pan=pan * 0.6, send=0.3)
            mel.place(glass(m + 12, v * 0.16, dur=1.4), t + 0.008, gain=0.4, pan=pan, send=0.55)
            log(t, typ, m, "kalimba lead")
            log(t, typ, m - 12, "marimba (oct below)")
            log(t + 0.008, typ, m + 12, "glass-bell shimmer")

    # ---------------- backing ----------------------------------------
    # pad: chord layer segments (half-bar harmony), split at the silence
    segs = []
    grid = [0.5] + [G0 + 1.25 * k for k in range(0, 37)]
    grid = sorted(set([g for g in grid if g < DUR] + [36.0, 36.25, 33.75]))
    for a, b in zip(grid, grid[1:] + [DUR]):
        if SIL0 <= a < SIL1:
            continue
        c = harmony(a + 1e-3)
        if segs and segs[-1][2] == c and segs[-1][1] == a and not (a == SIL1):
            segs[-1][1] = b
        else:
            segs.append([a, b, c])
    chord_layer = {"pre": np.zeros((2, N)), "post": np.zeros((2, N))}
    for a, b, c in segs:
        world = "pre" if a < SPLIT else "post"
        att = 0.12 if a == SIL1 else 0.55
        for mm in PAD_VOICING[c]:
            y = pad_note(mm, b - a, att=att, rel=0.9)
            i0 = int(round(a * SR))
            n = min(y.shape[1], N - i0)
            chord_layer[world][:, i0:i0 + n] += y[:, :n]
        log(a, "pad", None, f"pad chord {c} ({a:.2f}-{b:.2f})", src="backing")
    drone = {"pre": np.zeros((2, N)), "post": np.zeros((2, N))}
    for (a, b, world) in ((0.5, 36.0, "pre"), (36.25, DUR, "post")):
        for mm, g in ((38, 0.45), (50, 1.0), (57, 0.8)):
            y = pad_note(mm, b - a, att=2.0 if a < 1 else 0.12, rel=0.3)
            i0 = int(round(a * SR))
            n = min(y.shape[1], N - i0)
            drone[world][:, i0:i0 + n] += g * y[:, :n]
    log(0.5, "pad", 50, "pad drone D (D2/D3/A3)", src="backing")

    g_chord = auto([(0, 0), (0.5, 0), (3.5, 0.12), (6.25, 0.2), (13.75, 0.22), (21.25, 0.36),
                    (26.25, 0.26), (28.75, 0.2), (31.0, 0.0), (33.75, 0.0), (34.2, 0.12),
                    (36.0, 0.5), (36.25, 0.5), (37.5, 0.42), (41.25, 0.32), (46.25, 0.24),
                    (48.75, 0.3), (50.5, 0.26), (53, 0.2)])
    g_drone = auto([(0, 0), (0.5, 0), (4.0, 0.14), (6.25, 0.16), (21.25, 0.14), (28.75, 0.14),
                    (31.25, 0.10), (33.75, 0.10), (36.0, 0.2), (36.25, 0.22), (41.25, 0.16),
                    (46.25, 0.16), (53, 0.12)])
    bright = auto([(0, 0.15), (6.25, 0.25), (21.0, 0.3), (21.4, 0.8), (23.0, 0.5), (26.25, 0.35),
                   (28.75, 0.15), (31.25, 0.0), (33.75, 0.1), (36.0, 0.6), (36.25, 1.0),
                   (38.75, 0.6), (41.25, 0.4), (46.25, 0.25), (48.75, 0.5), (50.5, 0.3), (53, 0.2)])
    for w in ("pre", "post"):
        x = chord_layer[w] * g_chord + drone[w] * g_drone
        dark = lp(x, 520, order=4)
        brt = lp(x, 1500, order=4)
        pad = dark * (1 - bright) + brt * bright
        bak.dry[w] += pad * 0.85
        bak.send[w] += pad * 0.35

    # intro shimmer (very soft, high, slow tremolo)
    t_in = tarr(5.9)
    sh_env = np.clip(t_in / 2.5, 0, 1) * np.clip((5.9 - t_in) / 1.5, 0, 1)
    shim = sum(a * np.sin(2 * np.pi * m2f(mm) * t_in) * (0.6 + 0.4 * np.sin(2 * np.pi * r * t_in + p))
               for mm, a, r, p in ((86, 1.0, 0.23, 0.0), (93, 0.6, 0.31, 1.3), (90, 0.4, 0.17, 2.2)))
    bak.place(shim * sh_env * 0.006, 0.3, pan=0.0, send=0.8, check=False)
    log(0.3, "shimmer", 86, "high sine shimmer (D6/F#6/A6)", src="backing")

    # low marimba roots
    bass_times = []
    for tt in (13.75, 16.25, 18.75):
        bass_times.append((tt, 0.5))
    for k in range(8):                           # groove beats 1 & 3
        bass_times.append((21.25 + k * 1.25, 0.55 if k % 2 == 0 else 0.45))
    bass_times += [(26.25, 0.38), (27.5, 0.3)]
    bass_times += [(37.5, 0.5), (38.75, 0.55), (40.0, 0.5)]
    bass_times += [(41.25, 0.38), (43.75, 0.33)]
    for tt, vv in bass_times:
        c = harmony(tt + 1e-3)
        r = ROOT_BASS[c]
        bak.place(marimba(r, vv, tau_scale=1.1), tt, gain=0.55, pan=-0.05, send=0.12, check=False)
        log(tt, "bass", r, "marimba (low root)", src="backing")

    # marimba ostinato 21.25 - 31.25 (8ths on chord tones)
    g_ost = auto([(21.25, 0.5), (26.2, 0.5), (26.25, 0.3), (28.75, 0.26), (31.25, 0.0)])
    vel = [0.55, 0.32, 0.42, 0.32, 0.48, 0.32, 0.42, 0.32]
    k = 0
    tt = 21.25
    while tt < 31.25 - 1e-6:
        c = harmony(tt + 1e-3)
        tri = TRIAD[c]
        r = tri[0] if tri[0] <= 61 else tri[0] - 12
        third = tri[1] - tri[0]
        pat = [r, r + 7, r + 12, r + 7, r + 12 + third, r + 7, r + 12, r + 7]
        mm = pat[k % 8]
        gi = float(g_ost[int(tt * SR)])
        if gi > 0.01:
            pan = 0.35 if k % 2 == 0 else 0.2
            bak.place(marimba(mm, vel[k % 8], tau_scale=0.7), tt, gain=0.85 * gi, pan=pan, send=0.16, check=False)
            log(tt, "ostinato", mm, "marimba ostinato", src="backing")
        k += 1
        tt = 21.25 + k * BEAT / 2

    # kalimba countermelody over the day groove (from the theme)
    counter = [(1.0, 74, 0.8), (1.5, 78, 0.8), (2.0, 81, 1.0), (3.0, 83, 1.0), (4.0, 81, 0.8),
               (4.5, 78, 0.8), (5.5, 76, 0.8), (6.0, 74, 1.0), (7.0, 69, 1.0)]
    for bt, mm, ac in counter:
        tt = 21.25 + bt * BEAT
        bak.place(kalimba(mm, 0.42 * ac, tail=0.9), tt, gain=0.65, pan=-0.35, send=0.3, check=False)
        log(tt, "counter", mm, "kalimba countermelody", src="backing")

    # final D chord at 48.75 (end card), gently strummed
    for k, (mm, g) in enumerate(((38, 0.5), (50, 0.45), (57, 0.35), (62, 0.35), (66, 0.3))):
        bak.place(marimba(mm, 0.5, tau_scale=1.6), 48.75 + 0.018 * k, gain=g * 0.6, pan=-0.2 + 0.1 * k,
                  send=0.35, check=False)
        log(48.75 + 0.018 * k, "final", mm, "marimba (final D chord)", src="backing")
    for k, mm in enumerate((69, 74, 78)):
        bak.place(kalimba(mm, 0.32, tail=2.0), 48.85 + 0.03 * k, gain=0.35, pan=0.1 + 0.15 * k,
                  send=0.45, check=False)
        log(48.85 + 0.03 * k, "final", mm, "kalimba (final D chord)", src="backing")

    # ---------------- percussion -------------------------------------
    def put_shaker(tt, vv):
        per.place(shaker(vv), tt, gain=8.0, pan=0.3, send=0.1, check=False)
        log(tt, "shaker", None, "shaker (bp noise)", src="perc")

    tt = 16.25
    while tt < 21.25 - 1e-6:
        put_shaker(tt, 0.05 if ((tt - 16.25) / (BEAT / 2)) % 2 == 0 else 0.035)
        tt += BEAT / 2
    acc = [0.085, 0.04, 0.06, 0.04]
    for (a, b) in ((21.25, 26.25), (36.25, 41.25)):
        k = 0
        while a + k * BEAT / 4 < b - 1e-6:
            put_shaker(a + k * BEAT / 4, acc[k % 4] * (1.0 if a < 30 else 0.9))
            k += 1
    for tt in [21.25 + 1.25 * k for k in range(4)] + [36.25 + 1.25 * k for k in range(4)]:
        per.place(kick(0.5), tt, gain=0.55, pan=0.0, send=0.03, check=False)
        log(tt, "kick", 26, "soft kick (~55 Hz)", src="perc")

    # ---------------- reverb, gates, mix -----------------------------
    tt_all = np.arange(N) / SR
    gate_pre = np.clip((SIL0 + FADE_SIL - tt_all) / FADE_SIL, 0, 1)
    gate_post = (np.arange(N) >= int(round(SIL1 * SR))).astype(float)
    # narration: lighten 1-3 kHz a little
    narr = [(3.9, 6.1), (7.0, 8.9), (26.5, 28.9), (31.6, 33.6), (44.0, 46.6)]
    nar_amt = np.zeros(N)
    for a, b in narr:
        nar_amt = np.maximum(nar_amt, auto([(0, 0), (a - 0.25, 0), (a, 1), (b, 1), (b + 0.3, 0), (DUR, 0)]))
    end_fade = np.clip((DUR - tt_all) / 2.2, 0, 1) ** 1.5

    stems = {}
    for bus, dip_db in ((mel, 1.5), (bak, 3.0), (per, 3.0)):
        out = np.zeros((2, N))
        for w, gate in (("pre", gate_pre), ("post", gate_post)):
            wet = reverb(bus.send[w])
            out += (bus.dry[w] + wet * 0.55) * gate
        mid = bp(out, 1000, 3000, order=2, zero_phase=True)
        g = 10 ** (-dip_db / 20)
        out = out - (1 - g) * mid * nar_amt
        out *= end_fade
        out[:, int(round(SIL0 * SR)) + int(FADE_SIL * SR):int(round(SIL1 * SR))] = 0.0
        stems[bus.name] = out

    score = sum(stems.values())
    peak = np.abs(score).max()
    norm = 10 ** (-3 / 20) / peak
    os.makedirs(os.path.join(HERE, "stems"), exist_ok=True)
    for k, s in stems.items():
        sf.write(os.path.join(HERE, "stems", f"{k}.wav"), (s * norm).T.astype(np.float32), SR, subtype="FLOAT")
    score = score * norm
    sf.write(os.path.join(HERE, "score.wav"), score.T, SR, subtype="PCM_24")
    dry = mel.drycheck * norm
    sf.write(os.path.join(HERE, "stems", "melody_dry.wav"), dry.astype(np.float32), SR, subtype="FLOAT")

    # report section levels
    def rms_db(x, a, b):
        s = x[..., int(a * SR):int(b * SR)]
        return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)
    secs = [(0, 6.25), (6.25, 13.75), (13.75, 21.25), (21.25, 26.25), (26.25, 28.75),
            (28.75, 31.25), (31.25, 33.75), (33.75, 36.0), (36.25, 41.25), (41.25, 46.25), (46.25, 53)]
    print("section        score  melody backing  perc (dBFS RMS)")
    for a, b in secs:
        print(f"{a:5.2f}-{b:5.2f}  {rms_db(score, a, b):6.1f} {rms_db(stems['melody'] * norm, a, b):6.1f} "
              f"{rms_db(stems['backing'] * norm, a, b):6.1f} {rms_db(stems['perc'] * norm, a, b):6.1f}")
    print("peak after norm", 20 * np.log10(np.abs(score).max()))

    meta = {
        "sr": SR, "dur": DUR, "bpm": 96, "beat": BEAT, "bar": BAR, "groove_bar0": G0, "key": "D major",
        "chords_given": CHORDS,
        "harmony_used": [{"t0": a, "t1": b, "chord": c} for a, b, c in segs],
        "harmony_note": "bar 6 (21.25) played D|G and bar 7 (23.75) D|A so the island-complete chord hit is D major; bar 11 pre-ignite is Asus4",
        "silence": {"fade_out": [SIL0, SIL0 + FADE_SIL], "zero": [SIL0 + FADE_SIL, SIL1]},
        "sections": {"sea": [0, 6.25], "tiles": [6.25, 13.75], "details": [13.75, 21.25], "day": [21.25, 26.25],
                     "dusk": [26.25, 28.75], "dusk_night": [28.75, 31.25], "night": [31.25, 33.75],
                     "lighthouse": [33.75, 36.0], "silence": [36.0, 36.25], "climax": [36.25, 41.25],
                     "home": [41.25, 46.25], "far": [46.25, 53.0]},
        "narration_mid_dip": narr,
        "final_chord": 48.75, "end_fade": [DUR - 2.2, DUR],
        "normalization_gain": norm,
        "notes": sorted(NOTES_LOG, key=lambda d: d["t"]),
    }
    json.dump(meta, open(os.path.join(HERE, "score.json"), "w"), indent=1, ensure_ascii=False)
    print("notes synthesized:", len(NOTES_LOG))


if __name__ == "__main__":
    main()
