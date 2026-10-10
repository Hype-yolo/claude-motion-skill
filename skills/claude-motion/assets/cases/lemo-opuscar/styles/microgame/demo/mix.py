"""混音：配乐 + 人声（Tick 主持腔 / Dot 小声）+ 按画风材质合成的拟音 → mix.wav
python styles/microgame/demo/mix.py（先跑 events.mjs 与 music/score.py）"""
import sys, os, json, numpy as np, soundfile as sf, librosa
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, click, clack, whoosh, thump, ding, pop, add, compress, limit
from core.audio import sampler as S
D = os.path.dirname(os.path.abspath(__file__))
EV = json.load(open(os.path.join(D, 'events.json')))
DUR = EV['dur']; N = int(DUR * SR)
lines = {l['id']: l for l in json.load(open(os.path.join(D, 'lines.json')))}
rng = np.random.default_rng(7)
fx = np.zeros((N, 2)); vo = np.zeros((N, 2))
def sine(f, d, ph=0): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, len(t_(d)))) / SR + ph)
def env_ad(d, a=.005, tau=.1): x = env_exp(d, tau); n = int(a * SR); x[:n] *= np.linspace(0, 1, n) if n else 1; return x
def nz(d): return rng.standard_normal(len(t_(d)))

# ───────── 拟音库（按材质）─────────
def sizzle(d, boss=False):     # 引线：带通噪声 + 随机噼啪
    x = bp(nz(d), 2500, 7000) * .25
    cr = (rng.random(len(x)) > (.9965 if boss else .998)).astype(float); cr = lp(cr * rng.standard_normal(len(x)), 6000) * 3
    e = np.minimum(1, t_(d) / .05) * np.minimum(1, (d - t_(d)) / .05)
    return (x + cr) * e * (1.25 if boss else 1)
def swoosh(d=.25, lo=300, hi=3000, up=True):
    n = nz(d); tt = t_(d); out = np.zeros_like(n); step = 240
    for i in range(0, len(n), step):
        u = i / len(n); f = lo * (hi / lo) ** (u if up else 1 - u); s = bp(n[max(0, i - 1200):i + step], f * .7, min(f * 1.4, 20000))[-step:]; out[i:i + len(s)] = s
    return norm(out * np.sin(np.pi * tt / d) ** 1.5)
def spring_click():            # 表冠：金属咔哒 + 弹簧余振
    d = .25; tt = t_(d)
    return norm(hp(nz(d), 3000) * env_exp(d, .002) + np.sin(2 * np.pi * 3100 * tt) * env_exp(d, .03) * .5 + np.sin(2 * np.pi * 870 * tt * (1 + .02 * np.sin(2 * np.pi * 40 * tt))) * env_exp(d, .08) * .35)
def glass_crack():
    d = .5; x = np.zeros(len(t_(d)))
    for k in range(10): s = int(k * .018 * SR); c = hp(nz(.03), 3500) * env_exp(.03, .004) * (1 - k / 12); x[s:s + len(c)] += c
    tt = t_(d); x += sum(np.sin(2 * np.pi * f * tt) * env_exp(d, .08) * a for f, a in [(4200, .2), (6100, .12)])
    return norm(x)
def clink(p=1.0):
    d = .3; tt = t_(d); return norm(sum(np.sin(2 * np.pi * f * p * tt) * env_exp(d, tau) * a for f, a, tau in [(2300, 1, .05), (5200, .5, .03)]) + hp(nz(d), 4000) * env_exp(d, .003))
def buzzer(d=.35):
    tt = t_(d); sq = np.sign(np.sin(2 * np.pi * 110 * tt)) + .5 * np.sign(np.sin(2 * np.pi * 116 * tt))
    return norm(lp(sq, 2500)) * np.minimum(1, (d - tt) / .03) * .8
def bling():
    d = .7; tt = t_(d); return norm(sum(np.sin(2 * np.pi * f * tt) * env_exp(d, .18) * np.clip((tt - k * .06) * 200, 0, 1) for k, f in enumerate([1568, 2093, 2637])))
def rubber_squeak(f0=700, f1=1100, d=.18):
    tt = t_(d); f = np.linspace(f0, f1, len(tt)) * (1 + .04 * np.sin(2 * np.pi * 35 * tt)); saw = (np.cumsum(f) / SR) % 1 * 2 - 1
    return norm(bp(saw, 600, 4000)) * np.sin(np.pi * tt / d)
