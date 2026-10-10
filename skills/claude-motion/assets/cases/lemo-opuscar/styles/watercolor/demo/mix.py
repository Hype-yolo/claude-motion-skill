# 配乐 + 旁白 + 合成环境声 → mix.wav（48k 立体声）
# 用法（仓库根）：.venv/bin/python styles/watercolor/demo/mix.py [out.wav]   （默认写 demo/mix.wav）
# 输入：music/score.wav、voices/v*.wav + dur.json、scene.js 里 VO 表的开始时间
import json, re, os, sys, numpy as np, soundfile as sf
OUTWAV = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else None
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve

SR = 48000; DUR = 113.6; N = int(DUR * SR)
rng = np.random.default_rng(11)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rng.standard_normal(n)
def pink(n):
    w = np.fft.rfft(noise(n)); f = np.arange(len(w)); f[0] = 1
    return np.fft.irfft(w / np.sqrt(f), n) * 20
def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p
def st(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)
def env(n, a, r):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))
def fade(x, fi, fo):
    n = len(x); e = np.ones(n); a = int(fi * SR); b = int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 1.5
    if b: e[-b:] = np.minimum(e[-b:], np.linspace(1, 0, b) ** 1.5)
    return x * (e[:, None] if x.ndim == 2 else e)
def dbfs(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
IRn = int(1.8 * SR); IR = np.stack([noise(IRn), noise(IRn)], 1) * np.exp(-np.arange(IRn) / SR * 3.2)[:, None]
IR = np.stack([lp(IR[:, 0], 5000), lp(IR[:, 1], 5000)], 1); IR /= np.sqrt((IR ** 2).sum(0))
def verb(x2, wet=.3):
    y = np.stack([fftconvolve(x2[:, 0], IR[:, 0])[:len(x2)], fftconvolve(x2[:, 1], IR[:, 1])[:len(x2)]], 1)
    return x2 * (1 - wet) + y * wet

sfx = np.zeros((N, 2))
def put(buf, t, x):
    i = int(t * SR); j = min(N, i + len(x))
    if j > i: buf[i:j] += x[:j - i]

# ---- 笔刷：纸上的沙沙 ----
def brush(d, g, pan0=-.5, pan1=.5):
    n = int(d * SR); p = np.arange(n) / n
    x = bp(noise(n), 1500, 7000) * (.6 + .4 * np.abs(np.sin(np.arange(n) / SR * 2 * np.pi * 9)))
    x += bp(pink(n), 300, 1500) * .5
    e = np.sin(np.pi * p) ** .8
    pan = pan0 + (pan1 - pan0) * p
    y = norm(x * e, .5) * g
    return np.stack([y * np.cos((pan + 1) * np.pi / 4) * 1.414, y * np.sin((pan + 1) * np.pi / 4) * 1.414], 1)
put(sfx, .5, brush(2.3, .5, -.8, .8))
# 太阳像盖印：一声闷响
def stamp(g):
    n = int(1.2 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(90 * (1 + .5 * np.exp(-t * 30))) / SR) * np.exp(-t * 9) + lp(noise(n), 900) * env(n, .002, .05) * .6
    return verb(st(norm(x, .8) * g), .25)
put(sfx, 1.6, stamp(.55))
put(sfx, 10.2, brush(3.2, .35, -.9, .9))
# ---- 沙漠风 ----
def wind(d, g):
    n = int(d * SR); t = np.arange(n) / SR
    gust = .55 + .45 * np.sin(2 * np.pi * .21 * t + 1) * np.sin(2 * np.pi * .09 * t)
    a = lp(pink(n), 600) * gust + bp(noise(n), 700, 2200) * .06 * gust
    b = lp(pink(n), 600) * gust
    return fade(np.stack([norm(a, .5), norm(b, .5)], 1) * g, 2.5, 3)
put(sfx, 9.0, wind(26, .30))
# ---- 虎皮鹦鹉的叽喳 ----
def chirp(g, f0):
    n = int(.09 * SR); t = np.arange(n) / SR
    f = f0 * (1 + .35 * np.sin(2 * np.pi * 38 * t)) * (1 + 1.2 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]) ** 2
    return x * g
