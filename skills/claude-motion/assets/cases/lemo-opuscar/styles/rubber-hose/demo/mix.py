"""mix.py — 拟音（按材质合成）+ 电台腔旁白 + 配乐闪避 + 1930s 光学声轨老化 → mix.wav
运行：.venv/bin/python styles/rubber-hose/demo/mix.py（先 node core/render/events.mjs 导出 events.json）"""
import os, sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly, butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, os.path.join(ROOT, 'core/audio'))
import sfx as X
from sfx import SR, t_, env_exp, bp, lp, hp, norm, add

R = np.random.default_rng(1930)
def nz(d): return R.standard_normal(len(t_(d)))
ev = json.load(open(os.path.join(HERE, 'events.json'))); DUR = ev['dur']; E = ev['ev']
N = int(round(DUR * SR))
FX = np.zeros((N, 2)); VOX = np.zeros((N, 2)); BED = np.zeros((N, 2))

# ———————————————————— 拟音配方 ————————————————————
def sine_sweep(f0, f1, d, curve=1.0):
    tt = t_(d); f = f0 + (f1 - f0) * (tt / d) ** curve; return np.sin(2 * np.pi * np.cumsum(f) / SR)
def partials(fs, d, taus, amps=None):
    tt = t_(d); amps = amps or [1] * len(fs)
    return sum(a * np.sin(2 * np.pi * f * tt + R.random() * 6) * np.exp(-tt / tau) for f, tau, a in zip(fs, taus, amps))
def porcelain(p=1.0, d=.25):   # 瓷器：高而硬的非谐分音 + 极短瞬态
    x = partials([2750 * p, 4180 * p, 6320 * p, 1650 * p], d, [.07, .05, .03, .09], [1, .7, .4, .5]); x += hp(nz(d), 3000) * env_exp(d, .002) * .6
    return norm(x)
def ceramic_low(p=1.0, d=.3):   # 厚陶瓷马克杯：低一些、闷一些
    x = partials([880 * p, 1690 * p, 2480 * p, 330 * p], d, [.05, .035, .025, .06], [1, .6, .35, .6]); x += lp(nz(d), 1200) * env_exp(d, .01) * .5
    return norm(x)
def woodblock(f=2400, d=.09):
    tt = t_(d); x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / .018) + .5 * np.sin(2 * np.pi * f * 1.52 * tt) * np.exp(-tt / .01)
    return norm(x + hp(nz(d), 2000) * env_exp(d, .0015) * .4)
def sugar_crunch(d=.05): return norm(hp(nz(d), 4500) * env_exp(d, .008) * (R.random(len(t_(d))) > .6))
def slide_whistle(f0, f1, d, vib=0):
    tt = t_(d); f = f0 * (f1 / f0) ** (tt / d) * (1 + vib * np.sin(2 * np.pi * 6 * tt)); x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x = x + .15 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR); e = np.minimum(1, tt / .03) * np.minimum(1, (d - tt) / .06)
    return norm(x * e + bp(nz(d), 1500, 5000) * .03 * e)
def boing(f=210, d=.6, depth=.35):
    tt = t_(d); f_ = f * (1 + depth * np.sin(2 * np.pi * 13 * tt) * np.exp(-tt * 4)); ph = 2 * np.pi * np.cumsum(f_) / SR
    return norm((np.sin(ph) + .4 * np.sin(2 * ph) + .2 * np.sin(3 * ph)) * np.exp(-tt * 4.5))
def bell_ring(d):   # 闹钟铃：小锤 18 次/秒敲两只铃
    out = np.zeros(len(t_(d) ) + int(.3 * SR))
    for k in range(int(d * 18)):
        s = int(k / 18 * SR); b = partials([2100 + (k % 2) * 180, 3350, 5200, 7100], .3, [.06, .04, .025, .015], [1, .7, .5, .3]); out[s:s + len(b)] += b
    return norm(out)
def water_splash(d=.5, big=1.0):
    x = lp(nz(d), 3500) * env_exp(d, .07 * big) * 1.0
    for _ in range(int(8 * big)):
        s = int(R.random() * d * .7 * SR); bd = .05 + R.random() * .05; b = sine_sweep(300 + R.random() * 500, 900 + R.random() * 900, bd) * env_exp(bd, .02); x[s:s + len(b)] += b[:len(x) - s] * .5
    return norm(x)
