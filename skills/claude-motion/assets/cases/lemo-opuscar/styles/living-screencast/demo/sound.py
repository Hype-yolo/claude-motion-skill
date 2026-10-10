"""配乐 + 音效 + 人声 → mix.wav（全部读 events.json，时间与画面同源）
配乐的核心是"两种分辨率"：高清层（钢琴、低音提琴拨弦、鼓组、钟琴，真采样）+ 像素层（方波，Clawd 的声音）。
结构：前奏只有键盘声 → 化身时 8-bit 琶音 → 8.4 s Clawd 落地全乐队进 → 每章转场一个过门 → 第 4 章抽空蓄力 →
踩下暗色开关后整支乐队"夜间模式"（低通）→ 分屏时钢琴与方波左右声道对话 → 片尾逐词方波音符 → 最后一踩亮回来。"""
import sys, os, json, numpy as np, soundfile as sf, soxr
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, ROOT)
from core.audio.sfx import SR, bp, lp, hp, noise, add, compress, limit, whoosh, click as sclick
from core.audio import sampler as S
HERE = os.path.dirname(os.path.abspath(__file__))
EVJ = json.load(open(os.path.join(HERE, 'events.json'))); E = EVJ['ev']; DUR = EVJ['dur']
rng = np.random.default_rng(7); S.seed(7)
NS = int((DUR + 1.5) * SR)
B = .6
def tt(d): return np.arange(int(round(d * SR))) / SR
def db(x): return 10 ** (x / 20)
def first(tp): return next(e['t'] for e in E if e['type'] == tp)
def all_(tp): return [e for e in E if e['type'] == tp]
def hz(n): return S.hz(n)

# ───────── 像素层：带限方波 + 包络
def pulse(f, d, duty=.25, vol=1., att=.003, rel=.05, slide=None, vib=0):
    t = tt(d); fr = np.full(len(t), float(f)) if slide is None else f * (slide ** (t / d))
    if vib: fr = fr * (1 + vib * np.sin(2 * np.pi * 6 * t))
    ph = np.cumsum(fr) / SR; x = np.zeros(len(t))
    for k in range(1, 24):                                        # 加法合成，避免混叠
        fk = fr * k; m = fk < 16000
        x += m * (np.sin(np.pi * k * duty) / k) * np.cos(2 * np.pi * k * (ph - duty / 2))
    e = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel).clip(0)
    return (x * e * vol * .5).astype(np.float32)
def crush(x, bits=5): q = 2 ** bits; return (np.round(x * q) / q).astype(np.float32)
def nz(d, lo, hi, vol=1., tau=None):
    x = bp(rng.standard_normal(int(d * SR)), lo, hi) * vol
    if tau: x *= np.exp(-tt(d)[:len(x)] / tau)
    return x.astype(np.float32)

# ═════════ 配乐
band = np.zeros((NS, 2), np.float32)       # 高清层（会被"夜间模式"低通）
chip = np.zeros((NS, 2), np.float32)       # 像素层
T_HIT, T_STOMP, T_SPLIT, T_LIGHT = first('hit'), first('stomp'), first('split') + .1, first('lighton') - .04
T_OUT = next(e['t'] for e in E if e['type'] == 'whoosh' and e.get('d') == 0)
WIPES = [e['t'] for e in all_('wipe')]
PROG = [('F2', ['F3', 'A3', 'C4', 'E4']), ('A2', ['E3', 'G3', 'A3', 'C4']), ('D2', ['F3', 'A3', 'C4', 'D4']), ('Bb1', ['F3', 'A3', 'Bb3', 'D4'])]
def bar_of(t): return int(np.floor((t - T_HIT) / (4 * B) + 1e-6))
def chord_at(t): return PROG[bar_of(t) % 4]
def pan_piano(t): return -.65 if T_SPLIT <= t < T_OUT else -.15
def pan_chip(t): return .65 if T_SPLIT <= t < T_OUT else .15
EVN = []
def N(t, inst, p, d, v, pan=0., g=1.): EVN.append((t, inst, p, d, v, pan, g))

# 前奏：钢琴 Fmaj7 八分琶音（很轻），化身后加拨弦低音、军鼓渐强、上行噪声
ARP = ['F4', 'A4', 'C5', 'E5', 'C5', 'A4']
t = 2.4; i = 0
while t < T_HIT - .01:
    v = .28 + .18 * min(1, max(0, (t - 5.8) / 2.6)); N(t, 'piano', ARP[i % 6], .5, v, -.2); t += B / 2; i += 1
