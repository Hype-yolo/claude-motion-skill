"""原创摇篮曲配乐《The Moon Can't Sleep》：3/4，72 BPM，F 大调，52.0 s
音乐盒（pluck 模态合成）+ 玩具钢琴（numpy 金属棒击）+ 长笛 + 单簧管 + 钟琴 + 竖琴低音。
运行：.venv/bin/python styles/crayon-book/demo/music/score.py
输出：music/score.wav、music/stems/*.wav、music/score.json
"""
import sys, os, json
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add, bp, lp, hp
from scipy.signal import butter, sosfilt

S.seed(7)
DUR = 52.0
N = int(DUR * SR)
B = 60 / 72          # 1 拍
BAR = 3 * B          # 1 小节 = 2.5 s
rng = np.random.default_rng(11)
stems = {k: np.zeros((N, 2), np.float32) for k in ['musicbox', 'toypiano', 'flute', 'clarinet', 'glock', 'bass']}

def m(p): return S.midi(p)

# ---------- 乐器 ----------
def mbox(t, p, vel=.7, pan=.1, gain=1.0, st='musicbox', dur=None):
    x = P.pluck('music_box', m(p) if isinstance(p, str) else p, dur, vel)
    add(stems[st], x, t, gain, pan)

def toy(pitch, vel=.7, detune=None):
    """玩具钢琴：锤子敲金属棒。非谐分音 + 快衰减 + 小锤击噪声 + 木盒共鸣，略微走音"""
    f0 = 440 * 2 ** ((m(pitch) - 69) / 12) * 2 ** ((detune if detune is not None else rng.uniform(-9, 9)) / 1200)
    d = 1.6; t = np.arange(int(d * SR)) / SR; y = np.zeros_like(t)
    for r, a, t60 in [(1, 1.0, 1.1), (2.92, .42, .38), (5.84, .2, .18), (9.3, .1, .09), (1.004, .35, 1.0)]:
        if f0 * r > 18000: continue
        y += a * np.sin(2 * np.pi * f0 * r * t + rng.random() * 6) * np.exp(-6.9 * t / t60)
    L = int(.01 * SR); nz = rng.standard_normal(L) * np.exp(-np.arange(L) / (.0012 * SR))
    y[:L] += bp(nz, 1500, 6000) * .6 * vel
    thud = np.sin(2 * np.pi * 180 * t[:int(.05 * SR)]) * np.exp(-t[:int(.05 * SR)] / .012)
    y[:len(thud)] += thud * .25
    y = lp(y, 7000)
    y[:48] *= np.linspace(0, 1, 48); y[-480:] *= np.linspace(1, 0, 480)
    y *= .12 * (vel / .8) ** 1.3 / (np.sqrt(np.mean(y[:int(.1 * SR)] ** 2)) + 1e-9)
    return y.astype(np.float32)

def toyp(t, p, vel=.7, pan=-.15, gain=1.0):
    add(stems['toypiano'], toy(p, vel), t, gain, pan)

def samp(st, inst, t, p, dur, vel=.6, pan=0., gain=1.0, attack=0., release=None):
    x = S.note(inst, p, dur, vel, release=release, attack=attack)
    add(stems[st], x, t, gain, pan)

def bend(x, curve):
    """按半音曲线（与样本等长的数组）变速重采样 = 滑音"""
    rate = 2 ** (curve / 12)
    pos = np.cumsum(rate); pos = pos[pos < len(x) - 1]
    i = pos.astype(int); f = pos - i
    return (x[i] * (1 - f) + x[i + 1] * f).astype(np.float32)

def slide(st, inst, t, p, dur, semis, vel=.55, pan=0., gain=1., t0=.15):
    """先保持 t0 秒再滑落 semis 个半音（哈欠 / 哇–哇）"""
    x = S.note(inst, p, dur + .2, vel, release=.25)
    n = len(x); tt = np.arange(n) / SR
    c = np.where(tt < t0, 0, np.clip((tt - t0) / max(dur - t0, .05), 0, 1) ** 1.3 * semis)
    y = bend(x, c)
    add(stems[st], y, t, gain, pan)

