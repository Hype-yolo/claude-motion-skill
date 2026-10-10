# Where the Wind Went —— 拟音 + 环境底（全部程序合成）
# 纸上钢笔、湿画洇开、风、草帽翻飞、脚步、车铃、扑接、点水、公园/城市环境
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
from core.audio.sfx import SR, add, bp, hp, lp, noise, env_exp, norm, t_, brown, thump, whoosh
from core.audio import sampler as S

D = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(D, 'cues.json')))
DUR = C['dur']; N = int(DUR * SR)
rng = np.random.default_rng(3)
def buf(): return np.zeros((N, 2), np.float32)
B = {k: buf() for k in ['pen', 'wash', 'wind', 'hat', 'body', 'amb']}
ev = lambda typ: [e for e in C['ev'] if e['type'] == typ]
BEAT = .4

# ---------- 钢笔在冷压纸上 ----------
def pen(d, v=1., bright=1.):
    d = max(.03, d); n = int(d * SR); x = rng.standard_normal(n)
    fiber = lp(rng.standard_normal(n), 90); fiber = .55 + .45 * np.abs(fiber) / (np.abs(fiber).max() + 1e-9)
    grain = (rng.random(n) > .9975) * rng.standard_normal(n) * 4                     # 纸纤维的小颗粒
    y = bp(x, 1600 * bright, 7500 * min(1.25, bright), 2) * fiber + hp(grain, 2500)
    e = np.minimum(1, np.arange(n) / (.008 * SR)) * np.minimum(1, (n - np.arange(n)) / (.025 * SR))
    return (y * e * v * .22).astype(np.float32)
# 开场：人物一笔一笔（0.12–1.6），帽子（1.05–1.5）
t = .12
while t < 1.62:
    d = .06 + rng.random() * .16; add(B['pen'], pen(d, .9 + rng.random() * .3), t, 1, rng.uniform(-.25, .25)); t += d + .02 + rng.random() * .05
for k in range(5): add(B['pen'], pen(.07, .8, 1.1), 1.05 + k * .09, 1, .3)
# 页角手写（1.55–2.35）：写字的节奏更碎
def write(t0, d, v=.8):
    t = t0
    while t < t0 + d:
        dd = .03 + rng.random() * .07; add(B['pen'], pen(dd, v * (.7 + rng.random() * .5), 1.15), t, 1, rng.uniform(-.1, .1)); t += dd + .012 + rng.random() * .03
        if rng.random() < .12: t += .08                                                    # 单词之间
write(1.55, .8)
for e in ev('writeTitle'): write(e['t'], e['d'], .9)
for e in ev('writeCredits'): write(e['t'], e['d'], .7)
# 世界里的每一笔（线稿扩散 + 天际线）
for t0, du, L, g in C['strokes']:
    if g == 0 and t0 < 2.2: v = .8                                                      # 野餐布、篮子
    elif g == 0: v = .09 + min(.12, L / 4000)                                           # 扩散：成百上千笔叠成一片沙沙
    else: v = .22 + min(.15, L / 3000)                                                  # 天际线：更亮、更脆，当踩镲用
    add(B['pen'], pen(du, v, 1.3 if g else 1.0), t0, 1, rng.uniform(-.6, .6))

# ---------- 湿画洇开 ----------
def wet(d, v=1., lo=180, hi=2600):
    n = int(d * SR); x = rng.standard_normal(n)
    bub = lp(np.abs(rng.standard_normal(n)), 30); bub = bub / (bub.max() + 1e-9)
    y = bp(x, lo, hi, 2) * (.5 + .8 * bub)
    tt = np.arange(n) / SR; e = (1 - np.exp(-tt / .06)) * np.exp(-tt / (d * .45))
    return (y * e * v * .5).astype(np.float32)
for t0, v, d in [(1.78, .5, .8), (6.02, .9, 1.6), (12.0, .7, 1.1), (13.2, .7, 1.1), (14.4, .75, 1.1), (16.0, .8, 2.2), (24.02, 1.0, 1.4), (24.3, .9, 3.4)]:
    add(B['wash'], wet(d, v), t0, 1, rng.uniform(-.3, .3))
# 跟着帽子一路的湿声（很轻）
tr = np.array(C['track'])
for i in range(len(tr) - 1):
    tt, spd, sx = tr[i]
    if 6.1 < tt < 20.3 or 21.7 < tt < 24:
        if i % 6 == 0: add(B['wash'], wet(.3, .08 + min(.12, spd / 9000)), tt, 1, sx * .7)