for k, t in enumerate(np.arange(6.6, T_HIT - .01, B)): N(t, 'jazz_bass', 'F2', .5, .55, 0)
for k in range(12): tk = 7.2 + (T_HIT - 7.2) * (1 - (1 - k / 12) ** 1.6); N(tk, 'drum_kit', 'snare_1', .2, .25 + .45 * k / 12, .1)
rs = noise(1.2); rs = hp(rs, 900) * np.linspace(0, 1, len(rs)) ** 2 * .12; add(band, rs.astype(np.float32), T_HIT - 1.2, 1, 0)

# 主律动 8.4–T_STOMP（第 4 章 35.4 起抽空只留钢琴与踩镲，38.8 起蓄力）
BRK = WIPES[3]
def groove(t0, t1, night=False):
    n0 = int(round(t0 / B)); n1 = int(round(t1 / B))
    for n in range(n0, n1):
        t = n * B; bi = (n - int(round(T_HIT / B))) % 4; root, ch = chord_at(t + 1e-3)
        brk = BRK <= t < T_STOMP
        if not brk or t > T_STOMP - 1.21:
            if bi in (0, 2) and not brk: N(t, 'drum_kit', 'kick_drum_left', .3, .8, 0)
            if bi == 2 and not brk: N(t + B * .5, 'drum_kit', 'kick_drum_left', .3, .5, 0)
            if bi in (1, 3) and not brk: N(t, 'claps', None, .3, .55, .08); N(t, 'drum_kit', 'snare_2', .3, .35, .05)
        for h in (0, .5):
            if not (brk and t < T_STOMP - 2.4): N(t + h * B, 'drum_kit', 'hi_hat_closed', .1, (.32 if h == 0 else .2) * (1.2 if brk else 1), .3)
        if t >= WIPES[1] and not brk:
            for q in (.25, .75): N(t + q * B, 'shaker', None, .12, .22, -.35)
        # 低音：根音八分 + 五度
        if not brk or t >= T_STOMP - 2.4:
            N(t, 'jazz_bass', root, .28, .7, 0); N(t + B / 2, 'jazz_bass', root if bi != 3 else S.name(S.midi(root) + 7), .22, .45, 0)
        # 钢琴：小节头长和弦 + 反拍短和弦
        if bi == 0: [N(t, 'piano', p, 1.6, .42, pan_piano(t)) for p in ch]
        elif not brk: [N(t + B / 2, 'piano', p, .22, .3, pan_piano(t)) for p in ch[1:]]
        elif bi == 2: [N(t, 'piano', p, .9, .3, pan_piano(t)) for p in ch]
groove(T_HIT, T_STOMP)
# 章节过门：前一拍通鼓 + 转场上 crash
for w in WIPES:
    for k, tm in enumerate(['tom_1', 'tom_2', 'tom_3', 'tom_4']): N(w - B + k * B / 4, 'drum_kit', tm, .3, .5 + .1 * k, (k - 1.5) * .3)
    N(w, 'drum_kit', 'crash_left', 2.2, .55, -.2)
# 蓄力：38.8 起军鼓十六分渐强 + 上行噪声
for k in range(int(1.4 / (B / 4))): tk = T_STOMP - 1.4 + k * B / 4; N(tk, 'drum_kit', 'snare_1', .15, .2 + .5 * k / 9, .1)
rs = noise(1.6); rs = hp(rs, 1200) * np.linspace(0, 1, len(rs)) ** 2.5 * .14; add(band, rs.astype(np.float32), T_STOMP - 1.6, 1, 0)
# 暗色段：同一律动（稍后整体低通）+ 分屏后钢琴左 / 方波右对话
N(T_STOMP, 'drum_kit', 'crash_right', 2.5, .75, .2); N(T_STOMP, 'drum_kit', 'kick_drum_left', .4, 1., 0)
groove(T_STOMP, T_OUT - .6)
# 收尾：T_OUT 后鼓停，钢琴长和弦 + 片尾
for k, (root, ch) in enumerate([PROG[0], PROG[3]]):
    t0 = T_OUT + k * 2.4; N(t0, 'jazz_bass', root, 2.2, .5, 0); [N(t0 + j * .04, 'piano', p, 2.4, .35, -.1) for j, p in enumerate(ch)]
