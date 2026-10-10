"""《The Swordsman and the River》原创配乐（48.0 s）。
运行：.venv/bin/python styles/ink-wash/demo/music/score.py  （在仓库根）
古琴 = core/audio/pluck.py guqin（散音/按音滑音/吟猱/泛音/扫弦）；箫 = 采样长笛低音区 + 低通 + 气声噪声；
大鼓 = gran_cassa + timpani；盖印 = gong2 small；过江脚步 = frame_drum 轻点。F 宫五声（F G A C D），旋律原创。
输出 score.wav（48k 立体声，峰值 ≤ -1 dBFS）、stems/*.wav、score.json。"""
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add

HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 48.0
N = int(DUR * SR)
S.seed(7); np.random.seed(7)
st = {k: np.zeros((N, 2), np.float32) for k in ('guqin', 'xiao', 'drums', 'pad')}

def G(t, pitch, dur=None, vel=.7, pan=0., gain=1., **kw):
    add(st['guqin'], P.pluck('guqin', pitch, dur, vel, **kw), t, gain, pan)

def H(t, pitch, vel=.55, pan=0., gain=1., dur=1.2, **kw):   # 泛音
    G(t, pitch, dur, vel, pan, gain, harmonic=True, **kw)

rng = np.random.default_rng(11)
def xiao(t, pitch, dur, vel=.55, pan=-.15, gain=1., att=.5):
    """箫：长笛采样低音区（低于 C4 的音向下移调）+ 3 kHz 低通去亮 + 气声噪声（带通 800–3k，跟音量包络），弱起"""
    x = S.note('flute', pitch, dur, vel, release=.6, attack=att).astype(np.float64)
    x = sosfilt(butter(2, 2600, 'low', fs=SR, output='sos'), x)
    env = np.abs(x); env = np.convolve(env, np.ones(960) / 960, 'same')
    nz = sosfilt(butter(2, [800, 3000], 'band', fs=SR, output='sos'), rng.standard_normal(len(x)))
    y = x + nz * env * 1.6
    add(st['xiao'], y.astype(np.float32), t, gain, pan)

def D(t, inst, var, vel=.8, gain=1., pan=0., dur=None, env=None):
    x = S.hit(inst, var, vel, dur).astype(np.float64)
    if env is not None: x = x[:len(env)] * env[:len(x)]
    add(st['drums'], x.astype(np.float32), t, gain, pan)

marks = {}
def mark(k, t): marks[k] = t

# ---------------- A 虚白 0–7.0 散板 ----------------
mark('A_drop', .90)
G(.90, 'F2', None, .92, 0, 1.25)                      # 墨滴落纸：低 F 散音，长余韵
xiao(2.6, 'C4', 3.6, .5, -.2, .8, att=1.4)            # 箫长音弱起
for tt, p, pan in [(3.4, 'C5', .25), (4.0, 'F5', -.1), (4.6, 'A5', .15)]:
    H(tt, p, .5, pan, .9); mark(f'A_harm_{tt}', tt)
G(6.0, 'D3', 1.0, .55, .1, .9, bend=[(0, 0), (.25, 0), (1.0, -2)])   # 下行滑音引入
mark('A_slide', 6.0)

# ---------------- B 江岸 7.0–14.5，60 BPM ----------------
G(7.0, 'A3', 1.4, .62, .05, 1., bend=[(0, -2), (.25, 0)])            # 按音上滑入
G(8.0, 'C4', .8, .5, .1, .85, vib=(4.5, .18, .3))                   # 吟
for tt, p in [(8.8, 'F3'), (9.4, 'A3'), (10.0, 'C4')]:              # 侠客三笔
    G(tt, p, .55, .75, 0, 1.1); mark(f'B_stroke_{tt}', tt)