# ---------- 风 ----------
def band_env(x, fc_curve, q=.6):
    out = np.zeros_like(x); step = 1200
    for i in range(0, len(x), step):
        fc = fc_curve[min(len(fc_curve) - 1, i)]; lo, hi = max(60, fc * (1 - q)), min(SR / 2 - 100, fc * (1 + q))
        s = sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x[max(0, i - 4000):i + step])[-step:]; out[i:i + len(s)] = s
    return out
tt = np.arange(N) / SR
def envk(keys):
    ks = np.array(keys); return np.interp(tt, ks[:, 0], ks[:, 1])
wamp = envk([(0, 0), (4.3, 0), (5.2, .5), (6.0, .9), (7.0, .45), (11.0, .4), (15.0, .55), (19.2, .8), (20.2, .08), (20.4, .02), (21.55, .02), (21.7, .5), (23.6, 1.0), (24.05, .3), (26, .15), (32.4, .1)])
wfc = envk([(0, 400), (5.5, 700), (6.0, 900), (10, 600), (15, 800), (19.2, 1100), (20.4, 500), (21.6, 500), (23.8, 1500), (24.2, 500), (32.4, 400)])
wn = brown(DUR) * .6 + rng.standard_normal(N) * .08
w = band_env(wn, wfc) * wamp
wpan = envk([(0, .9), (4.4, .9), (6.0, 0), (32.4, 0)])       # J-cut：风从右声道进来
for ch, g in [(0, lambda p: np.cos((p + 1) * np.pi / 4)), (1, lambda p: np.sin((p + 1) * np.pi / 4))]:
    B['wind'][:, ch] += (w * g(wpan) * 1.2 * .7).astype(np.float32)
# 下坠的呼啸 + 扑的风声
for e in ev('fall'): add(B['wind'], whoosh(2.3, .5), e['t'] + .05, 1, .2)
for e in ev('dive'): add(B['wind'], whoosh(.5, .6), e['t'], 1, .3)
for e in ev('gust'): add(B['wind'], whoosh(1.6, .45), e['t'], 1, .6)
# 树叶哗啦（阵风时）
leaf = bp(rng.standard_normal(N), 2500, 9000) * (lp(np.abs(rng.standard_normal(N)), 12) * 6)
lamp = envk([(0, 0), (4.8, 0), (6.0, .35), (8, .12), (11.5, .2), (12, .35), (15, .25), (19, .1), (20.3, 0), (21.6, 0), (23, .1), (25, .15), (32.4, .1)])
B['wind'][:, 0] += (leaf * lamp * .25).astype(np.float32); B['wind'][:, 1] += (np.roll(leaf, 997) * lamp * .25).astype(np.float32)

# ---------- 草帽翻飞（纸质拍打），声像跟着屏幕 ----------
flap = np.zeros(N)
for i in range(len(tr) - 1):
    t0, spd, sx = tr[i]
    if t0 < 6.0 or t0 > 24.0 or (20.35 < t0 < 21.6): continue
    a, b = int(t0 * SR), int(tr[i + 1][0] * SR); rate = 9 + min(14, spd / 120)
    ph = 2 * np.pi * rate * np.arange(a, b) / SR
    flap[a:b] = (np.maximum(0, np.sin(ph)) ** 6) * min(1, .15 + spd / 1500)
fl = bp(rng.standard_normal(N), 700, 3200) * flap
# 到顶那几秒：极慢的纸声
pan = np.interp(tt, tr[:, 0], tr[:, 2])
B['hat'][:, 0] += (fl * np.cos((pan + 1) * np.pi / 4) * .5).astype(np.float32); B['hat'][:, 1] += (fl * np.sin((pan + 1) * np.pi / 4) * .5).astype(np.float32)
for e in ev('hatLift'): add(B['hat'], whoosh(.45, .7), e['t'] - .05, 1, .2); add(B['hat'], hp(noise(.12), 1200) * env_exp(.12, .02) * .5, e['t'], 1, .2)
for e in ev('bounce'): add(B['hat'], thump(.5, 170), e['t'], 1, -.1); add(B['hat'], bp(noise(.25), 1500, 6000) * env_exp(.25, .06) * .4, e['t'], 1, -.1)

# ---------- 人：脚步、扑空、跳、扑接 ----------
def step_grass(v=1.):
    d = .16; x = lp(noise(d), 500) * env_exp(d, .025) * .8 + bp(noise(d), 1800, 6000) * env_exp(d, .04) * .35
    return (x * v * .6).astype(np.float32)