N(T_OUT + 4.8, 'jazz_bass', 'C2', 2.2, .5, 0); [N(T_OUT + 4.8 + j * .04, 'piano', p, 2.2, .35, -.1) for j, p in enumerate(['E3', 'G3', 'Bb3', 'C4'])]
# 亮回来：Fmaj9 大和弦 + 弦乐 + 钟琴琶音 + 鼓
N(T_LIGHT, 'drum_kit', 'crash_left', 3.5, .8, -.2); N(T_LIGHT, 'drum_kit', 'kick_drum_left', .4, 1., 0)
N(T_LIGHT, 'jazz_bass', 'F1', 3.8, .8, 0)
for j, p in enumerate(['F2', 'C3', 'A3', 'E4', 'G4', 'C5']): N(T_LIGHT + j * .03, 'piano', p, 4.6, .55, -.15 + j * .06)
for p in ['F3', 'C4', 'A4']: EVN.append(dict(t=T_LIGHT, inst='violins', pitch=p, dur=4.6, vel=.4, pan=.1, attack=.3))
for j, p in enumerate(['F5', 'A5', 'C6', 'E6', 'G6', 'A6']): N(T_LIGHT + .15 + j * B / 4, 'glockenspiel', p, 1.5, .45, .35)
for n in range(8):   # 片尾轻律动两小节
    t = T_LIGHT + 1.2 + n * B
    if t > DUR - 1.8: break
    N(t, 'drum_kit', 'hi_hat_closed', .1, .22, .3)
    if n % 2: N(t, 'claps', None, .3, .3, 0)
band_notes = [e for e in EVN]
bandmix = S.render(band_notes, dur=DUR + 1.5)
band[:len(bandmix)] += bandmix[:NS]

# 像素层：Clawd 主题（钟琴 + 方波同奏）只在无人声的空档出现
THEME = [('C6', 0, .5), ('A5', .5, .5), ('F5', 1, .5), ('G5', 1.5, 1), ('A5', 3, .5), ('C6', 3.5, .5), ('D6', 4, 1.5)]
def theme(t0, vol=.35, pan=.15, glock=True):
    for p, o, d in THEME:
        ts = t0 + o * B / 2; add(chip, pulse(hz(p), d * B / 2 * .9, .25, vol), ts, 1, pan)
        if glock: add(band, S.note('glockenspiel', p, d * B / 2, .5), ts, .55, pan)
theme(T_HIT + .02)                       # 落地后片名
theme(first('final'), .4)                # 片尾
# 化身：上行方波琶音 + 闪烁
m0 = first('morph')
for k, p in enumerate(['F4', 'A4', 'C5', 'F5', 'A5', 'C6', 'F6']): add(chip, pulse(hz(p), .09, .125, .28), m0 + k * .075, 1, (k - 3) * .12)
# 分屏对话：钢琴（左）问、方波（右）答
for k, (p, q) in enumerate([('A4', 'C6'), ('F4', 'A5'), ('G4', 'D6'), ('C5', 'E6')]):
    t0 = T_SPLIT + .6 + k * 1.2
    if t0 > T_OUT - .5: break
    add(band, S.note('piano', p, .5, .45), t0, .8, -.75); add(chip, pulse(hz(q), .26, .25, .22), t0 + .6, 1, .75)
# 片尾逐词：C–E–G–C
for e, p in zip(sorted(all_('word'), key=lambda e: e['i']), ['C5', 'E5', 'G5', 'C6']):
    add(chip, pulse(hz(p), .2, .25, .16), e['t'] + .12, 1, .1); add(band, S.note('glockenspiel', p, .6, .4), e['t'] + .12, .4, .1)

# 夜间模式：乐队 = 原声与低通版交叉淡化（踩下开关 0.8 s 内压暗，亮回来 0.8 s 内打开）
def ramp(t, a, b): return np.clip((t - a) / (b - a), 0, 1)
tn = np.arange(NS) / SR
night = ramp(tn, T_STOMP, T_STOMP + .8) * (1 - ramp(tn, T_LIGHT, T_LIGHT + .8))
dark = np.stack([lp(band[:, c], 900, 2) for c in (0, 1)], 1).astype(np.float32) * 1.25
band = band * (1 - night[:, None]) + dark * night[:, None]
# 暗色段里的像素层也变"暗"（更窄的占空比、低一点）
music = band + chip * np.where(night[:, None] > .5, .8, 1.)
music = S.room(music, size=.35, mix=.12)