# ---------- 主旋律（全片统一）：4 小节，拍为单位 ----------
# 和声：F | Bb | C7 | F
THEME = [
    [('F4', 0, .5), ('A4', .5, .5), ('C5', 1, 1.5), ('A4', 2.5, .5)],          # 句一（F）
    [('D5', 0, 1), ('C5', 1, .5), ('Bb4', 1.5, .5), ('A4', 2, 1)],             # 句二（Bb）
    [('G4', 0, .5), ('Bb4', .5, .5), ('E5', 1, 1.5), ('D5', 2.5, .5)],         # 句三（C7）
    [('C5', 0, 3)],                                                            # 长音（F，开放地停在五度上）
]
def play_theme_bar(bar, t0, fn, beat=B, trans=0):
    for p, b, d in THEME[bar]:
        fn(t0 + b * beat, m(p) + trans, d * beat)

key = {}

# ===== A 0–7.5：音乐盒独奏动机 =====
key['A'] = 0.0
play_theme_bar(0, 0.0, lambda t, p, d: mbox(t, p + 12, .62, .15))
mbox(1.667, 'F6', .85, .35, 1.0)                                   # 月亮睁眼：高音"叮"
mbox(1.667, 'C7', .5, .35, .5)
play_theme_bar(1, 2.5, lambda t, p, d: mbox(t, p + 12, .58, .1))
mbox(5.0, 'G5', .55, 0.); mbox(5.0 + B, 'Bb5', .5, .1); mbox(5.0 + 2 * B, 'A5', .6, .1, dur=None)
samp('clarinet', 'clarinet', 2.5, 'F3', 2.4, .3, -.2, .55, attack=.5, release=.8)
samp('clarinet', 'clarinet', 5.0, 'E3', 2.3, .3, -.2, .5, attack=.4, release=.6)
# 句尾一点音乐盒和声
for i, p in enumerate(['A4', 'C5', 'F5']): mbox(0.0 + i * .02, p, .3, -.2, .6)

# ===== B 7.5–13.95：玩具钢琴 + 单簧管断奏"嘭恰恰" =====
key['B'] = 7.5
chords_B = [('F3', ['A4', 'C5']), ('C3', ['G4', 'Bb4']), ('F3', ['A4', 'C5'])]
for bi in range(3):
    t0 = 7.5 + bi * BAR
    root, ch = chords_B[bi]
    rootp = m(root) + 12 if m(root) < m('D3') else m(root)
    samp('clarinet', 'clarinet_stac', t0, rootp, .3, .62 if bi == 0 else .5, -.25, .9)
    for k in (1, 2):
        tt = t0 + k * B
        if tt >= 13.3: continue
        v = .42 if bi < 1 else .3                                   # 数羊时退后
        for p in ch: toyp(tt, p, v, -.1, .8)
# 翻身重音：7.5 与 9.17
for tt in (7.5, 9.1667):
    for p in ['F4', 'C5', 'F5']: toyp(tt, p, .85, .2, 1.0)
    samp('clarinet', 'clarinet_stac', tt, 'F3', .3, .75, -.2, 1.0)
# 数羊五个上行音（玩具钢琴）
sheep = [10.0, 10.8333, 11.6667, 12.5, 13.3333]
for i, (tt, p) in enumerate(zip(sheep, ['C5', 'D5', 'E5', 'F5', 'G5'])):
    toyp(tt, p, .8, -.3 + i * .15, 1.15)
    mbox(tt, m(p) + 12, .35, -.3 + i * .15, .45)
# 单簧管"哇–哇"下行（13.3–13.9）
slide('clarinet', 'clarinet', 13.30, 'Bb3', .30, -1.0, .6, .1, 1.1, t0=.08)
slide('clarinet', 'clarinet', 13.60, 'A3', .32, -2.2, .6, .1, 1.1, t0=.06)
key['silence'] = [13.95, 15.0]

