"""混音：拟音（纸 / 木 / 笔尖 / 黄铜 / 水）+ 旁白 + 配乐（旁白下闪避）→ mix.wav
.venv/bin/python styles/blueprint/demo/mix.py"""
import sys, os, json, numpy as np, soundfile as sf, librosa
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, os.path.join(ROOT, 'core/audio'))
import sfx
from sfx import SR, t_, noise, bp, lp, hp, norm, env_exp, add, compress, limit
rng = np.random.default_rng(7)
ev = json.load(open(os.path.join(HERE, 'events.json')))
DUR = ev['dur'] + .9
N = int(DUR * SR)
FX = np.zeros((N, 2)); VO = np.zeros((N, 2))
def nz(d): return rng.standard_normal(int(round(d * SR)))
def tt(d): return np.arange(int(round(d * SR))) / SR
def ex(d, tau): return np.exp(-tt(d) / tau)
# ——— 纸与绘图工具 ———
def pen(d, v=1.0):
    """针管笔划纸：2–6 kHz 颗粒噪声 + 纸纤维的不规则振幅"""
    d = max(d, .05); x = bp(nz(d), 1800, 6500, 2)
    grain = np.clip(lp(rng.standard_normal(len(x)), 60) * 6 + 1, .2, 2)
    e = np.minimum(1, tt(d) / .015) * np.minimum(1, (d - tt(d)) / .03)
    return norm(x * grain * e) * .5 * v
