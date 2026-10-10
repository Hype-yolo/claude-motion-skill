# 配乐剪辑 → score.wav（48k 立体声，成片长度）
# A 段：Monkeys Spinning Monkeys，第一拍对齐第一块砖（4.0s），倒塌瞬间硬切
# 重建：同曲安静段回来（-9dB），下拍对齐"找到锥头"
# 升空：Heroic Age 53.61s 的爆发点对齐点火，60.53→79.02 跳 10 小节（相似度 .95），最后重音落在片尾卡
import numpy as np, soundfile as sf, librosa, warnings, json; warnings.filterwarnings('ignore')
SR, DUR = 48000, 54.0
out = np.zeros((int(SR * DUR), 2))
def load(f):
    y, _ = librosa.load(f, sr=SR, mono=False); return y.T if y.ndim > 1 else np.stack([y, y], 1)
def place(y, song0, song1, at, gain=1.0, fin=.01, fout=.03):
    a, b = int(song0 * SR), int(song1 * SR); seg = y[a:b].copy() * gain
    n = len(seg); ramp = lambda k: np.linspace(0, 1, max(1, int(k * SR)))[:, None]
    fi = ramp(fin); seg[:len(fi)] *= fi[:n]; fo = ramp(fout)[::-1]; seg[-len(fo):] *= fo[-n:]
    s = int(at * SR); e = min(len(out), s + n); out[s:e] += seg[:e - s]
M = load('Monkeys_Spinning_Monkeys.mp3'); mb = np.load('Monkeys_Spinning_Monkeys_beats.npy')
FALL = 4.0 + 32 * 60 / 143.555
place(M, 0.0, FALL - 3.93, 3.93, 1.6, .01, .025)   # 原曲偏轻，+4dB 与升空段拉近
# 重建段：取 64–70s 附近的下拍（每 4 拍）对齐 29.0
downs = mb[::4]; d = downs[np.abs(downs - 66.0).argmin()]; off = 29.0 - d
place(M, 26.4 - off, 32.62 - off, 26.4, 10 ** (-9 / 20), 1.0, .35)
Hh = load('Heroic_Age.mp3'); HOFF = 53.61 - 36.5
A, B = 60.53, 79.02; XF = .06
place(Hh, 53.0, A + XF / 2, 53.0 - HOFF, 1.0, .5, XF)
place(Hh, B - XF / 2, 90.5, A - HOFF - XF / 2, 1.0, XF, 1.2)
pk = np.abs(out).max(); out *= .89 / pk
sf.write('score.wav', out, SR)
json.dump({'final_hit': 87.307 - HOFF - (B - A), 'reprise_downbeat_song': float(d)}, open('score.json', 'w'))
print('peak norm', pk, 'final hit video', 87.307 - HOFF - (B - A))
