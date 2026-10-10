"""mix.py · 丝印旅行海报：环境底 + 拟音 + 配乐 → mix.wav
仓库根运行：.venv/bin/python styles/silkscreen-poster/demo/mix.py
所有卡点来自 demo/events.json（node core/render/events.mjs 导出），配乐来自 music/score.wav（music/compose.py）。
材质：刮板 = 橡胶刀口在尼龙网纱上（带网格颗粒的中高频"嘶"）；墨 = 湿、黏的低频"咕"；网框 = 铝框 + 铰链弹簧；纸 = 短促干燥的中频。
"""
import json, os, sys
import numpy as np
import soundfile as sf
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, os.path.join(ROOT, 'core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, clack, creak, thump, whoosh, compress, limit, add

D = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(D, 'events.json')))
DUR = E['dur'] + 1.5
N = int(DUR * SR)
rng = np.random.default_rng(11)
amb = np.zeros((N, 2)); fol = np.zeros((N, 2))
ev = [e for e in E['ev']]
def evs(tp): return [e for e in ev if e['type'] == tp]
def first(tp, **kw):
    for e in ev:
        if e['type'] == tp and all(e.get(k) == v for k, v in kw.items()): return e
def fade(x, a=.01, b=.05):
    n1, n2 = int(a * SR), int(b * SR); x = x.copy()
    if n1: x[:n1] *= np.linspace(0, 1, n1)
    if n2: x[-n2:] *= np.linspace(1, 0, n2)
    return x

# ---------------- 拟音积木 ----------------
def scrape(d, v=1.0, bright=1.0, heavy=0.0, attack=.02):
    """刮板刮网：宽带噪声 → 带通；网格颗粒 = 180–320 Hz 的幅度调制；速度快 = 更亮"""
    n = noise(d); tt = t_(d)
    grain = .65 + .35 * np.abs(np.sin(2 * np.pi * (220 + 60 * bright) * tt + rng.random() * 6)) ** 2
    x = bp(n, 700 * bright, min(9000, 5200 * bright), 2) * grain
    x += lp(noise(d), 380) * (.5 + heavy) * .6                         # 刀口压着纸的低频
    e = np.minimum(1, tt / max(attack, 1e-3)) * np.minimum(1, (d - tt) / .06) * (1 - .25 * tt / d)
    return norm(x * e) * v
def squelch(v=1.0, f=140):
    """墨珠挤压的湿"咕"：低频正弦下滑 + 黏滞噪声"""
    d = .16; tt = t_(d)
    x = np.sin(2 * np.pi * f * tt * (1 - .9 * tt)) * env_exp(d, .05) + lp(noise(d), 900) * env_exp(d, .03) * .5
    return norm(x) * v
def tick(v=1.0, f=3200):
    d = .03; tt = t_(d)
    return norm(hp(noise(d), 2500) * env_exp(d, .003) + np.sin(2 * np.pi * f * tt) * env_exp(d, .004) * .4) * v
def stamp(v=1.0):
    """数据块落下：纸面闷响 + 一点点刮"""
    d = .14; tt = t_(d)
    x = lp(noise(d), 1200) * env_exp(d, .012) + np.sin(2 * np.pi * 160 * tt) * env_exp(d, .03) * .7 + bp(noise(d), 2500, 6000) * env_exp(d, .006) * .4
    return norm(x) * v
def rustle(d=.6, v=1.0):
    """松针擦过：高频碎噪 + 颗粒"""
    tt = t_(d); crack = (rng.random(len(tt)) > .993) * rng.standard_normal(len(tt)) * 4
    x = bp(noise(d), 2000, 8000) * .6 + hp(crack, 3000)
    return norm(x * np.sin(np.pi * tt / d) ** 1.5) * v
def paperslide(d=.35, v=1.0):
    tt = t_(d); x = bp(noise(d), 900, 4200) * (.7 + .3 * np.sin(2 * np.pi * 31 * tt))
    return norm(x * np.sin(np.pi * tt / d) ** 2) * v
def regclack(v=1.0):
    """对位夹合上：木头敲击 + 金属短振（全片最重要的一声）"""
    d = .6; tt = t_(d)
    wood = sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(520, 1, .03), (1180, .6, .02), (240, .8, .05)])
    metal = sum(a * np.sin(2 * np.pi * f * tt + p) * env_exp(d, tau) for f, a, tau in [(2410, .5, .18), (3890, .3, .12), (5230, .18, .08)] for p in [0])
    tr = hp(noise(d), 3000) * env_exp(d, .002) * 1.2
    return norm(wood + metal + tr) * v

# ---------------- 环境底 ----------------
def seg_env(a, b, fi, fo):
    tt = np.arange(N) / SR
    return np.clip(np.minimum((tt - a) / max(fi, 1e-3), (b - tt) / max(fo, 1e-3)), 0, 1)
