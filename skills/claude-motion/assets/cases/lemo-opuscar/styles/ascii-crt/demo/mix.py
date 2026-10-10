"""TRANQUILITY.LOG 混音：拟音（全部合成）+ 旁白（闪避配乐）+ music/score.wav → mix.wav
事件来自 events.json（node core/render/events.mjs 导出 window.EV）。拟音跟"材质"走：继电器、塑料键帽、显像管、电话线。"""
import json, os, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, '../../../core/audio'))
from sfx import compress, limit
SR = 48000
rng = np.random.default_rng(7)
E = json.load(open(os.path.join(D, 'events.json')))
DUR = E['dur']; N = int(DUR * SR)
def T(d): return np.arange(int(round(d * SR))) / SR
def nz(d): return rng.standard_normal(int(round(d * SR)))
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
bus = {k: np.zeros((N, 2)) for k in ['sfx', 'bed', 'vo', 'music']}
def add(name, x, at, g=1.0, pan=0.0):
    i = int(round(at * SR));
    if i >= N or len(x) == 0: return
    x = x[:N - i] * g
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[name][i:i + len(x), 0] += x * l * 1.414; bus[name][i:i + len(x), 1] += x * r * 1.414

# ---------- 拟音 ----------
def key(v=1.0, kind='key'):
    """弹簧屈曲式机械键：塑料咔 + 弹簧叮 + 键帽回弹的低嗒"""
    d = .09; t = T(d)
    p = rng.uniform(.93, 1.08)
    clickn = hp(nz(d), 2200) * np.exp(-t / .0028)
    ping = np.sin(2 * np.pi * 3400 * p * t) * np.exp(-t / .03) * .22 + np.sin(2 * np.pi * 5230 * p * t) * np.exp(-t / .015) * .1
    thock = bp(nz(d), 260 * p, 900 * p) * np.exp(-np.maximum(0, t - .012) / .012) * (t > .01) * 1.3
    if kind == 'space': thock *= 1.6; ping *= .4; thock = lp(thock, 500)
    if kind == 'enter': thock *= 2.0
    return (clickn * .8 + ping + thock) * v
def tick(v=1.0):           # 对面来的字符：电传式的轻滴答
    d = .03; t = T(d)
    return (bp(nz(d), 1200, 4200) * np.exp(-t / .004) + np.sin(2 * np.pi * 1850 * t) * np.exp(-t / .008) * .3) * v
def relay(v=1.0):
    d = .12; t = T(d)
    return (hp(nz(d), 1500) * np.exp(-t / .004) * .8 + bp(nz(d), 80, 400) * np.exp(-t / .03) * 1.4 +
            hp(nz(d), 1500) * np.exp(-np.maximum(0, t - .035) / .003) * (t > .035) * .4) * v
def degauss(v=1.0):
    """消磁线圈：60Hz 及谐波的"嗡—"快速衰减 + 一声闷"咚" """
    d = 1.3; t = T(d)
    wob = 1 + .04 * np.sin(2 * np.pi * 7 * t)
    hum = sum(np.sin(2 * np.pi * 60 * h * t * wob) / h for h in (1, 2, 3, 5)) * np.exp(-t / .35)
    th = lp(nz(d), 120) * np.exp(-t / .08) * 3
    return (np.tanh(hum * 1.5) * .6 + th) * v
def data_chirp(v=1.0):
    d = .05; t = T(d); f = rng.choice([1200, 1500, 1800, 2200])
    return np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t / .015) * .25 * v
def ratchet(v=1.0):
    d = .02; t = T(d)
    return hp(nz(d), 2500) * np.exp(-t / .002) * v
def err(f=466, d=.16, v=1.0):
    t = T(d); x = np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * 2 * t) * .15
    e = np.minimum(1, t / .004) * np.minimum(1, (d - t) / .01)
    return lp(np.tanh(x * 1.6), 3500) * e * v
def bel(v=1.0):
    d = .45; t = T(d)
    return (np.sin(2 * np.pi * 1000 * t) + .3 * np.sin(2 * np.pi * 2000 * t)) * np.exp(-t / .12) * np.minimum(1, t / .003) * v
