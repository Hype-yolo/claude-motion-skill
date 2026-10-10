"""mix.py — 《Room to Think》拟音 + 人声 + 配乐闪避 → mix.wav
混乱的声音是"散"的（音高各差几十音分、声像乱摆、每种来源一种音色）；
Tidy 的声音是"一套"（同一种毛毡 + 玻璃材质、全部调在 A 大调里、居中）。
python styles/dark-keynote/demo/mix.py
"""
import os, sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from scipy.ndimage import uniform_filter1d
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, add, compress, limit

TL = json.load(open(os.path.join(D, 'timeline.json'))); K = TL['K']; DUR = TL['dur']
EV = json.load(open(os.path.join(D, 'events.json')))['ev']
rng = np.random.default_rng(2026)
N = int(DUR * SR)
fol = np.zeros((N, 2)); amb = np.zeros((N, 2)); vox = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
A_MAJ = [69, 71, 73, 76, 78, 81, 83, 85, 88, 90, 93]          # A 大调五声（Tidy 的调内音）

# ─────────── 音色 ───────────
def sine(f, d, tau, ph=0):
    return np.sin(2 * np.pi * f * t_(d) + ph) * env_exp(d, tau)

def caret_tick(v=1.0):      # 光标"嗒"：极短、干净、2 kHz 附近
    d = .03; return norm(bp(noise(d), 1500, 3200) * env_exp(d, .0025) + sine(2100, d, .004) * .6) * v

def key(v=1.0, heavy=False):  # 矮轴键盘
    d = .07; p = 1 + rng.uniform(-.08, .08)
    x = bp(noise(d), 1400 * p, 5200 * p) * env_exp(d, .004) + sine(180 * p, d, .012) * (.9 if heavy else .45) + sine(820 * p, d, .006) * .25
    if heavy: x = x + lp(noise(d), 500) * env_exp(d, .02) * .6
    return norm(x) * v

def glass(f, v=1.0, d=.5, bright=1.0):   # 玻璃"叮"：正弦 + 二次谐波 + 非谐分音
    x = sine(f, d, d * .35) + sine(2 * f, d, d * .18) * .35 * bright + sine(2.76 * f, d, d * .1) * .22 * bright + hp(noise(d), 5000) * env_exp(d, .002) * .3
    return norm(x) * v

def felt(v=1.0, f=320):     # 毛毡"嗒"（Tidy 材质的低端）
    d = .09; x = sine(f, d, .018) + lp(noise(d), 1400) * env_exp(d, .006) * .7 + sine(f * 2.01, d, .01) * .3
    return norm(x) * v

def whoosh(d=.3, lo=500, hi=4000, v=1.0, up=True):
    n = noise(d); out = np.zeros_like(n); L = len(n); step = 480
    for i in range(0, L, step):
        u = i / L; u = u if up else 1 - u; f = lo * (hi / lo) ** u
        w = min(step, L - i); seg = bp(n[max(0, i - 1500):i + w], f * .75, min(f * 1.3, SR / 2 - 100))[-w:]; out[i:i + w] = seg
    return norm(out * np.sin(np.pi * t_(d) / d) ** 1.5) * v

def plop(v=1.0):            # 文件落下
    d = .08; tt = t_(d); f = 320 * (1 - .5 * tt / d)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .02) + bp(noise(d), 2000, 6000) * env_exp(d, .003) * .4) * v

def flick(v=1.0):           # 照片甩入（纸牌"唰"）
    d = .09; return norm(bp(noise(d), 2200, 7500) * np.sin(np.pi * t_(d) / d) ** .6 * env_exp(d, .05)) * v

def pop(v=1.0, f=900):      # 通知弹出（加一点失谐的玻璃）
    d = .12; tt = t_(d); fr = f * (1 + .6 * np.exp(-tt / .01))
    return norm(np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(d, .03)) * v

