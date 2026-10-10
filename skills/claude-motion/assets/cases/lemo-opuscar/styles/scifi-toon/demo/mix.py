"""混音：程序化拟音（按 events.json）+ 对白（voices/）+ 配乐（music/score.wav，对白时闪避）+ 每个宇宙的环境声 → mix.wav
用法：python mix.py（先跑 core/render/events.mjs、voice.py、music/score.py）"""
import sys, os, json, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, click, clack, whoosh, pop, ding, thump, compress, limit, add
from scipy.ndimage import maximum_filter1d, uniform_filter1d
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; N = int(DUR * SR)
LINES = {l['id']: l for l in json.load(open(os.path.join(HERE, 'lines.json')))}
rng = np.random.default_rng(5)
def brown_(d):
    w = np.cumsum(nz(d)); w -= np.linspace(w[0], w[-1], len(w)); return norm(hp(w, 20))
def nz(d): return rng.standard_normal(int(d * SR))   # 与 t_() 同长度
sfxb, vob, amb = np.zeros((N, 2)), np.zeros((N, 2)), np.zeros((N, 2))

def sweep(f0, f1, d, curve=1.0):
    tt = t_(d); f = f0 * (f1 / f0) ** ((tt / d) ** curve); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def fade(x, a=.005, r=.02):
    n = len(x); x = x.copy(); A, R = min(n, int(a * SR)), min(n, int(r * SR)); x[:A] *= np.linspace(0, 1, A); x[n - R:] *= np.linspace(1, 0, R); return x
def bpsweep(x, f0, f1, q=.35):
    out = np.zeros_like(x); n = len(x)
    for i in range(0, n, 480):
        f = f0 * (f1 / f0) ** (i / n); s = bp(x[max(0, i - 2400):i + 480], f * (1 - q), min(f * (1 + q), 20000)); out[i:i + 480] = s[-len(out[i:i + 480]):]
    return out

# —— 卡通拟音（全部合成）——
def plip():
    d = .12; x = np.zeros(int(d * SR)); s = sweep(900, 2600, .05) * env_exp(.05, .02); x[:len(s)] += s; x += bp(nz(d), 2000, 6000) * env_exp(d, .01) * .2; return norm(x)
def squeak(): d = .09; tt = t_(d); return norm(np.sin(2 * np.pi * (2000 + 500 * np.sin(2 * np.pi * 30 * tt)) * tt) * np.sin(np.pi * tt / d))
def tic(): d = .04; return norm(np.sin(2 * np.pi * 3200 * t_(d)) * env_exp(d, .008))
def gulp(): d = .22; x = sweep(420, 110, d, .6) * env_exp(d, .07); x[:int(.01 * SR)] += bp(nz(.01), 500, 3000) * .8; return norm(lp(x, 1200))
def cloth(): d = .3; return norm(lp(nz(d), 1500) * np.sin(np.pi * t_(d) / d) ** 2)
def rclick(): x = click(.8); b = np.sin(2 * np.pi * 1320 * t_(.07)) * env_exp(.07, .03) * .5; y = np.zeros(int(.1 * SR)); y[:len(x)] += x; y[int(.02 * SR):int(.02 * SR) + len(b)] += b; return norm(y)
def portal_open():
    d = 1.5; tt = t_(d)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt / .12)) / SR) * env_exp(d, .45)
    down = bpsweep(nz(d), 6000, 300, .4) * env_exp(d, .5)
    swirl = np.sin(2 * np.pi * np.cumsum(260 + 500 * (tt / d) + 120 * np.sin(2 * np.pi * 7 * tt)) / SR) * np.sin(np.pi * np.minimum(tt / d, 1)) * .35
    sp = hp(nz(d), 5000) * (rng.random(len(tt)) > .997) * 4
    return norm(boom * 1.0 + down * .7 + swirl + lp(sp, 12000) * .3)