def modem(d, up=False, v=1.0):
    """原创握手：应答音（两次相位翻转）→ 双音 → 1200/2400 交替 → 扰码数据噪声。发送版更短更高。"""
    t = T(d); x = np.zeros_like(t)
    if not up:
        a = t < .42
        ph = np.pi * ((t > .14).astype(float) + (t > .28))
        x += np.sin(2 * np.pi * 2100 * t + ph) * a * .5
        b = (t >= .42) & (t < .72)
        x += (np.sin(2 * np.pi * 1200 * t) * .3 + np.sin(2 * np.pi * 2400 * t) * .25) * b * (1 + .5 * np.sign(np.sin(2 * np.pi * 9 * t)))
        c = t >= .72
        fsk = np.where(np.sin(2 * np.pi * 37 * t + 3 * np.sin(2 * np.pi * 5 * t)) > 0, 1200, 2400)
        x += np.sin(2 * np.pi * np.cumsum(fsk) / SR) * c * .25
        x += bp(nz(d), 600, 3200) * c * .5 * (.6 + .4 * np.sin(2 * np.pi * 11 * t))
    else:
        fsk = np.where(rng.random(len(t) // 240 + 1).repeat(240)[:len(t)] > .5, 1070, 1270)
        x += np.sin(2 * np.pi * np.cumsum(fsk) / SR) * .3
        x += bp(nz(d), 900, 3600) * .35 * (t > .25)
    e = np.minimum(1, t / .01) * np.minimum(1, (d - t) / .02)
    return lp(np.tanh(x * 1.3), 3800) * e * v      # 电话线的带宽
def swell(d, v=1.0, down=False):
    t = T(d); e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    f = np.linspace(200, 1400, len(t)) if not down else np.linspace(1400, 200, len(t))
    x = lp(nz(d), 900) * e * .6 + np.sin(2 * np.pi * np.cumsum(f) / SR) * e * .05
    return x * v
def poweroff(v=1.0):
    d = 1.0; t = T(d)
    th = lp(nz(d), 150) * np.exp(-t / .06) * 2.5
    crack = hp(nz(d), 3000) * np.exp(-t / .05) * .5
    return (th + crack) * v
def landtick(n, v=1.0):
    d = .02; t = T(d); x = np.zeros_like(t)
    for _ in range(min(n, 5)):
        f = rng.uniform(2200, 6000); o = rng.uniform(0, .008)
        x += np.sin(2 * np.pi * f * t) * np.exp(-np.maximum(0, t - o) / .003) * (t >= o)
    return x * v * min(1.6, np.sqrt(n) / 3)

for e in E['ev']:
    t, ty = e['t'], e['type']
    pan = rng.uniform(-.25, .25)
    if ty in ('key', 'space', 'enter', 'keyLight'): add('sfx', key(1.0, 'space' if ty == 'space' else 'enter' if ty == 'enter' else 'key'), t, .5 if ty != 'keyLight' else .28, pan)
    elif ty == 'remote': add('sfx', tick(), t, .35, .15)
    elif ty == 'relay': add('sfx', relay(), t, .8)
    elif ty == 'degauss': add('sfx', degauss(), t, .55)
    elif ty == 'bootline': add('sfx', data_chirp(), t, .5, pan)
    elif ty == 'ratchet': add('sfx', ratchet(), t, .22, .3)
    elif ty == 'clunk': add('sfx', relay(), t, .4)
    elif ty == 'modem': add('sfx', modem(e['d']), t, .55)
    elif ty == 'modemUp': add('sfx', modem(e['d'], up=True), t, .3)
    elif ty == 'err': add('sfx', err(466), t, .32)
    elif ty == 'err2': add('sfx', err(233, .38), t, .34)
    elif ty == 'bel': add('sfx', bel(), t, .3)
    elif ty == 'zoomIn': add('sfx', swell(e['d'] + .3), t, .25 if 'soft' not in e else .15)
    elif ty == 'zoomOut': add('sfx', swell(e['d'] + .3, down=True), t, .22)
    elif ty == 'poweroff': add('sfx', poweroff(), t, .6)
    elif ty == 'land': add('sfx', landtick(e['n']), t, .09, rng.uniform(-.5, .5))

# ---------- 机器底噪：风扇 + 120Hz + 显像管高压啸叫（极轻） ----------
t = np.arange(N) / SR
fan = lp(rng.standard_normal(N), 700) * .05 + lp(rng.standard_normal(N), 180) * .05
fan += np.sin(2 * np.pi * 120 * t) * .006
on = np.clip((t - .22) / 1.2, 0, 1) ** 1.5
off = np.clip(1 - (t - 58.6) / 1.1, 0, 1)
fan *= on * off
whf = 15734 - 1800 * np.exp(-np.maximum(0, t - .35) / .25)
whine = np.sin(2 * np.pi * np.cumsum(whf) / SR) * .0022 * (t > .35) * (t < 58.7) * (1 + .15 * np.sin(2 * np.pi * .3 * t))
dn = (t > 58.6) & (t < 59.2)
whine += np.sin(2 * np.pi * np.cumsum(np.where(dn, 15734 - 9000 * (t - 58.6), 0)) / SR) * dn * .003 * (1 - (t - 58.6) / .6)
bus['bed'][:, 0] += fan + whine; bus['bed'][:, 1] += fan * .97 + whine

# ---------- 旁白 ----------
vo_env = np.zeros(N)
for e in E['ev']:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(D, 'voices', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = resample_poly(y, SR, sr)
    y = compress(y / np.abs(y).max() * .8, thr=.2, ratio=3)
    y = y / np.abs(y).max() * .75
    add('vo', y, e['t'], 1.0, 0)
    i = int(e['t'] * SR); vo_env[i:i + len(y)] = 1
# 闪避包络：前后 0.25s 平滑
k = int(.25 * SR); ker = np.ones(k) / k
duck = 1 - .6 * np.clip(np.convolve(vo_env, ker, 'same') * 1.5, 0, 1)      # 约 −8 dB

# ---------- 配乐 ----------
m, sr = sf.read(os.path.join(D, 'music', 'score.wav'))
if sr != SR: m = resample_poly(m, SR, sr, axis=0)
m = m[:N]; bus['music'][:len(m)] += m * 1.25
bus['music'] *= duck[:, None]

mix = bus['music'] + bus['vo'] * 1.25 + bus['sfx'] * .9 + bus['bed']
mix = limit(mix, .95) if mix.ndim == 1 else np.stack([limit(mix[:, 0], .95), limit(mix[:, 1], .95)], 1)
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
# 电平表：每段各声部 RMS
def rms(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
for a, b, lab in [(0, 4.8, 'open'), (11.6, 15.5, 'vo1'), (16.2, 21.4, 'silence'), (21.4, 25.3, 'vo2'), (33.6, 37.2, 'fall'), (37.2, 40.2, 'bloom'), (42.2, 46.6, 'vo4'), (52.4, 55, 'vo5')]:
    s = slice(int(a * SR), int(b * SR))
    print(f"{lab:8s} music {rms(bus['music'][s]):6.1f}  vo {rms(bus['vo'][s]):6.1f}  sfx {rms(bus['sfx'][s]):6.1f}  bed {rms(bus['bed'][s]):6.1f}  mix {rms(mix[s]):6.1f}")
print('peak', np.abs(mix).max())
