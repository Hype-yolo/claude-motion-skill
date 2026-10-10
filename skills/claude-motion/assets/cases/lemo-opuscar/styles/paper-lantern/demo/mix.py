"""混音：旁白（压缩 + 配平）+ 配乐（Ripples → Nu Flute 接力，旁白时自动避让）+ 程序化音效 → out/mix.wav
用法：python mix.py [out.wav]   （先跑 node render/cues.mjs 生成 out/timeline.json；默认输出 out/mix.wav；任意 cwd 均可）"""
import json, sys, os, numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt, fftconvolve
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else None
os.chdir(os.path.dirname(os.path.abspath(__file__)))   # 以下路径都相对 demo/
OUT = OUT or 'out/mix.wav'
SR = 48000
rng = np.random.default_rng(3)
T = json.load(open('out/timeline.json')); C, DUR = T['C'], T['DUR']
W = json.load(open('vo/words.json'))
N = int((DUR + .5) * SR)

def t_(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def env(d, a, r): tt = t_(d); return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-np.maximum(0, tt - a) / r)
def norm(x, p=1.): m = np.abs(x).max(); return x / m * p if m > 0 else x
def db(x): return 10 ** (x / 20)
def put(buf, x, t, g=1.):
    i = int(t * SR); j = min(len(buf), i + len(x));
    if i < len(buf): buf[i:j] += x[:j - i] * g
def word(lid, k): return C[lid]['at'] + W[lid][k][1]

# —— 旁白：去齿音感的轻压缩（峰值限制 + RMS 配平）——
vo = np.zeros(N)
for lid, c in C.items():
    a, sr = librosa.load(f'vo/{lid}.wav', sr=SR, mono=True)
    put(vo, a, c['at'])
