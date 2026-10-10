# 混音：配乐 music/score.wav（配音时自动避让）+ 分场景环境声 + 事件拟音 + 旁白/对白 → mix.wav
# 用法：.venv/bin/python styles/hd-2d/demo/mix.py [out.wav]（默认写 demo/mix.wav）
import sys, os, json, numpy as np, soundfile as sf, librosa
from scipy.ndimage import uniform_filter1d
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../core/audio'))
from sfx import *

DUR = 76.5; N = int(DUR * SR); tt = np.arange(N) / SR
rng = np.random.default_rng(11)
EV = json.load(open(os.path.join(HERE, 'sfx_events.json')))   # 各场景给出的事件时间（脚步、闪电等）

def curve(keys): k = np.array(keys, float); return np.interp(tt, k[:, 0], k[:, 1])
def stereo(x, pan=0.0): l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); return np.stack([x * l * 1.414, x * r * 1.414], 1)
def place(buf, x, t, pan=0.0, g=1.0):
    s = int(t * SR); x = stereo(x, pan) if x.ndim == 1 else x
    if s >= len(buf): return
    n = min(len(x), len(buf) - s); buf[s:s + n] += x[:n] * g
def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)

# —— 环境床 ——
harbor_g = curve([(0, 0), (5.2, 0), (6.2, .9), (14.8, .9), (15.2, .7), (25.2, .6), (25.6, 0), (57.8, 0), (58.6, .8), (74, .6), (76.5, 0)])
waves = lp(brown(DUR), 700) * (.45 + .55 * np.sin(2 * np.pi * .11 * tt + 1) ** 4) + hp(lp(noise(DUR), 3500), 600) * .12 * (.3 + .7 * np.sin(2 * np.pi * .11 * tt + .6) ** 6)
waves *= .45 * harbor_g
creakB = np.zeros((N, 2))
for t0 in [7.3, 10.9, 19.4, 23.0, 61.5, 66.0]: place(creakB, creak(.35), t0, pan=.4)
fire_g = curve([(0, 0), (14.9, 0), (15.2, .8), (25.2, .7), (25.5, 0), (76.5, 0)])
crk = np.zeros(N); idx = rng.integers(0, N, 2600); crk[idx] = rng.uniform(.1, 1, len(idx)) ** 3; crk = bp(crk, 1500, 7000) * 4
fireB = (lp(brown(DUR), 500) * .25 + crk) * fire_g * .5
forest_g = curve([(0, 0), (25.3, 0), (25.8, .8), (35.2, .7), (35.6, 0), (76.5, 0)])
crick = np.zeros(N)
for f, rate, ph in [(4300, 17, 0), (5100, 21, 1.3), (3900, 13, 2.1)]:
    crick += np.sin(2 * np.pi * f * tt) * (np.sin(2 * np.pi * rate * tt + ph) > .55) * (np.sin(2 * np.pi * .7 * tt + ph * 2) > -.2) * .12
leaves = bp(noise(DUR), 700, 3500) * (.5 + .5 * np.sin(2 * np.pi * .23 * tt) ** 2) * .12
forestB = (crick + leaves) * forest_g
storm_g = curve([(0, 0), (35.3, 0), (35.7, 1), (40.4, 1), (40.8, 1.25), (41.8, .5), (42.2, .08), (44.3, .08), (45.6, .25), (47.6, .6), (49.3, .6), (49.7, .35), (53.3, .25), (54.5, .1), (58, .05), (58.3, 0), (76.5, 0)])
rainB = (hp(lp(noise(DUR), 8000), 400) * .3 + bp(brown(DUR), 150, 900) * .35) * storm_g
windB = bp(noise(DUR), 200, 1200) * (.55 + .45 * np.sin(2 * np.pi * .31 * tt) ** 2) * .5 * curve([(0, 0), (35.3, 0), (35.7, .8), (40.4, .8), (40.7, 1.6), (41.8, .6), (42.2, .05), (45.6, .15), (48, .5), (53, .35), (56, .15), (58.3, 0), (76.5, 0)])
amb = stereo(waves, -.2) + stereo(np.roll(waves, 7919), .2) + creakB * .5 + stereo(fireB, .15) + stereo(forestB, -.3) + stereo(np.roll(forestB, 5003), .3) \
    + stereo(rainB * .8, -.35) + stereo(np.roll(rainB, 4801) * .8, .35) + stereo(windB, -.5) + stereo(np.roll(windB, 9001), .5)

