"""混音：全部"录在带子上"的声音 → mix.wav（48 kHz 立体声）
日光灯嗡鸣 / 镇流器 / 带子底噪 / 脚步 / 呼吸 / 衣服摩擦 / 广播（叮咚 + af_bella 过天花板喇叭）/ 摄像者小声说话
/ 画内电梯音乐（带速越来越慢）/ 低频底噪 / 摄像机机械声 / 灯闪 / 头顶掠过 / 跟踪撕裂 / 屏息 1 秒 / 门
时间全部来自 events.json（页面 window.EV 导出），与画面同源。
另输出 voices_fx/<id>.wav（处理后的人声，给 whisper 复检）。"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt, lfilter
from scipy.ndimage import uniform_filter1d, maximum_filter1d
from core.audio.sfx import SR, bp, lp, hp, add, limit, compress
from core.audio import sampler as S

rng = np.random.default_rng(41)
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']; N = int(DUR * SR) + SR
LINES = json.load(open(os.path.join(HERE, 'lines.json')))
ev = lambda ty: [e for e in EV if e['type'] == ty]
one = lambda ty: ev(ty)[0]
tt = np.arange(N) / SR
def nz(n): return rng.standard_normal(n)
def sec(d): return int(round(d * SR))
def env_ar(n, a, r):   # 线性起、指数落
    x = np.ones(n); na = min(n, sec(a)); x[:na] = np.linspace(0, 1, na)
    nr = min(n, sec(r)); x[n - nr:] *= np.exp(-np.linspace(0, 5, nr)); return x
def fade(n, fi=.01, fo=.01):
    x = np.ones(n); a, b = min(n, sec(fi)), min(n, sec(fo)); x[:a] = np.linspace(0, 1, a); x[n - b:] *= np.linspace(1, 0, b); return x
def bus(): return np.zeros((N, 2))
def put(b, x, t, g=1., pan=0.):
    if x.ndim == 2:
        i = sec(t); j = min(N, i + len(x));
        if i < N and j > i: b[i:j] += x[:j - i] * g
    else: add(b, x.astype(np.float64), t, g, pan)

TREC0 = one('recOn')['t'] + .25; TOFF = one('recOff')['t']; TEND = one('end')['t']
TEAR = one('tear'); HUSH = one('hush'); DOOR = one('door'); OVER = one('overhead')
FL = [e['t'] + .03 for e in ev('flick')]           # 灯闪时刻（与画面 gLight 同一公式）
def glight(t):
    g = np.ones_like(t)
    for i, f in enumerate(FL):
        off = (t > f - .03) & (t < f + .1 + i * .02); g[off] = .025
        rec = (t >= f + .1 + i * .02) & (t < f + .2); g[rec] = np.minimum(g[rec], .55 + .45 * np.clip((t[rec] - f - .1) / .1, 0, 1))
    return g
G = glight(tt)
alive = ((tt > TREC0) & (tt < TOFF)).astype(float)          # 摄像机在录
hush = ((tt >= HUSH['t']) & (tt < HUSH['t'] + HUSH['d']))

# ———————— 人声 ————————
def load_voice(i):
    y, sr = sf.read(os.path.join(HERE, 'voices', i + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    return librosa.resample(y, orig_sr=sr, target_sr=SR)
def tapewow(x, depth, rate=.55, flutter=.0015):
    n = len(x); t = np.arange(n) / SR
    sp = 1 + depth * np.sin(2 * np.pi * rate * t) + flutter * np.sin(2 * np.pi * 7.3 * t)
    pos = np.cumsum(sp); pos = pos - pos[0]
    return np.interp(np.clip(pos, 0, n - 1), np.arange(n), x)
def speaker(x, far=.5, wow=0.):
    """天花板喇叭：带通 + 纸盆共振 + 轻失真 + 大空间混响（far 越大越远越湿）"""
    y = bp(x, 300 + 80 * far, 3900 - 1200 * far, 2)
    y = y + .5 * bp(y, 1000, 1600, 2)
    y = np.tanh(2.2 * y / (np.abs(y).max() + 1e-9)) / np.tanh(2.2)
    if wow: y = tapewow(y, wow)
    st = np.stack([y, y], 1)
    wet = S.room(np.pad(st, ((0, sec(2.5)), (0, 0))).astype(np.float32), size=.55 + .3 * far, mix=1.0, damp=.6)
    dry = np.pad(st, ((0, sec(2.5)), (0, 0)))
    return dry * (1 - .4 * far) + wet * (.18 + .5 * far)
def murmur(x):
    """摄像者小声说话：压低电平 + 近讲低频 + 一层跟着人声包络的气流声 + 压缩"""
    x = x / (np.abs(x).max() + 1e-9)
    envl = uniform_filter1d(np.abs(x), sec(.03))
    air = bp(nz(len(x)), 1400, 6000, 2) * envl * .9
    y = x * .8 + lp(x, 260) * .9 + air * .35
    y = hp(y, 70)
    y = compress(y / (np.abs(y).max() + 1e-9), .25, 3.0)
    return y / (np.abs(y).max() + 1e-9)

os.makedirs(os.path.join(HERE, 'voices_fx'), exist_ok=True)
vo, pa = bus(), bus()
voice_act = np.zeros(N)
for e in ev('line'):
    i, t = e['id'], e['t']; x = load_voice(i)
    if e['who'] == 'PA':
        far = {'p0': .45, 'p1': .4, 'p2': .38, 'p3': .38, 'p4': .35, 'p6': .12}[i]
        wow = .004 if i in ('p4', 'p6') else 0.
        y = speaker(x, far, wow)
        y = y / (np.abs(y).max() + 1e-9)
        put(pa, y, t, .62)
        sf.write(os.path.join(HERE, 'voices_fx', i + '.wav'), y[:, 0].astype(np.float32), SR)
    else:
        y = murmur(x)
        put(vo, y, t, .52, -.05)
        sf.write(os.path.join(HERE, 'voices_fx', i + '.wav'), y.astype(np.float32), SR)
    a = sec(t); voice_act[a:a + len(x)] = 1
# 叮咚：颤音琴 E5 → C5，过同一个喇叭；撕裂之后跟着带子走调
for k, e in enumerate(ev('chime')):
    det = -.55 if e['t'] > TEAR['t'] else 0.
    c = np.zeros(sec(2.2))
    for j, (p, dt) in enumerate([(76 + det, 0), (72 + det, .42)]):
        n = S.note('vibraphone', p, 1.3, vel=.6); c[sec(dt):sec(dt) + len(n)] += n[:len(c) - sec(dt)]
    far = .5 if k == 0 else .4
    sc = speaker(c, far); put(pa, sc * .42 / (np.abs(sc).max() + 1e-9), e['t'])
    voice_act[sec(e['t']):sec(e['t'] + 1.2)] = np.maximum(voice_act[sec(e['t']):sec(e['t'] + 1.2)], .6)

# ———————— 日光灯嗡鸣 + 镇流器 ————————
room = np.ones(N); tin = ev('af')[-1]['t']                       # 进到门后房间：嗡鸣更近
room += .45 * np.clip((tt - (tin - .8)) / 1.2, 0, 1)
wob = 1 + .004 * np.sin(2 * np.pi * .13 * tt) + .002 * np.sin(2 * np.pi * .71 * tt)
ph = 2 * np.pi * 120 * np.cumsum(wob) / SR
hum = sum(a * np.sin(k * ph + k * 1.3) for k, a in [(1, 1.), (2, .55), (3, .42), (4, .22), (5, .16), (7, .06)])
buzz = bp(np.sign(np.sin(ph)) * .3 + nz(N) * .05, 900, 3200, 2) * .5          # 电感的"滋"声
whine = np.sin(2 * np.pi * 9150 * tt + .3 * np.sin(2 * np.pi * .2 * tt)) * .05
hum_bed = (hum * .1 + buzz * .05 + whine * .25) * G * room
# 坏灯管的颤音：走廊里几处随机"滋滋"
for k in range(9):
    t0 = rng.uniform(4, 45); d = rng.uniform(.4, 1.2); n = sec(d)
    z = bp(nz(n), 1800, 4200, 2) * (rng.random(n // 480 + 1).repeat(480)[:n] > .5) * env_ar(n, .05, .2)
    a = sec(t0); hum_bed[a:a + n] += z * .018
hum_bed *= alive
hb = np.stack([hum_bed, np.roll(hum_bed, 37)], 1)

# ———————— 带子底噪 ————————
hiss = hp(nz(N), 3500, 2) * .006
hiss = hiss * (alive + .45 * ((tt > TOFF + .25) & (tt < DUR)) * np.clip(1 - (tt - TEND) / 3.2, 0, 1))
hs = np.stack([hiss, np.roll(hiss, 91)], 1)

# ———————— 拟音 ————————
fx = bus()
for e in ev('step'):   # 潮湿短绒地毯：闷击 + 一点湿黏
    n = sec(.2); t = np.arange(n) / SR; v = e['v'] * rng.uniform(.8, 1.1)
    th = np.sin(2 * np.pi * rng.uniform(62, 84) * t) * np.exp(-t / .045) + lp(nz(n), 320) * np.exp(-t / .05) * 1.4
    sq = bp(nz(n), 900, 2600, 2) * np.exp(-np.maximum(t - .025, 0) / .03) * (t > .02) * rng.uniform(.25, .45)
    put(fx, (th * .8 + sq) * v, e['t'], .32, rng.uniform(-.15, .15))
for e in ev('rustle'):
    d = rng.uniform(.35, .6); n = sec(d)
    x = bp(nz(n), 1500, 6500, 2) * env_ar(n, d * .3, d * .5) * (.5 + .5 * np.abs(uniform_filter1d(nz(n), 300)) * 8)
    put(fx, x * e['v'], e['t'], .07, rng.uniform(-.3, .3))
def clack(n=.08):
    k = sec(n); t = np.arange(k) / SR
    return (hp(nz(k), 1500) * np.exp(-t / .006) + np.sin(2 * np.pi * 180 * t) * np.exp(-t / .02) * .8)
def motor(d, f0, f1):
    k = sec(d); t = np.arange(k) / SR; f = np.linspace(f0, f1, k); p = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(p) + .4 * np.sin(2 * p) + .2 * np.sin(3 * p)) * env_ar(k, .05, d * .6) * .3 + bp(nz(k), 800, 3000) * .05 * env_ar(k, .05, d * .6)
r0 = one('recOn')['t']; put(fx, clack(), r0, .35); put(fx, motor(.9, 90, 230), r0 + .05, .12)
put(fx, clack(), TOFF, .45); put(fx, motor(.7, 230, 60), TOFF + .03, .14)
for e in ev('zoom'):   # 变焦伺服电机
    k = sec(e['d']); t = np.arange(k) / SR; p = 2 * np.pi * np.cumsum(1350 + 60 * np.sin(2 * np.pi * 11 * t)) / SR
    x = (np.sin(p) + .5 * np.sign(np.sin(p)) * .3) * fade(k, .06, .1) + bp(nz(k), 2000, 5000) * .15 * fade(k, .06, .1)
    put(fx, bp(x, 700, 5000), e['t'], .03)
for e in ev('af'):     # 对焦马达的细碎咔嗒
    for j in range(rng.integers(3, 6)):
        k = sec(.012); c = hp(nz(k), 3000) * np.exp(-np.arange(k) / SR / .002); put(fx, c, e['t'] + j * rng.uniform(.04, .09), .08)
for i, f in enumerate(FL):   # 灯闪：镇流器"叮" + 电弧"滋"
    for tt0, gg in [(f - .03, .5), (f + .1 + i * .02, .8)]:
        k = sec(.12); t = np.arange(k) / SR
        tink = (np.sin(2 * np.pi * 3150 * t) + .6 * np.sin(2 * np.pi * 4720 * t)) * np.exp(-t / .03)
        zz = bp(np.sign(np.sin(2 * np.pi * 120 * t)) + nz(k) * .3, 1500, 4000) * np.exp(-t / .04)
        put(fx, tink * .15 + zz * .3, tt0, .22 * gg)
# 头顶掠过：极轻的拖动声，从前到后（低通越来越暗）
k = sec(OVER['d']); t = np.arange(k) / SR; u = t / OVER['d']
sc = bp(nz(k), 140, 700) * (np.sin(np.pi * u) ** 1.5) * (.6 + .4 * np.abs(uniform_filter1d(nz(k), 1200)) * 10)
put(fx, sc, OVER['t'], .09, 0)
# 门：门闩 → 合页慢吱（粘滑摩擦脉冲过共鸣）→ 气压的呼声
put(fx, clack(.1) * .7, DOOR['t'] - .05, .3)
k = sec(DOOR['d'] + .4); t = np.arange(k) / SR
f = 5.0 + 4 * np.sin(np.pi * t / t[-1]) + rng.standard_normal(k).cumsum() * .0004
pulses = (np.diff(np.floor(np.cumsum(f * 60 / SR)), prepend=0) > 0).astype(float)
cr = sum(bp(pulses, fc * .92, fc * 1.08, 2) for fc in (420, 760, 1310)) * fade(k, .15, .3)
put(fx, cr / (np.abs(cr).max() + 1e-9), DOOR['t'], .08)
air = lp(nz(k), 400) * np.sin(np.pi * t / t[-1]) ** 2
put(fx, air, DOOR['t'] + .1, .06)

# ———————— 呼吸（近讲）————————
br = bus()
def breath(tin, d_in, d_out, g):
    n1, n2 = sec(d_in), sec(d_out)
    a = bp(nz(n1), 900, 2800, 2) * np.sin(np.linspace(0, np.pi, n1)) ** 1.5
    b = bp(nz(n2), 400, 1900, 2) * np.sin(np.linspace(0, np.pi, n2)) ** 2 * .7
    put(br, a, tin, g); put(br, b, tin + d_in + .08, g)
f1 = FL[0]; tH0, tH1 = HUSH['t'], HUSH['t'] + HUSH['d']
me_lines = [(e['t'], e['t'] + 1.6) for e in ev('line') if e['who'] == 'ME']
t = 1.2
while t < TOFF - .5:
    if t < f1: per, g = 3.8, .018
    elif t < f1 + 4.5: per, g = 1.7, .04
    elif t < TEAR['t']: per, g = 2.4, .03
    elif t < tH0 - .6: per, g = 2.1, .032
    elif t < tH1 + .25: t = tH1 + .35; breath(t, .15, 1.3, .045); t += 1.9; continue   # 屏住 → 一口长呼气
    else: per, g = 1.9, .034
    if not any(a - .6 < t < b for a, b in me_lines): breath(t, per * .3, per * .38, g * 1.5)
    t += per * rng.uniform(.92, 1.08)

# ———————— 画内电梯音乐：隔墙、越来越慢越低，屏息时消失 ————————
mz, msr = sf.read(os.path.join(HERE, 'music', 'muzak_raw.wav')); mz = mz.mean(1)
spd = np.interp(tt, [0, 20, TEAR['t'], TEAR['t'] + .7, tH0], [1.0, .985, .97, .905, .885])
depth = np.interp(tt, [0, 25, TEAR['t'] + .7, tH0], [.002, .004, .011, .014])
spd = spd * (1 + depth * np.sin(2 * np.pi * .47 * tt))
pos = np.cumsum(spd) + 8.0 * SR                                   # 从曲中第 8 秒开始：我们是中途听到的
m = np.interp(np.clip(pos, 0, len(mz) - 1), np.arange(len(mz)), mz)
m = bp(m, 350, 2400, 2) * np.interp(tt, [0, 1.2, 3, tH0 - .01, tH0], [0, .6, 1, 1, 0])
m = m * (G > .5) * alive
mzw = S.room(np.stack([m, m], 1).astype(np.float32), size=.8, mix=.75, damp=.7)

# ———————— 低频底噪：撕裂后升起，屏息时切断 ————————
dr_env = np.clip((tt - (TEAR['t'] - 1.5)) / (tH0 - TEAR['t'] + 1.5), 0, 1) ** 1.6 * (tt < tH0)
w = np.cumsum(nz(N)); w = hp(w - uniform_filter1d(w, SR), 18)
drone = (lp(w, 70) / (np.abs(lp(w, 70)).max() + 1e-9) * .6 + np.sin(2 * np.pi * 41 * tt) * .5 + np.sin(2 * np.pi * 43.5 * tt) * .4) * dr_env
drn = np.stack([drone, drone], 1)

# ———————— 合成 ————————
duck = 1 - .6 * np.clip(uniform_filter1d(maximum_filter1d(voice_act, sec(.3)), sec(.25)), 0, 1)   # ≈ −8 dB
D = duck[:, None]
mix = hb * .42 * D + hs * 1.0 + fx * 1.0 + br * 1.0 + mzw * .09 * D + drn * .09 * D + pa * 1.0 + vo * 1.0
# 跟踪撕裂：整条混音被切碎 + 噪声爆发
a, b = sec(TEAR['t']), sec(TEAR['t'] + TEAR['d'])
gate = np.repeat((rng.random((b - a) // 960 + 1) > .45).astype(float), 960)[:b - a]
gate = uniform_filter1d(gate, 48)
mix[a:b] *= gate[:, None]
burst = bp(nz(b - a), 300, 7000) * .12 * np.sin(np.linspace(0, np.pi, b - a)) ** .5 + bp(nz(b - a), 60, 400) * .08
mix[a:b] += np.stack([burst, np.roll(burst, 13)], 1)
# 屏息：1.00 s 数字静音（连混响尾巴一起）
a, b = sec(tH0), sec(tH1); mix[a - sec(.004):a] *= np.linspace(1, 0, sec(.004))[:, None]; mix[a:b] = 0
# 回来的第一声：所有镇流器同时重启的闷"咚"（全片唯一的声音惊吓，克制）
k = sec(.5); t = np.arange(k) / SR
thunk = np.sin(2 * np.pi * 48 * t) * np.exp(-t / .12) + lp(nz(k), 500) * np.exp(-t / .05) * .6 + bp(np.sign(np.sin(2 * np.pi * 120 * t)), 1500, 4000) * np.exp(-t / .08) * .15
put(mix, thunk, tH1, .34)
# REC 熄灭后的空白带：只剩底噪（片尾卡）
a = sec(TOFF + .25); keep = hs[a:] * 1.0; mix[a:] = keep
mix = mix[:int(DUR * SR)]
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
def db(x): return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)
print('mix peak %.3f  rms %.1f dB' % (np.abs(mix).max(), db(mix)))
for name, b_ in [('hum', hb * .55), ('hiss', hs), ('fx', fx), ('breath', br), ('muzak', mzw * .09), ('drone', drn * .09), ('pa', pa), ('vo', vo)]:
    print('  %-7s %6.1f dB' % (name, db(b_[:int(DUR * SR)])))