def glitch(v=1.0):          # 插入镜头的故障重音
    d = .18; tt = t_(d); sq = np.sign(np.sin(2 * np.pi * np.cumsum(900 * (1 - .8 * tt / d)) / SR))
    crush = np.round(noise(d) * 3) / 3; crush = np.repeat(crush[::12], 12)[:len(tt)]
    return norm(sq * env_exp(d, .05) * .6 + bp(crush, 800, 7000) * env_exp(d, .03)) * v

def buzz_low(v=1.0):        # "存储已满"错音：两个相差小二度的方波
    d = .45; tt = t_(d); x = np.sign(np.sin(2 * np.pi * 110 * tt)) + np.sign(np.sin(2 * np.pi * 116.5 * tt))
    return norm(lp(x, 900) * env_exp(d, .18)) * v

def thump(v=1.0, f=60, d=.4):
    tt = t_(d); return norm(np.sin(2 * np.pi * f * tt * (1 - .25 * tt)) * env_exp(d, .09) + lp(noise(d), 260) * env_exp(d, .02) * .6) * v

def doom(v=1.0):            # 按下："咚"——毛毡槌 + 55→40 Hz 下滑 + 室内尾巴
    d = 2.6; tt = t_(d); f = 40 + 15 * np.exp(-tt / .35)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .55)
    mallet = lp(noise(d), 700) * env_exp(d, .012) * .9 + sine(140, d, .05) * .5 + sine(95, d, .12) * .5
    tail = lp(noise(d), 900) * env_exp(d, .5) * .05
    return norm(sub + mallet + tail) * v

def shimmer(d=1.6, v=1.0):  # 光扫：带通噪声 3→9 kHz + 高次泛音
    x = whoosh(d, 3000, 9500, 1, True) * .7
    for m, a in [(93, .25), (100, .18), (105, .12)]:
        x += np.sin(2 * np.pi * hz(m) * t_(d)) * np.sin(np.pi * t_(d) / d) ** 2 * a * (1 + .3 * np.sin(2 * np.pi * 5 * t_(d)))
    return norm(x) * v

def grains(d=1.0, v=1.0):   # 乱码颗粒：越来越密的短点击
    out = np.zeros(int(d * SR)); t = 0.0
    while t < d - .01:
        c = bp(noise(.006), 2500, 9000) * env_exp(.006, .001) * rng.uniform(.4, 1)
        s = int(t * SR); out[s:s + len(c)] += c[:len(out) - s]; t += .045 * (1 - .8 * t / d) + rng.uniform(0, .01)
    return norm(out) * v

def crt_off(v=1.0):         # 窗口压成线：低"呼"收成一点 + 下滑正弦
    d = .5; tt = t_(d); f = 900 * np.exp(-tt / .12) + 120
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .15) * .5 + whoosh(d, 3000, 300, 1, True) * .6) * v

# ─────────── 环境底 ───────────
def ramp(a, b, fi=.3, fo=.3):
    e = np.zeros(N); s, e2 = int(a * SR), int(b * SR); e[s:e2] = 1
    k = int(fi * SR); e[s:s + k] *= np.linspace(0, 1, k)
    k = int(fo * SR); e[max(s, e2 - k):e2] *= np.linspace(1, 0, min(k, e2 - s))
    return e