def portal_hum(d):
    tt = t_(d); lfo = np.sin(2 * np.pi * .9 * tt)
    x = np.sin(2 * np.pi * 55 * tt + 2 * np.sin(2 * np.pi * 3 * tt)) * .6 + np.sin(2 * np.pi * 110.7 * tt) * .25 + bp(nz(d), 300, 900) * (.5 + .3 * lfo) * .5
    x += np.sin(2 * np.pi * np.cumsum(420 + 60 * lfo) / SR) * .08
    return fade(norm(x), .3, .4)
def portal_close(): d = .5; tt = t_(d); x = bpsweep(nz(d), 300, 3000, .4)[::-1] * np.linspace(0, 1, len(tt)) ** 2; x[-int(.12 * SR):] += thump(1, 60)[:int(.12 * SR)]; return norm(np.concatenate([x, thump(1, 55) * .8]))
def portal_whoosh(): d = .4; x = bpsweep(nz(d), 400, 4000, .3) * np.sin(np.pi * t_(d) / d) ** 2; return norm(x + np.sin(2 * np.pi * np.cumsum(np.linspace(200, 900, len(x))) / SR) * np.sin(np.pi * t_(d) / d) * .3)
def suck(): d = .35; x = bpsweep(nz(d), 3000, 250, .4) * np.linspace(.3, 1, int(d * SR)); return norm(np.concatenate([x, pop(.8)[:int(.12 * SR)] * .6]))
def whoosh_big(): return whoosh(.45)
def boing(): d = .7; tt = t_(d); f = 180 * (1 + .35 * np.sin(2 * np.pi * 16 * tt) * np.exp(-tt / .25)) * (1 + .6 * np.exp(-tt / .04)); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .22))
def thud(): return norm(thump(1, 70) + np.pad(lp(nz(.15), 1200) * env_exp(.15, .03), (0, int(.2 * SR))))
def bubble(f0=300, f1=900, d=.07): return sweep(f0, f1, d, .8) * np.sin(np.pi * t_(d) / d)
def gurgle():
    out = np.zeros(int(.8 * SR))
    for k in range(9): b = bubble(150 + rng.random() * 200, 400 + rng.random() * 400, .05 + rng.random() * .05); s = int(rng.random() * .7 * SR); out[s:s + len(b)] += b[:len(out) - s]
    return norm(lp(out, 2000))
def glorp():
    d = .5; tt = t_(d); f = 260 + 500 * np.sin(np.pi * tt / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 + .6 * np.sin(2 * np.pi * 28 * tt)) * np.sin(np.pi * tt / d)
    return norm(lp(x, 1800) + gurgle()[:len(x)] * .5)
def slide(): d = .45; tt = t_(d); return norm(bp(nz(d), 500, 2500) * (.6 + .4 * np.sin(2 * np.pi * 22 * tt)) * np.sin(np.pi * tt / d))
def squish(): d = .18; return norm(bpsweep(nz(d), 600, 2500, .5) * env_exp(d, .05))
def wetblink(): d = .09; x = bp(nz(d), 700, 3000) * env_exp(d, .015); x[:int(.03 * SR)] += bubble(500, 1500, .03) * .6; return norm(x)
def slurp(d): tt = t_(d); am = (rng.random(len(tt)) > .9992).astype(float); am = uniform_filter1d(maximum_filter1d(am, int(.015 * SR)), int(.01 * SR)); return fade(norm(bp(nz(d), 900, 3200) * (.25 + am * 2) * np.sin(np.pi * tt / d) ** .5), .02, .05)
def page(): d = .22; tt = t_(d); return norm(hp(nz(d), 2500) * (rng.random(len(tt)) > .6) * np.sin(np.pi * tt / d))
def lick(): d = .3; return norm(bpsweep(nz(d), 1200, 400, .5) * np.sin(np.pi * t_(d) / d))
def chomp(): x = np.zeros(int(.3 * SR)); a = clack(1.4); b = clack(1.2); x[:len(a)] += a; x[int(.07 * SR):int(.07 * SR) + len(b)] += b; x[:int(.15 * SR)] += lp(nz(.15), 3000) * env_exp(.15, .03) * .5; return norm(x)
def coo():
    d = .75; tt = t_(d); f = 330 + 90 * np.sin(np.pi * np.minimum(tt / .5, 1)) - 60 * (tt > .5)
    return norm(lp(np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 + .4 * np.sin(2 * np.pi * 24 * tt)) * np.sin(np.pi * tt / d), 1200))
