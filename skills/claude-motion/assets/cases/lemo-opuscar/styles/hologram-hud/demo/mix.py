"""mix.py — 《Volt · Spec Scan》界面音 + 机械拟音 + 环境底 + 人声 + 配乐闪避 → mix.wav
材质：发光的线 = 干净的电子音（正弦 / FM，短、准、在 D 小调里）；机械部件 = 伺服、气压、油压、金属。
两处静音：near（只剩房间嗡鸣）与 true（全部归零）。旁白期间音乐和环境底侧链压 6 dB。
用法（仓库根）：.venv/bin/python styles/hologram-hud/demo/mix.py
"""
import os, sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from scipy.ndimage import uniform_filter1d
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, add, limit

W = os.environ.get('HH_WORK') or D   # 工作目录：默认 demo/，换内容时是 out/<name>/
os.makedirs(os.path.join(W, 'out'), exist_ok=True)
E = json.load(open(os.path.join(W, 'events.json'))); EV = E['ev']; DUR = E['dur']
N = int(round(DUR * SR))
rng = np.random.default_rng(52)
fol = np.zeros((N, 2)); amb = np.zeros((N, 2)); vox = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
D5, F5, A5, C6, D6, E6 = 74, 77, 81, 84, 86, 88

# ─────────── 音色 ───────────
def sine(f, d, tau=None, ph=0):
    x = np.sin(2 * np.pi * f * t_(d) + ph)
    return x * env_exp(d, tau) if tau else x

def att(x, a=.004):   # 起音去咔嗒
    n = min(len(x), int(a * SR)); x = x.copy(); x[:n] *= np.linspace(0, 1, n); return x

def blip(m, d=.09, v=1.0, fm=0.0):
    tt = t_(d); f = hz(m)
    x = np.sin(2 * np.pi * f * tt + fm * np.sin(2 * np.pi * f * 2 * tt) * env_exp(d, .02)) * env_exp(d, d * .3)
    return att(x) * v

def tick(v=1.0, f=3200):
    d = .018; return att(norm(bp(noise(d), f * .7, f * 1.5) * env_exp(d, .002) + sine(f, d, .003) * .5)) * v

def lock_hit(v=1.0):   # 锁定：低频撞 + 金属 clack + 两声高频锁定音
    d = .6; tt = t_(d)
    f = 95 * np.exp(-tt * 9) + 42
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .16)
    clk = bp(noise(.05), 1800, 7000) * env_exp(.05, .006)
    metal = sum(sine(fr, .25, .05) * a for fr, a in [(1210, .5), (2717, .3), (4430, .18)])
    x = np.zeros(int(d * SR)); x += body * 1.0
    x[:len(clk)] += clk * .7; x[:len(metal)] += metal * .45
    b1 = blip(D6 + 12, .06, .35); b2 = blip(A5 + 12, .08, .3)
    s = int(.07 * SR); x[s:s + len(b1)] += b1; s = int(.13 * SR); x[s:s + len(b2)] += b2
    return att(norm(x)) * v

def confirm(v=1.0):   # 琥珀确认：D 小调三音叠置（D6 A6 E7 的柔和正弦 + 微颤）
    d = 1.1; tt = t_(d); x = np.zeros(len(tt))
    for m, a, dl in [(D6, 1, 0), (D6 + 7, .7, .03), (E6 + 12, .45, .06)]:
        s = int(dl * SR); seg = np.sin(2 * np.pi * hz(m) * tt[:len(tt) - s] * (1 + .002 * np.sin(2 * np.pi * 5 * tt[:len(tt) - s]))) * env_exp(d - dl, .28)
        x[s:] += seg * a
    return att(norm(x), .01) * v

def roll(d, v=1.0):   # 数字滚动：24 fps 计数器咔哒，音高交替
    n = max(1, int(d * 24)); x = np.zeros(int((d + .05) * SR))
    for i in range(n):
        s = int(i / 24 * SR); tk = tick(1.0, 2600 + 900 * (i % 3)); x[s:s + len(tk)] += tk * (0.6 + 0.4 * (i / n))
    return x * v

def zip_(up=True, d=.14, v=1.0):
    tt = t_(d); f0, f1 = (700, 2600) if up else (2600, 700)
    f = f0 * (f1 / f0) ** (tt / d); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d)
    return att(x) * v