room = lp(brown(DUR), 220) * .010
tt = np.arange(N) / SR
fan = bp(noise(DUR), 280, 1600) * .036
fanE = np.clip((tt - 9.4) / 5.4, 0, 1) ** 1.6                      # 旁白 3 结束后才起来
coil = np.sin(2 * np.pi * (6800 + 30 * np.sin(2 * np.pi * .7 * tt)) * tt) * .0045 * np.clip((tt - 10.0) / 5, 0, 1) ** 2
air = lp(noise(DUR), 700) * .0035
roomE = ramp(0, 15.0, .4, .005) + ramp(34.0, DUR, .2, 1.0)
cleanE = ramp(16.0, 33.0, .15, .4)
mono = room * roomE + (fan * .55 + coil) * fanE * (tt < 15.0) + air * cleanE + room * .1 * ramp(33.0, 34.0, .05, .05)
amb[:, 0] += mono; amb[:, 1] += np.roll(mono, 37)
# J-cut：3.25 起远处模糊的通知群
for k in range(26):
    t0 = 3.25 + (k / 26) ** .8 * .75 + rng.uniform(0, .03)
    add(fol, lp(glass(hz(rng.choice(A_MAJ)) * 2 ** (rng.uniform(-.4, .4) / 12), 1, .35), 1800), t0, .02 + .05 * k / 26, rng.uniform(-.8, .8))