for k in range(46):
    tt = 25.6 + rng.uniform(0, 6.6); pan = np.clip(.9 - (tt - 25.6) / 3.8, -.9, .9)
    put(sfx, tt, verb(st(chirp(rng.uniform(.05, .11), rng.uniform(3200, 4800)), pan), .2))
# ---- 雨滴落在穆加树上 ----
def plink(g, f):
    n = int(.35 * SR); t = np.arange(n) / SR
    fr = f * (1 + .8 * np.exp(-t * 60)); x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 22)
    return verb(st(x * g, rng.uniform(-.3, .3)), .3)
for i in range(14): put(sfx, 27.1 + i * .36 + .45, plink(.12, rng.uniform(900, 1500)))
# ---- 火：噼啪 + 低吼 ----
def fire(d, g):
    n = int(d * SR); t = np.arange(n) / SR
    roar = lp(pink(n), 500) * (.6 + .4 * np.sin(2 * np.pi * .7 * t) ** 2)
    imp = (rng.random(n) < 90 / SR) * rng.uniform(-1, 1, n)
    crack = hp(np.convolve(imp, np.exp(-np.arange(300) / 40), 'same'), 1500) * 3
    x = norm(roar, .5) + norm(crack, .7)
    return fade(np.stack([x, np.roll(x, 500)], 1) * g, 1.2, 2.0)
put(sfx, 41.4, fire(6.4, .42))
# ---- 雨（渐大）----
def rain(d, g):
    n = int(d * SR); t = np.arange(n) / SR
    base = hp(pink(n), 1200) * .5 + bp(noise(n), 3000, 9000) * .3
    imp = (rng.random(n) < 220 / SR) * rng.uniform(.2, 1, n)
    drops = bp(np.convolve(imp, np.exp(-np.arange(200) / 25), 'same'), 1500, 6000)
    x = norm(base, .5) + norm(drops, .35)
    ramp = np.clip((t - 0) / 8, 0, 1) ** 1.5 * .55 + np.clip((t - 9) / 5, 0, 1) * .45
    y = np.stack([x, np.roll(x, 900)], 1) * ramp[:, None]
    return fade(y * g, .5, 3.0)
put(sfx, 51.0, rain(23.0, .28))
# ---- 东部鞭鸟：长哨音 + 鞭响 + 雌鸟回应 ----
def whipbird(g, pan):
    d = 2.1; n = int(d * SR); t = np.arange(n) / SR; x = np.zeros(n)
    k1 = int(1.25 * SR); t1 = t[:k1]
    f1 = 2000 + 250 * (t1 / t1[-1]); a1 = np.minimum(1, t1 / .05) * (1 - .2 * t1)
    x[:k1] = np.sin(2 * np.pi * np.cumsum(f1) / SR) * a1 * .6
    k2 = int(.09 * SR); s2 = k1 + int(.04 * SR); t2 = np.arange(k2) / SR
    f2 = 1800 * np.exp(t2 / t2[-1] * np.log(4.2)); x[s2:s2 + k2] += np.sin(2 * np.pi * np.cumsum(f2) / SR) * np.sin(np.pi * t2 / t2[-1]) * 1.0
    for off in (.3, .5):
        s3 = s2 + int(off * SR); k3 = int(.1 * SR); t3 = np.arange(k3) / SR
        f3 = 2600 - 900 * t3 / t3[-1]; x[s3:s3 + k3] += np.sin(2 * np.pi * np.cumsum(f3) / SR) * np.sin(np.pi * t3 / t3[-1]) * .45
    return verb(st(x * g, pan), .4)