# ═════════ 音效
fx = np.zeros((NS, 2), np.float32)
def key(v=.8, heavy=False):
    d = .09; t = tt(d); th = np.sin(2 * np.pi * (170 + rng.uniform(-20, 20)) * t) * np.exp(-t / .018) * .5
    ck = nz(d, 2500, 7000, .5, .006) + nz(d, 900, 2200, .3, .012)
    x = (th + ck[:len(th)]) * v * (1.5 if heavy else 1); return x.astype(np.float32)
def tick(v=.5, f=2600): t = tt(.05); return (np.sin(2 * np.pi * f * t) * np.exp(-t / .008) * v + nz(.05, 3000, 8000, .15 * v, .004)[:len(t)]).astype(np.float32)
def pop(v=.6, f0=520, f1=980): t = tt(.12); f = f0 * (f1 / f0) ** np.minimum(1, t / .05); return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .035) * v).astype(np.float32)
def swish(d=.35, v=.5, lo=400, hi=4000):
    x = rng.standard_normal(int(d * SR)); t = tt(d)[:len(x)]; e = np.sin(np.pi * t / d) ** 2
    return (bp(x, lo, hi) * e * v).astype(np.float32)
def boom(v=1., f0=90, d=.9): v *= .45; t = tt(d); f = f0 * np.exp(-t * 2.2) + 32; return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .3) * v).astype(np.float32)
for e in E:
    t0, tp = e['t'], e['type']
    if tp in ('key', 'tkey'): add(fx, key(e.get('v', .7) * (.55 if tp == 'key' else .7), e.get('sp')), t0, .5, -.1 + rng.uniform(-.1, .1))
    elif tp == 'rkey': add(fx, key(.3), t0, .3, .3)
    elif tp in ('enter', 'tenter'): add(fx, key(1, True), t0, .38, 0)
    elif tp == 'click': add(fx, sclick(1.1, .8), t0, .45, .1)
    elif tp == 'pop': add(fx, pop(.35), t0, 1, 0)
    elif tp == 'chip': add(fx, pop(.3, 700, 1300), t0, 1, 0)
    elif tp == 'tick': add(fx, tick(.25), t0, 1, .2)
    elif tp == 'tool': add(fx, tick(.3, 3200) + np.pad(tick(.2, 4200), (int(.05 * SR), 0))[:int(.05 * SR)], t0, 1, -.2)
    elif tp == 'read': add(fx, pulse(hz(['C6', 'D6', 'E6', 'G6', 'A6', 'C7'][e['i']]), .05, .125, .16), t0, 1, .3)
    elif tp == 'write':
        d = .42; x = nz(d, 2500, 6000, .22) * (.6 + .4 * np.abs(np.sin(2 * np.pi * 11 * tt(d)[:int(d * SR)])))
        add(fx, x.astype(np.float32), t0, 1, .3)
    elif tp == 'count':
        for k in range(12): add(fx, tick(.14, 3600), t0 + k * .05, 1, -.1)
    elif tp in ('pane', 'whoosh'):
        add(fx, swish(.38 if tp == 'pane' else .5, .28 if tp == 'pane' else .35, 300, 3500), t0 - .1, 1, (e.get('d', .5) or 0) * .4)
    elif tp == 'send': add(fx, swish(.3, .25, 800, 6000), t0, 1, 0); add(fx, pop(.25, 600, 1100), t0 + .25, 1, 0)
    elif tp == 'jump': d = min(.16, e.get('d', .3) * .4); add(fx, pulse(330, d, .25, .18, slide=2.4), t0, 1, .1)
    elif tp == 'land': add(fx, pulse(110, .06, .5, .22 * e.get('v', .6)), t0, 1, 0); add(fx, crush(nz(.05, 200, 2000, .25 * e.get('v', .6), .015)), t0, 1, 0)
    elif tp == 'step': add(fx, crush(nz(.02, 1500, 6000, .07, .005), 4), t0, 1, .1)
    elif tp == 'blip': add(fx, pulse(hz(['C5', 'E5', 'G5'][e['n']]), .06, .125, .2), t0, 1, -.2)
    elif tp == 'blink': add(fx, pulse(hz('C6'), .04, .125, .18), t0, 1, -.2); add(fx, pulse(hz('G5'), .04, .125, .14), t0 + .09, 1, -.2)
    elif tp == 'morph':
        for k in range(26): add(fx, pulse(rng.uniform(900, 2600), .03, .125, .07), t0 + rng.uniform(0, .55), 1, rng.uniform(-.6, .6))
    elif tp == 'winopen': add(fx, swish(.8, .3, 200, 2500), t0 - .1, 1, .3)
    elif tp == 'dash': add(fx, pulse(220, .25, .25, .2, slide=5), t0, 1, .5); add(fx, swish(.3, .25, 1000, 7000), t0, 1, .6)
    elif tp == 'boing': d = .45; add(fx, (np.sin(2 * np.pi * np.cumsum(420 * (1 + .25 * np.sin(2 * np.pi * 14 * tt(d)) * np.exp(-tt(d) / .15))) / SR) * np.exp(-tt(d) / .12) * .3).astype(np.float32), t0, 1, .2)
    elif tp == 'stomp': add(fx, pulse(hz('C3'), .14, .5, .35, slide=.5), t0, 1, .3); add(fx, boom(.6, 120, .6), t0, 1, .2)
    elif tp == 'darkon':
        d = 1.1; x = noise(d); x = lp(x, 500) * np.exp(-tt(d)[:len(x)] / .5) * .25; add(fx, x.astype(np.float32), t0, 1, 0); add(fx, boom(.7, 70, 1.4), t0, 1, 0)
    elif tp == 'shutter': add(fx, sclick(1.6, .9), t0, .6, .3); add(fx, nz(.07, 1500, 9000, .3, .02), t0 + .01, 1, .3); add(fx, sclick(1.3, .7), t0 + .09, .5, .3)
    elif tp == 'split': d = .5; f = 300 * 2 ** (tt(d) / d * 1.2); add(fx, (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt(d) / d) * .12).astype(np.float32), t0, 1, 0); add(fx, swish(.5, .2, 500, 5000), t0, 1, 0)
    elif tp == 'mitosis': add(fx, pop(.35, 500, 900), t0, 1, -.6); add(fx, pop(.35, 600, 1100), t0 + .07, 1, .6)
    elif tp == 'merge':
        for k, p in enumerate(['C6', 'E6', 'G6', 'C7']): add(fx, S.note('glockenspiel', p, .8, .45), t0 + k * .06, .6, -.4)
    elif tp == 'merge2':
        for k in range(14): add(fx, pulse(rng.uniform(1200, 3000), .03, .125, .07), t0 - .3 + k * .025, 1, (k % 2 - .5) * 1.2)
        add(fx, pop(.35, 400, 800), t0, 1, 0)
    elif tp == 'lighton': add(fx, swish(1.0, .3, 2000, 12000), t0 - .1, 1, 0)
    elif tp == 'hit': add(fx, boom(.5, 100, .6), t0, 1, 0)

