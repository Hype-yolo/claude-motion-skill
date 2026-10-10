# 混音：原创配乐（music/score.wav）+ 引擎（按转速曲线合成）+ 雨 / 风 / 海 + 事件拟音 + 人声（调度员走无线电）→ mix.wav
# 用法：.venv/bin/python styles/cel-anime-80s/demo/mix.py
import sys, os, json, numpy as np, soundfile as sf, librosa
from scipy.ndimage import maximum_filter1d, uniform_filter1d
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../core/audio'))
from sfx import *

E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; N = int(DUR * SR)
tt = np.arange(N) / SR
rng = np.random.default_rng(87)
BPM = 116; BAR = 240 / BPM
bar = lambda n: n * BAR

def curve(keys):
    """分段线性包络：[(t, v), ...] → 每个采样的值"""
    k = np.array(keys, float); return np.interp(tt, k[:, 0], k[:, 1])

def stereo(x, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)

# —— 引擎：按转速合成（谐波锯齿 + 点火抖动 + 排气噪声）——
T_JUMP, T_LAND = bar(16), bar(18)
rpm = curve([(0, .12), (8.6, .12), (8.79, .72), (9.2, .2), (9.57, .85), (10.0, .25), (10.345, .9), (11.5, .72), (14.5, .7), (18.6, .74), (20.7, .68), (22.8, .78),
             (24.8, .7), (26.9, .66), (29.0, .7), (29.3, .97), (31.0, .95), (33.1, 1.0), (T_JUMP + .3, 1.08), (T_LAND, 1.05), (T_LAND + .15, .7), (39.3, .74), (41.4, .5),
             (42.2, .14), (43.4, .12), (59, .12)])
egain = curve([(0, 0), (2.2, 0), (3.6, .22), (4.14, .26), (7.24, .24), (8.6, .3), (10.345, .75), (14.5, .7), (18.6, .62), (20.7, .5), (22.8, .85), (24.8, .2), (26.9, .45),
               (29.0, .7), (31.0, .9), (32.5, 1.0), (33.1, .95), (33.3, .5), (T_LAND, .5), (T_LAND + .1, .85), (39.3, .6), (41.4, .45), (42.8, .25), (43.40, 0), (59, 0)])
f0 = 32 + 190 * rpm
ph = np.cumsum(f0 / SR) * 2 * np.pi
jit = 1 + .06 * lp(noise(DUR), 30) / .1                     # 点火不均匀
eng = np.zeros(N)
for h, a in [(1, 1.0), (2, .7), (3, .45), (4, .35), (6, .2), (8, .12), (11, .06)]:
    eng += a * np.sin(ph * h + h * .3) * jit
exh = bp(noise(DUR), 180, 2400) * (.5 + .5 * np.sin(ph)) ** 3 * .6   # 排气"突突"
eng = np.tanh((eng + exh) * 1.4)
eng = lp(eng, 3200) * egain
# 腾空时：引擎声变远（低通）+ 风声
air = (tt > T_JUMP + .08) & (tt < T_LAND)
eng[air] = lp(eng, 900)[air] * 1.3

# —— 环境床 ——
rain_g = curve([(0, .55), (4.14, .5), (7.24, .3), (10.345, .35), (14.5, .45), (26.9, .4), (32.5, .3), (33.1, 0), (59, 0)])
rain = hp(lp(noise(DUR), 7000), 300) * .18
drops = np.zeros(N); idx = rng.integers(0, N, 5000); drops[idx] = rng.uniform(.2, 1, len(idx)); drops = bp(drops, 2000, 9000) * 1.5
rain = (rain + drops) * rain_g
hiss_g = curve([(0, 0), (10.345, 0), (10.6, .3), (14.5, .35), (22.8, .6), (24.8, .15), (26.9, .3), (33.1, .3), (33.2, 0), (T_LAND, 0), (T_LAND + .1, .25), (41.4, .12), (42.5, 0), (59, 0)])
hiss = bp(noise(DUR), 1800, 7000) * .16 * hiss_g               # 湿路胎噪
wind_g = curve([(0, .05), (10.345, .1), (14.5, .25), (20.7, .35), (22.8, .25), (33.1, .3), (33.2, .85), (T_LAND, .6), (T_LAND + .2, .25), (41.4, .12), (49.6, .18), (53.8, .12), (59, 0)])
wind = bp(noise(DUR), 250, 1400) * (.6 + .4 * np.sin(2 * np.pi * .4 * tt)) * .35 * wind_g
city_g = curve([(0, .5), (7.24, .35), (10.3, .25), (33, .2), (33.1, 0), (59, 0)])
city = lp(brown(DUR), 350) * .1 * city_g                         # 城市底噪
sea_g = curve([(0, 0), (39.3, 0), (39.6, .3), (43.4, .25), (43.45, 0), (45.5, 0), (49.6, .2), (59, .15)])
sea = lp(brown(DUR), 900) * (.5 + .5 * np.sin(2 * np.pi * .12 * tt) ** 2) * .3 * sea_g
amb = stereo(rain * .8, -.3) + stereo(np.roll(rain, 4801) * .8, .3) + stereo(hiss) + stereo(wind * .8, -.5) + stereo(np.roll(wind, 9001) * .8, .5) + stereo(city) + stereo(sea)
engS = stereo(eng * .5, -.05) + stereo(np.roll(eng, 60) * .5, .05)