def air_pff(d=.3): return norm(bp(nz(d), 800, 5000)) * env_ad(d, .01, .09)
def crayon_scribble(d=.4):
    x = bp(nz(d), 1500, 6000) * (0.5 + .5 * np.abs(np.sin(2 * np.pi * 9 * t_(d)))); return norm(x) * np.sin(np.pi * t_(d) / d)
def brush_swish(d=.35): return swoosh(d, 800, 5000) * .7 + norm(bp(nz(d), 3000, 9000)) * env_ad(d, .02, .12) * .3
def wet_splat(big=False):
    d = 1.4 if big else .8; tt = t_(d)
    body = lp(nz(d), 900 if big else 1400) * env_ad(d, .003, .12 if big else .07)
    low = np.sin(2 * np.pi * (48 if big else 70) * tt * (1 - .3 * tt)) * env_exp(d, .25 if big else .12)
    drops = np.zeros(len(tt))
    for k in range(14 if big else 8): s = int((.05 + rng.random() * (.8 if big else .45)) * SR); c = bp(nz(.04), 900, 3500) * env_exp(.04, .006) * rng.random(); drops[s:s + len(c)] += c[:len(drops) - s]
    return norm(body * .8 + low * (1.0 if big else .6) + drops * .5)
def drip():
    d = .2; tt = t_(d); f = 900 + 1500 * (tt / d) ** .5; return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .04))
def sneeze_burst(big=False):
    d = .7 if big else .45; tt = t_(d)
    x = bp(nz(d), 1200, 7000) * env_ad(d, .004, .12 if big else .08) + hp(nz(d), 5000) * env_ad(d, .002, .05) * .5
    return norm(x)
def teletype(d):
    x = np.zeros(len(t_(d))); tt = 0
    while tt < d - .03:
        c = click(1.4 + rng.random() * .4, .5 + rng.random() * .3); s = int(tt * SR); x[s:s + len(c)] += c[:len(x) - s]; tt += 1 / 60 + rng.random() * .01
    return x * .5
def ratchet(n=4, gap=.022):
    x = np.zeros(int((n * gap + .05) * SR))
    for k in range(n): c = clack(1.6, .8); s = int(k * gap * SR); x[s:s + len(c)] += c[:len(x) - s]
    return norm(x)
def metal_click():
    d = .2; tt = t_(d); return norm(hp(nz(d), 2000) * env_exp(d, .003) + np.sin(2 * np.pi * 1800 * tt) * env_exp(d, .025) * .6 + np.sin(2 * np.pi * 420 * tt) * env_exp(d, .04) * .4)
def paper_thump():
    d = .3; tt = t_(d); return norm(lp(nz(d), 1500) * env_exp(d, .02) + np.sin(2 * np.pi * 110 * tt) * env_exp(d, .05) * .6 + bp(nz(d), 2000, 6000) * env_exp(d, .05) * .3)
def crunch():
    d = .35; x = np.zeros(len(t_(d)))
    for k in range(16): s = int((k * .015 + rng.random() * .01) * SR); c = bp(nz(.025), 1500, 8000) * env_exp(.025, .005) * (1 - k / 18); x[s:s + len(c)] += c[:len(x) - s]
    return norm(x + lp(nz(d), 500) * env_exp(d, .03) * .5)
def blip_up(f0=400, f1=1200, d=.12):
    tt = t_(d); f = np.linspace(f0, f1, len(tt)); sq = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)); return sq * env_exp(d, .06) * .4
def bitcrush_noise(d=.4, hold=24):
    x = nz(d); x = np.repeat(x[::hold], hold)[:len(x)]; return norm(lp(x, 3000)) * env_exp(d, .12)
def pencil(d=.5): return norm(bp(nz(d), 2500, 8000) * (0.6 + .4 * np.abs(np.sin(2 * np.pi * 6 * t_(d))))) * np.sin(np.pi * t_(d) / d)
def zip_tooth(): return ratchet(3, .012) * .8 + norm(bp(nz(.06), 3000, 9000)) [:len(ratchet(3, .012))] * .2 if False else ratchet(3, .012)
def stamp_thunk():
    d = .35; tt = t_(d); return norm(lp(nz(d), 600) * env_exp(d, .025) + np.sin(2 * np.pi * 85 * tt) * env_exp(d, .06))
def air_swish(d=.2): return swoosh(d, 1500, 6000)
def hollow_bonk():
    d = .4; tt = t_(d); return norm(sum(np.sin(2 * np.pi * f * tt * (1 - .06 * tt)) * env_exp(d, tau) * a for f, a, tau in [(310, 1, .12), (620, .4, .06), (930, .25, .04)]) + hp(nz(d), 2000) * env_exp(d, .003) * .5)
