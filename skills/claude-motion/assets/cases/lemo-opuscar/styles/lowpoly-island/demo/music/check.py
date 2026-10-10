#!/usr/bin/env python
"""Verify the event-driven melody: onset timing + pitch per key event, the silence window,
and the spectral balance of score.wav. Writes check.json."""
import json
import os

import numpy as np
import librosa
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ONSET_TOL_MS = 15.0
CENTS_TOL = 35.0

KEY = [(6.25, "rise"), (11.25, "rise"),
       (16.4063, "roof"), (16.875, "roof"), (17.1875, "roof"), (17.5, "roof"),
       (26.25, "window"), (26.875, "window"), (27.5, "window"),
       (33.75, "ring"), (34.375, "ring"), (35.0, "ring"), (35.625, "ring"),
       (36.25, "beamhit"), (36.875, "beamhit"), (38.125, "beamhit"), (38.75, "beamhit"), (40.0, "beamhit"),
       (39.6875, "boatbell"), (47.5, "bell")]


def m2f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def cents(f, fref):
    return 1200 * np.log2(f / fref)


def main():
    ev = json.load(open(os.path.join(HERE, "..", "events.json")))["ev"]
    y, sr = sf.read(os.path.join(HERE, "stems", "melody_dry.wav"), dtype="float32")
    if y.ndim > 1:
        y = y.mean(axis=1)

    # ---- onsets (librosa, fine hop, backtracked)
    hop = 64
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_fft=1024)
    onsets = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop,
                                        backtrack=True, units="time", delta=0.02, wait=4)

    # ---- energy onset (1 ms RMS envelope; first rise of >6 dB within ±30 ms)
    def energy_onset(t_exp):
        """Causal 4 ms RMS; onset = point of max level jump (current vs previous 4 ms window)."""
        w = int(0.004 * sr)
        a = int((t_exp - 0.03) * sr)
        b = int((t_exp + 0.03) * sr)
        seg = y[a - w:b + w] ** 2
        c = np.concatenate([[0.0], np.cumsum(seg)])
        e = (c[w:] - c[:-w]) / w                      # e[i] = mean power of seg[i:i+w]
        rise = 10 * np.log10((e[w:] + 1e-12) / (e[:-w] + 1e-12))   # window at i+w vs window at i
        k = int(np.argmax(rise[: b - a]))
        return (a + k) / sr                              # new window starts at a-w+k+w
    rows = []
    for t_exp, typ in KEY:
        e = min((x for x in ev if x["type"] == typ), key=lambda x: abs(x["t"] - t_exp))
        midi = e["note"]
        if typ == "bell":
            e = [x for x in ev if x["type"] == "bell" and x.get("far")][0]
        t_on = float(onsets[np.argmin(np.abs(onsets - t_exp))])
        err_ms = (t_on - t_exp) * 1000
        t_en = energy_onset(t_exp)
        err_en = (t_en - t_exp) * 1000

        # ---- pitch: window 60-150 ms after the event
        f_exp = m2f(midi)
        a = int((t_exp + 0.06) * sr)
        b = int((t_exp + 0.15) * sr)
        seg = y[a:b] * np.hanning(b - a)
        nfft = 1 << 18
        spec = np.abs(np.fft.rfft(seg, nfft))
        freqs = np.fft.rfftfreq(nfft, 1 / sr)
        bellish = typ in ("bell", "boatbell")
        target = 2 * f_exp if bellish else f_exp       # bells: strike tone = nominal / 2
        rng_st = 2 if bellish else 3
        lo, hi = target * 2 ** (-rng_st / 12), target * 2 ** (rng_st / 12)
        idx = np.where((freqs >= lo) & (freqs <= hi))[0]
        k = idx[np.argmax(spec[idx])]
        a1, a2, a3 = np.log(spec[k - 1:k + 2] + 1e-12)
        p = 0.5 * (a1 - a3) / (a1 - 2 * a2 + a3)
        f_peak = (k + p) * sr / nfft
        f_peak_note = f_peak / 2 if bellish else f_peak
        c_peak = cents(f_peak_note, f_exp)

        # pyin (non-bell): +-4 semitone search, median of voiced frames in the window
        c_pyin = None
        if not bellish:
            fl = 4096 if f_exp < 150 else 2048
            a0 = int((t_exp - 0.05) * sr)
            chunk = y[a0:a0 + int(0.35 * sr)]
            f0, vf, vp = librosa.pyin(chunk, fmin=f_exp * 2 ** (-4 / 12), fmax=f_exp * 2 ** (4 / 12),
                                      sr=sr, frame_length=fl, hop_length=256)
            times = librosa.times_like(f0, sr=sr, hop_length=256) + (a0 / sr)
            sel = (times >= t_exp + 0.06) & (times <= t_exp + 0.15) & np.isfinite(f0)
            if sel.any():
                c_pyin = float(cents(np.median(f0[sel]), f_exp))
        # primary = spectral peak (sub-cent accurate; kalimba/marimba/bell are inharmonic modal
        # instruments, which biases YIN's periodicity estimate). pyin is reported for reference.
        c_used = c_peak
        ok = abs(err_ms) <= ONSET_TOL_MS and abs(c_used) <= CENTS_TOL
        rows.append({"t": t_exp, "type": typ, "midi": midi, "onset_librosa": round(t_on, 4),
                     "onset_err_ms": round(err_ms, 2), "onset_energy_err_ms": round(err_en, 2),
                     "f_expected": round(f_exp, 2), "f_peak": round(f_peak_note, 2),
                     "cents_peak": round(c_peak, 1),
                     "cents_pyin": None if c_pyin is None else round(c_pyin, 1),
                     "pitch_method": "strike=nominal/2 (spectral peak)" if bellish else "spectral peak (pyin informational)",
                     "cents": round(c_used, 1), "pass": bool(ok)})

    # ---- silence + bands on the full score
    s, sr2 = sf.read(os.path.join(HERE, "score.wav"), dtype="float64")
    sil = s[int(36.03 * sr2):int(36.25 * sr2)]
    sil_full = s[int(36.0 * sr2) + int(0.03 * sr2):int(36.25 * sr2)]
    fade = s[int(36.0 * sr2):int(36.03 * sr2)]
    sil_max = float(np.abs(sil_full).max())
    sil_ok = sil_max < 1e-4
    after = float(np.abs(s[int(36.25 * sr2):int(36.26 * sr2)]).max())

    mono = s.mean(axis=1)
    S = np.abs(librosa.stft(mono, n_fft=4096, hop_length=1024)) ** 2
    fr = librosa.fft_frequencies(sr=sr2, n_fft=4096)
    bands = [("20-120", 20, 120), ("120-500", 120, 500), ("500-2k", 500, 2000), ("2k-8k", 2000, 8000),
             ("8k+", 8000, sr2 / 2)]
    be = {}
    for name, lo, hi in bands:
        m = (fr >= lo) & (fr < hi)
        be[name] = float(10 * np.log10(S[m].sum() + 1e-20))
    top = max(be.values())
    be_rel = {k: round(v - top, 2) for k, v in be.items()}
    low_ok = be_rel["20-120"] <= -3.0
    high_ok = be_rel["8k+"] <= -15.0

    print(f"{'t':>8} {'type':9} {'midi':>4} {'onset_ms':>8} {'energy_ms':>9} {'f_exp':>8} {'f_det':>8} "
          f"{'c_peak':>7} {'c_pyin':>7} {'pass':>5}")
    for r in rows:
        print(f"{r['t']:8.4f} {r['type']:9} {r['midi']:4d} {r['onset_err_ms']:8.2f} {r['onset_energy_err_ms']:9.2f} "
              f"{r['f_expected']:8.2f} {r['f_peak']:8.2f} {r['cents_peak']:7.1f} "
              f"{'' if r['cents_pyin'] is None else r['cents_pyin']:>7} {str(r['pass']):>5}")
    max_on = max(abs(r["onset_err_ms"]) for r in rows)
    max_c = max(abs(r["cents"]) for r in rows)
    print(f"\nmax |onset err| = {max_on:.2f} ms (tol {ONSET_TOL_MS}),  max |cents| = {max_c:.1f} (tol {CENTS_TOL})")
    print(f"silence 36.03-36.25 max abs = {sil_max:.2e}  -> {'OK' if sil_ok else 'FAIL'};  "
          f"fade 36.00-36.03 max = {np.abs(fade).max():.3f}; first 10 ms after 36.25 max = {after:.3f}")
    print("band energy rel. to loudest (dB):", be_rel, " low_ok", low_ok, " high_ok", high_ok)
    peak_db = 20 * np.log10(np.abs(s).max())
    print(f"score peak {peak_db:.2f} dBFS, duration {len(s) / sr2:.4f} s")

    all_ok = all(r["pass"] for r in rows) and sil_ok and low_ok and high_ok
    out = {"events": rows, "max_onset_err_ms": max_on, "max_cents_err": max_c,
           "silence": {"window": [36.03, 36.25], "max_abs": sil_max, "pass": sil_ok,
                       "fade_window": [36.0, 36.03]},
           "band_energy_db_rel": be_rel, "band_energy_db_abs": {k: round(v, 2) for k, v in be.items()},
           "low_band_pass": low_ok, "high_band_pass": high_ok,
           "score_peak_dbfs": round(peak_db, 2), "duration_s": len(s) / sr2, "all_pass": all_ok}
    json.dump(out, open(os.path.join(HERE, "check.json"), "w"), indent=1)
    print("ALL PASS" if all_ok else "SOME CHECKS FAILED")


if __name__ == "__main__":
    main()