# ═════════ 人声 + 闪避
vo = np.zeros((NS, 2), np.float32)
for e in all_('vo'):
    y, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'), dtype='float32')
    if y.ndim > 1: y = y.mean(1)
    y = soxr.resample(y, sr, SR).astype(np.float32); y = compress(y, .3, 3.0); add(vo, y, e['t'], 1.0, 0)
env = np.abs(vo[:, 0]); k = int(.12 * SR); env = np.convolve(env, np.ones(k) / k, 'same'); env = np.clip(env / (env.max() * .25), 0, 1)
duck = 1 - .62 * env
music *= duck[:, None]
music = music / (np.abs(music).max() + 1e-9) * .5
fx = fx / (np.abs(fx).max() + 1e-9) * .42
vo = vo / (np.abs(vo).max() + 1e-9) * .9
G_MUS, G_FX = db(float(os.environ.get('GM', 0))), db(float(os.environ.get('GF', 3)))
mix = music * G_MUS + fx * G_FX + vo
if os.environ.get('STEMS'):
    for nm, y in (('music', music * G_MUS), ('fx', fx * G_FX), ('vo', vo)): sf.write(os.path.join(HERE, 'out', nm + '.wav'), y[:int((DUR + .1) * SR)], SR)
fade = np.ones(NS); fo = int(1.2 * SR); end = int(DUR * SR); fade[end - fo:end] = np.linspace(1, 0, fo); fade[end:] = 0
mix = limit(mix * fade[:, None], .95)
sf.write(os.path.join(HERE, 'mix.wav'), mix[:int((DUR + .1) * SR)], SR)
print('mix.wav', round(DUR, 2), 's; notes', len(band_notes))