def boing(f=300, d=.35):
    tt = t_(d); fr = f * (1 + .25 * np.sin(2 * np.pi * 14 * tt) * np.exp(-tt * 6)); return norm(np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(d, .12))
def tape_rewind(d=.35):
    tt = t_(d); f = 1500 + 2500 * (tt / d); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * .3 + bp(nz(d), 2000, 8000) * .4; return norm(x) * np.sin(np.pi * tt / d) ** .5
def roll_ticks(d):
    x = np.zeros(len(t_(d))); tt = 0; k = 0
    while tt < d: c = click(1.8, .3); s = int(tt * SR); x[s:s + len(c)] += c[:len(x) - s]; tt += .03 + .002 * k; k += 1
    return x * .5
def reentry(d):
    tt = t_(d); b = lp(brown(d), 500) + bp(nz(d), 300, 2500) * .3
    e = np.minimum(1, tt / .3) * (0.6 + .4 * tt / d); e *= np.minimum(1, (d - tt) / .08)
    return norm(b) * e
def lever(): return norm(clack(.6, 1) + np.pad(metal_click(), (int(.08 * SR), 0))[:len(clack(.6, 1))] * .7)
def wind(d):
    tt = t_(d); x = bp(brown(d), 200, 1200) * (0.6 + .4 * np.sin(2 * np.pi * .7 * tt)); return norm(x) * np.minimum(1, tt / .4) * np.minimum(1, (d - tt) / .3)
def fabric_fwump():
    d = .6; tt = t_(d); return norm(lp(nz(d), 700) * env_ad(d, .03, .15) + np.sin(2 * np.pi * 60 * tt) * env_exp(d, .12) * .6)
def water_splash():
    d = 1.6; tt = t_(d); body = bp(nz(d), 300, 6000) * env_ad(d, .005, .35); low = np.sin(2 * np.pi * 50 * tt) * env_exp(d, .15)
    drops = np.zeros(len(tt))
    for k in range(30): s = int((.1 + rng.random() * 1.2) * SR); c = drip() * rng.random() * .5; drops[s:s + len(c)] += c[:len(drops) - s]
    return norm(body + low * .8 + drops * .6)
def confetti_pops():
    d = 1.0; x = np.zeros(len(t_(d)))
    for k in range(6): c = pop(.6); s = int((k * .07 + rng.random() * .03) * SR); x[s:s + len(c)] += c[:len(x) - s]
    return x
def rocket_pop():
    d = .9; tt = t_(d); f = 800 + 2200 * np.minimum(1, tt / .5); wh = np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt < .5) * .3
    bang = np.zeros(len(tt)); s = int(.5 * SR); b = norm(lp(nz(.4), 3000)) * env_exp(.4, .06); bang[s:s + len(b)] += b[:len(bang) - s]
    return norm(wh + bang + bp(nz(d), 3000, 9000) * (tt < .5) * .15)
def applause(d):
    x = np.zeros((int(d * SR) + SR, 2)); tt = 0
    while tt < d:
        c = S.hit('claps', 'solo', .4 + rng.random() * .4); add(x, c, tt, .25 * (1 - tt / d * .5), rng.random() * 1.6 - .8); tt += .018 + rng.random() * .02
    return x[:int(d * SR)]
def card_flip(): return norm(bp(nz(.08), 1500, 7000) * env_exp(.08, .015)) + click(.8, .4)[:len(t_(.08))] if False else norm(bp(nz(.08), 1500, 7000) * env_exp(.08, .015))
def whirr(d):
    tt = t_(d); x = np.zeros(len(tt)); k = 0; t0 = 0
    while t0 < d: c = click(1.1, .35); s = int(t0 * SR); x[s:s + len(c)] += c[:len(x) - s]; t0 += .028; k += 1
    return x * .6 + bp(nz(d), 500, 3000) * .08
def reel_clunk(): return norm(thump(1, 90) * .8 + np.pad(clack(.9, 1), (0, len(thump(1, 90)) - len(clack(.9, 1)))))
def tick_clock(): return click(2.0, .7)