put(sfx, 63.4, whipbird(.16, .5))
put(sfx, 68.6, whipbird(.11, -.4))
# ---- 转场：雾起、海岸线笔刷、倒带、地图上的火 ----
def swell(d, g, rev=False):
    n = int(d * SR); p = np.arange(n) / n
    e = (p if not rev else p) ** 2.2
    x = bp(pink(n), 250, 5000) * e * np.minimum(1, (1 - p) / .03)
    return st(norm(x, .45) * g)
def airy(d, g):
    n = int(d * SR); p = np.arange(n) / n
    x = bp(pink(n), 300, 3000) * np.sin(np.pi * p) ** 2
    return st(norm(x, .4) * g)
put(sfx, 70.3, airy(3.8, .35))
put(sfx, 73.3, brush(3.1, .22, -.6, .6))
put(sfx, 79.2, swell(1.6, .38))
put(sfx, 89.4, fire(5.4, .16))

# ---- 配乐 ----
mus, sr = sf.read('music/score.wav'); assert sr == SR
mus = mus[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
mus = fade(mus, 0, 1.2)

# ---- 旁白：压缩 + 摆放 ----
dur = json.load(open('voices/dur.json'))
vo_times = [(m[0], float(m[1])) for m in re.findall(r"\['(v\d\d)', ([\d.]+),", open('scene.js').read())]
vo = np.zeros(N); duck = np.zeros(N)
def compress(x, thr=-24, ratio=3.0):
    e = np.sqrt(np.maximum(lp(x ** 2, 30), 0) + 1e-10); lv = 20 * np.log10(e)
    gdb = np.where(lv > thr, (thr - lv) * (1 - 1 / ratio), 0); return x * 10 ** (gdb / 20)
for vid, t0 in vo_times:
    x, vsr = sf.read(f'voices/{vid}.wav')
    x = resample_poly(x, SR, vsr); x = hp(x, 90); x = compress(x)
    i = int(t0 * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
    a = max(0, i - int(.25 * SR)); b = min(N, j + int(.4 * SR)); duck[a:b] = 1
duck = lp(np.convolve(duck, np.ones(int(.3 * SR)) / int(.3 * SR), 'same'), 5)
act = duck > .5
mus_db = dbfs(mus[act]); vo_db = dbfs(vo[act])
from scipy.ndimage import maximum_filter1d
def limit(x, ceil):  # 5ms 预读的峰值限制
    pk = maximum_filter1d(np.abs(x), int(.005 * SR)); g = np.minimum(1, ceil / (pk + 1e-9))
    g = np.minimum.reduce([g, np.roll(g, int(.0025 * SR))]); g = lp(g, 200); return x * np.clip(g, 0, 1)
speech = np.abs(vo) > 10 ** (-40 / 20) * np.abs(vo).max()
vr = np.sqrt(np.mean(vo[np.convolve(speech, np.ones(2400), 'same') > 0] ** 2))
vo = limit(vo, vr * 10 ** (11 / 20))
vo_db = dbfs(vo[act])
vo *= 10 ** ((mus_db + 8 - vo_db) / 20)       # 旁白比配乐高约 8 dB
mus *= (1 - .38 * duck)[:, None]               # 说话时配乐让开约 4 dB
vo2 = verb(st(vo), .06)
mix = mus + vo2 + sfx
pk = lambda x: round(20 * np.log10(np.abs(x).max() + 1e-12), 1); print('peaks mus', pk(mus), 'vo', pk(vo2), 'sfx', pk(sfx)); print('music', round(dbfs(mus), 1), 'vo(active)', round(dbfs(vo2[act]), 1), 'sfx', round(dbfs(sfx), 1), 'peak', round(20 * np.log10(np.abs(mix).max()), 1))
mix = mix / np.abs(mix).max() * .89
sf.write(OUTWAV or 'mix.wav', mix.astype(np.float32), SR, subtype='FLOAT')