# ===== C 15–20：长笛温柔新乐句 + 音乐盒和声 =====
key['C'] = 15.0
fl = [(15.0, 'C5', B), (15.0 + B, 'D5', .5 * B), (15.0 + 1.5 * B, 'F5', 2.3 * B), (18.3333, 'E5', B), (18.3333 + B, 'D5', .5 * B), (18.3333 + 1.5 * B, 'C5', 1.6 * B)]
for tt, p, d in fl: samp('flute', 'flute', tt, p, d, .45, .15, .9, attack=.06, release=.35)
# 音乐盒和声：Dm | Bb – C
harm = [(15.0, ['D5', 'F5', 'A5']), (17.5, ['Bb4', 'D5', 'F5']), (18.75, ['C5', 'E5', 'G5'])]
for t0, ch in harm:
    for k, p in enumerate(ch): mbox(t0 + k * B * .5, m(p) + 12 if k else m(p), .32, -.35, .6)
samp('clarinet', 'clarinet', 15.0, 'D3', 2.4, .28, -.25, .5, attack=.4, release=.5)
samp('clarinet', 'clarinet', 17.5, 'D3', 2.4, .26, -.25, .45, attack=.3, release=.5)
add(stems['glock'], S.note('glockenspiel', 'C6', 1.5, .45), 18.3333, .7, .3)        # 挥手

# ===== D 20–27.5：梯子音阶 + 单簧管 walking bass + 渐慢 =====
key['D'] = 20.0
rungs = [20.3 + .45 * i for i in range(8)]
for i, (tt, p) in enumerate(zip(rungs, ['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5'])):
    toyp(tt, p, .7 + .02 * i, -.2 + i * .06, 1.1)
walk = [(20.0, 'F3'), (20.0 + B, 'A3'), (20.0 + 2 * B, 'C4'), (22.5, 'D4'), (22.5 + B, 'Bb3'), (22.5 + 2 * B, 'G3')]
for tt, p in walk: samp('clarinet', 'clarinet_stac', tt, p, .45, .45, -.25, .9)
# 第 11 小节：C7sus 延长和弦 + 渐慢
rit = [25.0, 25.95, 26.95]
for tt, p in zip(rit, ['G4', 'Bb4', 'C5']): mbox(tt, m(p) + 12, .45, .1, .8)
samp('clarinet', 'clarinet', 25.0, 'G3', 2.15, .32, -.2, .7, attack=.25, release=.08)
samp('flute', 'flute', 25.95, 'E5', 1.2, .3, .2, .6, attack=.3, release=.08)
key['breath'] = [27.2, 27.5]

# ===== E 27.5–37.5：主旋律完整一遍 =====
key['E'] = 27.5
E0 = 27.5
for bar in range(4):
    t0 = E0 + bar * BAR
    play_theme_bar(bar, t0, lambda t, p, d: samp('flute', 'flute', t, p, d + (.25 if bar < 3 else 0), .55, .12, 1.0, attack=.05, release=.4))
    play_theme_bar(bar, t0, lambda t, p, d: mbox(t, p + 12, .5, -.15, .55))
# 单簧管副旋律（三度 / 六度下方的长音）
counter = [(E0, 'A3', 1.5 * B), (E0 + 1.5 * B, 'C4', 1.5 * B), (E0 + BAR, 'Bb3', 1.5 * B), (E0 + BAR + 1.5 * B, 'D4', 1.5 * B),
           (E0 + 2 * BAR, 'Bb3', 1.5 * B), (E0 + 2 * BAR + 1.5 * B, 'G3', 1.5 * B), (E0 + 3 * BAR, 'A3', 3 * B)]