def whoosh(d=.5, lo=300, hi=3500, v=1.0, updown=False):
    n = noise(d); out = np.zeros_like(n); L = len(n); step = 480
    for i in range(0, L, step):
        u = i / L; u = (1 - abs(2 * u - 1)) if updown else u; fc = lo * (hi / lo) ** u
        w = min(step, L - i); seg = bp(n[max(0, i - 1500):i + w], fc * .7, min(fc * 1.4, SR / 2 - 100))[-w:]; out[i:i + w] = seg
    return norm(out * np.sin(np.pi * t_(d) / d) ** 1.5) * v

def servo(d, f0=180, f1=420, v=1.0):   # 伺服滑轨
    tt = t_(d); f = f0 + (f1 - f0) * tt / d
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    x = lp(saw, 1400) * .6 + bp(noise(d), 900, 2400) * .25
    return att(x * np.sin(np.pi * tt / d) ** .5) * v

def hiss(d=.7, v=1.0):   # 油压嘶
    x = bp(noise(d), 2200, 7500) * (1 - np.exp(-t_(d) / .02)) * env_exp(d, d * .35)
    return att(norm(x)) * v

def pneu(v=1.0):     # 气压"噗"
    d = .25; return att(norm(lp(noise(d), 900) * env_exp(d, .05) + sine(110, d, .04) * .4)) * v

def tink(v=1.0):
    d = .5; return att(norm(sum(sine(f, d, d * .2) * a for f, a in [(2380, 1), (3910, .6), (6120, .35)]))) * v

def whine(d, f0=1800, f1=3400, v=1.0):   # 电机电磁啸叫（J-cut 先进）
    tt = t_(d); f = f0 + (f1 - f0) * np.clip(tt / (d * .6), 0, 1)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * tt)) + np.sin(2 * np.pi * np.cumsum(f / 6) / SR) * .5
    e = np.clip(tt / .4, 0, 1) * np.clip((d - tt) / .6, 0, 1)
    return x * e * v

def powerdown(d=.5, v=1.0):
    tt = t_(d); f = 900 * (80 / 900) ** (tt / d)
    return att(np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - tt / d) ** 1.5 + lp(noise(d), 600) * (1 - tt / d) * .2) * v

def ignite(v=1.0):   # 点亮：低频"嗡"起 + 亮噪声膨胀
    d = 2.5; tt = t_(d)
    sub = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-tt * 1.5) + 36) / SR) * env_exp(d, .7)
    air = hp(noise(d), 4000) * env_exp(d, .5) * .35
    pad = sum(np.sin(2 * np.pi * hz(m) * tt) for m in [D5 - 12, A5 - 12, D5]) * env_exp(d, .9) * .15
    return att(norm(sub + air + pad), .002) * v

def glitch(d=.13, v=1.0):   # 数码爆裂：降采样噪声块
    x = np.zeros(int(d * SR)); pos = 0
    while pos < len(x):
        L = int(rng.uniform(.008, .03) * SR); hold = int(rng.integers(8, 60))
        blk = np.repeat(rng.uniform(-1, 1, L // hold + 1), hold)[:L] * rng.uniform(.3, 1)
        x[pos:pos + L] = blk[:len(x) - pos]; pos += L + int(rng.uniform(0, .006) * SR)
    return hp(x, 200) * v

def shimmer(d=1.2, v=1.0, up=True):
    tt = t_(d); x = np.zeros(len(tt))
    for k, m in enumerate([D6, F5 + 12, A5 + 12, C6 + 12, E6 + 12]):
        c = (k + 1) / 6; e = np.exp(-((tt / d - (c if up else 1 - c)) ** 2) / .01)
        x += np.sin(2 * np.pi * hz(m) * tt) * e
    return x * v

def ping(v=1.0, m=A5 + 12):
    d = .6; return att(sine(hz(m), d, .15) + sine(hz(m) * 2.01, d, .05) * .2) * v

def iris(opening=True, v=1.0):
    d = .3; x = bp(noise(d), 3000, 9000) * env_exp(d, .05) * .5
    z = zip_(opening, .25) * .5; x[:len(z)] += z
    return att(x) * v

# ─────────── 环境底 ───────────
tt = np.arange(N) / SR
hum = (np.sin(2 * np.pi * 40 * tt) * .5 + np.sin(2 * np.pi * 80 * tt) * .3 + np.sin(2 * np.pi * 120 * tt) * .06) * (1 + .05 * np.sin(2 * np.pi * .3 * tt))
_b = brown(DUR + .1); room = lp(np.pad(_b, (0, max(0, N - len(_b))))[:N], 700)
room = room / (np.abs(room).max() + 1e-9)
bed = hum * .09 + room * .05
beam = hp(bp(noise(DUR)[:N], 3000, 9000), 3000) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * tt)) * .018
# 分段包络
def envseg(a, b, fa=.05, fb=.05):
    e = np.zeros(N); i0, i1 = int(a * SR), int(b * SR); e[i0:i1] = 1
    return uniform_filter1d(e, int(max(fa, fb) * SR) + 1)
