"""mix.py — 芯片拟音 + 旁白 + 配乐闪避 → mix.wav（48 kHz 立体声）
读取 events.json（node core/render/events.mjs 导出）、voices/*.wav、music/score.wav
拟音全部程序化合成；按"色深"处理：4 色回忆里的声音降到 4-bit / 11 kHz，8-bit 回忆 8-bit；呼吸是唯一不"芯片"的声音。"""
import sys, os, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, os.path.join(ROOT, 'core/audio'))
import sfx
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm

E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int(DUR * SR); bus_sfx = np.zeros((N, 2)); bus_vo = np.zeros((N, 2)); rng = np.random.default_rng(11)
def put(bus, x, at, g=1.0, pan=0.0):
    s = int(at * SR); x = np.asarray(x, float) * g
    if s >= N: return
    x = x[:N - s]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[s:s + len(x), 0] += x * l * 1.414; bus[s:s + len(x), 1] += x * r * 1.414

# —— 芯片音源 ——
def sq(f, d, duty=.5, v=1.0):
    tt = t_(d); f = np.broadcast_to(f, tt.shape) if np.ndim(f) else np.full(tt.shape, f)
    ph = np.cumsum(f) / SR; return ((ph % 1) < duty).astype(float) * 2 - 1
def tri(f, d):
    tt = t_(d); ph = np.cumsum(np.full(tt.shape, f) if not np.ndim(f) else f) / SR; x = 2 * np.abs(2 * (ph % 1) - 1) - 1
    return np.round(x * 7) / 7                                   # 4-bit 阶梯
def crush(x, bits=8, sr=48000):
    if sr < SR: step = int(SR / sr); x = np.repeat(x[::step], step)[:len(x)]
    q = 2 ** (bits - 1); return np.round(x * q) / q
def adsr(d, a=.004, r=.05):
    tt = t_(d); e = np.minimum(1, tt / max(a, 1e-4)) * np.minimum(1, (d - tt) / max(r, 1e-4)); return np.clip(e, 0, 1)
def echo(x, taps=((.12, .3), (.21, .18))):
    y = np.concatenate([x, np.zeros(int((max(t for t, _ in taps) + .05) * SR))])
    for dt, g in taps: s = int(dt * SR); y[s:s + len(x)] += x * g
    return y