for tt, p, d in counter: samp('clarinet', 'clarinet', tt, p, d, .38, -.3, .75, attack=.12, release=.4)
# 竖琴低音
for bar, p in enumerate(['F2', 'Bb2', 'C3', 'F2']):
    t0 = E0 + bar * BAR
    add(stems['bass'], S.note('harp', p, 2.4, .55), t0, .9, -.05)
    add(stems['bass'], S.note('harp', m(p) + 7, 1.6, .35), t0 + B, .6, .05)
    add(stems['bass'], S.note('harp', m(p) + 12, 1.6, .3), t0 + 2 * B, .55, .1)
# 35.0：长和弦 + 钟琴琶音洒下来
for k, p in enumerate(['F5', 'A5', 'C6', 'F6']): mbox(35.0 + k * .06, p, .5, -.3 + k * .2, .7)
samp('flute', 'flute', 35.0, 'A4', 2.4, .35, -.1, .5, attack=.4, release=.5)
casc = ['C8', 'A7', 'F7', 'D7', 'C7', 'A6', 'G6', 'F6', 'D6', 'C6', 'A5']
for k, p in enumerate(casc):
    add(stems['glock'], S.note('glockenspiel', p, 2.0, .42 - .015 * k), 35.05 + k * .17, .8, .6 - k * .11)
