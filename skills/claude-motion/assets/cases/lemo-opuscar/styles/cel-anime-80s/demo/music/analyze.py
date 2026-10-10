# 配乐自检：分段 RMS、频段能量、静音段、卡带段频谱、节拍网格、削波、分轨平衡
# 运行：.venv/bin/python styles/cel-anime-80s/demo/music/analyze.py
import os, json, numpy as np, soundfile as sf, librosa, warnings
from scipy.signal import butter, sosfilt
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
x, sr = sf.read(os.path.join(HERE, 'score.wav')); info = json.load(open(os.path.join(HERE, 'score.json')))
BAR = info['bar']; mono = x.mean(1)
db = lambda v: 20 * np.log10(max(v, 1e-9))
rms = lambda a: np.sqrt(np.mean(a ** 2)) if len(a) else 0
print(f"len {len(x)/sr:.3f}s  peak {db(np.abs(x).max()):.2f} dBFS  clipped samples {(np.abs(x) >= .999).sum()}")
secs = [('intro 0-4', 0, 4), ('fill 4', 4, 5), ('title 5-7', 5, 7), ('verse 7-13', 7, 13), ('pre 13-15.75', 13, 15.75),
        ('CUTOUT', 15.75, 16), ('chorus 16-21', 16, 21), ('lofi 21', 21, 22), ('final 22-24', 22, 24), ('pullback 24-26', 24, 26),
        ('ending 26-28', 26, 28), ('tail 28-end', 28, 59 / BAR)]
print('\n段落 RMS / 频谱质心 / 立体声宽度(side/mid dB)')
for name, a, b in secs:
    s = x[int(a * BAR * sr):int(b * BAR * sr)]
    if not len(s): continue
    m = s.mean(1); sd = (s[:, 0] - s[:, 1]) / 2
    cen = librosa.feature.spectral_centroid(y=m.astype(np.float32), sr=sr).mean() if rms(m) > 1e-6 else 0
    print(f"  {name:16s} {db(rms(m)):7.1f} dB   centroid {cen:6.0f} Hz   width {db(rms(sd)) - db(rms(m)):6.1f} dB")
print('\n每小节 RMS (dB):')
print('  ' + ' '.join(f"{db(rms(mono[int(i*BAR*sr):int((i+1)*BAR*sr)])):.0f}" for i in range(int(59 / BAR) + 1)))
c0, c1 = int(info['cutout_start'] * sr), int(info['cutout_end'] * sr)
print(f"\n静音段 {info['cutout_start']:.3f}-{info['cutout_end']:.3f}: 最大样本 {np.abs(x[c0 + 10:c1]).max():.2e}; 静音后 20ms 峰值 {db(np.abs(x[c1:c1 + 960]).max()):.1f} dB")
def band(a, lo, hi): return db(rms(sosfilt(butter(4, [lo, hi], 'band', fs=sr, output='sos'), a)))
for name, a, b in [('verse', 7, 13), ('chorus', 16, 21), ('final', 22, 24)]:
    s = mono[int(a * BAR * sr):int(b * BAR * sr)]; tot = db(rms(s))
    print(f"频段({name}) 相对全频: 20-120 {band(s, 20, 120) - tot:+.1f}  120-500 {band(s, 120, 500) - tot:+.1f}  500-2k {band(s, 500, 2000) - tot:+.1f}  2k-6k {band(s, 2000, 6000) - tot:+.1f}  6k-16k {band(s, 6000, 16000) - tot:+.1f}")
lo = mono[int(21 * BAR * sr) + 2000:int(22 * BAR * sr) - 2000]; ch = mono[int(20 * BAR * sr):int(21 * BAR * sr)]
print(f"卡带段 vs 前一小节: <250Hz {band(lo, 30, 250) - band(ch, 30, 250):+.1f} dB, >5k {band(lo, 5000, 15000) - band(ch, 5000, 15000):+.1f} dB, 总 {db(rms(lo)) - db(rms(ch)):+.1f} dB")
tempo, beats = librosa.beat.beat_track(y=mono[int(5 * BAR * sr):].astype(np.float32), sr=sr, start_bpm=116, units='time')
beats = beats + 5 * BAR; grid = info['beat']
err = [(b / grid - round(b / grid)) * grid * 1000 for b in beats]
print(f"\n节拍追踪 tempo {float(np.atleast_1d(tempo)[0]):.1f} BPM，{len(beats)} 拍，偏离网格 中位 {np.median(np.abs(err)):.1f} ms，90% {np.percentile(np.abs(err), 90):.1f} ms")
on = librosa.onset.onset_detect(y=mono.astype(np.float32), sr=sr, units='time', backtrack=False)
for k in ['title_hit', 'chorus_hit', 'land_hit', 'keychange_hit', 'final_chord']:
    t = info[k]; near = on[np.argmin(np.abs(on - t))]
    print(f"  {k:14s} {t:7.3f}s  最近起音 {near:7.3f}s ({(near - t) * 1000:+.0f} ms)")
print('\n分轨在副歌 (bar16-21) 的 RMS:')
for f in sorted(os.listdir(os.path.join(HERE, 'stems'))):
    s, _ = sf.read(os.path.join(HERE, 'stems', f)); s = s.mean(1)[int(16 * BAR * sr):int(21 * BAR * sr)]
    print(f"  {f:12s} {db(rms(s)):6.1f} dB")
