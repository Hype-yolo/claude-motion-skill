"""混音：纸 + 金属 + 磁带拟音（全部程序合成）+ 磁带简报旁白 + 配乐（旁白下闪避）→ mix.wav
.venv/bin/python styles/spy-titles/demo/mix.py
"""
import sys, os, json, numpy as np, soundfile as sf, librosa
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, add, limit, compress, whoosh, thump
from scipy.ndimage import uniform_filter1d

rng = np.random.default_rng(36)
ev = json.load(open(os.path.join(HERE, 'events.json')))
DUR = ev['dur'] + 1.4
N = int(DUR * SR)
fol = np.zeros((N, 2)); vox = np.zeros((N, 2))
def nz(d): return rng.standard_normal(int(round(d * SR)))
def n1(x, p=1.0): m = np.abs(x).max(); return x * p / m if m > 0 else x
def env_ad(d, a, tau): tt = t_(d); return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-np.maximum(0, tt - a) / tau)

# ── 纸 ──
def paper_cut(): d = .32; tt = t_(d); x = bp(nz(d), 2500, 9000) * env_ad(d, .2, .05); return n1(x) * .6
def paper_slide(): d = .24; x = bp(nz(d), 1200, 6000) * env_ad(d, .16, .04); return n1(x) * .5
def paper_whoosh(): d = .42; x = bp(nz(d), 500, 5000) * np.sin(np.pi * t_(d) / d) ** 2; return n1(x) * .55
def card_slap():
    d = .14; tt = t_(d)
    body = np.sin(2 * np.pi * 95 * tt) * env_exp(d, .025)
    crack = bp(nz(d), 700, 4500) * env_exp(d, .012)
    return n1(body * .9 + crack * 1.1) * .8
def paper_flip(n=2):
    out = np.zeros(int(.25 * SR))
    for k in range(n): x = bp(nz(.05), 900, 5000) * env_exp(.05, .01); s = int(k * .07 * SR); out[s:s + len(x)] += x
    return n1(out) * .45
def blinds():
    out = np.zeros(int(.5 * SR))
    for k in range(12): x = bp(nz(.05), 800, 4500) * env_exp(.05, .012) * (.6 + .4 * rng.random()); s = int(k * .025 * SR); out[s:s + len(x)] += x
    return n1(out) * .6
def scissor():
    out = np.zeros(int(.3 * SR))
    for k, f in enumerate([4200, 3600]):
        d = .12; tt = t_(d); x = hp(nz(d), 3000) * env_exp(d, .004) + np.sin(2 * np.pi * f * tt) * env_exp(d, .02) * .5
        s = int(k * .075 * SR); out[s:s + len(x)] += x
    return n1(out) * .7
def step(): d = .08; tt = t_(d); return n1(bp(nz(d), 300, 3000) * env_exp(d, .012) + np.sin(2 * np.pi * 120 * tt) * env_exp(d, .015) * .6) * .45
def skid(): d = .4; tt = t_(d); x = nz(d); x = bp(x, 1200, 5000) * env_ad(d, .03, .15); return n1(x) * .5
def land(): return n1(card_slap() + np.pad(step(), (0, int(.06 * SR)))[:len(card_slap())] * .3) * .7
def coat_whoosh(): d = .9; x = bp(nz(d), 150, 1600) * np.sin(np.pi * t_(d) / d) ** 1.5; return n1(x) * .75
def shatter():
    d = .9; tt = t_(d); x = bp(nz(d), 600, 7000) * (np.abs(np.sin(tt * 90 + 3 * np.sin(tt * 23))) ** 3) * env_ad(d, .02, .35)
    return n1(x + whoosh(d) * .5) * .8
# ── 金属 ──
def metal(d, parts, tau):
    tt = t_(d); return sum(a * np.sin(2 * np.pi * f * tt + rng.random() * 6) * env_exp(d, tau * (1 + .3 * rng.random())) for f, a in parts)
def key_jingle():
    out = np.zeros(int(.5 * SR))
    for k in range(3):
        x = metal(.3, [(2100 * (1 + .03 * k), .5), (3450, .4), (5230, .3), (6900, .2)], .06) * env_ad(.3, .001, .08)
        s = int((k * .06 + rng.random() * .02) * SR); out[s:s + len(x)] += x
    return n1(out) * .45