# 星星浮现：刷子前沿经过星星 → 钟琴粒子（和声内五声音）
ev = json.load(open(os.path.join(HERE, '..', 'events.json')))['ev']
gl = sorted([e for e in ev if e['type'] == 'glint'], key=lambda e: e['t'])
pent = {0: ['F', 'G', 'A', 'C', 'D'], 1: ['F', 'Bb', 'C', 'D', 'G'], 2: ['C', 'E', 'G', 'Bb', 'D'], 3: ['F', 'A', 'C', 'D', 'G']}
last = -1; ng = 0
for e in gl:
    if e['t'] - last < .1 or e['t'] > 35.0: continue
    last = e['t']; ng += 1
    bar = min(3, int((e['t'] - E0) // BAR))
    nm = pent[bar][int(rng.integers(0, 5))] + str(int(rng.choice([6, 6, 7])))
    add(stems['glock'], S.note('glockenspiel', nm, 1.2, float(rng.uniform(.22, .36))), e['t'], .55, float(np.clip(e.get('pan', 0), -.9, .9)))
key['glints'] = ng

# ===== F 37.5–45：音乐盒独奏尾句（更慢）+ 哈欠 + 终止式 =====
key['F'] = 37.5
slow = B * 1.12
play_theme_bar(2, 37.5, lambda t, p, d: mbox(t, p + 12, .5, .1), beat=slow)
slide('clarinet', 'clarinet', 38.3, 'Bb3', .75, -5.0, .5, -.2, 1.0, t0=.12)      # 月亮哈欠
mbox(40.3, 'C6', .45, .1); mbox(40.3 + slow * 1.5, 'Bb5', .4, .1); mbox(41.4, 'A5', .42, .1)
# 42.5 终止式 F
for k, p in enumerate(['F4', 'A4', 'C5', 'F5']): mbox(42.5 + k * .09, p, .5, -.2 + k * .15, .8)
samp('clarinet', 'clarinet', 42.5, 'F3', 2.3, .32, -.2, .7, attack=.15, release=1.0)
add(stems['bass'], S.note('harp', 'F2', 3.0, .45), 42.5, .8, 0)
slide('flute', 'flute', 43.3, 'A5', .5, -4.0, .32, .25, .7, t0=.1)               # 女孩哈欠（43.3）
mbox(44.1, 'C6', .3, .2, .7)

# ===== G 45–52：音乐盒动机最后一句，发条走完 =====
key['G'] = 45.0
g = np.zeros((int(7.2 * SR), 2), np.float32)
tG = [0.0, .5, 1.05, 1.95]               # F A C A（越来越慢）
for tt, p in zip(tG, ['F5', 'A5', 'C6', 'A5']): add(g, P.pluck('music_box', p, None, .55), tt, .9, .1)
add(g, P.pluck('music_box', 'F5', None, .6), 3.85, 1.0, .05)   # 最后一个音 = 48.85（翻页结束、The End 出现时）
add(g, P.pluck('music_box', 'C5', None, .35), 3.85, .6, -.1)
# 发条走完：逐渐变慢 + 音高下沉（整段变速重采样，速率 1 → 0.93）
n = len(g); tt = np.arange(n) / SR
rate = 1 - .07 * np.clip(tt / 4.0, 0, 1) ** 1.5
pos = np.cumsum(rate); pos = pos[pos < n - 1]; i = pos.astype(int); f = (pos - i)[:, None]
gg = g[i] * (1 - f) + g[i + 1] * f
# 实际时间：播放位置 pos 对应源时间 → 最后一音在源 3.85 s，重采样后出现在 inv 处
last_note = 45.0 + np.searchsorted(pos, 3.85 * SR) / SR
stems['musicbox'][int(45.0 * SR):int(45.0 * SR) + len(gg)] += gg[:N - int(45.0 * SR)]
key['last_note'] = round(float(last_note), 3)
key['theme_phrases_E'] = [27.5, 30.0, 32.5, 35.0]
key['sheep'] = sheep; key['rungs'] = rungs

# ---------- 混合 ----------
gains = {'musicbox': 1.0, 'toypiano': .55, 'flute': .8, 'clarinet': .75, 'glock': .7, 'bass': .8}
mix = sum(stems[k] * gains[k] for k in stems)
mix = S.room(mix, size=.42, mix=.2, damp=.45)
tt = np.arange(N) / SR
def gate(a, b, fade=.02):
    env = np.ones(N, np.float32)
    ia, ib = int(a * SR), int(b * SR); k = int(fade * SR)
    env[ia - k:ia] = np.linspace(1, 0, k); env[ia:ib] = 0; env[ib:ib + k] = np.minimum(env[ib:ib + k], np.linspace(0, 1, k))
    return env
g1 = gate(13.95, 15.0, .03); g2 = gate(27.2, 27.5, .05)
tail = np.clip((51.95 - tt) / 1.2, 0, 1).astype(np.float32)    # 52 前完全静下
env = g1 * g2 * tail
mix *= env[:, None]
for k in stems: stems[k] *= env[:, None]
pk = np.abs(mix).max()
if pk > .9: mix *= .9 / pk; print('scaled peak', pk)
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR)
for k in stems: sf.write(os.path.join(HERE, 'stems', k + '.wav'), (stems[k] * gains[k]).astype(np.float32), SR)
json.dump(key, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)

# ---------- 自检 ----------
def rms(a, b): x = mix[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
print('dur', len(mix) / SR, 'peak', round(float(np.abs(mix).max()), 3))
for nm, a, b in [('A', 0, 7.5), ('B', 7.5, 13.95), ('silence', 13.95, 15.0), ('C', 15, 20), ('D', 20, 27.2), ('breath', 27.2, 27.5), ('E', 27.5, 35), ('E-climax', 35, 37.5), ('F', 37.5, 45), ('G', 45, 52)]:
    print(f'{nm:9s} {a:5.2f}-{b:5.2f}  rms {rms(a, b):7.1f} dB')
X = np.abs(np.fft.rfft(mix.mean(1))) ** 2; fr = np.fft.rfftfreq(N, 1 / SR)
tot = X.sum()
for lo, hi in [(20, 250), (250, 2000), (2000, 8000), (8000, 20000)]:
    print(f'band {lo:5d}-{hi:5d} Hz  {100 * X[(fr >= lo) & (fr < hi)].sum() / tot:5.1f} %')
print('silence max abs', float(np.abs(mix[int(13.95 * SR):int(15.0 * SR)]).max()), float(np.abs(mix[int(27.2 * SR):int(27.5 * SR)]).max()), 'end', float(np.abs(mix[-int(.05 * SR):]).max()))
print(json.dumps(key))