H(10.3, 'F6', .5, .3, .85); mark('B_tassel', 10.3)                  # 剑穗点红
# 旁白 10.6–14.1：只留低音和极稀的音
G(11.2, 'D3', 1.8, .42, -.1, .8, bend=[(0, 0), (.9, 0), (1.6, -2)])
G(12.8, 'G2', 1.2, .4, .1, .75)
H(13.6, 'C5', .3, -.2, .55)
G(14.1, 'A2', .5, .5, 0, .8)

# ---------------- C 过江 14.5–21.3，90 BPM ----------------
b = 60 / 90
# 轮指 ostinato（低、轻）
seq = ['F2', 'C3', 'F3', 'C3', 'G2', 'D3', 'G3', 'D3']
tt, i = 14.5, 0
while tt < 20.9:
    fade = 1 - max(0, (tt - 20.0) / 1.0) * .7
    G(tt, seq[i % 8], .32, .34 * fade, (-.3 if i % 2 else .3) * .4, .7 * fade)
    tt += b / 2; i += 1
# 脚步点：清脆短音 + 手鼓轻点
stepP = ['C4', 'D4', 'F4', 'D4', 'C4', 'A3', 'C4', 'D4', 'F4']
for k in range(9):
    t0 = 15.3333 + k * b
    G(t0, stepP[k], .22, .62, .15 * (1 if k % 2 else -1), .75, pos=.12)
    D(t0, 'frame_drum', 'small_muted', .45, .5, .1)
    mark(f'C_step_{k}', round(t0, 4))
# 箫旋律（旁白期间轻）
for t0, p, d, g in [(15.0, 'A4', 1.33, .55), (16.33, 'C5', 1.33, .5), (17.67, 'D5', .67, .5), (18.33, 'C5', .67, .5), (19.0, 'A4', 1.33, .62), (20.33, 'G4', 1.0, .55)]:
    xiao(t0, p, d, .5, -.2, g, att=.25)
G(20.2, 'F2', 1.2, .5, 0, .9, bend=[(0, 0), (.4, 0), (1.1, -1)])  # 低音下沉

# ---------------- D 浪起 21.3–26.8 ----------------
mark('D_hit', 21.30)
D(21.30, 'gran_cassa', 'hit', .95, 1.1)
D(21.30, 'timpani', 'drum2', .85, .9)
G(21.30, 'C2', 3.0, .8, -.1, 1.1, bend=[(0, 0), (.4, 0), (2.8, -2)])
G(22.1, 'F2', 2.0, .45, .15, .7, bend=[(0, 0), (.5, 0), (1.8, -1)])
G(24.0, 'A2', 1.2, .6, -.15, .9, bend=[(0, 0), (.3, 0), (1.1, -2)])
G(25.3, 'C2', 1.5, .7, .1, 1.0, bend=[(0, 0), (.2, 0), (1.4, -3)])
nr = int((26.8 - 23.0) * SR)
ramp = (np.linspace(0, 1, nr) ** 2.2) * 1.0 + .03
D(23.0, 'gran_cassa', 'roll', .8, 1.3, 0, env=ramp)
D(24.6, 'timpani', 'drum2', .5, .45, -.2)
D(25.9, 'timpani', 'drum2', .7, .6, .2)

# —— 26.80 硬切：A–D 段单独加混响，再把 26.80 之后（含混响尾巴、长采样余音）全部清零 ——
def verb(d):
    d['guqin'] = S.room(d['guqin'], size=.5, mix=.2); d['xiao'] = S.room(d['xiao'], size=.62, mix=.3)
    d['drums'] = S.room(d['drums'], size=.55, mix=.16); d['pad'] = S.room(d['pad'], size=.5, mix=.15)
    return d
def cut_after(x, a, fade=.02):
    ia, nf = int(a * SR), int(fade * SR)
    x[ia - nf:ia] *= np.linspace(1, 0, nf, dtype=np.float32)[:, None]; x[ia:] = 0
pre = verb(st)
for k in pre: cut_after(pre[k], 26.80)
st = {k: np.zeros((N, 2), np.float32) for k in pre}