# ───────── 事件 → 拟音（增益、声像）─────────
G = {'fuse': .045, 'ui': .5}
for e in EV['ev']:
    t, ty = e['t'], e['type']
    if ty == 'fuse_on': add(fx, sizzle(e['dur'], e.get('boss')), t, G['fuse'], .35)
    elif ty == 'cmd_slam': add(fx, swoosh(.18, 200, 2500), t - .2, .3)
    elif ty == 'tv_out': add(fx, swoosh(.3, 3000, 400, False), t, .35, -.1)
    elif ty == 'tv_in': add(fx, swoosh(.25, 250, 2000), t, .4, .1)
    elif ty == 'crown': add(fx, spring_click(), t, .55, -.4)
    elif ty == 'crack': add(fx, glass_crack(), t, .45, .5); add(fx, clink(1.0), t + .2, .25, .55); add(fx, clink(.8), t + .38, .2, .6); add(fx, clink(.7), t + .52, .12, .6)
    elif ty == 'lights_off': add(fx, thump(1, 45), t, .8); add(fx, metal_click(), t, .6)
    elif ty == 'stamp_ok': add(fx, bling(), t + .1, .3, .2)
    elif ty == 'stamp_bad': add(fx, buzzer(), t + .1, .22, .2)
    elif ty == 'insert_whoosh': add(fx, swoosh(.25, 200, 3000), t, .45)
    elif ty == 'button': add(fx, thump(1, 55), t, .9); add(fx, clack(.5, 1), t, .5)
    elif ty == 'bulb': add(fx, click(2.2, .3), t, .12, -.6 + e['i'] * .17)
    elif ty == 'reels_spin': add(fx, whirr(e['dur']), t, .35)
    elif ty == 'reel_stop': add(fx, reel_clunk(), t, .55, (e['k'] - 2) * .6)
    elif ty == 'zoom_whoosh': add(fx, swoosh(.22, 400, 6000), t, .4)
    elif ty == 'tile_flip': add(fx, card_flip(), t, .18 if e.get('soft') else .3, -.7 + (e['k'] % 8) * .2)
    # 蜡笔：橡胶、纸
    elif ty == 'pump': add(fx, rubber_squeak(500, 800, .15), t - .05, .25, .1); add(fx, air_pff(.28), t + .05, .35, .35); add(fx, crayon_scribble(.18), t, .06, -.2)
    elif ty == 'float_up': add(fx, rubber_squeak(700, 1600, .5), t, .22, .4)
    # 水墨：宣纸、水
    elif ty == 'dust': add(fx, brush_swish(.6), t, .18, .5)
    elif ty == 'sneeze': add(fx, sneeze_burst(), t, .5)
    elif ty == 'ink_splat': add(fx, wet_splat(), t + .02, .6)
    elif ty == 'drip': [add(fx, drip(), t + k * .13, .2, -.4 + k * .2) for k in range(5)]
    elif ty == 'blink': add(fx, pop(.4), t, .25)
    # ASCII：电传、继电器
    elif ty == 'typing': add(fx, teletype(e['dur']), t, .35, .4)
    elif ty == 'ratchet': add(fx, ratchet(4), t, .45, -.3)
    elif ty == 'buckle': add(fx, metal_click(), t, .7, -.1)
    # 孔版：纸、滚筒
    elif ty == 'float_whoosh': add(fx, swoosh(1.2, 200, 900), t, .18)
    elif ty == 'grab': add(fx, paper_thump(), t, .55); add(fx, swoosh(.12, 2000, 6000), t, .2)
    elif ty == 'chomp': add(fx, crunch(), t, .6, .3)
    # 像素
    elif ty == 'jump': add(fx, blip_up(300, 900, .1), t, .25, -.4)
    elif ty == 'meteor': add(fx, bitcrush_noise(.35), t - .1, .3, .6)
    elif ty == 'graze': add(fx, bitcrush_noise(.15, 6), t, .25, -.3)
    # 蓝图：铅笔、金属
    elif ty == 'pencil': add(fx, pencil(.6), t, .2, -.3)
    elif ty == 'zip': add(fx, ratchet(3, .012), t, .45, (e['i'] - 2.5) * .08)
    elif ty == 'red_stamp': add(fx, stamp_thunk(), t, .7, .4)
    # 瑞士：干净的物体
    elif ty == 'swing': add(fx, air_swish(.28), t, .35, .3)
    elif ty == 'bonk': add(fx, hollow_bonk(), t, .7, .2)
    elif ty == 'bounce': add(fx, boing(420 - e['i'] * 80, .25), t, .35, -.2 - e['i'] * .2)
    elif ty == 'replay_in': add(fx, tape_rewind(.35), t, .4)
    elif ty == 'replay_out': add(fx, metal_click(), t, .3)
    elif ty == 'roll': add(fx, roll_ticks(e['dur']), t, .3, -.6)
    # Boss
    elif ty == 'reentry': add(fx, reentry(e['dur']), t, .35)
    elif ty == 'cloud_whoosh': add(fx, swoosh(.3, 300, 2500), t, .12, (-1) ** e['k'] * .6)
    elif ty == 'lever': add(fx, lever(), t - .06, .35, .3)
    elif ty == 'chute_pop': add(fx, blip_up(500, 1400, .15), t, .35)
    elif ty == 'err': add(fx, buzzer(.25), t, .3); add(fx, bitcrush_noise(.25, 12), t + .1, .2)
    elif ty == 'zoom_in': add(fx, swoosh(.3, 3000, 300, False), t, .3)
    elif ty == 'sneeze_big': add(fx, sneeze_burst(True), t, .6)
    elif ty == 'ink_boom': add(fx, wet_splat(True), t + .03, .75)
    elif ty == 'canopy_open': add(fx, fabric_fwump(), t, .7)
    elif ty == 'wind': add(fx, wind(e['dur']), t, .25)
    elif ty == 'splash': add(fx, water_splash(), t, .8)
    elif ty == 'clear': add(fx, bling(), t, .4)
    elif ty == 'confetti': add(fx, confetti_pops(), t, .35)
    elif ty == 'applause': a2 = applause(e['dur']) * .6; s0 = int(t * SR); e0 = min(N, s0 + len(a2)); fx[s0:e0] += a2[:e0 - s0]
    elif ty == 'hop': add(fx, boing(260 + e['i'] * 40, .18), t, .07, .6)
    elif ty == 'salute': add(fx, air_swish(.2), t - .05, .35, .5)
    elif ty == 'tick_hand': add(fx, tick_clock(), t, .5, -.4)
    elif ty == 'rocket_pop': add(fx, rocket_pop(), t, .5, .5)

