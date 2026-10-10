"""Nian Comes to Town — 原创配乐（民乐小合奏）。
120 BPM，2/4，D 宫五声（D E F# A B）。琵琶（物理建模）+ 筝（dan_tranh 采样）+ 二胡 + 笛（flute 采样）+ 木鱼 + 小锣/大锣 + 手鼓。
运行：.venv/bin/python styles/papercut-red/demo/music/score.py
输出：music/score.wav、music/stems/*.wav、music/score.json、music/CREDITS.txt
"""
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add

HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
DUR = 49.0
N = int(DUR * SR)
S.seed(7)
rng = np.random.default_rng(31)
B = .5          # 1 拍
E8 = .25        # 八分音符

def hum(t, amt=.008):
    return t + float(rng.uniform(-amt, amt))

def vv(v, amt=.06):
    return float(np.clip(v + rng.uniform(-amt, amt), .05, 1))

STEMS = {k: np.zeros((N, 2), np.float32) for k in ['pipa', 'zheng', 'winds', 'perc']}
KEY = {}

# ---------- 滑音：变速重采样（二胡） ----------
def glide(x, curve, dur):
    """curve = [(t, 半音), ...] 相对原音高；输出长度 dur 秒（不含尾巴）"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ks, vs = zip(*curve)
    semi = np.interp(tt, ks, vs)
    ratio = 2 ** (semi / 12)
    pos = np.cumsum(ratio)
    pos = pos[pos < len(x) - 2]
    i = pos.astype(int); f = pos - i
    y = x[i] * (1 - f) + x[i + 1] * f
    fade = min(len(y), int(.08 * SR))
    y[-fade:] *= np.linspace(1, 0, fade)
    return y.astype(np.float32)

def erhu_glide(t, pitch, curve, dur, vel=.55, gain=1.0, pan=.15):
    x = S.note('erhu', pitch, dur * 1.8 + .5, vel=vel, attack=.08)
    add(STEMS['winds'], glide(x, curve, dur), t, gain, pan)

# ---------- 乐器便捷函数 ----------
def pipa(t, p, d, v=.7, g=1.0, pan=-.15, trem=None, **kw):
    if trem: kw['trem'] = trem
    add(STEMS['pipa'], P.pluck('pipa', p, d, vel=vv(v), **kw), hum(t), g, pan)

def zheng(t, p, d=1.2, v=.55, g=1.0, pan=.25):
    add(STEMS['zheng'], S.note('dan_tranh', p, d, vel=vv(v)), hum(t), g, pan)

def zheng_trem(t, p, d, v=.35, g=1.0, pan=.2):
    add(STEMS['zheng'], S.note('dan_tranh_trem', p, d, vel=v, attack=.25), t, g, pan)

def flute(t, p, d, v=.55, g=1.0, pan=-.3, grace=None):
    if grace:   # 倚音
        add(STEMS['winds'], S.note('flute', grace, .07, vel=vv(v * .8)), hum(t) - .06, g * .7, pan)
    add(STEMS['winds'], S.note('flute', p, d, vel=vv(v), attack=.02), hum(t), g, pan)

def erhu(t, p, d, v=.5, g=1.0, pan=.15):
    add(STEMS['winds'], S.note('erhu', p, d, vel=vv(v), attack=.06), hum(t), g, pan)

def wb(t, v=.6, var='a', g=1.0, pan=.35):
    add(STEMS['perc'], S.hit('woodblock', var, vel=vv(v, .04)), hum(t, .004), g, pan)

def gong(t, kind='small', v=.6, g=1.0, pan=0):
    add(STEMS['perc'], S.hit('gong2', kind, vel=v), t, g, pan)

def drum(t, kind='large', v=.7, g=1.0, pan=0):
    add(STEMS['perc'], S.hit('frame_drum', kind, vel=vv(v, .04)), hum(t, .005), g, pan)

def gliss(t, notes, step=.028, v=.5, g=.8, pan=.25):
    for i, p in enumerate(notes):
        zheng(t + i * step, p, .9, v * (.8 + .4 * i / max(1, len(notes) - 1)), g, pan)

# ---------- 主题 A（两句，每句 4 小节 = 8 拍 = 4 s） ----------
# (音高, 拍数)
P1 = [('A4', 1), ('B4', 1), ('D5', 2), ('E5', 1), ('F#5', 1), ('E5', 1), ('D5', 1),
      ('B4', 1), ('D5', 1), ('A4', 1), ('B4', 1), ('A4', 4)]
P2 = [('A4', 1), ('B4', 1), ('D5', 2), ('E5', 1), ('F#5', 1), ('A5', 1), ('F#5', 1),
      ('E5', 1), ('D5', 1), ('B4', 1), ('E5', 1), ('D5', 4)]
# 上面单位 = 八分音符（0.25 s）
HARM1 = ['D', 'E', 'B', 'A']
HARM2 = ['D', 'A', 'E', 'D']
CH = {'D': ['D3', 'A3', 'D4', 'F#4'], 'E': ['E3', 'B3', 'E4', 'B3'], 'B': ['B2', 'F#3', 'B3', 'D4'], 'A': ['A2', 'E3', 'A3', 'E4']}

def melody(t0, phrase, inst='pipa', unit=E8, v=.7, octave=0, g=1.0, trem_min=2, pan=None):
    t = t0
    out = []
    for p, n in phrase:
        d = n * unit
        pp = S.midi(p) + 12 * octave
        if inst == 'pipa':
            pipa(t, pp, d + .15, v, g, pan if pan is not None else -.15, trem=14 if n >= trem_min else None)
        elif inst == 'flute':
            flute(t, pp, d * .95, v, g, pan if pan is not None else -.3, grace=(pp + 2 if n >= 2 else None))
        elif inst == 'erhu':
            erhu(t, pp, d * .98, v, g, pan if pan is not None else .15)
        out.append(t); t += d
    return out

def zheng_bars(t0, harm, v=.45, g=1.0, dens=4):
    for b, h in enumerate(harm):
        notes = CH[h]
        for k in range(dens):
            zheng(t0 + b * 1.0 + k * (1.0 / dens), notes[k % len(notes)], .8, v * (1.1 if k == 0 else .9), g)

# ================= Cues =================
# C0 引子：2.5 琵琶上滑 → 3.0
pipa(2.50, 'E4', .3, .6, bend=[(0, 0), (.12, 5)])     # E4 滑到 A4
pipa(2.75, 'B4', .3, .6)
KEY['intro'] = 2.5

# C1 片名 3.0–7.0：主题 A 第二句全奏
gong(3.0, 'small', .55, .8)
melody(3.0, P2, 'pipa', v=.72)
melody(3.0, P2, 'flute', v=.5, octave=1, g=.55)
zheng_bars(3.0, HARM2, v=.45)
for k in range(8): wb(3.0 + k * B, .55 if k % 2 == 0 else .4)
drum(3.0, 'large', .55, .7)
gliss(6.5, ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5'], .045, .5, .8)
KEY['title'] = 3.0; KEY['titleFold'] = 6.5

# C2 夜村 7.0–12.0：主题 A 轻（笛独奏）
zheng(7.0, 'D3', 2.0, .5, .9)
melody(7.0, P1, 'flute', v=.42, g=.8)
zheng_bars(7.0, HARM1, v=.3, g=.8, dens=4)
for k in range(10): wb(7.0 + k * B + .25, .28, 'b', .7)
flute(11.0, 'D5', .9, .35, .7)
zheng(11.0, 'D3', 1.0, .35, .8); zheng(11.25, 'A3', .8, .3, .8); zheng(11.5, 'D4', .8, .3, .8)

# C3 年兽 12.0–17.0
drum(12.0, 'large', 1.0, 1.4)
zheng(12.0, 'B2', 3.0, .75, 1.1, 0)
zheng(12.0, 'D3', 3.0, .5, .8, 0)
for t in [12.5, 13.5]:
    drum(t, 'large', .62, 1.0); drum(t + .22, 'large', .45, .85)
erhu_glide(12.5, 'D5', [(0, 0), (1.2, 0), (2.4, -5), (3.4, -5), (4.2, -8)], 4.4, .5, .85)
zheng(13.25, 'B2', 1.5, .5, .9, -.1)
zheng(15.25, 'D3', 1.5, .45, .8, .1)
for i, t in enumerate([14.0, 14.5, 15.0, 15.5, 16.0, 16.5]):
    drum(t, 'large_muted', .6 + .04 * i, 1.0)
KEY['rise'] = 12.0; KEY['lightsOut'] = [14.0, 14.5, 15.0, 15.5, 16.0, 16.5]

# C5 决心 19.5–24.0
zheng_trem(19.5, 'D4', 4.2, .28, .7, -.15)
zheng_trem(19.9, 'A4', 3.8, .25, .6, .2)
for t, p in [(21.76, 'A4'), (22.5, 'B4'), (23.28, 'D5')]:
    add(STEMS['pipa'], P.pluck('pipa', p, 1.2, vel=.72), t, 1.0, -.1)
for t, p in [(23.5, 'D5'), (23.625, 'E5'), (23.75, 'F#5')]:
    pipa(t, p, .2, .6)
KEY['words'] = [21.76, 22.5, 23.28]

# C6 折剪 24.0–29.5
for t in [24.0, 25.0, 26.0]: wb(t, .75, 'a', 1.1, 0)
add(STEMS['pipa'], P.pluck('pipa', 'A5', .6, vel=.7), 24.0, .9, -.1)
steps = [(26.5, 27.5, ['D4', 'A4', 'D5', 'A4'], 'A4', 4), (27.5, 28.5, ['E4', 'B4', 'E5', 'B4'], 'B4', 8), (28.5, 29.45, ['F#4', 'D5', 'F#5', 'D5'], 'D5', 8)]
for i, (a, b, pat, lead, dens) in enumerate(steps):
    n = int(round((b - a) * dens))
    for k in range(n):
        zheng(a + k / dens, pat[k % 4], .5, .42 + .12 * i + .1 * k / n, 1.0)
    pipa(a, lead, b - a + .05, .55 + .1 * i, 1.0, trem=12 + 3 * i)
pipa(29.0, 'E5', .45, .8, trem=18)
drum(28.5, 'small', .5, .8); drum(29.0, 'small', .6, .9); drum(29.25, 'small', .7, 1.0)
KEY['folds'] = [24.0, 25.0, 26.0]

# C7 展开 30.0–31.0
gliss(30.0, ['D4', 'E4', 'F#4', 'A4', 'B4'], .03, .55)
gliss(30.25, ['A4', 'B4', 'D5', 'E5', 'F#5'], .03, .62)
gliss(30.5, ['D5', 'E5', 'F#5', 'A5', 'B5'], .03, .7)
KEY['unfolds'] = [30.0, 30.25, 30.5]

# C8 满村红 31.0–38.0
T8 = 31.0
gong(T8, 'big', .9, 1.2)
drum(T8, 'large', .95, 1.3)
add(STEMS['pipa'], P.strum('pipa', ['D4', 'A4', 'D5', 'F#5'], 1.5, vel=.85, spread=.018), T8, 1.0, -.1)
for p in ['D3', 'A3', 'D4', 'F#4', 'A4']: zheng(T8, p, 2.0, .7, .8)
flute(T8, 'D6', 1.0, .6, .6); erhu(T8, 'A4', 1.0, .6, .7)
# 句一（31–35）全奏
melody(31.0, P1, 'pipa', v=.78)
melody(31.0, P1, 'flute', v=.5, octave=1, g=.45)
erhu(31.0, 'D5', 1.0, .5, .55); erhu(32.0, 'E5', 1.0, .5, .55); erhu(33.0, 'B4', 1.0, .5, .55); erhu(34.0, 'A4', 1.0, .55, .6)
zheng_bars(31.0, HARM1[:1], v=.34, g=.75, dens=2)
zheng_bars(34.0, HARM1[3:], v=.34, g=.75, dens=2)
# 八扇窗：筝五声上行八音（清楚、偏右声像、力度高）
WIN = ['F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5']
WINBUF = np.zeros((N, 2), np.float32)
for i, p in enumerate(WIN):
    t = 32.0 + i * .25
    x = S.note('dan_tranh', p, 1.0, vel=.82)
    add(STEMS['zheng'], x, t, 1.25, .45 - .1 * (i % 2)); add(WINBUF, x, t, 1.0, 0)
KEY['windows'] = [32.0 + i * .25 for i in range(8)]
for k in range(14):
    t = 31.0 + k * B
    drum(t, 'large' if k % 2 == 0 else 'small', .7 if k % 2 == 0 else .5, .9)
    wb(t + .25, .45, 'b', .8)
gong(33.0, 'small', .5, .6); gong(35.0, 'small', .55, .7)
# 句二后半（35–38）：旁白 L4 在 35.2–37.43 → 只留琵琶 + 筝 + 轻打击
melody(35.0, P2[4:], 'pipa', v=.62, g=.85)
zheng_bars(35.0, HARM2[1:], v=.3, g=.7, dens=2)
for k in range(6): wb(35.0 + k * B, .35, 'b', .7)
gong(37.5, 'small', .6, .8)
flute(37.0, 'D6', 1.0, .4, .45)
KEY['tutti'] = 31.0; KEY['phraseEnd'] = 37.5

# C9 天亮 38.0–42.5：慢版（拍 = 0.667 s）
u = .667 / 2
melody(38.4, P1[:7], 'flute', unit=u, v=.4, g=.75)
erhu(38.0, 'D4', 2.4, .35, .45); erhu(40.4, 'A4', 2.2, .35, .45)
for k, p in enumerate(['D5', 'A5', 'F#5', 'A5', 'E5', 'A5', 'D5', 'B5', 'A5', 'F#5', 'E5', 'D5']):
    zheng(38.2 + k * .35, p, 1.2, .25, .6, .35)
zheng(38.0, 'D3', 3.0, .35, .6)

# C10 尾句 42.5–46.0：D 落在 44.0
melody(42.5, [('A5', 1), ('F#5', 1)], 'pipa', v=.66)
melody(43.0, [('E5', 1), ('D5', 1), ('B4', 1), ('E5', 1)], 'pipa', v=.68)
melody(42.5, [('A5', 1), ('F#5', 1), ('E5', 1), ('D5', 1), ('B4', 1), ('E5', 1)], 'flute', v=.42, octave=0, g=.55)
pipa(44.0, 'D5', 2.4, .75, trem=12)
flute(44.0, 'D5', 2.0, .45, .55)
for i, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']): zheng(44.0 + i * .035, p, 3.0, .58, .85)
erhu(44.0, 'A4', 1.8, .38, .45)
gong(44.0, 'small', .6, .9)
zheng(42.5, 'A3', 1.0, .35, .7); zheng(43.0, 'B3', 1.0, .35, .7); zheng(43.5, 'E3', .8, .35, .7)
KEY['cadence'] = 44.0

# C11 片尾
for t in [46.5, 47.0]: wb(t, .6, 'a', 1.0, 0)
KEY['endTicks'] = [46.5, 47.0]

# ================= 混响、静音窗、导出 =================
REV = {'pipa': (.42, .16), 'zheng': (.5, .2), 'winds': (.5, .2), 'perc': (.38, .12)}
GAIN = {'pipa': 1.0, 'zheng': .8, 'winds': .75, 'perc': .9}
env = np.ones(N, np.float32)
tt = np.arange(N) / SR
def zero(a, b, fin=.03, fout=.03):
    m = (tt >= a) & (tt < b); env[m] = 0
    ia = int(a * SR); k = int(fin * SR); env[max(0, ia - k):ia] = np.minimum(env[max(0, ia - k):ia], np.linspace(1, 0, ia - max(0, ia - k)))
    ib = int(b * SR); k = int(fout * SR); env[ib:ib + k] = np.minimum(env[ib:ib + k], np.linspace(0, 1, k))
# 16.5 之后淡出，17.0 前归零
m = (tt >= 16.6) & (tt < 17.0); env[m] = np.minimum(env[m], np.linspace(1, 0, m.sum()))
zero(17.0, 19.5, .01, .15)
zero(29.5, 30.0, .03, .01)
# 结尾淡完
m = tt >= 47.6; env[m] *= np.linspace(1, 0, m.sum()) ** 1.5

out = {}
for k, x in STEMS.items():
    y = S.room(x, *REV[k]) * GAIN[k]
    y *= env[:, None]
    out[k] = y.astype(np.float32)
# 18.3 极轻木鱼（静场里唯一的一声，静音窗之后加入）
wbq = np.zeros((N, 2), np.float32)
add(wbq, S.hit('woodblock', 'c', vel=.25), 18.3, .18, 0)
out['perc'] += S.room(wbq, .35, .12)
mix = sum(out.values())
pk = np.abs(mix).max()
g = (10 ** (-1.2 / 20)) / pk
for k in out:
    out[k] *= g
    sf.write(os.path.join(HERE, 'stems', k + '.wav'), out[k], SR)
mix *= g
sf.write(os.path.join(HERE, 'score.wav'), mix, SR)
json.dump(KEY, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
open(os.path.join(HERE, 'CREDITS.txt'), 'w').write('\n'.join(S.credits(['dan_tranh', 'dan_tranh_trem', 'erhu', 'flute', 'woodblock', 'gong2', 'frame_drum'])) + '\nPipa: physical-model plucked string (core/audio/pluck.py), original synthesis.\n')

# ---------- 自检 ----------
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
seg = lambda a, b: mix[int(a * SR):int(b * SR)]
cues = [('C0', 0, 3), ('C1', 3, 7), ('C2', 7, 12), ('C3', 12, 17), ('C4', 17, 19.5), ('C5', 19.5, 24), ('C6', 24, 29.5), ('C6x', 29.5, 30), ('C7', 30, 31), ('C8', 31, 38), ('C9', 38, 42.5), ('C10', 42.5, 46), ('C11', 46, 49)]
print('peak dBFS', round(20 * np.log10(np.abs(mix).max()), 2))
for n, a, b in cues: print(n, a, b, 'RMS', round(db(seg(a, b)), 1))
q = seg(17.0, 19.5).copy(); q2 = np.concatenate([seg(17.0, 18.25), seg(18.9, 19.5)])
print('silence 17.0-19.5 (excl woodblock) peak dB', round(20 * np.log10(np.abs(q2).max() + 1e-12), 1))
print('silence 29.5-30.0 peak dB', round(20 * np.log10(np.abs(seg(29.53, 29.99)).max() + 1e-12), 1))
print('31.0 jump: 30.6-30.99', round(db(seg(30.6, 30.99)), 1), '31.0-31.4', round(db(seg(31.0, 31.4)), 1))
# 八窗音起音时间（zheng 干声 onset）
z = WINBUF.mean(1)
for i, t in enumerate(KEY['windows']):
    w = np.abs(z[int((t - .05) * SR):int((t + .08) * SR)])
    if i: w = w - 0  # 前一音余振已衰减
    on = np.argmax(w > .3 * w.max()) / SR + t - .05
    print('window', t, 'onset err ms', round((on - t) * 1000, 1))
from scipy.signal import welch
f, Pw = welch(mix.mean(1), SR, nperseg=8192)
band = lambda lo, hi: 10 * np.log10(Pw[(f >= lo) & (f < hi)].sum() + 1e-20)
print('band dB 60-250', round(band(60, 250), 1), '250-2k', round(band(250, 2000), 1), '2k-8k', round(band(2000, 8000), 1), '8k-20k', round(band(8000, 20000), 1))