# —— 事件拟音 ——
def sweep_noise(d, f0_, f1_, v=1.0):
    n = noise(d); out = np.zeros_like(n); step = 480
    for i in range(0, len(n), step):
        u = i / len(n); f = f0_ * (f1_ / f0_) ** u; seg = bp(n[max(0, i - 2000):i + step], f * .7, min(f * 1.4, 20000))[-step:]; out[i:i + len(seg)] = seg
    return norm(out * np.sin(np.pi * t_(d) / d) ** 1.5) * v
def squelch(v=1.0):   # 对讲机：按键咔 + 短噪声
    d = .16; x = hp(noise(d), 1500) * env_exp(d, .05); x[:200] += np.sin(2 * np.pi * 2000 * t_(200 / SR)) * .6
    return norm(bp(x, 800, 5000)) * v
def bell(v=1.0):      # 警铃（双音）
    d = .45; x = sum(a * np.sin(2 * np.pi * f * t_(d)) * env_exp(d, .18) for f, a in [(1180, 1), (1560, .6), (2890, .3)])
    return norm(x) * v
def metal_scrape(d, v=1.0):
    x = bp(noise(d), 2500, 9000) * (1 + .6 * np.sin(2 * np.pi * 37 * t_(d))) * np.exp(-t_(d) / (d * .5))
    cr = np.zeros(int(d * SR)); ii = rng.integers(0, len(cr), 300); cr[ii] = rng.uniform(.3, 1, 300); cr = hp(cr, 3000) * 2 * np.exp(-t_(d) / (d * .4))
    return norm(x + cr) * v
def motor(d, v=1.0):
    x = np.sin(2 * np.pi * 120 * t_(d)) * .3 + bp(noise(d), 300, 1200) * .5
    return norm(x) * np.minimum(1, t_(d) / .15) * v

def S(*xs):   # 不同长度的片段相加（补零）
    n = max(len(x) for x in xs); return sum(np.pad(x, (0, n - len(x))) for x in xs)
sfxb = np.zeros((N, 2))
G = dict(tapenoise=.3, crton=.35, squelch=.2, tapeclick=.45, rev=.0, launch=.5, whoosh=.35, spray=.45, bell=.32, clunk=.4, twist=.4, impact=1.0, wind=.0, land=1.0, scrape=.45, grab=.5, button=.5, motor=.12, ignite=.9, roar=.6)
for e in E['ev']:
    if 'd' in e: e['d'] = int(e['d'] * SR) / SR + .25 / SR
    ty, t0, v = e['type'], e['t'], e.get('v', 1.0); pan = 0.0
    if ty == 'squelch': x = squelch(v)
    elif ty == 'tapeclick': x = S(click(.55, v), np.pad(click(.7, .7), (int(.06 * SR), 0)))
    elif ty == 'launch': x = sweep_noise(.9, 400, 6000, v)
    elif ty == 'whoosh': x = sweep_noise(.5, 600, 5000, v); pan = .4
    elif ty == 'spray': x = norm(bp(noise(e['d']), 700, 8000) * (.6 + .4 * np.abs(np.sin(2 * np.pi * 7 * t_(e['d']))))) * np.minimum(1, t_(e['d']) / .05) * v; pan = -.3
    elif ty == 'bell': x = bell(v); pan = -.2 if int(t0 * 2) % 2 else .2
    elif ty == 'clunk': x = thump(v, 90)
    elif ty == 'twist': x = S(click(.35, v), creak(.4) * .3)
    elif ty == 'impact': x = norm(S(thump(1, 45), crash(.6) * .6, lp(noise(.35), 2500) * env_exp(.35, .08))) * v
    elif ty == 'land': x = norm(S(thump(1, 55), lp(noise(.3), 3000) * env_exp(.3, .06), crash(.5) * .4)) * v
    elif ty == 'scrape': x = metal_scrape(e['d'], v); pan = -.2
    elif ty == 'grab': x = S(clack(.8, v) * .8, lp(noise(.08), 1500) * env_exp(.08, .02))
    elif ty == 'button': x = S(click(.4, v), np.pad(clack(.6, .6), (int(.03 * SR), 0)))
    elif ty == 'motor': x = motor(e['d'], v)
    elif ty == 'tapenoise':   # 磁带跟踪噪声：嘶声 + 抖动的嗡声 + 撕裂的咔啦
        d = e['d']; tt_ = t_(d); x = bp(noise(d), 1500, 9000) * (.6 + .4 * np.sign(np.sin(2 * np.pi * 23 * tt_))) + np.sin(2 * np.pi * (60 + 30 * np.sin(2 * np.pi * 7 * tt_)) * tt_) * .5
        x = norm(x) * np.minimum(1, (d - tt_) / .08) * v
    elif ty == 'crton':       # 显像管开机：高压"嘣"+ 15.7kHz 行输出变压器的尖啸
        d = 1.2; tt_ = t_(d); x = norm(thump(1, 60)[:len(tt_)] if len(thump(1, 60)) >= len(tt_) else np.pad(thump(1, 60), (0, len(tt_) - len(thump(1, 60))))) * .8 + np.sin(2 * np.pi * 15700 * tt_) * .05 * np.exp(-tt_ / .8) + hp(noise(d), 4000) * np.exp(-tt_ / .05) * .3
        x = x * v
    elif ty == 'ignite': x = ignite(v)
    elif ty == 'roar': x = roar(e['d'], v) * np.exp(-np.maximum(0, t_(e['d']) - 3.5) / 3.0)
    else: continue
    add(sfxb, x, t0, G.get(ty, .4), pan)