def swish(): d = .2; return norm(bp(nz(d), 1500, 6000) * np.sin(np.pi * t_(d) / d) ** 2)
def shopbell(): a = ding(1); y = np.zeros(len(a) + int(.14 * SR)); y[:len(a)] += a; y[int(.14 * SR):] += ding(.7); return norm(y)
def cupset(): return norm(thump(.8, 140)[:int(.15 * SR)] + np.pad(click(.6), (0, int(.15 * SR) - len(click(.6)))))
def bloop(): return norm(bubble(280, 950, .08))
def blip(): d = .05; return norm(np.sin(2 * np.pi * 1700 * t_(d)) * np.sin(np.pi * t_(d) / d))
def wheee(d):
    tt = t_(d); f = 900 + 700 * np.sin(np.pi * tt / d) + 50 * np.sin(2 * np.pi * 9 * tt)
    return fade(norm(np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * tt / d) ** .3, .02, .08)
def gulp_portal(): return norm(np.concatenate([gulp(), pop(.7)[:int(.1 * SR)]]))
def slam():
    d = 1.0; tt = t_(d)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-tt / .05)) / SR) * env_exp(d, .3)
    crack = bp(nz(d), 1000, 7000) * env_exp(d, .05)
    splat = lp(nz(d), 1500) * env_exp(d, .12) * (1 + .5 * np.sin(2 * np.pi * 30 * tt))
    return norm(boom + crack * .6 + splat * .5)

FX = {'plip': (plip, .5), 'squeak': (squeak, .12), 'tic': (tic, .18), 'gulp': (gulp, .5), 'cloth': (cloth, .15), 'click': (rclick, .45),
      'portalOpen': (portal_open, .7), 'portalClose': (portal_close, .5), 'portalWhoosh': (portal_whoosh, .45), 'suck': (suck, .4), 'whooshBig': (whoosh_big, .45),
      'pop': (lambda: pop(1), .35), 'boing': (boing, .4), 'thud': (thud, .5), 'gurgle': (gurgle, .3), 'glorp': (glorp, .55), 'slide': (slide, .3), 'squish': (squish, .35),
      'wetblink': (wetblink, .7), 'page': (page, .25), 'lick': (lick, .35), 'chomp': (chomp, .5), 'coo': (coo, .45), 'swish': (swish, .3), 'shopbell': (shopbell, .3),
      'cupSet': (cupset, .3), 'bloop': (bloop, .45), 'blip': (blip, .3), 'whoosh': (lambda: whoosh(.35), .4), 'gulpPortal': (gulp_portal, .5), 'slam': (slam, .7)}
for e in E['ev']:
    ty, t, v = e['type'], e['t'], e.get('v', 1.0)
    if ty in FX: f, gdb = FX[ty]; add(sfxb, f() * v, t, gdb, float(rng.uniform(-.2, .2)))
    elif ty == 'portalHum': add(sfxb, portal_hum(e['d']) * v, t, .16)
    elif ty == 'slurp': add(sfxb, slurp(e['d']) * v, t, .35)
    elif ty == 'wheee': add(sfxb, wheee(e['d']) * v, t, .22)

# —— 环境声：每个宇宙一张"底" ——
def amb_lab(d):
    tt = t_(d); hum = (np.sin(2 * np.pi * 120 * tt) + .5 * np.sin(2 * np.pi * 240 * tt) + .25 * np.sin(2 * np.pi * 360 * tt)) * .012
    x = hum + lp(brown_(d), 300) * .03; ticks = np.zeros_like(tt)
    for k in range(int(d)):
        s = int(k * SR); tk = hp(nz(.025), 2500) * env_exp(.025, .003) * (.07 if k % 2 else .055); ticks[s:s + len(tk)] += tk[:len(ticks) - s]
    return x, ticks