# ───────── 人声 ─────────
def load(id):
    y, sr = sf.read(os.path.join(D, 'voices', id + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    return librosa.resample(y, orig_sr=sr, target_sr=SR)
def room(x, rt=.35, wet=.12):   # 小舞台房间感
    n = int(rt * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (rt * SR / 6.9)); ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    return x + np.convolve(x, ir)[:len(x)] * wet
for e in EV['ev']:
    if e['type'] != 'voice': continue
    L = lines[e['id']]; y = load(e['id'])
    if L['who'] == 'dot':
        y = librosa.effects.pitch_shift(y, sr=SR, n_steps=2.5)
        g = .75 if L.get('fx') else .9
        if e['id'].startswith('fx_choo'): g = 1.0
        y = compress(norm(y, .9), .3, 3) ; add(vo, room(y, .25, .08), e['t'], g * (1.25 if e['id'] == 'fx_choo2' else 1), .1)
    else:
        y = hp(y, 90); y = y + bp(y, 2500, 5000) * .25   # 主持腔：提一点临场感
        y = compress(norm(y, .9), .28, 4)
        add(vo, room(y, .4, .1 if L.get('cmd') else .14), e['t'] + (.1 if L.get('cmd') else 0), 1.7 if L.get('cmd') else (1.3 if e['id'] == 'l7' else 1.0), -.05)

# ───────── 配乐 + 闪避 ─────────
mus, msr = sf.read(os.path.join(D, 'music', 'score.wav'))
if msr != SR: mus = librosa.resample(mus.T, orig_sr=msr, target_sr=SR).T
mus = mus[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
ve = np.abs(vo).max(1); from scipy.ndimage import maximum_filter1d, uniform_filter1d
ve = uniform_filter1d(maximum_filter1d(ve, int(.12 * SR)), int(.08 * SR))
duck = 1 - .72 * np.clip(ve / .12, 0, 1)                 # 最多约 −11 dB
fduck = 1 - .5 * np.clip(ve / .12, 0, 1)                 # 拟音也让一让（约 −6 dB）
mix = mus * 1.35 * duck[:, None] + fx * fduck[:, None] + vo * 1.4
# 总线：轻压 + 14 kHz 低通 + 限幅
for c in range(2): mix[:, c] = lp(mix[:, c], 15000, 2)
pk = np.abs(mix).max(); mix *= .95 / pk
for c in range(2): mix[:, c] = limit(mix[:, c], .89)
# 结尾 0.4s 淡出
n = int(.4 * SR); mix[-n:] *= np.linspace(1, 0, n)[:, None]
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
print('mix.wav', round(len(mix) / SR, 3), 's  peak', round(float(np.abs(mix).max()), 3))
# 审查用分轨（电平表）
os.makedirs(os.path.join(D, 'out', 'stems'), exist_ok=True)
k = .95 / pk
for nm, x in [('music', mus * 1.35 * duck[:, None] * k), ('fx', fx * fduck[:, None] * k), ("voice", vo * 1.4 * k)]: sf.write(os.path.join(D, 'out', 'stems', nm + '.wav'), x.astype(np.float32), SR)