tt_all = np.arange(N) / SR
# 印刷工作室：低频房间声 + 远处窗外鸟（0 → 13.2，横幅段更明显）
room = lp(brown(DUR), 260) * .5 + bp(noise(DUR), 150, 900) * .08
lift1 = first('lift', i=0)['t']; wipe1 = first('wipe', i=1)['t']
studio = room * seg_env(-1, wipe1 + .1, .01, .4) * .05
amb[:, 0] += studio; amb[:, 1] += studio * .95
for t0 in [2.3, 3.6, 6.4]:      # 窗外小鸟（很轻、偏右）
    d = .22; x = np.sin(2 * np.pi * np.cumsum(3200 + 900 * np.sin(2 * np.pi * 14 * t_(d))) / SR) * env_exp(d, .08)
    add(amb, x, t0, .012, .6)
# 画里的清晨湖边：网版抬起时淡入（水拍岸 + 一声潜鸟），到转场结束
w = lp(noise(DUR), 500) * (.6 + .4 * np.sin(2 * np.pi * .7 * tt_all) ** 2)
lake = w * seg_env(lift1, wipe1 + .2, .6, .3) * .05
amb[:, 0] += lake * .9; amb[:, 1] += lake
d = 1.4; loon = np.sin(2 * np.pi * np.cumsum(np.interp(t_(d), [0, .3, 1.1, 1.4], [760, 1020, 980, 900])) / SR) * np.sin(np.pi * t_(d) / d) * (1 + .15 * np.sin(2 * np.pi * 6 * t_(d)))
add(amb, lp(loon, 2500), lift1 + .5, .02, -.4)
# 瀑布：J-cut，在第 1 张结尾前 0.9 s 从底下涨上来，静音前收掉
sil_pre = first('silence', pre=1)
fall = (bp(noise(DUR), 250, 5000) * .7 + lp(brown(DUR), 180) * .6)
fenv = seg_env(wipe1 - .9, sil_pre['t'] + .15, .9, .5)
amb[:, 0] += fall * fenv * .07; amb[:, 1] += fall * fenv * .075
# 山风：J-cut（静音里 0.6 s 先进来），随高度变强变亮；L-cut 延续到墙面拉出后
asc = first('ascent'); wallp = first('wallpull'); land = first('land')
g = lp(noise(DUR), 900) * .6 + bp(noise(DUR), 900, 3500) * .25
gust = .55 + .45 * np.sin(2 * np.pi * .23 * tt_all + 1) * np.sin(2 * np.pi * .11 * tt_all)
height = np.clip((tt_all - asc['t']) / asc['dur'], 0, 1)
wind = g * gust * (.5 + .7 * height) * seg_env(asc['t'] - .6, land['t'] + .9, .6, 1.1) * .06
amb[:, 0] += wind; amb[:, 1] += np.roll(wind, 900)
# 游客中心室内：拉出墙面时接过山风；轻人声嘈杂（带音节调制的带通噪声）、远处门、木地板脚步
mur = bp(noise(DUR), 250, 1800) * (.5 + .5 * np.abs(np.sin(2 * np.pi * 3.1 * tt_all + np.sin(2 * np.pi * .7 * tt_all) * 3)))
mur = mur * seg_env(wallp['t'] + .5, DUR, .9, 1.5) * .022
amb[:, 0] += mur; amb[:, 1] += np.roll(mur, 2400)
add(amb, thump(.5, 80), land['t'] + 1.7, .06, -.7)                       # 远处门
for k in range(4): add(amb, bp(noise(.06), 300, 2000) * env_exp(.06, .012), land['t'] + 2.2 + k * .52, .05, .6 - k * .15)