for e in ev('step'): add(B['body'], step_grass(.75 + rng.random() * .3), e['t'] + rng.normal(0, .006), 1, rng.uniform(-.2, .2))
for e in ev('miss'): add(B['body'], whoosh(.3, .5), e['t'] - .1, 1, -.2); add(B['body'], step_grass(1.1), e['t'] + .3, 1, -.2)
for e in ev('jump'): add(B['body'], whoosh(.35, .45), e['t'] - .25, 1, -.3); add(B['body'], step_grass(1.2), e['t'] + .35, 1, -.3)
for e in ev('catch'):
    add(B['body'], thump(1.0, 75), e['t'] + .03, 1, .1)
    add(B['body'], bp(noise(.6), 1200, 7000) * env_exp(.6, .18) * .5, e['t'] + .03, 1, .1)                # 草上滑行
    add(B['body'], hp(noise(.07), 900) * env_exp(.07, .012) * .9, e['t'], 1, .15)                         # 帽子"啪"地进手
for e in ev('splash'):
    d = .5; tt2 = t_(d); f = 1400 * np.exp(-tt2 / .05) + 280
    plop = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .06)
    add(B['body'], plop * .8 + bp(noise(d), 1500, 8000) * env_exp(d, .08) * .4, e['t'] + .02, 1, .2)
    for k in range(6): add(B['body'], np.sin(2 * np.pi * (2200 + k * 350) * t_(.08)) * env_exp(.08, .02) * .15, e['t'] + .15 + k * .09, 1, .3)

# ---------- 单车：铃 + 飞轮 ----------
def bell(v=1.):
    d = 1.3; tt2 = t_(d); f0 = 1760
    x = sum(a * np.sin(2 * np.pi * f0 * r * tt2 + ph) * env_exp(d, tau) for r, a, tau, ph in [(1, 1, .5, 0), (2.76, .5, .25, 1), (5.4, .25, .12, 2), (1.004, .6, .45, .5)])
    trill = .6 + .4 * np.sign(np.sin(2 * np.pi * 26 * tt2)) * (tt2 < .18)
    return (x * trill * v * .25).astype(np.float32)
for e in ev('bell'): add(B['body'], bell(.9), e['t'], 1, -.35)
for k in range(60):
    t0 = 9.6 + k * .045
    if t0 < 12.2: add(B['body'], hp(noise(.01), 3000) * env_exp(.01, .002) * .08, t0, 1, -.3)

# ---------- 环境：纸面房间音 → 公园（鸟）→ 城市低鸣 ----------
room = lp(brown(DUR), 900) * .05
B['amb'][:, 0] += room; B['amb'][:, 1] += np.roll(room, 1500)
def chirp(v=1.):
    d = .09 + rng.random() * .12; tt2 = t_(d); f0 = 2600 + rng.random() * 2200
    f = f0 * (1 + .35 * np.sin(2 * np.pi * (8 + rng.random() * 10) * tt2)) * (1 + .3 * tt2 / d)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt2 / d) ** 2 * v * .12).astype(np.float32)
t = 5.8
while t < DUR:
    if not (20.2 < t < 21.7):
        n = 1 + int(rng.random() * 3)
        for k in range(n): add(B['amb'], chirp(.5 + rng.random() * .5), t + k * .13, 1, rng.uniform(-.8, .8))
    t += .6 + rng.random() * 1.4
city = lp(brown(DUR), 260) * .5 + bp(rng.standard_normal(N), 300, 900) * .05
camp = envk([(0, 0), (13.8, 0), (15.6, .7), (19.2, .8), (20.3, 0), (21.6, 0), (22.5, .4), (24, .15), (32.4, .1)])
B['amb'][:, 0] += (city * camp * .6).astype(np.float32); B['amb'][:, 1] += (np.roll(city, 2400) * camp * .6).astype(np.float32)
# 静音段：环境也收掉（只留纸面房间音）
g = envk([(0, 1), (20.25, 1), (20.45, .15), (21.55, .15), (21.65, 1), (32.4, 1)])
for k in ('amb', 'wind'): B[k] *= g[:, None]

for k, v in B.items(): sf.write(os.path.join(D, f'foley_{k}.wav'), v, SR)
print({k: round(float(np.sqrt((v ** 2).mean())), 4) for k, v in B.items()})
