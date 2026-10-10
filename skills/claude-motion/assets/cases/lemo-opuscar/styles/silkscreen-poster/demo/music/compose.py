# compose.py · 《Three Trails》配乐：美式户外民谣，100 BPM，D 大调，开放 D 调弦（DADF#AD）
# 卡点全部从 ../events.json 读（画面时间改了，重跑本脚本即可对齐）。
#
# 配器与来源（全部 CC0 或代码合成）：
#   - 钢弦民谣吉他：core/audio/pluck.py `acoustic_guitar` 物理建模（扫弦 / 耙弦 / 分解和弦 / 空弦单音）
#   - 滑棒吉他：本文件 numpy 合成（连续滑音相位积分、钢弦谐波、琴体共振滤波、滑棒摩擦噪声、颤音）
#   - 口琴：core/audio/sampler.py `harmonica`（VCSL，CC0 1.0）
#   - 低音：sampler `jazz_bass`（Karoryfer Sneakybass，CC0 1.0）
#   - 鼓：sampler `cajon`（VCSL，CC0 1.0）当底鼓；`snare2:taps`（VCSL，CC0）+ `shaker`（VCSL，CC0）当刷子律动；
#         `sus_cymbal`（VSCO 2 CE，CC0 1.0）做重印 2 的镲刷渐强与高点的镲
#   - 混响：sampler.room()
# 运行：仓库根目录  .venv/bin/python styles/silkscreen-poster/demo/music/compose.py
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add

HERE = os.path.dirname(os.path.abspath(__file__))
EVJ = json.load(open(os.path.join(HERE, '..', 'events.json')))
DUR = EVJ['dur']; EV = EVJ['ev']; TOT = DUR + 1.5
BEAT = .6; E8 = .3
S.seed(7); rng = np.random.default_rng(7)

def evs(tp, **kw): return [e for e in EV if e['type'] == tp and all(e.get(k) == v for k, v in kw.items())]
def ev1(tp, **kw):
    r = evs(tp, **kw); return r[0] if r else None

N = int(TOT * SR)
stem = {k: np.zeros((N, 2), np.float32) for k in ['guitar', 'slide', 'harmonica', 'drums', 'bass']}