def letter(d, v=1.0):
    """写字：一串短笔画"""
    out = np.zeros(int(d * SR) + SR // 10); p = 0.0
    while p < d:
        L = rng.uniform(.04, .11); s = pen(L, rng.uniform(.5, 1)); i = int(p * SR); out[i:i + len(s)] += s[:len(out) - i]; p += L + rng.uniform(.02, .07)
    return out * v
def hatchs(d, v=1.0):
    out = np.zeros(int(d * SR) + SR // 10); p = 0.0
    while p < d:
        s = pen(.05, rng.uniform(.6, 1)); i = int(p * SR); out[i:i + len(s)] += s[:len(out) - i]; p += 1 / 13
    return out * v
def compass(d, v=1.0):
    x = pen(d, .8); q = tt(d)
    sq = np.sin(2 * np.pi * (2600 + 80 * np.sin(2 * np.pi * 5 * q)) * q) * .05 * np.sin(np.pi * q / d)
    return (x + sq) * v
def slide(d, v=1.0, f=900):
    """丁字尺木头在纸上滑：低通噪声 + 细颤"""
    q = tt(d); x = lp(nz(d), f) * (1 + .3 * np.sin(2 * np.pi * 31 * q)); e = np.sin(np.pi * np.minimum(1, q / d)) ** .7
    return norm(x * e) * .5 * v
def unroll():
    d = .6; q = tt(d); x = hp(nz(d), 1500) * (np.abs(lp(rng.standard_normal(len(q)), 40)) * 5) * np.minimum(1, q / .05)
    roll = lp(nz(d), 400) * .6
    return norm((x + roll) * (1 - q / d) ** .5) * .6
def fit(x, d): n = int(round(d * SR)); return np.pad(x, (0, max(0, n - len(x))))[:n]
def slap():
    d = .4; x = fit(sfx.thump(1, 95) * .9, d)
    c = hp(nz(d), 1200) * ex(d, .012); return norm(x + c * .9) * .9
def paperpuff(v=1.0):
    d = .5; q = tt(d); x = lp(nz(d), 250) * np.sin(np.pi * q / d) ** 2 + hp(nz(d), 3000) * ex(d, .05) * .15
    return norm(x) * .5 * v
def swell(d, v=1.0):
    q = tt(d); x = bp(nz(d), 300, 1500) * (q / d) ** 2; return norm(x) * .25 * v
# ——— 机器（黄铜、木、链）———
def brass(v=1.0, p=1.0):
    d = .09; q = tt(d)
    x = hp(nz(d), 3000) * ex(d, .0012) + sum(a * np.sin(2 * np.pi * f * p * q + rng.random() * 6) * ex(d, tau) for f, a, tau in [(3100, .6, .014), (5200, .4, .009), (1700, .3, .02)])
    return norm(x) * v
def tick(v=1.0):
    d = .07; q = tt(d)
    tock = np.sin(2 * np.pi * 900 * q) * ex(d, .008) * .6 + lp(nz(d), 2000) * ex(d, .004) * .4
    return norm(brass(.7, 1.3)[:len(q)] + tock) * v
def bellows(v=1.0, d=.45):
    q = tt(d); return norm(lp(nz(d), 700) * np.sin(np.pi * q / d) ** 2) * .35 * v
def chain(d):
    out = np.zeros(int(d * SR) + SR // 10)
    for k in range(int(d * 14)):
        s = brass(rng.uniform(.08, .18), rng.uniform(1.6, 2.4)); i = int((k / 14 + rng.uniform(0, .02)) * SR); out[i:i + len(s)] += s[:len(out) - i]
    return out
def winddown(d):
    out = np.zeros(int(d * SR) + SR // 5); p = 0.0; gap = .14
    while p < d:
        s = tick(.8); i = int(p * SR); out[i:i + len(s)] += s[:len(out) - i]; p += gap; gap *= 1.35
    return out
def rubberstamp():
    d = .5; x = fit(sfx.thump(1, 60), d) + hp(nz(d), 800) * ex(d, .01) * .7 + lp(nz(d), 1500) * ex(d, .04) * .3
    return norm(x)
def drop(v=1.0):
    d = .08; q = tt(d); x = lp(nz(d), 2500) * ex(d, .006) + np.sin(2 * np.pi * rng.uniform(700, 1100) * q) * ex(d, .012) * .4
    return norm(x) * v
def rainbed(d):
    q = tt(d); x = bp(nz(d), 1500, 7000) * .5 + lp(nz(d), 500) * .3
    e = np.minimum(1, q / 1.0) * np.minimum(1, (d - q) / 1.5); return norm(x) * e * .12
def cap():
    d = .06; q = tt(d); return norm(hp(nz(d), 2000) * ex(d, .003) + np.sin(2 * np.pi * 2400 * q) * ex(d, .01) * .5) * .8
def room(d):
    return norm(lp(sfx.brown(d), 400)) * .02
# ——— 事件 → 拟音 ———
G = {'pen': .55, 'letter': .5, 'hatch': .45, 'compass': .5}
for e in ev['ev']:
    t, ty, v, d, pan = e['t'], e['type'], e.get('v', 1.0), e.get('d', .5), e.get('pan', 0)
    if ty == 'unroll': add(FX, unroll(), t, .9)
    elif ty == 'slap': add(FX, slap(), t, 1.0)
    elif ty == 'tsquare': add(FX, slide(d), t, .8, -.2)
    elif ty == 'tsquare_off': add(FX, slide(d, .7, 1200), t, .6, .1)
    elif ty == 'pen': add(FX, pen(d, v), t, G['pen'], pan)
    elif ty == 'letter': add(FX, letter(d, v), t, G['letter'], pan)
    elif ty == 'hatch': add(FX, hatchs(d, v), t, G['hatch'])
    elif ty == 'compass': add(FX, compass(d, v), t, G['compass'])
    elif ty == 'scratch': add(FX, pen(.12, v * 1.2), t, .7)
    elif ty == 'turn': add(FX, sfx.whoosh(.8, .3), t, .5)
    elif ty == 'whoosh': add(FX, lp(sfx.whoosh(.25, v), 2500), t, .32, pan)
    elif ty == 'section': add(FX, pen(d, .7), t, .5)
    elif ty == 'click': add(FX, brass(v), t, .7)
    elif ty == 'tick': add(FX, tick(v), t, .35, -.1)
    elif ty == 'bellows': add(FX, bellows(v), t, .6, -.4)
    elif ty == 'chain': add(FX, chain(d), t, .25, .1)
    elif ty == 'swing': add(FX, sfx.creak(.6), t, .35, .2); add(FX, sfx.whoosh(max(.3, d), .3), t, .4, .3)
    elif ty == 'gaugetwitch': add(FX, brass(.5, 2.2), t, .4); add(FX, brass(.35, 2.4), t + .12, .3)
    elif ty == 'winddown': add(FX, winddown(d), t, .45)
    elif ty == 'deflate': add(FX, bellows(1, d) * np.linspace(1, .2, int(round(d * SR))), t, .6, -.4)
    elif ty == 'room': add(FX, room(d), t, 1.0)
    elif ty == 'puff': add(FX, paperpuff(v), t, .8)
    elif ty == 'swell': add(FX, swell(d), t, .7)
    elif ty == 'catch': add(FX, paperpuff(1.2), t, .9); add(FX, sfx.whoosh(.35, .5), t - .1, .5)
    elif ty == 'gaugeping': add(FX, sfx.ding(.25)[:SR // 2], t, .25)
    elif ty == 'drop': add(FX, drop(v), t, .38, np.clip(pan, -.8, .8))
    elif ty == 'rainbed': add(FX, rainbed(d), t, 1.0)
    elif ty == 'grow': add(FX, letter(d, .4), t, .35)
    elif ty == 'stampair': add(FX, sfx.whoosh(.25, .5), t, .6)
    elif ty == 'stamp': add(FX, rubberstamp(), t, 1.0)
    elif ty == 'cap': add(FX, cap(), t, .8)
# ——— 旁白 ———
vo_spans = []
for e in ev['ev']:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    y = hp(y, 80); y = compress(norm(y, .9), thr=.3, ratio=3)
    add(VO, y, e['t'], 1.0); vo_spans.append((e['t'], e['t'] + len(y) / SR))
# ——— 配乐 + 闪避 ———
mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
if msr != SR: mus = librosa.resample(mus.T, orig_sr=msr, target_sr=SR).T
M = np.zeros((N, 2)); M[:min(N, len(mus))] = mus[:N]
duck = np.ones(N)
for a, b in vo_spans:
    i0, i1 = int((a - .15) * SR), int((b + .25) * SR); duck[max(0, i0):i1] = .36
from scipy.ndimage import uniform_filter1d
duck = uniform_filter1d(duck, int(.25 * SR))
M *= duck[:, None]
# 旁白期间拟音也让一点
fxd = 1 - (1 - duck) * .5
mix = M * 1.0 + FX * .55 * fxd[:, None] + VO * .7
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
mix = mix / max(1e-9, np.abs(mix).max()) * .89
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
def rms(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
print('mix', mix.shape, 'music', round(rms(M), 1), 'fx', round(rms(FX * .55), 1), 'vo', round(rms(VO * .62), 1))