def S(type_, e):
    if type_ == 'chime':
        d = 2.2; tt = t_(d); x = sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(1568, 1, .7), (2349, .5, .5), (3136, .25, .3)])
        return echo(x * .5, ((.18, .35), (.37, .2), (.55, .1))), .5
    if type_ == 'flare':
        out = np.zeros(int(.8 * SR))
        for k, f in enumerate([1047, 1319, 1568, 2093]): s = sq(f, .12, .125) * adsr(.12, .002, .08); i = int(k * .05 * SR); out[i:i + len(s)] += s * (1 - k * .15)
        return echo(out * .25), .5
    if type_ == 'step':
        d = .07; x = hp(noise(d), 700) * env_exp(d, .008) + np.sin(2 * np.pi * 160 * t_(d)) * env_exp(d, .01) * .6
        return echo(norm(x) * .35 * e.get('v', 1), ((.09, .25), (.19, .12))), .9
    if type_ == 'step4':
        d = .06; x = crush(noise(d) * env_exp(d, .01), 4, 11025); return norm(x) * .22, .4
    if type_ in ('open', 'open8', 'openUI'):
        a = sq(880, .04, .25) * adsr(.04); b = sq(1320, .06, .25) * adsr(.06); x = np.concatenate([a, b]) * .22
        return (crush(x, 6) if type_ == 'open8' else x), .5
    if type_ == 'select':
        a = sq(1320, .035, .5) * adsr(.035); b = sq(1760, .07, .5) * adsr(.07, .002, .05); return np.concatenate([a, b]) * .2, .6
    if type_ == 'cursor':
        return sq(1046, .035, .5) * adsr(.035, .001, .02) * .17, .6
    if type_ == 'slide':
        return sfx.whoosh(.22, .12), .5
    if type_ == 'mosaic':
        d = .4; f = np.linspace(300, 1400, int(d * SR)) if e.get('up') else np.linspace(1400, 300, int(d * SR))
        x = sq(f, d, .25) * adsr(d, .01, .1); return crush(x, 5, 16000) * .12, .5
    if type_ == 'blipW':
        f = 880 * (1 + .06 * rng.standard_normal()); return crush(sq(f, .028, .25) * adsr(.028, .001, .01), 5) * .2, .9
    if type_ == 'blipUI':
        return sq(660, .022, .5) * adsr(.022, .001, .01) * .12, .6
    if type_ == 'cloth':
        return sfx.whoosh(.35, .12) * .8, .4
    if type_ == 'hop':
        d = .12; return sq(np.linspace(400, 900, int(d * SR)), d, .5) * adsr(d) * .12, .5
    if type_ == 'ward':
        out = np.zeros(int(1.0 * SR))
        for k, f in enumerate([1047, 1319, 1568, 2093, 2637]): s = tri(f, .5) * env_exp(.5, .18); i = int(k * .035 * SR); out[i:i + len(s)] += s * .5
        return echo(out * .35, ((.15, .3), (.28, .15))), .8
    if type_ == 'charge':
        d = e['t1'] - e['t']; n = int(d * SR); f = np.linspace(120, 700, n) ** 1.0
        x = sq(f, d, .5) * (0.5 + 0.5 * np.sin(2 * np.pi * np.linspace(6, 22, n) * t_(d))) * np.linspace(.1, 1, n) ** 2
        x = x * .1 + lp(noise(d), 900) * np.linspace(0, 1, n) ** 2 * .22; return x, 1.0
    if type_ == 'blast':
        d = .9; tt = t_(d); nz = noise(d); x = np.zeros_like(nz)
        for i in range(0, len(nz), 960): f = 6000 * np.exp(-i / SR * 5) + 200; seg = lp(nz[max(0, i - 3000):i + 960], f)[-960:]; x[i:i + len(seg)] = seg
        x = crush(norm(x) * env_exp(d, .22), 6, 22050) + np.sin(2 * np.pi * 48 * tt) * env_exp(d, .25) * .9
        x[int(.62 * SR):] *= np.linspace(1, 0, len(x) - int(.62 * SR)); return norm(x) * .9, 1.0
    if type_ == 'tick':
        return sq(2093, .015, .5) * adsr(.015, .001, .008) * .07, .8
    if type_ == 'thud':
        return sfx.thump(.35, 60), 1.0
    if type_ == 'koblink':
        return sq(520, .03, .25) * adsr(.03) * .04, .6
    if type_ == 'bitdrop':
        k = e.get('k', 0); d = .42; f = np.linspace(700 / (1 + k * .45), 120 / (1 + k * .3), int(d * SR))
        x = sq(f, d, [.5, .25, .125, .125][k]) * env_exp(d, .16); return crush(x, 7 - k * 1.5, [24000, 16000, 11025, 8000][k]) * .2, .9
    if type_ == 'savetick':
        return sq(1568, .012, .5) * adsr(.012, .001, .006) * .05, .5
    if type_ == 'sparkle':
        out = np.zeros(int(.9 * SR))
        for k in range(5): f = 2637 * 2 ** (rng.integers(0, 5) / 12); s = np.sin(2 * np.pi * f * t_(.2)) * env_exp(.2, .05); i = int((k * .12 + .05) * SR); out[i:i + len(s)] += s
        return out * .06, .5
    if type_ == 'breath':         # 真实气声：吸 0.6 s + 呼 0.4 s（带通噪声，唯一不"芯片"的声音）
        a = bp(noise(.62), 900, 3800) * np.sin(np.pi * t_(.62) / .62 / 2) ** 1.5 * np.linspace(.3, 1, int(round(.62 * SR)))
        b = bp(noise(.5), 400, 2200) * env_exp(.5, .16)
        x = np.concatenate([a * .8, np.zeros(int(.05 * SR)), b]); return norm(x) * .22, 1.0
    if type_ == 'stepB':
        d = .07; x = hp(noise(d), 500) * env_exp(d, .01) + np.sin(2 * np.pi * 130 * t_(d)) * env_exp(d, .015) * .7
        return echo(norm(x) * .4, ((.11, .3), (.24, .15))), 1.0
    if type_ == 'grind':
        d = e['t1'] - e['t']; n = int(d * SR); tt = t_(d)
        rum = lp(sfx.brown(d), 180) * .8
        crk = bp(noise(d), 280, 700) * (np.abs(np.sin(2 * np.pi * (3 + 4 * tt / d) * tt)) ** 4)
        x = (rum + crk * .7) * np.minimum(1, tt / .3) * np.minimum(1, (d - tt) / .5) * np.linspace(.6, 1, n)
        return crush(norm(x), 8, 22050) * .3, 1.0
    if type_ == 'flood':
        d = .9; n = int(d * SR); x = bp(noise(d), 800, 6000) * np.linspace(0, 1, n) ** 2
        sh = sum(np.sin(2 * np.pi * f * t_(d)) for f in (1760, 2217, 2637)) * np.linspace(0, 1, n) * .15
        return norm(x + sh) * .25, 1.0
    if type_ == 'ignite':
        d = .35; x = bp(noise(d), 500, 4000) * env_exp(d, .1)
        return norm(x) * .15, 1.0
    if type_ == 'swell':
        d = e['t1'] - e['t']; n = int(d * SR); x = hp(noise(d), 3000) * np.linspace(0, 1, n) ** 3
        return x * .12, 1.0
    return None, 0

