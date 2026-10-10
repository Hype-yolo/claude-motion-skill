# 混音：音乐分轨 + 拟音分轨 → mix.wav（响度交给 mux.sh 两遍 loudnorm）
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from core.audio.sfx import SR, limit, lp, hp
from core.audio import sampler as S

D = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: sf.read(p, dtype='float32')[0]
M = {k: rd(os.path.join(D, 'music_stems', f'{k}.wav')) for k in ['melody', 'bass', 'piano', 'drums', 'strings', 'color']}
F = {k: rd(os.path.join(D, f'foley_{k}.wav')) for k in ['pen', 'wash', 'wind', 'hat', 'body', 'amb']}
N = min(len(v) for v in list(M.values()) + list(F.values()))
tt = np.arange(N) / SR
GM = dict(melody=1.0, bass=.95, piano=.85, drums=.75, strings=.8, color=.9)
GF = dict(pen=1.05, wash=.8, wind=.42, hat=.7, body=.95, amb=.55)
music = sum(M[k][:N] * g for k, g in GM.items())
music = S.room(music, size=.4, mix=.16)
# 开场只有笔声：钢笔在前面，0–2.4 s 笔声大；之后线稿扩散的沙沙声压低一点
pen_g = np.interp(tt, [0, 2.3, 2.6, 5, 15, 19.3, 28, 32.4], [1.25, 1.25, .75, .75, .55, .55, 1.0, 1.0])
hpS = lambda x, f: np.stack([hp(x[:, c], f, 4) for c in range(2)], 1)
foley = sum(hpS(F[k][:N], 90) * g for k, g in GF.items() if k not in ('pen', 'body')) + F['body'][:N] * GF['body'] + F['pen'][:N] * GF['pen'] * pen_g[:, None]
music = hpS(music, 38)
# 音乐给关键拟音让路（接住、点水、落地）
duck = np.ones(N)
for t0, depth, d in [(24.0, .55, .5), (8.4, .8, .3), (11.9, .85, .25)]:
    a = int(t0 * SR); b = int((t0 + d) * SR); r = np.linspace(0, 1, b - a)
    duck[a:b] = np.minimum(duck[a:b], depth + (1 - depth) * r ** 2)
music *= duck[:, None]
mix = music * .9 + foley
# 低频不要独大：60 Hz 以下轻切
mix = np.stack([hp(mix[:, c], 35) for c in range(2)], 1)
mix = np.stack([limit(mix[:, c], .95) for c in range(2)], 1).astype(np.float32)
sf.write(os.path.join(D, 'mix.wav'), mix, SR)
# 自检：每小节 RMS（dBFS），静音段，低频占比
bar = 1.2
print('bar  t     music  foley  total')
for b in range(int(N / SR / bar)):
    a, e = int(b * bar * SR), int((b + 1) * bar * SR)
    db = lambda x: 20 * np.log10(np.sqrt((x[a:e] ** 2).mean()) + 1e-9)
    print(f'{b:>3} {b*bar:5.1f} {db(music):6.1f} {db(foley):6.1f} {db(mix):6.1f}')
lo = lp(mix[:, 0], 120); print('low<120Hz share dB:', round(10 * np.log10((lo ** 2).mean() / (mix[:, 0] ** 2).mean()), 1))
s0, s1 = int(20.5 * SR), int(21.5 * SR); print('silence window dBFS:', round(20 * np.log10(np.sqrt((mix[s0:s1] ** 2).mean()) + 1e-9), 1))