# ─────────── 事件 ───────────
ding_m = [88, 85, 81]            # E6 C#6 A5
for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'caret_tick': add(fol, caret_tick(), t, .09 if t < 30 else .12)
    elif ty == 'key': add(fol, key(), t, .16 if e.get('echo') else .14, -.1)
    elif ty == 'return': add(fol, key(heavy=True), t, .2)
    elif ty == 'ding': add(fol, glass(hz(ding_m[e['i']]), 1, .7), t, .26, .35)
    elif ty == 'spawn_file': add(fol, plop(), t, .05 + .02 * (t > 12), e['pan'] * .8)
    elif ty == 'spawn_photo': add(fol, flick(), t, .06, e['pan'] * .8)
    elif ty == 'spawn_notif':
        det = rng.uniform(-.45, .45); f = hz(rng.choice(A_MAJ[:7])) * 2 ** (det / 12)   # 散：音分乱
        add(fol, pop(1, f), t, .035 if not e['fg'] else .08, e['pan'] * .9)
        if e['fg']: add(fol, whoosh(.35, 300, 2500, 1), t - .1, .1, e['pan'])
    elif ty == 'spawn_window': add(fol, whoosh(.16 + .08 * e['big'], 900 / (.6 + e['big']), 5000, 1, True), t - .05, .09, e['pan'] * .7)
    elif ty == 'insert':
        add(fol, glitch(), t, .22)
        if e['i'] == 2: add(fol, buzz_low(), t + .05, .2)
    elif ty == 'insert_back': add(fol, whoosh(.2, 3000, 600, 1, True), t - .05, .14)
    elif ty == 'press':
        add(fol, doom(), t, .85)
        add(fol, key(heavy=True), t, .35)
        add(fol, whoosh(.7, 200, 6000, 1, True), t, .18)
    elif ty == 'lift':
        pass
    elif ty == 'land':
        m = A_MAJ[(e['k'] // 3 + 2 * e['g']) % len(A_MAJ)] + 12      # 调内玻璃"嗒"，按格子位置排音高
        add(fol, glass(hz(m), 1, .16, .6), t, .026, e['pan'] * .8)
    elif ty == 'grid': add(fol, glass(hz(105), 1, .5, 1.2), t, .12); add(fol, caret_tick(), t, .2)
    elif ty == 'sort_wave': add(fol, felt(1, 300 + 40 * e['w']), t, .14); add(fol, whoosh(.18, 1500, 5000, 1), t, .04)
    elif ty == 'chrome': add(fol, whoosh(.45, 400, 3000, 1, True), t, .08)
    elif ty == 'caret_logo': add(fol, caret_tick(), t, .14)
    elif ty == 'dim': add(fol, whoosh(.5, 2000, 200, 1, True), t, .05)
    elif ty == 'sweep': add(fol, shimmer(1.9), t - .4, .12)          # J-cut：先于光带 0.4 s
    elif ty == 'check': add(fol, felt(1, 420), t, .12); add(fol, glass(hz([85, 88, 93][e['i']]), 1, .25), t, .05)
    elif ty == 'push': add(fol, whoosh(1.0, 300, 7000, 1, True), t, .12)
    elif ty == 'num': add(fol, thump(1, 70, .4), t, .25); add(fol, grains(.98), t + .02, .07)
    elif ty == 'lock': add(fol, felt(1, 360 + 30 * e['i']), t, .16)
    elif ty == 'files': add(fol, thump(1, 90, .25), t, .12)
    elif ty == 'line2': add(fol, whoosh(.3, 800, 4000, 1), t - .05, .07)
    elif ty == 'num_back': add(fol, whoosh(.5, 5000, 400, 1, True), t, .1)
    elif ty == 'retract': add(fol, felt(1, 300), t, .1) if e['i'] < 4 else add(fol, shimmer(.5), t, .05)
    elif ty == 'to_caret': add(fol, crt_off(), t, .22)
    elif ty == 'to_caret2': add(fol, caret_tick(), t + .26, .1)
    elif ty == 'caret_off': add(fol, caret_tick(), t, .06)
# 14–15 越压越重的低频"咚"（八分音符）
for k in range(8): add(fol, thump(1, 58 + 4 * k, .3), 14 + k * .125, .05 + .02 * k)
# 结尾的光标"嗒"（34.0 已在事件里；40.0 / 41.0 由事件 caret_tick 给出）

# ─────────── 人声 ───────────
lines = json.load(open(os.path.join(D, 'lines.json')))
vo_int = []
for L in lines:
    t0 = K['vo'][L['id']]
    y, sr = sf.read(os.path.join(D, 'voices', L['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = resample_poly(y, SR, sr); y = compress(y / (np.abs(y).max() + 1e-9) * .9, .3, 3.0)
    add(vox, y, t0, .55)
    vo_int.append((t0, t0 + len(y) / SR))

# ─────────── 配乐 + 闪避 ───────────
mus = np.zeros((N, 2))
mp = os.path.join(D, 'music', 'score.wav')
if os.path.exists(mp):
    m, msr = sf.read(mp, always_2d=True)
    if msr != SR: m = resample_poly(m, SR, msr, axis=0)
    mus[:min(N, len(m))] = m[:N]
duck = np.ones(N); duckF = np.ones(N)
for a, b in vo_int:
    s, e = int((a - .08) * SR), int((b + .12) * SR); duck[s:e] = 10 ** (-8 / 20); duckF[s:e] = 10 ** (-4 / 20)
duck = uniform_filter1d(duck, int(.12 * SR)); duckF = uniform_filter1d(duckF, int(.12 * SR))
MUSIC_G = 0.62
# 上升段最后压一点，让静音之后的"咚"成为全片最重的一下
rise = 1 - 0.5 * np.clip((tt - 14.0) / 0.6, 0, 1) * (tt < 15.0)
mix = mus * MUSIC_G * (duck * rise)[:, None] + fol * (duckF * (1 - 0.2 * (rise < 1)))[:, None] + amb + vox
# 两处静音：15.000–16.000 数字静音；33.000–34.000 只剩 −60 dB 底噪
mix[int(15.0 * SR):int(16.0 * SR)] = 0
s2, e2 = int(33.0 * SR), int(34.0 * SR); mix[s2:e2] = 0; mix[s2:e2, 0] += room[s2:e2] * .1; mix[s2:e2, 1] += room[s2:e2] * .1
# 结尾淡出
f = int(.6 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
mix[int(15.0 * SR):int(16.0 * SR)] = 0
sf.write(os.path.join(D, 'mix.wav'), mix.astype(np.float32), SR)
if '--stems' in sys.argv:
    for nm, x in [('music', mus * MUSIC_G * duck[:, None]), ('foley', fol * duckF[:, None]), ('amb', amb), ('vox', vox)]: sf.write(os.path.join(D, 'out', f'stem_{nm}.wav'), x.astype(np.float32), SR)
print('mix.wav', mix.shape, 'peak %.3f' % np.abs(mix).max(), 'vo', [(round(a, 2), round(b, 2)) for a, b in vo_int])