# ---------------- E 静 26.8–32.4 ----------------
for tt, p in [(28.50, 'G5'), (29.20, 'C6'), (29.95, 'D6')]:
    H(tt, p, .55, (tt - 29.2) * .5, .95, dur=.35, release=.35); mark(f'E_harm_{tt}', tt)

# ---------------- F 断流 32.40 ----------------
mark('F_cut', 32.40)
D(32.40, 'gran_cassa', 'hit', 1.0, 1.4)
D(32.40, 'timpani', 'drum2', 1.0, 1.1)
add(st['guqin'], P.strum('guqin', ['C2', 'D2', 'F2', 'G2', 'A2', 'C3', 'D3'], 3.0, .95, spread=.011), 32.40, 1.35, 0)
G(32.40, 'F2', 3.0, .7, 0, .8)
lowF = S.note('contrabass', 'F1', 2.6, .55, release=.6, attack=.05).astype(np.float64)
add(st['pad'], lowF.astype(np.float32), 32.42, .55, 0)

# ---------------- G 过江 35.4–42.6，60 BPM ----------------
G(35.4, 'A3', 1.5, .6, .05, .9, bend=[(0, -2), (.35, 0)])
G(36.4, 'C4', 1.0, .5, .1, .75, vib=(4.2, .2, .3))
G(37.4, 'D4', .8, .45, -.05, .7)
G(38.2, 'C4', .8, .45, .05, .7)
G(39.0, 'A3', 1.0, .5, 0, .75, vib=(4.0, .2, .35))
G(40.0, 'G3', .6, .45, -.1, .7)
G(40.6, 'A3', .6, .5, .1, .75)
G(41.30, 'F3', 2.0, .72, 0, 1.0); H(41.30, 'F5', .45, .2, .6); mark('G_bow_cadence', 41.30)
for t0, p, d, g in [(36.0, 'C5', 2.0, .42), (38.2, 'A4', 1.5, .42), (39.8, 'G4', 1.4, .4), (41.3, 'F4', 1.6, .5)]:
    xiao(t0, p, d, .48, -.25, g, att=.4)

# ---------------- H 收卷 42.6–48.0 ----------------
G(42.8, 'C3', 1.0, .42, .1, .75)
G(43.6, 'A2', 1.0, .45, -.1, .75, bend=[(0, 0), (.4, 0), (.9, -2)])
mark('H_seal', 44.60)
H(44.60, 'F3', .6, 0, 1.0, dur=3.2, release=1.2)
G(44.60, 'F2', None, .5, 0, .8)
D(44.60, 'gong2', 'small', .35, .35, .1)

# ---------------- 混响 + 静音段 + 总线 ----------------
st = verb(st)
st = {k: st[k] + pre[k] for k in st}

def gate_zero(x, a, b2, fade=.02):
    """[a, b2) 强制数字 0；a 前 fade 秒淡出，b2 后不淡入（后面的事件自己起音）"""
    ia, ib, nf = int(a * SR), int(b2 * SR), int(fade * SR)
    x[ia - nf:ia] *= np.linspace(1, 0, nf, dtype=np.float32)[:, None]
    x[ia:ib] = 0
zones = [(26.80, 28.50), (30.50, 32.40)]
for k in st:
    for a, b2 in zones: gate_zero(st[k], a, b2)
    # 泛音在 30.50 前淡尽（30.2→30.5）
    i0, i1 = int(30.2 * SR), int(30.5 * SR); st[k][i0:i1] *= np.linspace(1, 0, i1 - i0, dtype=np.float32)[:, None] ** 2
    st[k][-int(.3 * SR):] *= np.linspace(1, 0, int(.3 * SR), dtype=np.float32)[:, None]