def bubble_bed(d):
    x = lp(nz(d), 300) * .25; tt = t_(d)
    for _ in range(int(d * 22)):
        s = int(R.random() * (d - .1) * SR); bd = .04 + R.random() * .06; b = sine_sweep(200 + R.random() * 400, 600 + R.random() * 700, bd) * env_exp(bd, .015); x[s:s + len(b)] += b * (.3 + .7 * s / len(x))
    return norm(x * np.minimum(1, tt / .2))
def rubber_creak(d, f0=90, f1=260):
    tt = t_(d); f = f0 * (f1 / f0) ** (tt / d); saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return norm(bp(saw, 300, 2500) * (.6 + .4 * np.abs(np.sin(2 * np.pi * 17 * tt))) * np.sin(np.pi * tt / d) ** .5)
def china_crash(d=.9, n=16):
    out = np.zeros(int(d * SR) + int(.3 * SR))
    for k in range(n):
        s = int((k / n) ** 1.3 * d * .8 * SR); c = porcelain(.8 + R.random() * .6, .25) * (.4 + R.random() * .6); out[s:s + len(c)] += c
    out[:int(.2 * SR)] += lp(nz(.2), 900) * env_exp(.2, .05) * .8
    return norm(out)
def whoosh(d=.35): return X.whoosh(d)
def zip_up(d=.16, f0=400, f1=2200): return norm(sine_sweep(f0, f1, d, 1.5) * np.sin(np.pi * t_(d) / d) + bp(nz(d), 1500, 6000) * .3 * np.sin(np.pi * t_(d) / d))
def smack(): d = .03; return norm(bp(nz(d), 900, 3200) * env_exp(d, .004))
def ratchet(d):
    out = np.zeros(int(d * SR) + 2000); n = 14
    for k in range(n): s = int((1 - (1 - k / n) ** 1.6) * d * SR); c = woodblock(3200, .03) * .6; out[s:s + len(c)] += c
    return norm(out)

def seq(clips, total):   # [(t, clip)] 放进定长缓冲
    out = np.zeros(int(total * SR))
    for t0, c in clips:
        s0 = int(t0 * SR); n = max(0, min(len(c), len(out) - s0)); out[s0:s0 + n] += c[:n]
    return norm(out)