ev_by = lambda ty: [e for e in EV if e['type'] == ty]
ign = ev_by('ignite')[0]['t'] if ev_by('ignite') else DUR
lock0 = ev_by('erase')[0]['t'] if ev_by('erase') else DUR
beam_env = envseg(ign, DUR, .3) * np.where(tt < ign + 4, 1, .55)
fade_end = np.clip((DUR - .3 - tt) / 3.0, 0, 1)          # 片尾嗡鸣 L-cut 后淡出
fade_in = np.clip(tt / .25, 0, 1)
amb[:, 0] += (bed + beam * beam_env) * fade_end * fade_in; amb[:, 1] += (bed * .97 + beam * beam_env * 1.1) * fade_end * fade_in

# ─────────── 事件 → 声音 ───────────
tot = 0
for e in EV:
    t, ty = e['t'], e['type']; tot += 1
    if ty == 'scan':
        d = e['d']; tt2 = t_(d); f = 220 * (1300 / 220) ** (tt2 / d)
        x = whoosh(d, 250, 5000, .5) + np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt2 / d) ** 1.5 * .35
        add(fol, x, t, .55)
    elif ty == 'scan_tick': add(fol, tick(1, 2400 + 1200 * e['y']), t, .35, rng.uniform(-.3, .3))
    elif ty == 'scan_done': add(fol, blip(D6 + 12, .5, 1, fm=.6), t, .3)
    elif ty == 'roll': add(fol, roll(e['d']), t, .15)
    elif ty == 'confirm_small': add(fol, blip(A5 + 12, .06, 1), t, .32); add(fol, blip(D6 + 12, .09, .8), t + .06, .32)
    elif ty == 'type_line':
        for k in range(3): add(fol, tick(1, 3600), t + k * .045, .25)
    elif ty == 'detect': add(fol, blip([D5, F5, A5][e['i'] % 3] + 12, .18, 1, fm=1.2), t, .3, [-.4, 0, .4][e['i'] % 3])
    elif ty == 'lock': add(fol, lock_hit(), t, .85)
    elif ty == 'lock_small': add(fol, blip(D6 + 12, .07, 1) , t, .35, .5)
    elif ty == 'push': add(fol, servo(e['d'], 90, 160, 1) * .6, t, .18)
    elif ty == 'orbit': add(fol, whoosh(e['d'], 200, 900, 1, True), t, .08)
    elif ty == 'explode':
        p, d = e['part'], e['d']
        if p == 'battery':
            add(fol, servo(d, 160, 360), t, .2, -.2); add(fol, tick(1, 2000), t + d, .5)
            add(fol, shimmer(.9, 1), t + d * .5, .12)          # 电芯亮起
        elif p == 'motor':
            add(fol, pneu(), t, .45, -.3); add(fol, tick(1, 1500), t + d * .35, .5, -.2); add(fol, tick(1, 1700), t + d * .7, .5, .2); add(fol, tick(1, 1900), t + d, .5, .35)
        else:
            add(fol, hiss(.8), t, .22, .4); add(fol, tink(), t + d * .8, .35, .45)
    elif ty == 'leader': add(fol, zip_(True, .14), t, .28)
    elif ty == 'confirm': add(fol, confirm(), t, .3)
    elif ty == 'reassemble': add(fol, zip_(False, .2) * .6, t, .25); add(fol, tick(1, 1700), t + .45, .45)
    elif ty == 'dock': add(fol, blip(A5, .08, 1), t, .25, -.5)
    elif ty == 'whip': add(fol, whoosh(e['d'], 300, 4500), t, .45)
    elif ty == 'jcut':
        if e["part"] == "motor": add(fol, whine(2.6, 1400, 3000), t, .03, -.2)
        elif e['part'] == 'brakes': add(fol, hiss(.55), t, .18, .3)
    elif ty == 'loupe_open': add(fol, iris(True), t, .35, .5)
    elif ty == 'loupe_close': add(fol, iris(False), t, .3, .5)
    elif ty == 'powerdown': add(fol, powerdown(e['d']), t, .35)
    elif ty == 'ignite': add(fol, ignite(), t, .8)
    elif ty == 'glitch': add(fol, glitch(e['d']), t, .35)
    elif ty == 'wave': add(fol, shimmer(e['d'], 1, True), t, .09)
    elif ty == 'spin': add(fol, whoosh(e['d'], 150, 1600, 1, True), t, .12)
    elif ty == 'ping': add(fol, ping(1, [A5 + 12, C6 + 12, E6 + 12][e['i'] % 3]), t, .32, [-.3, 0, .3][e['i'] % 3])
    elif ty == 'cta': add(fol, confirm(), t, .42)
    elif ty == 'erase':
        d = e['d']; tt2 = t_(d); f = 1300 * (200 / 1300) ** (tt2 / d)
        add(fol, whoosh(d, 5000, 250, .5) + np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - tt2 / d) * .3, t, .45)
    elif ty == 'card_tick': add(fol, blip(A5 + 12, .06, 1), t, .18)
    elif ty == 'vo':
        a, sr = sf.read(os.path.join(W, 'voices', e['id'] + '.wav'))
        if a.ndim > 1: a = a.mean(1)
        a = resample_poly(a, SR, sr); add(vox, a, t, 1.5)