# —— 事件拟音 ——
fx = np.zeros((N, 2))
def fwoomp(v=1.0, d=1.2):   # 火焰熄灭：低频吸气 + 噪声收尾
    x = t_(d); return norm(lp(noise(d), 500) * np.exp(-x / .25) * np.sin(np.pi * np.minimum(x / .08, 1) / 2) + np.sin(2 * np.pi * 60 * x * (1 - .4 * x)) * np.exp(-x / .3) * .6) * v
def strike(v=1.0):          # 划火 + 呼的一下
    d = .9; x = t_(d); scr = hp(noise(.12), 2500) * np.exp(-t_(.12) / .03)
    out = np.zeros(len(x)); out[:len(scr)] += scr * .8; out += lp(noise(d), 1800) * np.exp(-x / .35) * np.minimum(1, x / .05) * .7
    return norm(out) * v
def chime(v=1.0, f=1568):
    d = 1.4; x = t_(d); return norm(sum(a * np.sin(2 * np.pi * f * m * x) * np.exp(-x / tau) for m, a, tau in [(1, 1, .5), (2.01, .35, .3), (3, .15, .2)])) * v
def bell(v=1.0, f=880):
    d = 3.0; x = t_(d); return norm(sum(a * np.sin(2 * np.pi * f * m * x + m) * np.exp(-x / tau) for m, a, tau in [(1, 1, 1.2), (2.76, .45, .6), (5.4, .2, .3), (.5, .3, 1.5)])) * v
def thunder(v=1.0, d=3.5):
    x = t_(d); crack = hp(noise(d), 1500) * np.exp(-x / .08) * .6; body = lp(brown(d), 180) * np.exp(-x / 1.1) * np.minimum(1, x / .12)
    rum = lp(noise(d), 90) * np.exp(-x / 1.6) * 2
    return norm(crack + body + rum) * v
def stepSoft(v=1.0, kind='dirt'):
    d = .09; x = t_(d)
    if kind == 'dirt': return norm(lp(noise(d), 1400) * np.exp(-x / .02) + np.sin(2 * np.pi * 120 * x) * np.exp(-x / .015) * .4) * v
    if kind == 'stone': return norm(bp(noise(d), 900, 5000) * np.exp(-x / .012) + np.sin(2 * np.pi * 300 * x) * np.exp(-x / .01) * .3) * v
    return norm(bp(noise(d), 400, 2500) * np.exp(-x / .018) + np.sin(2 * np.pi * 180 * x) * np.exp(-x / .02) * .5) * v   # wood
def boom(v=1.0):            # 灯塔点亮：低频冲击 + 明亮的闪光噪声 + 长混响尾
    d = 4.5; x = t_(d); sub = np.sin(2 * np.pi * 42 * x * (1 - .2 * x)) * np.exp(-x / .9)
    air = lp(noise(d), 3000) * np.exp(-x / .5) * .6; shim = sum(np.sin(2 * np.pi * f * x) * np.exp(-x / 2.2) * .08 for f in [1760, 2217, 2637, 3520])
    return norm(sub + air + shim) * v

place(fx, fwoomp(.5), 12.3, pan=.5)
place(fx, strike(.55), 16.15, pan=.05)
place(fx, chime(.18), 17.3)
for t0 in EV.get('pierSteps', []): place(fx, stepSoft(.35, 'wood'), t0, pan=-.1)
for t0 in EV.get('forestSteps', []): place(fx, stepSoft(.3, 'dirt'), t0, pan=float(np.clip((t0 - 30.5) / 5, -.6, .6)))
for t0 in EV.get('cliffSteps', []): place(fx, stepSoft(.3, 'stone'), t0)
for t0 in EV.get('lampSteps', []): place(fx, stepSoft(.3, 'stone'), t0)
for t0 in EV.get('thunder', []): place(fx, thunder(.6), t0 + .25)
place(fx, whoosh(1.1, .9), 40.45, pan=-.3)                       # 狂风
place(fx, fwoomp(.35, .9), 41.2)                                 # 火被压小
place(fx, heartbeat(.22), 42.6); place(fx, heartbeat(.18), 43.5)
place(fx, strike(.28), 45.55)                                     # 火苗重燃（轻）
place(fx, strike(.3), 52.6)                                       # 倒火
place(fx, boom(1.0), 53.5)
for i in range(6): place(fx, bell(.16 if i % 2 == 0 else .1, [784, 659, 988, 587, 880, 698][i]), 59.2 + i * .7, pan=[-.5, .3, -.1, .6, -.6, .2][i])

