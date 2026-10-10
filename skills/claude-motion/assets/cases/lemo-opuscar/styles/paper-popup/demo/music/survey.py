import librosa, numpy as np, glob, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fs = sorted(glob.glob('*.mp3'))
fig, ax = plt.subplots(len(fs), 1, figsize=(14, 1.6 * len(fs)))
for i, f in enumerate(fs):
    y, sr = librosa.load(f, sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr); tempo = float(np.atleast_1d(tempo)[0])
    rms = librosa.feature.rms(y=y, hop_length=2205)[0]; db = 20 * np.log10(rms + 1e-6)
    cen = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=2205)[0]
    H, P = librosa.effects.hpss(y); pr = np.sqrt(np.mean(P**2)) / np.sqrt(np.mean(H**2))
    onset = librosa.onset.onset_detect(y=y, sr=sr); dens = len(onset) / (len(y) / sr)
    t = np.arange(len(db)) * .1
    ax[i].plot(t, db, lw=.8); ax[i].set_title(f'{f}  tempo {float(tempo):.0f}  cen {np.median(cen):.0f}  perc/harm {pr:.2f}  onsets/s {dens:.1f}', fontsize=9, loc='left'); ax[i].set_ylim(-50, 0)
    ax2 = ax[i].twinx(); ax2.plot(t, cen, color='orange', lw=.4, alpha=.6); ax2.set_ylim(0, 5000)
    print(f, f'{len(y)/sr:.0f}s tempo {float(tempo):.1f} cen {np.median(cen):.0f} p/h {pr:.2f} onsets/s {dens:.1f}')
plt.tight_layout(); plt.savefig('survey.png', dpi=55)