RECIPES = {
    'shade': lambda e: (ratchet(e['d']) * .5, .45),
    'bell': lambda e: (bell_ring(e['d']), .55),
    'jolt': lambda e: (zip_up(.14, 500, 1600), .4),
    'yawn': lambda e: (slide_whistle(620, 330, e['d'], .02) * .6, .35),
    'plip': lambda e: (sine_sweep(1100, 1900, .05) * env_exp(.05, .015), .35),
    'slurp': lambda e: (norm(sum(bp(nz(.35), f * .8, f * 1.25) * np.sin(np.pi * t_(.35) / .35) for f in [500, 900, 1500])) * (.6 + .4 * np.sin(2 * np.pi * 26 * t_(.35))), .35),
    'rattle': lambda e: (seq([(k * .025, ceramic_low(1.3, .06)) for k in range(14)], .45), .3),
    'lidup': lambda e: (porcelain(.9, .2), .3),
    'lidclank': lambda e: (seq([(0, porcelain(.85, .3)), (.07, porcelain(.9, .25))], .4), .45),
    'windup': lambda e: (seq([(0, ratchet(e['d'])), (0, slide_whistle(250, 900, e['d']) * .5)], e['d'] + .05), .4),
    'zip': lambda e: (zip_up(), .5),
    'stepCube': lambda e: (seq([(0, woodblock(2600, .07)), (0, sugar_crunch() * .5)], .08), .22),
    'stepMug': lambda e: (seq([(0, woodblock(760, .12)), (0, ceramic_low(1, .12) * .4)], .13), .28),
    'twirl': lambda e: (slide_whistle(1100, 1250, e['d'], .22), .25),
    'zipIn': lambda e: (seq([(0, zip_up(.18, 2200, 400)), (.15, X.thump(.6, 120))], .4), .45),
    'skid': lambda e: (norm(np.sin(2 * np.pi * np.cumsum(1700 + 200 * R.standard_normal(len(t_(e['d'])))) / SR) * np.sin(np.pi * t_(e['d']) / e['d']) + bp(nz(e['d']), 2000, 6000) * .4), .3),
    'click': lambda e: (seq([(0, hp(nz(.02), 3000) * env_exp(.02, .002)), (0, partials([1800, 3100], .06, [.01, .006]))], .07), .45),
    'tick': lambda e: (seq([(0, partials([3200, 5100], .04, [.006, .004])), (0, hp(nz(.01), 4000) * env_exp(.01, .001))], .05), .3),
    'toastDing': lambda e: (partials([1568, 3136, 4700, 2350], 1.4, [.5, .25, .12, .3], [1, .4, .2, .3]), .55),
    'spring': lambda e: (boing(170, .7, .45), .55),
    'fwoosh': lambda e: (norm(lp(nz(.5), 1500) * np.sin(np.pi * t_(.5) / .5) ** .5), .35),
    'blink': lambda e: (norm(partials([3600], .03, [.006])), .18),
    'whistleDown': lambda e: (slide_whistle(2100, 700, e['d']), .35),
    'clinkSmall': lambda e: (porcelain(1 + e.get('i', 0) * .06, .18), .2),
    'clonk': lambda e: (ceramic_low(1 + e.get('i', 0) * .03, .3), .32),
    'grab': lambda e: (norm(sine_sweep(1400, 2300, .09) * np.abs(np.sin(2 * np.pi * 40 * t_(.09)))), .25),
    'stretchUp': lambda e: (rubber_creak(.3, 120, 300), .3),
    'whoosh': lambda e: (whoosh(.3), .4),
    'slideScrape': lambda e: (norm(bp(nz(e['d']), 2500, 5000) * (.6 + .4 * np.sin(2 * np.pi * 30 * t_(e['d'])))), .2),
    'chinaCrash': lambda e: (china_crash(1.0, 20), .6),
    'splash': lambda e: (water_splash(.6, 1.2), .55),
    'gurgle': lambda e: (bubble_bed(e['d']), .3),
    'plateBreak': lambda e: (china_crash(.5, 9), .5),
    'shiver': lambda e: (seq([(k * .03, ceramic_low(1.4, .05)) for k in range(int(e['d'] / .03))], e['d'] + .06), .22),
    'rubber': lambda e: (rubber_creak(e['d'], 80, 320), .22),
    'drainSlurp': lambda e: (norm(sum(bp(nz(.6), f * .7, f * 1.3) * np.sin(np.pi * t_(.6) / .6) for f in [300, 600]) * np.linspace(1.4, .4, len(t_(.6)))), .5),
    'creak': lambda e: (rubber_creak(.2, 150, 110), .25),
    'zipBack': lambda e: (zip_up(.2, 300, 2400), .5),
    'cork': lambda e: (X.pop(), .45),
    'drips': lambda e: (seq([(k * .16, sine_sweep(1200, 1900, .05) * env_exp(.05, .015)) for k in range(3)], .5), .3),
    'tap': lambda e: (ceramic_low(1.4, .15), .3),
    'pat': lambda e: (norm(lp(nz(.06), 900) * env_exp(.06, .012)), .3),
    'shuffle': lambda e: (norm(bp(nz(.25), 800, 3000) * np.sin(np.pi * t_(.25) / .25)), .15),
    'stepSoft': lambda e: (seq([(0, woodblock(640, .1) * .7), (0, ceramic_low(.9, .1) * .3)], .11), .16),
    'sigh': lambda e: (norm(bp(nz(.8), 500, 1800) * np.sin(np.pi * t_(.8) / .8) ** 1.5 * np.linspace(1, .5, len(t_(.8)))), .25),
    'hopSmall': lambda e: (boing(420, .25, .3), .3),
    'plop': lambda e: (norm(sine_sweep(380, 1500, .07) * env_exp(.07, .03)), .5),
    'smack': lambda e: (smack(), .3),
    'bloop': lambda e: (norm(sine_sweep(300, 950, .09) * np.sin(np.pi * t_(.09) / .09)), .35),
    'popLight': lambda e: (boing(300, .2, .25), .12),
    'irisThunk': lambda e: (seq([(0, X.thump(1, 90)), (0, bp(nz(.2), 400, 2000) * env_exp(.2, .05) * .5)], .3), .45),
}
for e in E:
    ty = e['type']
    if ty in ('vo', 'projector'): continue
    if ty == 'boing': continue          # 7.3 的"啵嘤"已在配乐 drums_fx 里，不叠两层
    x, g = RECIPES[ty](e)
    pan = {'stepCube': .15, 'stepMug': -.15, 'clinkSmall': .1, 'clonk': -.1}.get(ty, 0)
    add(FX, np.asarray(x, dtype=np.float64), e['t'], g, pan)