def amb_jelly(d):
    out = lp(brown_(d), 500) * .03
    for k in range(int(d * 5)): b = bubble(200 + rng.random() * 300, 500 + rng.random() * 500, .06) * .05; s = int(rng.random() * (d - .1) * SR); out[s:s + len(b)] += b
    return out
def amb_cafe(d, murmur=.035):
    tt = t_(d); x = np.zeros_like(tt)
    for k in range(6):   # 人声嘈杂：几条带通噪声 + 随机语音包络
        am = uniform_filter1d((rng.random(len(tt)) > .9995).astype(float), int(.25 * SR)) * 60
        x += bp(nz(d), 300 + k * 90, 900 + k * 150) * np.clip(am, 0, 1)
    x = norm(x) * murmur + lp(brown_(d), 400) * .02
    for k in range(int(d / 1.3)):
        c = click(1.8 + rng.random() * .5, .15); s = int((k * 1.3 + rng.random()) * SR)
        if s + len(c) < len(x): x[s:s + len(c)] += c
    return x
def amb_wind(d): return lp(brown_(d), 700) * .045
cur_mid = []
for e in E['ev']:
    if e['type'] != 'amb': continue
    t, d, w = e['t'], e['d'], e['w']
    if w == 'lab': x, ticks = amb_lab(d); add(amb, fade(x, .05, .05), t, 1.0); add(amb, ticks, t + .5 - (t % 1), 1.0, .5)
    elif w == 'jelly': add(amb, fade(amb_jelly(d), .03, .05), t, 1.0)
    elif w == 'mug': add(amb, fade(amb_wind(d) + amb_cafe(d, .02), .03, .05), t, 1.0)
    elif w == 'normal': add(amb, fade(amb_cafe(d, .03), .03, .05), t, 1.0)
    elif w in ('teeth', 'pigeon', 'vasks'): add(amb, fade(amb_wind(d), .02, .02), t, .8)

# —— 对白 ——
for e in E['ev']:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
    y = compress(y / np.abs(y).max(), .28, 3.2)
    y = y / (np.sqrt((y ** 2).mean()) + 1e-9) * .12   # 按 RMS 配平
    who = LINES[e['id']]['who']; pan = {'VASK': .12, 'GARY': -.12, 'COFFEE': 0}[who]
    add(vob, y, e['t'], {'VASK': 1.0, 'GARY': .92, 'COFFEE': .85}[who], pan)
# 一点点房间感（短早反射），让人声和画面在同一空间
from scipy.signal import fftconvolve
er = np.zeros(int(.09 * SR)); er[0] = 1
for dly, gdb in [(.011, .25), (.019, .18), (.031, .12), (.047, .08), (.067, .05)]: er[int(dly * SR)] += gdb
vob = np.stack([fftconvolve(vob[:, c], er)[:N] for c in range(2)], 1)

# —— 配乐 + 闪避 ——
mus, _ = sf.read(os.path.join(HERE, 'music', 'score.wav'))
mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
act = (np.abs(vob).max(1) > .01).astype(float)
duck = 1 - .55 * np.clip(uniform_filter1d(maximum_filter1d(act, int(.3 * SR)), int(.15 * SR)), 0, 1)
mix = mus * .42 * duck[:, None] + sfxb * .8 + vob * 1.0 + amb * .9
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
def rms_db(x): return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
print('mix peak %.3f  rms %.1f dB | voice %.1f  music %.1f  sfx %.1f  amb %.1f' % (np.abs(mix).max(), rms_db(mix), rms_db(vob), rms_db(mus * .42 * duck[:, None]), rms_db(sfxb * .8), rms_db(amb)))