# —— 环境床 ——
def bed(name, t0, t1, g):
    d = t1 - t0; n = int(round(d * SR)); tt = t_(d)
    if name == 'hum':
        x = sum(a * np.sin(2 * np.pi * f * tt + p) for f, a, p in [(220, .5, 0), (329.6, .3, 1), (440, .2, 2), (221.3, .4, 3)]) * (0.75 + .25 * np.sin(2 * np.pi * .4 * tt))
        x = x * .05 + bp(noise(d), 2000, 6000) * .004
    elif name == 'fire':
        base = lp(sfx.brown(d), 500) * .15
        pops = np.zeros(n)
        for _ in range(int(d * 14)):
            i = rng.integers(0, n - 2000); L = rng.integers(200, 1500); pops[i:i + L] += bp(noise(L / SR), 1500, 6000)[:L] * env_exp(L / SR, .004)[:L] * rng.uniform(.2, 1)
        x = crush(base + pops * .5, 8, 24000) * .5
    elif name == 'wind':
        x = bp(noise(d), 250, 1100) * (0.6 + .4 * np.sin(2 * np.pi * .23 * tt)) * .08
    else: return
    fade = np.minimum(1, np.minimum(tt / .25, (d - tt) / .25)); put(bus_sfx, x * fade, t0, g)

for e in EV:
    ty = e['type']
    if ty == 'vo': continue
    if ty == 'bed': bed(e['name'], e['t'], e['t1'], e.get('gain', 1)); continue
    x, g = S(ty, e)
    if x is None: continue
    put(bus_sfx, x, e['t'], g, e.get('pan', 0))

# —— 旁白（24k → 48k，压缩，轻微早反射）——
for e in EV:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = resample_poly(y, SR, sr); y = hp(y, 90); y = sfx.compress(y / max(1e-6, np.abs(y).max()) * .9, .3, 3.0)
    y = norm(y, .9); y2 = np.concatenate([y, np.zeros(int(.2 * SR))]); s = int(.023 * SR); y2[s:s + len(y)] += y * .12
    put(bus_vo, y2, e['t'], 1.0)

# —— 配乐：旁白下闪避 ——
mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav')); mus = mus[:N]
if len(mus) < N: mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
env = np.abs(bus_vo).max(1); k = int(.02 * SR); env = np.convolve(env, np.ones(k) / k, 'same') > .02
duck = np.where(env, .42, 1.0)
a, r = np.exp(-1 / (.06 * SR)), np.exp(-1 / (.35 * SR)); d = np.empty(N); v = 1.0
for i in range(N): tgt = duck[i]; c = a if tgt < v else r; v = tgt + (v - tgt) * c; d[i] = v
mus = mus * d[:, None]

# —— 静音窗：29.8–30.1、34.6–35.5 拟音也清零（HP 滚动的细哔在 29.3–29.7，保留）——
def silence(t0, t1, bus):
    s, e_ = int(t0 * SR), int(t1 * SR); bus[s:e_] = 0; f = int(.02 * SR); bus[max(0, s - f):s] *= np.linspace(1, 0, min(f, s))[:, None]
silence(29.85, 30.1, bus_sfx); silence(34.6, 35.5, bus_sfx)

mix = mus * 1.0 + bus_sfx * 0.9 + bus_vo * 1.05
peak = np.abs(mix).max(); mix = mix / peak * .89 if peak > .89 else mix
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
# 电平表（每 2 秒）
for t0 in np.arange(0, DUR, 2.0):
    s, e_ = int(t0 * SR), int(min(DUR, t0 + 2) * SR)
    rms = lambda b: 20 * np.log10(np.sqrt((b[s:e_] ** 2).mean()) + 1e-9)
    print(f'{t0:5.1f}  mus {rms(mus):6.1f}  sfx {rms(bus_sfx):6.1f}  vo {rms(bus_vo):6.1f}  mix {rms(mix):6.1f}')
print('peak', 20 * np.log10(np.abs(mix).max()))