# ---------------- 拟音 ----------------
for e in ev:
    t, tp = e['t'], e['type']
    if tp == 'squeegee':
        dd = e['dur']
        if e['ink'] == 'sky':      # 开场刮板：已经在刮（无起音），从左往右
            x = scrape(dd, .8, 1.0, .3, attack=.003)
            n = len(x); pan = np.linspace(-.3, .5, n)
            s0 = int(t * SR); fol[s0:s0 + n, 0] += x * np.cos((pan + 1) * np.pi / 4) * 1.2; fol[s0:s0 + n, 1] += x * np.sin((pan + 1) * np.pi / 4) * 1.2
            add(fol, squelch(.8, 120), t + .03, .35, 0)
        else:
            add(fol, scrape(dd, .75, 1.25, .1), t, .7 if e['ink'] == 'title' else .45, .1)
    elif tp == 'lift':
        add(fol, clack(.65, 1), t, .35, 0); add(fol, creak(1), t + .05, .18, .2); add(fol, whoosh(.3, 1), t + .02, .12, 0)
        add(fol, tick(.8, 1800), t + .32, .15, .25)                                  # 弹簧
    elif tp == 'pull':
        dd = e['dur']; q = e.get('quick', 0)
        add(fol, scrape(dd, 1, 1.1 + .15 * e['n'] + (.25 if q else 0), .2), t, .55 if not q else .45, -.2 + .15 * e['n'])
        add(fol, squelch(1, 150 + 20 * e['n']), t, .22, 0)
    elif tp == 'band':
        add(fol, scrape(.34, 1, .9, .6), t, .6, -.2); add(fol, squelch(1, 110), t, .3, 0)
    elif tp == 'name':
        add(fol, scrape(.3, 1, 1.2, .3, attack=.004), t, .5, -.1); add(fol, squelch(1, 170), t, .35, 0); add(fol, thump(1, 95), t + .28, .22, 0)
    elif tp == 'item':
        add(fol, stamp(1), t, .8 if not e.get('climb') else .95, -.35 + .25 * e['k']); add(fol, tick(1, 2400), t, .25, -.35 + .25 * e['k'])
    elif tp == 'wipe':
        if e['i'] != 2: add(fol, rustle(.6, 1), t - .3, .32, .3); add(fol, whoosh(.55, 1), t - .28, .25, -.2)
    elif tp in ('tilt', 'pullback', 'tiltdown'):
        add(fol, whoosh(.5, 1), t, .07, 0)
    elif tp == 'part':
        add(fol, paperslide(.4, 1), t - .12, .22, -.5 if e['layer'] in ('spurA', 'spurC') else .5)
    elif tp == 'swap':
        add(fol, scrape(e['dur'] + .1, 1, .85, .8), t, .8 if e['k'] > 1 else .65, 0); add(fol, squelch(1, 95), t, .45, 0)
    elif tp == 'clack':
        add(fol, regclack(1), t, 1.0, 0); add(fol, thump(1, 60), t, .5, 0)
    elif tp == 'wallpull':
        add(fol, whoosh(1.1, 1), t, .1, 0)
    elif tp == 'land':
        add(fol, tick(1, 2600), t - .05, .12, .6)                                    # 图钉
    elif tp == 'endpull':
        add(fol, scrape(e['dur'], 1, 1.2, .4), t, .45, .1); add(fol, squelch(1, 120), t, .2, 0)
    elif tp == 'endcard':
        add(fol, scrape(.5, 1, 1.0, .4), t, .5, 0); add(fol, squelch(1, 100), t, .25, 0)
# 步道虚线逐段印出：第 1 张印信息带时 + 爬升全程，每十六分音符一个极小的"嗒"
B = .6
b0 = first('band', i=0)['t']
for k in range(4): add(fol, tick(1, 3600 + 200 * k), b0 + k * B / 4, .08, .3)
for k in range(int(asc['dur'] / (B / 2))): add(fol, tick(1, 3000 + 60 * (k % 5)), asc['t'] + .2 + k * B / 2, .07, -.2 + .03 * (k % 8))

# ---------------- 配乐 + 让路 ----------------
mus, sr = sf.read(os.path.join(D, 'music/score.wav'), always_2d=True)
assert sr == SR
m = np.zeros((N, 2)); L = min(N, len(mus)); m[:L] = mus[:L]
# 让路：拟音包络 → 配乐压低 2.5 dB（快起慢放）
fe = np.abs(fol).max(axis=1)
from scipy.ndimage import maximum_filter1d, uniform_filter1d
fe = uniform_filter1d(maximum_filter1d(fe, int(.12 * SR)), int(.05 * SR))
duck = 1 - .25 * np.clip(fe / (fe.max() + 1e-9) * 3, 0, 1)
m *= duck[:, None]
# 爬升段渐强（配乐分支的建议：+3 dB 包络）
ramp = 1 + .4 * np.clip((tt_all - asc['t']) / asc['dur'], 0, 1) * (tt_all < asc['t'] + asc['dur'])
m *= ramp[:, None]

# 静音窗：两处静音里配乐和拟音必须为零；环境只留规定的（瀑布尾巴 / 山风）
for s in evs('silence'):
    a, b = int((s['t'] + .03) * SR), int((s['t'] + s['dur'] - .005) * SR)
    m[a:b] = 0; fol[a:b] *= 0
    if s.get('pre'): amb[a:b] *= np.linspace(1, .35, b - a)[:, None]

# 静音里只留一声很轻的松针擦过（进入签名段的树影转场）
w2 = [e for e in evs('wipe')][-1]
add(fol, rustle(.6, 1), w2['t'] - .3, .07, .3)
mix = m * .62 + fol * .55 + amb * 1.0
for c in range(2): mix[:, c] = limit(mix[:, c], .92)
assert np.isfinite(mix).all()
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
print('mix.wav', f'{DUR:.2f}s', 'peak', f'{20*np.log10(np.abs(mix).max()):.1f} dBFS')
for s in evs('silence'):
    a, b = int((s['t'] + .06) * SR), int((s['t'] + s['dur'] - .02) * SR)
    print(f"silence {s['t']:.2f}-{s['t']+s['dur']:.2f}  rms {20*np.log10(np.sqrt((mix[a:b]**2).mean())+1e-12):.1f} dBFS")