# ─────────── 配乐 + 闪避 ───────────
mp = os.path.join(W, 'music', 'score.wav')
mus = np.zeros((N, 2))
if os.path.exists(mp):
    m, sr = sf.read(mp)
    if m.ndim == 1: m = np.stack([m, m], 1)
    if sr != SR: m = resample_poly(m, SR, sr, axis=0)
    L = min(N, len(m)); mus[:L] = m[:L]
from scipy.ndimage import maximum_filter1d
vo_env = np.abs(vox).max(1); vo_env = maximum_filter1d((vo_env > .01).astype(float), int(.5 * SR))   # 保持：字与字之间不回弹
vo_env = uniform_filter1d(vo_env, int(.2 * SR))
duck = 1 - .85 * np.clip(vo_env * 1.6, 0, 1)     # 旁白期间音乐 −16.5 dB
hi = [e for e in EV if e['type'] == 'ignite']
if hi: mus *= (1 - .3 * envseg(hi[0]['t'] - .01, hi[0]['t'] + 4, .02, .5))[:, None]   # 点亮段别把人声段压得太远
mus *= duck[:, None] * .8; amb *= .8 * (1 - .3 * np.clip(vo_env, 0, 1))[:, None]

# ─────────── 静音 ───────────
for e in ev_by('silence'):
    a, b = e['t'], e['t'] + e['d']
    g = 1 - envseg(a + .02, b - .005, .03, .005) if e['kind'] == 'true' else 1 - envseg(a + .03, b - .01, .05, .01)
    mus *= g[:, None]; fol *= g[:, None]
    if e['kind'] == 'true': amb *= g[:, None]; vox *= g[:, None]
    else: amb *= (0.55 + 0.45 * g)[:, None]
    for i in range(2):   # 真静音：严格归零
        if e['kind'] == 'true': mus[int((a + .03) * SR):int((b - .01) * SR), i] = 0; fol[int((a + .03) * SR):int((b - .01) * SR), i] = 0; amb[int((a + .03) * SR):int((b - .01) * SR), i] = 0

# 旁白期间拟音也让路 −15 dB（锁定、确认这两个信息落点不让）
keep = np.zeros(N)
for e in EV:
    if e['type'] in ('lock', 'confirm', 'ignite'): keep[int(e['t'] * SR):int((e['t'] + .2) * SR)] = 1   # 只保起音，尾巴照样让路
keep = uniform_filter1d(keep, int(.02 * SR))
fol *= (1 - .82 * np.clip(vo_env * 1.6, 0, 1) * (1 - keep))[:, None]
mix = mus + fol + amb + vox
for i in range(2): mix[:, i] = limit(mix[:, i], .95)
sf.write(os.path.join(W, 'mix.wav'), mix.astype(np.float32), SR)
for nm, b in [('music', mus), ('foley', fol), ('amb', amb), ('vox', vox)]: sf.write(os.path.join(W, 'out', f'stem_{nm}.wav'), b.astype(np.float32), SR)
print('mix.wav', DUR, 's', tot, 'events; peak', float(np.abs(mix).max()))