# —— 人声 ——
L = json.load(open(os.path.join(HERE, 'lines.json'))); T0 = {v['id']: v['t'] for v in json.load(open(os.path.join(HERE, 'vo_times.json')))}
vo = np.zeros((N, 2)); vmask = np.zeros(N)
for Ln in L:
    y, sr = sf.read(os.path.join(HERE, 'voices', Ln['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    y = compress(norm(y, .9), thr=.25, ratio=3.2)
    act = np.abs(y) > .02 * np.abs(y).max(); y = y * (10 ** (-20 / 20)) / (np.sqrt(np.mean(y[act] ** 2)) + 1e-9)   # 每句有声部分 RMS 统一
    if Ln['id'] == 'k1': y = lp(y, 7000) * 1.05
    t0 = T0[Ln['id']]; place(vo, y, t0)
    s = int(t0 * SR); vmask[s:s + len(y)] = 1

# —— 配乐 + 避让 ——
mus = np.zeros((N, 2))
mp = os.path.join(HERE, 'music', 'score.wav')
if os.path.exists(mp):
    m, sr = sf.read(mp, always_2d=True)
    if sr != SR: m = librosa.resample(m.T, orig_sr=sr, target_sr=SR).T
    n = min(len(m), N); mus[:n] = m[:n]
duck = uniform_filter1d(vmask, int(.35 * SR)); duck = 1 - .22 * np.clip(duck * 1.6, 0, 1)   # 约 -2.2 dB（配乐本身已在旁白处让了 2–3.5 dB）
mus *= duck[:, None]

def lvl(x, db): r = np.sqrt(np.mean(x[np.abs(x).sum(1) > 1e-4] ** 2)) if np.any(np.abs(x) > 1e-4) else 1; return x * (10 ** (db / 20)) / (r + 1e-9)
voS = lvl(vo, -17); musS = lvl(mus, -21); ambS = lvl(amb, -30); fxS = lvl(fx, -27)
# 按句自动避让：让每句旁白窗口里 配乐+环境 比人声低约 10 dB（只压不抬）
Dd = json.load(open(os.path.join(HERE, 'voices', 'dur.json'))); keys = [(0, 1.0)]
for k, t0 in sorted(T0.items(), key=lambda kv: kv[1]):
    a, b = int(t0 * SR), int((t0 + Dd[k]) * SR); need = rms_db(voS[a:b]) - 10 - rms_db((musS + ambS)[a:b]); g = min(1.0, 10 ** (need / 20))
    keys += [(t0 - .35, 1.0), (t0 - .05, g), (t0 + Dd[k] + .1, g), (t0 + Dd[k] + .6, 1.0)]
keys.sort(); gk = np.array(keys); bedG = np.interp(tt, gk[:, 0], gk[:, 1])
musS *= bedG[:, None]; ambS *= (.25 + .75 * bedG)[:, None]
mix = voS + musS + ambS + fxS
pk = np.abs(mix).max(); print('peak', 20 * np.log10(pk))
mix = np.tanh(mix / max(pk, 1e-6) * 1.2) * .9
OUT_WAV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'mix.wav')
sf.write(OUT_WAV, mix.astype(np.float32), SR, subtype='FLOAT')
print('wrote', OUT_WAV, DUR, 's  |  vo', round(rms_db(voS), 1), 'mus', round(rms_db(musS), 1), 'amb', round(rms_db(ambS), 1), 'fx', round(rms_db(fxS), 1))

# —— 自检：每句旁白窗口内 人声 vs 配乐+环境 的 RMS 差 ——
D = json.load(open(os.path.join(HERE, 'voices', 'dur.json')))
for k, t0 in T0.items():
    a, b = int(t0 * SR), int((t0 + D[k]) * SR)
    print(f'{k} {t0:5.1f}s  vo {rms_db(voS[a:b]):6.1f}  bed {rms_db((musS + ambS + fxS)[a:b]):6.1f}  diff {rms_db(voS[a:b]) - rms_db((musS + ambS + fxS)[a:b]):5.1f} dB')