# —— 人声 ——
VO = {'d1': 0.9, 'd2': 4.35, 'g1': 8.05, 'd3': bar(13) + .25, 'g2': bar(14) + BAR / 4 * 1.6, 'g3': bar(20) + BAR / 4 * 1.9, 'd4': bar(21) + BAR / 4 * 1.2, 'g4': bar(24) + BAR / 4 * 2.2}
vob = np.zeros((N, 2))
for k, t0 in VO.items():
    y, sr = sf.read(os.path.join(HERE, 'voices', k + '.wav')); y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    y = y / (np.abs(y).max() + 1e-9)
    y = limit(y, .5, .005) / .5                                   # 先削峰（Kokoro 峰均比高）
    y = compress(y, .3, 3.0)
    if k.startswith('d'): y = radio(y) * .85; y = y + bp(noise(len(y) / SR), 1500, 4000) * .015
    else:
        room = np.convolve(y, np.exp(-np.arange(int(.08 * SR)) / (.02 * SR)) * rng.standard_normal(int(.08 * SR)) * .02)[:len(y)]
        y = y + room
    y = y / (np.sqrt((y ** 2).mean()) + 1e-9) * .12                # 按 RMS 配平
    add(vob, y, t0, 1.0, 0.0)

# —— 配乐 + 闪避 ——
mus, sr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
if sr != SR: mus = librosa.resample(mus.T, orig_sr=sr, target_sr=SR).T
mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
act = (np.abs(vob).max(1) > .01).astype(float)
duck = 1 - .64 * np.clip(uniform_filter1d(maximum_filter1d(act, int(.3 * SR)), int(.25 * SR)), 0, 1)   # 约 -9 dB
# 引擎 / 环境也在人声下稍让
duck2 = 1 - .3 * np.clip(uniform_filter1d(maximum_filter1d(act, int(.3 * SR)), int(.25 * SR)), 0, 1)

MUS, ENG, AMB, SFX, VOX = 1.0, .24, .45, .8, 1.75
mix = mus * MUS * duck[:, None] + engS * ENG * duck2[:, None] + amb * AMB * duck2[:, None] + sfxb * SFX + vob * VOX
mix *= .98 / np.percentile(np.abs(mix), 99.99)          # 按 99.99% 分位配平，只让极少数峰进限幅器（保住副歌的动态）
for c in range(2): mix[:, c] = limit(mix[:, c], .97)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
def rms(x): return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)
print('mix peak', np.abs(mix).max(), 'rms dB', rms(mix))
for nm, x in [('music', mus * MUS), ('engine', engS * ENG), ('amb', amb * AMB), ('sfx', sfxb * SFX), ('voice', vob * VOX)]: print(f'{nm:7s} {rms(x):6.1f} dB')
# 分段检查：每句台词处 人声 vs 音乐 的 RMS
for k, t0 in VO.items():
    a, b = int(t0 * SR), int((t0 + 1.2) * SR)
    print(k, 'voice', round(rms(vob[a:b] * VOX), 1), 'music', round(rms((mus * MUS * duck[:, None])[a:b]), 1), 'engine', round(rms((engS * ENG * duck2[:, None])[a:b]), 1))
for nm, a, b in [('intro', 0, 8.2), ('title', 10.35, 12.4), ('verse', 14.5, 26.8), ('cutout', 32.6, 33.1), ('chorus', 33.1, 37.2), ('lofi', 43.5, 45.5), ('keych', 45.5, 49.6), ('end', 53.8, 59)]:
    print(f'section {nm:7s} {rms(mix[int(a * SR):int(b * SR)]):6.1f} dB')