# 扑通：额外叠一层水花
for e in E:
    if e['type'] == 'plop': add(FX, water_splash(.45, .9), e['t'] + .02, .4)

# ———————————————————— 旁白：电台话筒链 ————————————————————
lines = {L['id']: L for L in json.load(open(os.path.join(HERE, 'lines.json')))}
def room_ir(d=.28):
    tt = t_(d); ir = R.standard_normal(len(tt)) * np.exp(-tt / .06); ir[0] = 1; return ir / np.abs(ir).sum() * 6
IR = room_ir()
vo_mask = np.zeros(N)
for e in E:
    if e['type'] != 'vo': continue
    y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = resample_poly(y, SR, sr)
    y = hp(y, 260, 3); y = lp(y, 4600, 3)
    y = np.tanh(y / (np.abs(y).max() + 1e-9) * 2.2) / np.tanh(2.2)
    y = y + np.convolve(y, IR)[:len(y)] * .12
    y = X.compress(norm(y), .3, 3.0)
    add(VOX, norm(y), e['t'], 1.1)
    s = int(e['t'] * SR); vo_mask[max(0, s - 2400): s + len(y) + 4800] = 1

# ———————————————————— 配乐 + 闪避 ————————————————————
mus, msr = sf.read(os.path.join(HERE, 'music', 'score.wav'))
if mus.ndim == 1: mus = np.stack([mus, mus], 1)
mus = mus[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
from scipy.ndimage import uniform_filter1d
duck = uniform_filter1d(vo_mask, int(.12 * SR))
mus = mus * (1 - .62 * duck)[:, None]

# ———————————————————— 1930s 光学声轨：带宽、饱和、抖晃、爆豆、底噪 ————————————————————
def optical(x):
    y = np.stack([hp(lp(x[:, c], 6200, 2), 110, 2) for c in range(2)], 1)
    # 抖晃：0.6 Hz + 7 Hz 的微小时基变化
    tt = np.arange(N) / SR; dl = (.00035 * np.sin(2 * np.pi * .6 * tt) + .00008 * np.sin(2 * np.pi * 7 * tt)) * SR
    idx = np.clip(np.arange(N) - 40 + dl, 0, N - 1); i0 = idx.astype(int); fr = idx - i0; i1 = np.minimum(i0 + 1, N - 1)
    y = y[i0] * (1 - fr)[:, None] + y[i1] * fr[:, None]
    y = np.tanh(y * 1.4) / np.tanh(1.4)
    return y
bus = optical(mus * 1.0 + FX * .9)
# 胶片底噪 + 爆豆（整片都有，静音那一拍它和放映机就是全部声音）
hiss = bp(R.standard_normal(N), 800, 6000) * .0035
crk = np.zeros(N); pos = R.random(int(DUR * 9)) * (N - 200)
for p in pos.astype(int): L_ = R.integers(8, 60); crk[p:p + L_] += R.standard_normal(L_) * np.exp(-np.arange(L_) / 10) * (.02 + R.random() * .05)
crk = hp(crk, 900)
proj = np.zeros(N); per = SR / 24
for k in range(int(DUR * 24)): s = int(k * per); c = hp(R.standard_normal(200), 1500) * np.exp(-np.arange(200) / 30); proj[s:s + 200] += c[:max(0, min(200, N - s))] * .012
proj += np.sin(2 * np.pi * 50 * np.arange(N) / SR) * .002 + lp(R.standard_normal(N), 180) * .006
BED[:, 0] = hiss + crk + proj; BED[:, 1] = hiss * .9 + crk + proj * .95
mix = bus + VOX + BED
for c in range(2): mix[:, c] = X.limit(mix[:, c], .95)
mix = mix / np.abs(mix).max() * .89
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
# 电平自检：旁白段 vs 非旁白段
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
m = vo_mask > 0
print('mix.wav', DUR, 's  | VO RMS', round(db(VOX[m]), 1), 'dB  music-under-VO', round(db(bus[m]), 1), 'dB  music-alone', round(db(bus[~m]), 1), 'dB  FX', round(db(FX), 1), 'dB')