def wheel_clank(): d = .35; return n1(metal(d, [(620, .6), (980, .4), (1530, .3)], .06) + bp(nz(d), 200, 2000) * env_exp(d, .02)) * .6
def chain_snap(): d = .2; return n1(hp(nz(d), 2500) * env_exp(d, .005) + metal(d, [(3100, .5), (4700, .3)], .03)) * .6
def key_catch(): return n1(card_slap() * .6 + np.pad(key_jingle(), (0, 0))[:len(card_slap())]) * .6
def key_slide():
    d = .55; tt = t_(d); sw = 2200 + 1800 * tt / d
    x = bp(nz(d), 2000, 7000) * (.6 + .4 * np.sin(2 * np.pi * 38 * tt)) * env_ad(d, .08, .3)
    ring = np.sin(2 * np.pi * np.cumsum(sw) / SR) * .15 * env_ad(d, .1, .2)
    return n1(x + ring) * .45
def lock_click():
    d = .25; tt = t_(d)
    a = hp(nz(d), 2500) * env_exp(d, .002) + np.sin(2 * np.pi * 3100 * tt) * env_exp(d, .015) * .5
    b = np.roll(a, int(.035 * SR)) * .7
    body = np.sin(2 * np.pi * 180 * tt) * env_exp(d, .03)
    return n1(a + b + body) * .9
def grab(): d = .2; tt = t_(d); return n1(bp(nz(d), 250, 1600) * env_exp(d, .04) + np.sin(2 * np.pi * 80 * tt) * env_exp(d, .05)) * .7
# ── 环境 ──
def jet(d=1.9):
    tt = t_(d); f = 400 + 1400 * (tt / d)
    x = bp(nz(d), 150, 3500) * np.sin(np.pi * tt / d) ** 1.2
    whine = np.sin(2 * np.pi * np.cumsum(f * 2.2) / SR) * .06 * np.sin(np.pi * tt / d)
    return n1(x + whine) * .6
def train_bed(d):
    tt = t_(d); rum = lp(nz(d), 180) * .8
    out = n1(rum) * .35
    beat = 60 / 132
    for k in range(int(d / beat) + 1):
        for off, a in [(0, 1), (.11, .7)]:
            s = int((k * beat + off) * SR); c = n1(bp(nz(.05), 150, 900) * env_exp(.05, .012)) * .35 * a
            if s + len(c) < len(out): out[s:s + len(c)] += c
    return out * np.minimum(1, np.minimum(tt / .05, (d - tt) / .05))
def roulette(d):
    out = np.zeros(int(d * SR)); t = .05
    while t < d - .05:
        c = bp(nz(.016), 2200, 6500) * env_exp(.016, .0035) * (.25 + .3 * rng.random()); s = int(t * SR); out[s:s + len(c)] += c
        t += .03 + .09 * (t / d) ** 2 + .01 * rng.random()
    return out * .9
def wind(d):
    tt = t_(d); x = bp(nz(d), 200, 1400) * (.6 + .4 * np.sin(2 * np.pi * .7 * tt + 1)) * np.minimum(1, np.minimum(tt / .3, (d - tt) / .3))
    return n1(x) * .22
def pupil(): d = .5; tt = t_(d); f = 2400 - 1400 * tt / d; return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(d, .01, .15) * .12
def tape_click(): d = .12; tt = t_(d); return n1(hp(nz(d), 1500) * env_exp(d, .003) + np.sin(2 * np.pi * 70 * tt) * env_exp(d, .03)) * .6

FX = dict(paper_cut=paper_cut, paper_slide=paper_slide, paper_whoosh=paper_whoosh, card_slap=card_slap, paper_flip=paper_flip, blinds=blinds,
          scissor=scissor, step=step, skid=skid, land=land, coat_whoosh=coat_whoosh, shatter=shatter, key_jingle=key_jingle,
          wheel_clank=wheel_clank, chain_snap=chain_snap, key_catch=key_catch, key_slide=key_slide, lock_click=lock_click, grab=grab,
          jet=jet, pupil=pupil, tape_click=tape_click)