def compress(x, thr=-20, ratio=3, att=.003, rel=.12):
    e = np.abs(x); out = np.zeros_like(e); ga, gr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); s = 0
    # 降采样包络以提速
    hop = 48; ee = e[:len(e) // hop * hop].reshape(-1, hop).max(1); o = np.zeros_like(ee); ga, gr = np.exp(-hop / (att * SR)), np.exp(-hop / (rel * SR))
    for i, v in enumerate(ee): s = ga * s + (1 - ga) * v if v > s else gr * s + (1 - gr) * v; o[i] = s
    lvl = 20 * np.log10(np.maximum(o, 1e-6)); gdb = np.minimum(0, (thr - lvl) * (1 - 1 / ratio))
    g = np.repeat(db(gdb), hop); g = np.concatenate([g, np.full(len(x) - len(g), g[-1])])
    return x * g
vo = compress(vo, -22, 3)
vo = hp(vo, 70)
speech = np.abs(vo) > 1e-4

# —— 配乐 ——
def load(p): a, _ = librosa.load(p, sr=SR, mono=False); return a if a.ndim == 2 else np.stack([a, a])
rip, flu = load('music/km_Ripples.mp3'), load('music/km_Nu_Flute.mp3')
music = np.zeros((2, N))
T_FLU = C['L23']['at'] - 70 + .3          # 让 Nu Flute 70 s 的抬升落在“但愿人长久”
XF0, XF1 = T_FLU, T_FLU + 4.5
tt = np.arange(N) / SR
r = rip[:, :min(rip.shape[1], int(XF1 * SR))]; gr_ = np.clip((XF1 - tt[:r.shape[1]]) / (XF1 - XF0), 0, 1) ** .7
music[:, :r.shape[1]] += r * gr_ * db(0)
i0 = int(T_FLU * SR); f = flu[:, :N - i0]; gf = np.clip((tt[i0:i0 + f.shape[1]] - XF0) / (XF1 - XF0), 0, 1) ** .7
music[:, i0:i0 + f.shape[1]] += f * gf * db(-3.3)
# 片头：古筝前 2 s 淡入；片尾：最后 3 s 淡出
music *= np.clip(tt / 2.0, 0, 1) * np.clip((DUR - tt) / 3.0, 0, 1)
# 旁白避让：说话时压 7 dB（平滑包络）
e = np.convolve(speech.astype(float), np.ones(int(.25 * SR)) / int(.25 * SR), 'same')
e = np.clip(e * 3, 0, 1); duck = db(-5.5 * e)
music *= duck

# —— 音效 ——
fx = np.zeros(N)
def click(v=1.):   # 开关
    d = .05; x = hp(noise(d), 2000) * env(d, .0005, .004) + np.sin(2 * np.pi * 1800 * t_(d)) * env(d, .0005, .01) * .4; return norm(x) * v
def shimmer(d=3., v=1.):   # 灯亮起：高频泛音慢慢升起
    tt2 = t_(d); x = sum(np.sin(2 * np.pi * f * tt2 + rng.random() * 6) * (.5 + .5 * np.sin(2 * np.pi * (.3 + k * .07) * tt2)) for k, f in enumerate([1320, 1760, 1980, 2640, 3520]))
    return norm(x * np.minimum(1, tt2 / (d * .6)) * np.exp(-np.maximum(0, tt2 - d * .6) / (d * .3))) * v
def thud(v=1., f0=90):   # 木模压下 / 合盖
    d = .35; tt2 = t_(d); x = np.sin(2 * np.pi * f0 * tt2 * (1 - .3 * tt2)) * env(d, .002, .07) + lp(noise(d), 900) * env(d, .001, .03) * .8 + bp(noise(d), 1500, 4000) * env(d, .0005, .008) * .5
    return norm(x) * v
def puff(v=1.):
    d = .6; return norm(bp(noise(d), 300, 3000) * env(d, .01, .15)) * v
def rustle(d=1.5, v=1.):   # 纸张沙沙
    x = bp(noise(d), 1500, 7000); am = np.clip(sosfilt(butter(1, 12, 'low', fs=SR, output='sos'), np.abs(noise(d))) * 3, 0, 1)
    return norm(x * am * np.sin(np.pi * t_(d) / d) ** .5) * v
def crunch(v=1.):
    d = .25; x = sum(bp(noise(d), 2000, 6000) * env(d, .001, .01 + k * .004) * (rng.random() > .3) for k in range(1)); x = np.roll(x, 0)
    for k in range(6): put_ = int(rng.random() * .15 * SR); x[put_:put_ + 400] += bp(noise(400 / SR), 1500, 5000)[:len(x[put_:put_ + 400])] * .6
    return norm(x * env(d, .002, .08)) * v
def chime(v=1., f=1568):
    d = 2.2; tt2 = t_(d); x = sum(a * np.sin(2 * np.pi * f * m * tt2) * np.exp(-tt2 / (.9 / m ** .5)) for m, a in [(1, 1), (2.76, .4), (5.4, .2)]); return norm(x) * v
def train_bed(d):   # 火车：低频轰鸣 + “哐当哐当”
    tt2 = t_(d); rum = lp(noise(d), 180) * .5 + lp(noise(d), 60) * .8
    x = rum * (.8 + .2 * np.sin(2 * np.pi * .7 * tt2))
    per = .62
    for k in range(int(d / per)):
        for off in (0, .12):
            s = int((k * per + off) * SR); c = hp(noise(.08), 400) * env(.08, .001, .02) * .9 + np.sin(2 * np.pi * 140 * t_(.08)) * env(.08, .001, .03)
            x[s:s + len(c)] += c[:len(x[s:s + len(c)])]
    return norm(x) * np.minimum(1, np.minimum(tt2, d - tt2) / .8)
def whoosh(d=1.6, v=1.):
    n = noise(d); tt2 = t_(d); out = np.zeros_like(n); hop = 960
    for i in range(0, len(n), hop):
        fc = 300 + 2200 * np.sin(np.pi * i / len(n)); seg = bp(n[max(0, i - 4000):i + hop], fc * .7, fc * 1.4)[-hop:]; out[i:i + len(seg)] = seg
    return norm(out * np.sin(np.pi * tt2 / d) ** 2) * v
def hum(d, v=1.):   # 城市远处的车流
    return norm(lp(noise(d), 400) + bp(noise(d), 500, 1500) * .2) * v * np.minimum(1, np.minimum(t_(d), d - t_(d)) / 1.0)

P = {p[0]: p for p in T['P']}
put(fx, click(), .55, db(-24))
put(fx, shimmer(4.0), 1.0, db(-30))
put(fx, thud(1, 85), word('L04', 13) + .02, db(-14))
put(fx, puff(), word('L04', 13) + .05, db(-26))
put(fx, chime(1, 1318), C['L05']['at'] + W['L05'][8][1] + .1, db(-30))       # “圆”字闪光
put(fx, rustle(2.2), C['L06']['at'] + .6, db(-28))                            # 卷轴展开
put(fx, rustle(.6), word('L09', 8) - .5, db(-30))                             # 字条
put(fx, thud(1, 110), C['L10']['at'] - .45, db(-18))                          # 合盖
tb0, tb1 = P['S07'][1], P['S09'][1] + .6
put(fx, train_bed(tb1 - tb0), tb0, db(-28))
put(fx, train_bed(P['S10'][2] - P['S10'][1]), P['S10'][1], db(-27))
put(fx, whoosh(1.8), C['L14']['at'] + .1, db(-22))                            # 对面来车
put(fx, chime(1, 1760), C['L14']['at'] + 1.0, db(-30))                        # 交会一瞬
put(fx, hum(P['S11'][2] - P['S11'][1]), P['S11'][1], db(-34))
put(fx, rustle(.8), word('L16', 6) - .1, db(-28)); put(fx, chime(1, 1175), word('L16', 6) + .3, db(-31))
put(fx, crunch(), word('L18', 1) + .05, db(-24))
put(fx, rustle(.8), word('L19', 6) - .2, db(-28)); put(fx, chime(1, 1318), word('L19', 6) + .2, db(-31))
put(fx, chime(1, 1568), word('L21', 7) + 1.2, db(-29)); put(fx, chime(1, 2093), word('L21', 7) + 1.5, db(-33))
put(fx, whoosh(1.4), P['S17'][1] - 1.0, db(-26))                              # 祥云幕
fx = np.stack([fx, fx])

# —— 总线：旁白居中，高于音乐约 10 dB ——
def rms(x): return np.sqrt(np.mean(x[np.abs(x) > 1e-4] ** 2))
vo_s = np.stack([vo, vo]) * (db(-18) / rms(vo))
mu = music * (db(-27.5) / rms(music.mean(0)))
mix = vo_s + mu + fx * db(-4)
mix = mix / max(1, np.abs(mix).max() / db(-1))
sf.write(OUT, mix.T.astype(np.float32), SR)
print('mix ok', mix.shape[1] / SR, 'peak', 20 * np.log10(np.abs(mix).max()), 'T_FLU', round(T_FLU, 2))