BUS = {'guqin': 1.0, 'xiao': 2.1, 'drums': .9, 'pad': .7}
mix = sum(st[k] * g for k, g in BUS.items())
pk = np.abs(mix).max(); tgt = 10 ** (-1.2 / 20)
sc = tgt / pk if pk > tgt else 1.0
mix *= sc
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
for k, g in [('guqin', 1.0), ('xiao', 2.1), ('drums', .9), ('pad', .7)]:
    sf.write(os.path.join(HERE, 'stems', f'{k}.wav'), (st[k] * g * sc).astype(np.float32), SR, subtype='FLOAT')
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')

# ---------------- 自检 ----------------
def rms_db(a, b2):
    s = mix[int(a * SR):int(b2 * SR)]; return round(float(20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)), 1)
def onset(t, win=.08):
    """能量上升点：2.5 ms 窗 RMS 的最大增量所在（在 t±win 内），比阈值法不受前一音余韵干扰"""
    h = int(.0025 * SR); a0 = int((t - win) * SR)
    seg = mix[a0:int((t + win) * SR)].mean(1)
    e = np.sqrt(np.convolve(seg ** 2, np.ones(h) / h, 'same') + 1e-12)
    d = e[h:] - e[:-h]; i = int(np.argmax(d)); return round((a0 + i + h // 2) / SR, 4)
secs = {'A 0-7': (0, 7), 'B 7-14.5': (7, 14.5), 'C 14.5-21.3': (14.5, 21.3), 'D 21.3-26.8': (21.3, 26.8), 'E 28.5-30.5': (28.5, 30.5), 'F 32.4-35.4': (32.4, 35.4), 'G 35.4-42.6': (35.4, 42.6), 'H 42.6-48': (42.6, 48)}
report = {
    'dur': len(mix) / SR, 'peak_dbfs': round(float(20 * np.log10(np.abs(mix).max())), 2),
    'rms_db': {k: rms_db(*v) for k, v in secs.items()},
    'silence_max_abs': {f'{a}-{b2}': float(np.abs(mix[int(a * SR):int(b2 * SR)]).max()) for a, b2 in zones},
    'onsets': {k: onset(v) for k, v in marks.items() if not k.startswith('C_step_') or k in ('C_step_0', 'C_step_8')},
    'stem_rms_db': {k: {sk: round(float(20 * np.log10(np.sqrt(np.mean((st[k][int(v[0] * SR):int(v[1] * SR)] * sc * BUS[k]) ** 2)) + 1e-12)), 1) for sk, v in secs.items()} for k in st},
}
json.dump({'bpm': {'B': 60, 'C': 90, 'G': 60}, 'marks': marks, 'sections': {
    'A': '散板：0.90 低 F 散音（墨滴），2.6 箫弱起长音，3.4/4.0/4.6 泛音 C5/F5/A5 托片名，6.0 D→C 下行滑音',
    'B': '60 BPM 古琴独奏主题：A 按音上滑、C 吟；8.8/9.4/10.0 单音 F/A/C = 三笔成形；10.3 F6 泛音 = 剑穗；旁白段只留低音',
    'C': '90 BPM：低音轮指 ostinato（八分）+ 脚步点清脆短音与手鼓（15.333+k*0.6667）+ 箫旋律 A C D C A G；20.0 起渐暗下沉',
    'D': '21.30 大鼓+定音鼓重音；古琴低弦下滑；23.0→26.8 大鼓滚奏渐强；26.80 硬切到 0',
    'E': '26.8–28.5 数字 0；泛音 G5/C6/D6 于 28.50/29.20/29.95；30.50–32.40 数字 0',
    'F': '32.40 大鼓最强 + 定音鼓 + 古琴七弦扫弦（C D F G A c d）+ 低 F 延续到 35.4',
    'G': '60 BPM 主题回归（更舒展）+ 箫对位；41.30 落在主音 F（抱拳）',
    'H': '42.8 起收束；44.60 低 F 泛音 + F2 散音 + 小锣（盖印）；48.0 前 0.3 s 淡出'},
    'selfcheck': report}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(report, indent=1, ensure_ascii=False))