PAN = dict(jet=0, step=-.1)
for e in ev['ev']:
    ty, t = e['type'], e['t']; gn = e.get('g', 1.0)
    if ty == 'key_drop': x = n1(metal(.2, [(2600, .6), (4100, .4)], .03)) * .45
    elif ty == 'train_bed': x = train_bed(e['d']) * .45
    elif ty == 'roulette': x = roulette(e['d'])
    elif ty == 'wind': x = wind(e['d'])
    elif ty in FX: x = FX[ty]()
    else: print('?? unknown', ty); continue
    if ty == 'jet':   # 从左飞到右
        L = len(x); pan = np.linspace(-.8, .9, L); s = int(t * SR); e2 = min(N, s + L)
        fol[s:e2, 0] += x[:e2 - s] * np.cos((pan[:e2 - s] + 1) * np.pi / 4) * 1.2; fol[s:e2, 1] += x[:e2 - s] * np.sin((pan[:e2 - s] + 1) * np.pi / 4) * 1.2
        continue
    add(fol, x.astype(np.float64), t, gn, PAN.get(ty, 0))

# ── 旁白：磁带简报链路（带通 + 轻微饱和 + 抖晃）──
lines = json.load(open(os.path.join(HERE, 'lines.json')))
venv = np.zeros(N)
for L in lines:
    y, sr = sf.read(os.path.join(HERE, 'voices', L['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    # 抖晃：0.9 Hz ±0.25% 变速
    n = len(y); tt = np.arange(n) / SR; idx = np.arange(n) + (np.sin(2 * np.pi * .9 * tt) * .0025 * SR / (2 * np.pi * .9))
    y = np.interp(np.clip(idx, 0, n - 1), np.arange(n), y)
    y = bp(y, 220, 5200, 3); y = np.tanh(y * 2.2) / np.tanh(2.2)
    y = compress(y / (np.abs(y).max() + 1e-9) * .8, thr=.3, ratio=3)
    s = int(L['t'] * SR); e2 = min(N, s + len(y))
    vox[s:e2, 0] += y[:e2 - s] * .62; vox[s:e2, 1] += y[:e2 - s] * .62
    venv[s:e2] = 1
# 磁带嘶声（整片很轻，旁白处略高）
hiss = hp(rng.standard_normal(N), 3000) * .0035
hiss = hiss * (1 + 1.8 * uniform_filter1d(venv, int(.3 * SR)))
fol[:, 0] += hiss; fol[:, 1] += hiss * .97

# ── 配乐 + 闪避 ──
mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
assert msr == SR
mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
duck = uniform_filter1d(uniform_filter1d(venv, int(.25 * SR)), int(.15 * SR))
music = mus * (1 - .55 * duck)[:, None]

for c in range(2): fol[:, c] = lp(fol[:, c], 11000, 4)   # 拟音里的尖锐噪声瞬态会造成采样间峰值（true peak 比 sample peak 高 3 dB）
mix = music * .95 + fol * .9 + vox
# 绝对静音区（stop-time 与结尾那一拍）：全部清零（5 ms 淡入淡出）
for a, b in [(20.60, 21.364), (37.10, 37.727)]:
    s, e2 = int(a * SR), int(b * SR); f = int(.005 * SR)
    mix[s - f:s] *= np.linspace(1, 0, f)[:, None]; mix[s:e2] = 0; mix[e2:e2 + f] *= np.linspace(0, 1, f)[:, None]
mix *= .89 / np.abs(mix).max() * 1.9   # 约 +4 dB 推进限幅器，压低峰均比（loudnorm 线性模式才能到 −14）
for c in range(2): mix[:, c] = limit(mix[:, c], .89)
for c in range(2): mix[:, c] = lp(mix[:, c], 17000, 4)
for c in range(2): mix[:, c] = limit(mix[:, c], .8)
assert np.isfinite(mix).all()
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
# 电平表
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
print('mix.wav', round(len(mix) / SR, 2), 's  peak', round(20 * np.log10(np.abs(mix).max()), 2), 'dBFS')
for a, b, n_ in [(0, 2.27, 'open'), (2.27, 9.5, 'grid/velvet/intro'), (9.5, 16.8, 'airport'), (16.8, 22.3, 'train'), (22.3, 25.9, 'casino'), (25.9, 31.4, 'roof'), (31.4, 36.8, 'title'), (37.9, 40.4, 'vo6'), (40.9, 44, 'end')]:
    s, e2 = int(a * SR), int(b * SR)
    print(f'{n_:18s} mix {db(mix[s:e2]):6.1f}  music {db(music[s:e2]):6.1f}  fol {db(fol[s:e2]):6.1f}  vox {db(vox[s:e2]):6.1f}')