# ---------------- 和弦（开放 D 调弦的真实按法） ----------------
CH = {
    'D':   ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
    'D/F#': ['F#2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
    'G':   ['G2', 'D3', 'G3', 'B3', 'D4', 'G4'],      # 5 品横按
    'A':   ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4'],     # 7 品横按
    'Bm':  ['B2', 'F#3', 'B3', 'D4', 'F#4', 'B4'],
    'Dhi': ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'],     # 12 品
}
_cache = {}
def strum(ch, at, vel=.7, dur=1.2, up=False, spread=.018, gain=1., pan=0., top=6, mute=False):
    key = (ch, round(vel, 2), round(dur, 2), up, round(spread, 3), top, mute)
    if key not in _cache:
        ps = CH[ch][-top:] if not up else CH[ch][-top:]
        kw = dict(damp=.85, t60=.08) if mute else {}
        _cache[key] = P.strum('acoustic_guitar', ps, dur, vel, spread=spread, up=up, **kw)
    add(stem['guitar'], _cache[key], at, gain, pan)

def pick(p, at, vel=.7, dur=2., gain=1., pan=0.):
    add(stem['guitar'], P.pluck('acoustic_guitar', p, dur, vel), at, gain, pan)

def harm(p, at, dur, vel=.6, gain=1., pan=.15, attack=.04):
    ps = p if isinstance(p, (list, tuple)) else [p]
    # 口琴采样的气息起音 30–60 ms 才到 30–50%，提前 35 ms 放，让听感起音落在卡点上
    for q in ps: add(stem['harmonica'], S.note('harmonica', q, dur, vel, attack=attack, release=.25), at - .035, gain / np.sqrt(len(ps)), pan)

def bass(p, at, dur=.55, vel=.75, gain=1.):
    add(stem['bass'], S.note('jazz_bass', p, dur, vel), at, gain, 0)

def kick(at, vel=.8, gain=1.): add(stem['drums'], S.hit('cajon', 'bass', vel), at, gain * 1.2, 0)
def slap(at, vel=.55, gain=1.): add(stem['drums'], S.hit('cajon', 'slap', vel), at, gain * .7, .1)
def brush(at, vel=.5, gain=1.):
    add(stem['drums'], S.hit('snare2', 'taps', vel), at, gain * .55, -.15)
    n = rng.standard_normal(int(.16 * SR)).astype(np.float32)
    n = sosfilt(butter(2, [1800, 7000], 'band', fs=SR, output='sos'), n).astype(np.float32)
    n *= np.exp(-np.arange(len(n)) / SR / .05).astype(np.float32)
    add(stem['drums'], n * .12, at, gain, -.2)
def shake(at, vel=.4, gain=1., up=False): add(stem['drums'], S.hit('shaker', 'up' if up else 'down', vel), at, gain * .5, .3)
def cymbal(at, var='hit', vel=.6, gain=1., dur=None): add(stem['drums'], S.hit('sus_cymbal', var, vel, dur), at, gain, -.25)

# ---------------- 滑棒吉他（numpy 合成） ----------------
def hz(p): return S.hz(p)
def slide(at, path, dur, vel=.7, gain=1., pan=-.2, vib=(5.2, .12, .45), t60=3.2):
    """path = [(t, 音名或midi), ...] 分段线性（半音域）滑动；返回并摆放"""
    n = int(dur * SR); t = np.arange(n) / SR
    ts = [a for a, _ in path]; ms = [S.midi(b) for _, b in path]
    m = np.interp(t, ts, ms)
    vd = np.clip((t - vib[2]) / .3, 0, 1) * vib[1] * np.sin(2 * np.pi * vib[0] * t)
    f = 440 * 2 ** ((m + vd - 69) / 12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.zeros(n)
    bright = np.exp(-t / .9)
    for k in range(1, 16):
        amp = (1 / k) * (0.35 + 0.65 * bright ** (k / 4))
        y += amp * np.sin(k * ph + k * .3) * (f * k < 9000)
    env = np.minimum(1, t / .008) * np.exp(-t * 6.9 / t60)
    y *= env
    # 琴体共振 + 钢弦亮度
    body = sosfilt(butter(2, [90, 260], 'band', fs=SR, output='sos'), y) * .6
    y = y + body + sosfilt(butter(2, [2200, 3800], 'band', fs=SR, output='sos'), y) * .5
    # 滑棒摩擦：随滑动速度
    speed = np.abs(np.gradient(m) * SR)
    fr = sosfilt(butter(2, [1500, 5000], 'band', fs=SR, output='sos'), rng.standard_normal(n)) * np.clip(speed / 12, 0, 1) * .05
    y = (y + fr) * env ** 0
    y = y / (np.abs(y).max() + 1e-9) * .5 * vel
    k = min(n, 960); y[-k:] *= np.linspace(1, 0, k)
    add(stem['slide'], y.astype(np.float32), at, gain, pan)

# ================= 编曲 =================
def T(tp, **kw):
    e = ev1(tp, **kw); return e['t'] if e else None

# ---- Intro：0 s 就在进行的开放 D 震音扫弦 ----
lift0 = T('lift')                                   # 1.0
t = 0.0; i = 0
while t < lift0 - .05:
    strum('D', t, .38 + .12 * (t / lift0), dur=.35, up=bool(i % 2), spread=.008, gain=.8, top=5)
    t += .15; i += 1
strum('D', lift0, .6, dur=.08, mute=True, gain=1.1)          # 抬网版：闷音 chk
title = [e for e in evs('squeegee') if e.get('ink') == 'title'][0]['t']   # 1.2
kick(title, .9); strum('D', title, .85, dur=3.2, spread=.02, gain=1.2); bass('D2', title, 2.2, .7, .9)
ht = T('title')                                     # 1.5
harm(['D4', 'F#4', 'A4'], ht, 3.1, .62, 1.0, attack=.03)
tilt = T('tilt', i=0)
strum('G', ht + 4 * BEAT - .3, .5, dur=1.2, spread=.02, gain=.7)   # 3.6 附近轻扫
strum('A', tilt - E8, .5, dur=.5, up=True, spread=.012, gain=.7)   # 下摇前的上耙

# ---- A 段：第 1 张，每层一声扫弦，和弦逐层上行 ----
pulls0 = sorted(evs('pull', i=0), key=lambda e: e['t'])
for e, ch in zip(pulls0, ['D', 'D/F#', 'G', 'A']):
    strum(ch, e['t'], .72 + .05 * e['n'], dur=1.4, spread=.022, gain=1.05)
    if e['n'] == 0: kick(e['t'], .55, .7)
lift1 = T('lift', i=0)                              # 7.8
kick(lift1, .9); bass('D2', lift1, .55, .8)
band0 = T('band', i=0); name0 = T('name', i=0)
strum('D', band0, .8, dur=2.0, spread=.05, gain=1.0)        # 长下扫
harm('A4', name0, .28, .7); harm('B4', name0 + .3, .28, .7); harm('D5', name0 + .6, 1.2, .72)
for e, p in zip(sorted(evs('item', i=0), key=lambda e: e['t']), ['D4', 'F#4', 'A4', 'D5']):
    pick(p, e['t'], .8, 1.6, 1.1, .2)
# 律动：lift1 之后到转场，bass 每拍 1、3，cajon 1、3，刷子 2、4，吉他八分轻扫
w1 = T('wipe', i=1)                                 # 13.2
prog = ['D', 'D', 'G', 'G', 'D', 'D', 'A', 'A']
t = lift1 + BEAT; k = 0
while t < w1 - .35:
    beat = int(round(t / BEAT)) % 4
    if beat in (0, 2): kick(t, .6, .75); bass(['D2', 'G2', 'D2', 'A2'][(k // 4) % 4], t, .5, .7, .9)
    else: brush(t, .5)
    if t >= name0 + 1.4:
        ch = prog[(k // 2) % len(prog)]
        strum(ch, t, .42, dur=.5, spread=.012, gain=.55, top=4); strum(ch, t + E8, .32, dur=.3, up=True, spread=.01, gain=.45, top=4)
    t += BEAT; k += 1
strum('A', w1 - E8, .8, dur=.6, up=True, spread=.03, gain=1.0)     # 转场前半拍上耙（同时是第 2 张天空刮）

# ---- B 段：第 2 张，八分音符扫弦 + 四踩（加速） ----
pulls1 = sorted(evs('pull', i=1), key=lambda e: e['t'])
for e, ch in zip(pulls1[1:], ['G', 'A', 'D']):
    strum(ch, e['t'], .85, dur=.5, spread=.012, gain=1.1)
sil1 = [e for e in evs('silence') if e.get('pre')][0]; s1a, s1b = sil1['t'], sil1['t'] + sil1['dur']
band1 = T('band', i=1); name1 = T('name', i=1)
t = w1; k = 0; progB = ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'A']
while t < s1a - .01:
    kick(t, .75, .85)
    if k % 2 == 1: brush(t, .55)
    shake(t + E8, .35); shake(t, .25, up=True)
    bass(['D2', 'G2', 'A2', 'D2', 'B1', 'G2', 'A2', 'A2'][(k // 2) % 8], t, .28, .75, .85)
    ch = progB[(k // 2) % 8]
    if not any(abs(t - e['t']) < .05 for e in pulls1):
        strum(ch, t, .5, dur=.3, spread=.01, gain=.6, top=5)
    strum(ch, t + E8, .38, dur=.25, up=True, spread=.008, gain=.5, top=4)
    t += BEAT; k += 1
strum('D', band1, .82, dur=1.6, spread=.045, gain=.95)
slide(name1, [(0, 'A3'), (.08, 'A3'), (.42, 'D4')], 1.6, .8, 1.0)
for e, p in zip(sorted(evs('item', i=1), key=lambda e: e['t']), ['A4', 'D5', 'F#5', 'A5']):
    pick(p, e['t'], .8, 1.4, 1.0, .2)

# ---- C 段：签名爬升 ----
asc = ev1('ascent'); a0 = asc['t']; a1 = a0 + asc['dur']
sil2 = [e for e in evs('silence') if not e.get('pre')][0]; s2a, s2b = sil2['t'], sil2['t'] + sil2['dur']
slide(a0, [(0, 'D3'), (.1, 'D3'), (.9, 'A3'), (1.3, 'A3'), (1.8, 'D4')], 3.2, .95, .7, vib=(5.0, .15, 1.9), t60=4.5)
t = a0 + BEAT; k = 1
while t < s2a - .01:
    g = .35 + .8 * (t - a0) / (a1 - a0)                          # 渐强（到顶约 +9 dB）
    kick(t, .5 + .35 * g, .8 * g + .2)
    if t >= a0 + 2 * BEAT: bass(['D2', 'D2', 'G2', 'A2'][(k // 2) % 4], t, .5, .75, g)
    if t >= a0 + 3 * BEAT:
        ch = ['D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'A'][(k // 2) % 8]
        strum(ch, t, .45 + .3 * g, dur=.5, spread=.012, gain=1.0 * g, top=5)
        strum(ch, t + E8, .35 + .2 * g, dur=.3, up=True, spread=.01, gain=.6 * g, top=4)
    if t >= a0 + 4 * BEAT and k % 2 == 1: brush(t, .5 * g + .2)
    if t >= a0 + 4 * BEAT and (k % 4 == 0): harm(['D4', 'F#4', 'A4'] if (k // 4) % 2 == 0 else ['D4', 'G4', 'B4'], t, 4 * BEAT * .95, .45 + .25 * g, .7 * g, attack=.08)
    t += BEAT; k += 1
for e in evs('swap'):
    big = e['k'] >= 2
    strum('Dhi' if big else 'A', e['t'], .95, dur=1.6, up=True, spread=.03 if big else .025, gain=1.3 if big else 1.1)
    if big: cymbal(e['t'], 'cresc', .7, .9)
for j, e in enumerate(sorted(evs('part'), key=lambda e: e['t'])):
    tgt = ['A3', 'B3', 'D4', 'E4'][j % 4]
    slide(e['t'], [(0, S.midi(tgt) - 2), (.12, tgt)], .9, .8, 1.25, pan=-.35, vib=(5.5, .1, .3), t60=1.4)

# ---- 高点：卡嗒 = 全乐队强拍 ----
cl = T('clack')
kick(cl, 1.0, 1.4); add(stem['drums'], S.hit('snare2', 'on', .8), cl, .7, 0); cymbal(cl, 'hit', .9, 1.0)
strum('D', cl, 1.0, dur=2.6, spread=.015, gain=1.5); strum('Dhi', cl + .01, .9, dur=2.4, spread=.012, gain=1.0, pan=.3)
bass('D2', cl, 1.2, .95, 1.2); harm(['D4', 'F#4', 'A4', 'D5'], cl, .75, .75, 1.2, attack=.01)
slide(cl, [(0, 'D4'), (.3, 'D4'), (.9, 'F#4')], 2.4, .8, .9, pan=-.3)

# ---- D 段：读数（一小节律动 → 吉他 + 口琴） ----
wp = T('wallpull'); land = T('land'); endc = T('endcard')
band2 = T('band', i=2); name2 = T('name', i=2)
items2 = sorted(evs('item', i=2), key=lambda e: e['t'])
t = cl + BEAT; k = 1
while t < wp - .05:
    full = t < cl + 4 * BEAT
    if full:
        kick(t, .75 if k % 2 == 0 else .6, .9)
        if k % 2 == 1: brush(t, .55)
        bass(['D2', 'D2', 'G2', 'A2'][k % 4], t, .5, .75, .9)
    ch = ['D', 'D', 'G', 'G', 'D', 'D', 'A', 'A'][(k // 2) % 8]
    if not any(abs(t - x) < .05 for x in [band2, name2] + [e['t'] for e in items2]):
        strum(ch, t, .45 if full else .35, dur=.5, spread=.012, gain=.65 if full else .5, top=5)
    t += BEAT; k += 1
strum('D', band2, .85, dur=2.0, spread=.035, gain=1.05)
harm('A4', name2, .28, .8, 1.3, attack=.01); harm('B4', name2 + .3, .28, .75, 1.2); harm('F#5', name2 + .6, 1.1, .75, 1.2)
base = ['D4', 'F#4', 'A4', 'D4']
for j, e in enumerate(items2):
    p = base[j % 4]
    if e.get('climb'): p = S.midi(p) + 12
    pick(p, e['t'], .85, 1.8, 1.15, .2)

# ---- 尾：呼吸，分解和弦 + 口琴收句，落在 D ----
arp = [('G', wp), ('A', wp + 2 * BEAT)]
for ch, t0 in arp:
    for j, p in enumerate(CH[ch][1:]):
        pick(p, t0 + j * E8 * .5, .5, 1.6, .7, -.1 + .05 * j)
harm('B4', wp, .55, .55); harm('A4', wp + .6, .55, .55); harm('E4', wp + 1.2 - .01, .3, .5)
strum('D', land, .6, dur=4.0, spread=.06, gain=.95)
harm(['D4', 'F#4', 'A4'], land, 3.9, .5, .9, attack=.3)
bass('D2', land, 3.8, .6, .8)
for j, p in enumerate(['A3', 'D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'D4']):
    pick(p, land + BEAT * (1 + j * .75), .35, 1.5, .55, .2 * np.sin(j))
# ---- 片尾 ----
strum('Dhi', endc, .45, dur=4.5, spread=.05, gain=.8)
harm('A4', endc + .2, 3.8, .45, .75, attack=.6)

# ================= 静音门、混响、输出 =================
def gate(x):
    g = np.ones(len(x), np.float32); tt = np.arange(len(x)) / SR
    for a, b in [(s1a, s1b), (s2a, s2b)]:
        g *= np.where(tt < a, 1, np.where(tt >= b, 1, np.clip(1 - (tt - a) / .06, 0, 1))).astype(np.float32)
    return x * g[:, None]
gains = {'guitar': .95, 'slide': .8, 'harmonica': .7, 'drums': .9, 'bass': .95}
wet = {'guitar': .16, 'slide': .22, 'harmonica': .2, 'drums': .08, 'bass': .03}
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
out = {}
for k, x in stem.items():
    y = S.room(x * gains[k], size=.42, mix=wet[k])
    y = gate(y)                                       # 混响尾巴也在静音区收掉
    out[k] = y.astype(np.float32)
mix = sum(out.values())
pk = np.abs(mix).max(); sc = 10 ** (-1.5 / 20) / pk
mix *= sc
for k in out: out[k] *= sc; sf.write(os.path.join(HERE, 'stems', k + '.wav'), out[k], SR, subtype='FLOAT')
sf.write(os.path.join(HERE, 'score.wav'), mix, SR, subtype='FLOAT')

# ================= 自检 =================
assert np.isfinite(mix).all()
print(f'dur {len(mix)/SR:.2f}s  peak {20*np.log10(np.abs(mix).max()):.2f} dBFS')
def rms_db(a, b):
    x = mix[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)
print(f'silence1 {s1a:.2f}-{s1b:.2f}: {rms_db(s1a + .08, s1b - .005):.1f} dBFS   silence2 {s2a:.2f}-{s2b:.2f}: {rms_db(s2a + .08, s2b - .005):.1f} dBFS')
import librosa
mono = mix.mean(1)
# 起音检测：hop 64（1.3 ms），onset_detect + backtrack 回溯到能量开始上升的位置（去掉 onset_strength 的固有滞后）
hop = 64
of = librosa.onset.onset_strength(y=mono, sr=SR, hop_length=hop)
ons = librosa.onset.onset_detect(onset_envelope=of, sr=SR, hop_length=hop, backtrack=True, units='time', delta=.02, wait=4)
tt = librosa.times_like(of, sr=SR, hop_length=hop)
hm = out['harmonica'].mean(1)
hof = librosa.onset.onset_strength(y=hm, sr=SR, hop_length=hop)
hons = librosa.onset.onset_detect(onset_envelope=hof, sr=SR, hop_length=hop, backtrack=False, units='time', delta=.02, wait=4)
def onset_near(t0, w=.04, src=None):
    src = ons if src is None else src
    c = src[(src >= t0 - w) & (src <= t0 + w)]
    if not len(c): return None
    d = c[np.argmin(np.abs(c - t0))]; j = np.searchsorted(tt, d + .01)
    return d - t0, of[min(j, len(of) - 1)] / (np.median(of) + 1e-9)
chk = [('lift', lift0), ('title', title), ('harm', ht)] + [(f'pull0.{e["n"]}', e['t']) for e in pulls0] + [('lift1', lift1), ('band0', band0), ('name0', name0)] \
    + [(f'item0.{e["k"]}', e['t']) for e in evs('item', i=0)] + [(f'pull1.{e["n"]}', e['t']) for e in pulls1] + [('band1', band1), ('name1', name1)] \
    + [(f'item1.{e["k"]}', e['t']) for e in evs('item', i=1)] + [('ascent', a0)] + [(f'swap{e["k"]}', e['t']) for e in evs('swap')] \
    + [(f'part.{e["layer"]}', e['t']) for e in evs('part')] + [('clack', cl), ('band2', band2), ('name2', name2)] \
    + [(f'item2.{e["k"]}', e['t']) for e in items2] + [('wallpull', wp), ('land', land), ('endcard', endc)]
print(f'{"cue":14s} {"t":>7s} {"Δms":>6s} {"strength":>8s}')
bad = 0
for nm, t0 in chk:
    r = onset_near(t0)
    if r is None and nm in ('harm', 'name0', 'name2'): r = onset_near(t0, src=hons); nm += '(口琴分轨)'
    if r is None: print(nm, 'none'); bad += 1; continue
    d, s = r; flag = '' if abs(d) <= .010 else '  <-- >10ms'
    bad += abs(d) > .010
    print(f'{nm:14s} {t0:7.2f} {d*1000:6.1f} {s:8.1f}{flag}')
print('cues >10ms:', bad)
