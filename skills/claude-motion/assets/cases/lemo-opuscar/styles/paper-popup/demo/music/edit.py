# 配乐拼接：Dreamy Flashback(开场) → Jaunty Gumption(纸片世界, 跳剪到结尾) → Heartwarming(真实世界)
import numpy as np, soundfile as sf, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'score.wav'   # 默认 demo/music/score.wav（mix.py 读它）
SR = 48000; DUR = 133.0
out = np.zeros((int(DUR * SR), 2))
def load(f): y, sr = sf.read(f); assert sr == SR; return y
def place(y, t_video, t0, t1, fin=.02, fout=.02, gain=1.0):
    seg = y[int(t0 * SR):int(t1 * SR)].copy() * gain
    n = len(seg); fi, fo = int(fin * SR), int(fout * SR)
    if fi: seg[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi))[:, None] ** 2
    if fo: seg[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo))[:, None] ** 2
    a = int(t_video * SR); b = min(len(out), a + n); out[a:b] += seg[:b - a]
DF, JG, HW = load('Dreamy_Flashback.wav'), load('Jaunty_Gumption.wav'), load('Heartwarming.wav')
place(DF, 0.0, 0.0, 16.2, fin=1.5, fout=1.6, gain=.9)
JS = 15.4; A, B, X = 73.21, 102.79, .42      # 跳剪点，交叉淡化一拍
place(JG, JS, 0.0, A + X / 2, fin=.05, fout=X)
place(JG, JS + A - X / 2, B - X / 2, 118.41, fin=X, fout=.3)
place(HW, 104.8, 39.38, 71.5, fin=.35, fout=1.0, gain=1.15)
sf.write(OUT, out.astype(np.float32), SR)
print('jaunty end at video', JS + A + (118.4 - B))
