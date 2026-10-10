"""配乐自检：静音是否真 0、起音对齐、各段能量/亮度/中频占用、stem 求和。结果打印并写 check.txt。
用法：.venv/bin/python styles/dark-keynote/demo/music/check.py（先跑 score.py）"""
import os, json
import numpy as np
import soundfile as sf
import librosa

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '..', 'timeline.json')))
x, SR = sf.read(os.path.join(HERE, 'score.wav'), dtype='float32')
out = []
P = lambda *a: out.append(' '.join(str(v) for v in a))
S = lambda t: int(round(t * SR))
mono = x.mean(1)

P(f'length {len(x) / SR:.6f} s  sr {SR}  channels {x.shape[1]}  peak {20 * np.log10(np.abs(x).max()):.2f} dBFS  nan/inf {int((~np.isfinite(x)).sum())}')
for a, b, name in [(15.0, 16.0, 'silence1'), (33.0, 34.0, 'silence2'), (0, 4.0, 'pre-music 0-4'), (33.0, 37.0, '33-37'), (41.94, 42.0, 'tail')]:
    seg = x[S(a):S(b)]
    P(f'{name:14s} {a:6.3f}-{b:6.3f}  max|x| {np.abs(seg).max():.3e}  nonzero samples {int((seg != 0).sum())}')
P(f'last nonzero before 15.0 at {np.nonzero(np.abs(mono[:S(15.0)]) > 0)[0][-1] / SR:.6f} s; first nonzero after 15.0 at {(S(15.0) + np.nonzero(mono[S(15.0):])[0][0]) / SR:.6f} s')


def onset_at(sig, t, win=.03, thr_db=-20):
    """t 附近第一次越过局部峰值 -20 dB 的时间（局部峰值取 t+[0,60ms]）"""
    a = np.abs(sig[S(t - win):S(t + .06)]); pk = np.abs(sig[S(t):S(t + .06)]).max()
    base = np.abs(sig[S(t - win):S(t - .004)]).max() if t - win > 0 else 0
    thr = max(pk * 10 ** (thr_db / 20), base * 1.5)
    return (S(t - win) + int(np.argmax(a >= thr))) / SR


K = TL['K']
t_on = onset_at(mono, K['press'])
P(f"chord onset @ {K['press']}: measured {t_on:.5f} s  error {1000 * (t_on - K['press']):+.2f} ms")

mar, _ = sf.read(os.path.join(HERE, 'stems', 'marimba.wav'), dtype='float32'); mar = mar.mean(1)
v1 = TL['voice1']
oenv = librosa.onset.onset_strength(y=mar[S(3.9):S(15.0)], sr=SR, hop_length=32)
ons = librosa.onset.onset_detect(onset_envelope=oenv, sr=SR, hop_length=32, units='time', backtrack=True) + 3.9
t0 = onset_at(mar, v1[0]['t'])
P(f"voice1 k=0 t={v1[0]['t']:.3f} (-20 dB threshold on marimba stem, no previous note): measured {t0:.5f}  error {1000 * (t0 - v1[0]['t']):+.2f} ms")
for n in [v1[0], v1[len(v1) // 4], v1[len(v1) // 2], v1[3 * len(v1) // 4], v1[-1]]:
    tm = ons[np.argmin(np.abs(ons - n['t']))]
    P(f"voice1 k={n['k']:3d} t={n['t']:.3f} m={n['m']}  librosa backtracked onset {tm:.4f}  error {1000 * (tm - n['t']):+.2f} ms")
d = [1000 * (ons[np.argmin(np.abs(ons - n['t']))] - n['t']) for n in v1]
P(f'librosa onset (backtrack) vs all {len(v1)} voice1 t: median {np.median(d):+.2f} ms, |err|<5ms {sum(abs(e) < 5 for e in d)}/{len(d)}, max |err| {max(abs(e) for e in d):.2f} ms')

P('\nsection            RMS dBFS   centroid Hz   300-3k share   300-3k dBFS   <300 share   >3k share   >3k dBFS   notes/s')
notes = json.load(open(os.path.join(HERE, 'score.json')))['notes']
for a, b, name in [(4, 6, 'desktop v1'), (6, 8, 'album +v2+pad'), (8, 10, 'inbox phase+pulse'), (10, 12, 'all +glock+shk'),
                   (12, 14, 'insert (anxious)'), (14, 15, 'rise'), (16, 18, 'gather chord'), (18, 20, 'sort'),
                   (20, 26, 'reveal (VO)'), (26, 29.5, 'big number'), (29.5, 33, 'breathe'), (37, 42, 'echo chord')]:
    seg = mono[S(a):S(b)].astype(np.float64); rms = np.sqrt(np.mean(seg ** 2))
    F = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / SR); tot = F.sum()
    mid = F[(f >= 300) & (f < 3000)].sum(); lo = F[f < 300].sum(); hi = F[f >= 3000].sum()
    cen = (F * f).sum() / tot
    # 300-3k 带内 RMS（时域带通）
    Z = np.fft.rfft(seg); Zm = Z.copy(); Zm[(f < 300) | (f >= 3000)] = 0; midrms = np.sqrt(np.mean(np.fft.irfft(Zm, len(seg)) ** 2))
    Zh = Z.copy(); Zh[f < 3000] = 0; hirms = np.sqrt(np.mean(np.fft.irfft(Zh, len(seg)) ** 2))
    nps = sum(1 for r in notes if a <= r[0] < b) / (b - a)
    if name.startswith('gather'):
        P(f'  (gather first 250 ms RMS {20 * np.log10(np.sqrt(np.mean(mono[S(16):S(16.25)] ** 2))):.1f} dBFS; rise last 250 ms {20 * np.log10(np.sqrt(np.mean(mono[S(14.75):S(15)] ** 2))):.1f} dBFS)')
    P(f'{name:18s} {20 * np.log10(rms):8.1f}   {cen:10.0f}   {mid / tot:12.2f}   {20 * np.log10(midrms + 1e-12):11.1f}   {lo / tot:10.2f}   {hi / tot:9.2f}   {20 * np.log10(hirms + 1e-12):8.1f}   {nps:7.1f}')

tot = sum(sf.read(os.path.join(HERE, 'stems', f'{s}.wav'), dtype='float64')[0] for s in ['marimba', 'vibes', 'glock', 'pad', 'pulse', 'bowed'])
P(f'\nstems sum vs score: max |diff| {np.abs(tot - x).max():.2e}')
open(os.path.join(HERE, 'check.txt'), 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
