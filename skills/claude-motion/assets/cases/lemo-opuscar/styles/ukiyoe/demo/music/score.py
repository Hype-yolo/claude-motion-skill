"""Toward the Mountain — 原创配乐（序・破・急）
三味线（pluck 物理建模，sawari）+ 尺八（recorder/flute 采样：去颤音、气声、滑入、meri/kari）
+ 太鼓（大鼓/通鼓/框鼓采样 + 合成鼓皮）+ 拍子木（木块/响棒采样 + 合成硬木共振）
运行：.venv/bin/python styles/ukiyoe/demo/music/score.py   → music/score.wav, stems/, score.json
"""
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add

HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 44.0
N = int(DUR * SR)
rng = np.random.default_rng(1703)
S.seed(17)
def bpf(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lpf(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hpf(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def st(): return np.zeros((N, 2), np.float32)
stems = {k: st() for k in ['shamisen', 'shakuhachi', 'taiko', 'hyoshigi', 'other']}
EVENTS = []  # (t, stem, 说明)
def mark(t, k, d): EVENTS.append((round(t, 3), k, d))

# ——————————————— 拍子木（两块硬木互击）———————————————
def hyoshigi(v=1.0):
    L = int(.5 * SR); t = np.arange(L) / SR
    y = np.zeros(L)
    for f, a, tau in [(1180, 1., .05), (2460, .7, .035), (3870, .45, .022), (5300, .25, .012), (760, .35, .07)]:
        y += a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / tau)
    cl = rng.standard_normal(L) * np.exp(-t / .0018); y += 1.6 * bpf(cl, 1500, 9000)
    y /= np.abs(y).max()
    s1 = S.hit('world_perc', 'claves', .9); s2 = S.hit('woodblock', 'a', .9)
    out = np.zeros(L); out[:min(L, len(s1))] += s1[:L] / (np.abs(s1).max() + 1e-9) * .8; out[:min(L, len(s2))] += s2[:L] / (np.abs(s2).max() + 1e-9) * .45
    out += y * .9
    # 两块木头几乎同时相击：3 ms 后的第二个瞬态
    d = int(.003 * SR); out[d:] += .35 * out[:-d]
    return (out / np.abs(out).max() * .85 * v).astype(np.float32)

# ——————————————— 太鼓 ———————————————
def odaiko(v=1.0, big=False):
    L = int(2.4 * SR); t = np.arange(L) / SR
    f = 58 + 62 * np.exp(-t / .045)                       # 鼓皮被击后音高下滑
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (.55 if big else .42)) + .35 * np.sin(1.59 * ph + 1) * np.exp(-t / .22) + .18 * np.sin(2.14 * ph) * np.exp(-t / .12)
    don = bpf(rng.standard_normal(L), 90, 900) * np.exp(-t / .02) * .8   # 击面"咚"
    stick = bpf(rng.standard_normal(L), 1200, 5000) * np.exp(-t / .004) * .25  # 鼓槌
    syn = body + don + stick
    syn /= np.abs(syn).max()
    out = syn * .85
    for inst, var, g in [('gran_cassa', 'hit', .55), ('toms', 'low_mallet', .35), ('frame_drum', 'large', .3)]:
        s = S.hit(inst, var, min(1, .55 + .45 * v)); s = s[:L] / (np.abs(s).max() + 1e-9)
        out[:len(s)] += s * g
    out = lpf(out, 3500)
    return (out / np.abs(out).max() * v).astype(np.float32)
def cut(x, d):
    n = int(d * SR)
    if n >= len(x): return x
    x = x[:n].copy(); k = min(n, int(.08 * SR)); x[-k:] *= np.linspace(1, 0, k); return x
def shime(v=.6):
    L = int(.6 * SR); t = np.arange(L) / SR
    f = 390 + 140 * np.exp(-t / .01); ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / .07) + .5 * bpf(rng.standard_normal(L), 800, 4000) * np.exp(-t / .006)
    s = S.hit('frame_drum', 'small_muted', .7); s = s[:L] / (np.abs(s).max() + 1e-9)
    y = y / np.abs(y).max() * .7; y[:len(s)] += s * .5
    return (y / np.abs(y).max() * v).astype(np.float32)

# ——————————————— 三味线 ———————————————
def sam(p, v=.7, dur=None, **kw):
    kw.setdefault('buzz', .7)
    return P.pluck('shamisen', p, dur, v, **kw)

# ——————————————— 尺八（采样 recorder+flute → 去颤音、滑音、气声）———————————————
def _f0track(y, f):
    hop, Nw = 480, 2048; out = []
    for s in range(0, max(1, len(y) - Nw), hop):
        fr = y[s:s + Nw] * np.hanning(Nw); sp = np.abs(np.fft.rfft(fr, 8 * Nw)); fq = np.fft.rfftfreq(8 * Nw, 1 / SR)
        m = (fq > f * .85) & (fq < f * 1.18); out.append(fq[m][np.argmax(sp[m])] if sp[m].max() > 1e-6 else f)
    return np.array(out), hop
def shaku(p, dur, v=.7, slide=-1.5, fall=0.0, kari=0.0, swell=.5, breath=1.0, rel=.35):
    """p: 实际音高；slide: 起音从下方几个半音滑入（0=不滑）；fall: 句尾 meri 下滑半音（负）；kari: 句尾上扬（正）
    swell: 音中段渐强程度；breath: 气声比例"""
    m = S.midi(p); f = 440 * 2 ** ((m - 69) / 12)
    ext = dur + rel + .8
    a = S.note('recorder', max(m, S.midi('F4') - 3), ext, .7, release=.2)
    b = S.note('flute', max(m, S.midi('C4')), ext, .6, release=.2)
    n = min(len(a), len(b)); y = .62 * a[:n] / (np.abs(a).max() + 1e-9) + .38 * b[:n] / (np.abs(b).max() + 1e-9)
    y = y.astype(np.float64)
    # 1) 去掉幅度颤动：除以平滑包络
    w = int(.06 * SR); e = np.sqrt(np.convolve(y ** 2, np.ones(w) / w, 'same')) + 1e-4
    e = np.convolve(e, np.ones(w) / w, 'same'); y = y / e
    y[:int(.03 * SR)] *= np.linspace(0, 1, int(.03 * SR))
    # 2) 去掉音高颤动 + 施加滑音：变速重采样
    tr, hop = _f0track(y, f); dev = 12 * np.log2(tr / np.median(tr[3:]))  # 半音
    dev = np.clip(dev, -.6, .6)
    tt = np.arange(n) / SR; devs = np.interp(tt, np.arange(len(dev)) * hop / SR + 1024 / SR, dev)
    L = int((dur + rel) * SR); to = np.arange(L) / SR
    bend = np.zeros(L)
    if slide: sl = .16; bend += np.where(to < sl, slide * (1 - np.sin(np.clip(to / sl, 0, 1) * np.pi / 2)), 0)
    if fall: k = np.clip((to - (dur - .45)) / .5, 0, 1); bend += fall * k * k
    if kari: k = np.clip((to - (dur - .3)) / .3, 0, 1); bend += kari * np.sin(k * np.pi / 2)
    dv = np.interp(to + .05, tt, devs)
    phase = .05 * SR + np.concatenate([[0], np.cumsum(2 ** ((bend[:-1] - dv[:-1]) / 12))])
    phase = np.minimum(phase, n - 2)
    z = np.interp(phase, np.arange(n), y)
    # 3) 自己的包络：气先出、音后到；中段渐强再回落（尺八式呼吸）
    at = .12; envl = np.clip(to / at, 0, 1) ** 1.6
    mid = 1 + swell * np.sin(np.clip(to / max(dur, .1), 0, 1) * np.pi) ** 1.5 * .8
    relk = np.clip((to - dur) / rel, 0, 1); envl = envl * mid * (1 - relk) ** 2
    z = z * envl
    # 暗一点、中空一点
    z = lpf(z, 3200) * .8 + bpf(z, 900, 1600) * .5
    # 4) 气声：1–4 kHz 带通噪声，起音更强（muraiki）
    nz = bpf(rng.standard_normal(L), 1000, 4000, 3)
    be = .22 * envl + .9 * np.exp(-np.clip(to, 0, None) / .07) * np.clip(to / .012, 0, 1)
    z = z / (np.abs(z).max() + 1e-9) + breath * .5 * nz / (np.abs(nz).max() + 1e-9) * be
    z[-min(len(z), 480):] *= np.linspace(1, 0, min(len(z), 480))
    return (z / (np.abs(z).max() + 1e-9) * v).astype(np.float32)

def put(k, x, t, g=1.0, pan=0.0, note=None):
    add(stems[k], x, t, g, pan)
    if note: mark(t, k, note)

# ================= C1 印刷：拍子木 =================
for i, t in enumerate([.35, 1.05, 1.70, 2.30]):
    put('hyoshigi', hyoshigi(.8 + .07 * i), t, 1.0, (-.25, .2, -.1, .15)[i], f'拍子木 {i+1}（第{i+1}版）')

# ================= C2 序 2.9–10.5 =================
put('shamisen', P.strum('shamisen', ['D3', 'A3', 'D4'], None, .85, spread=.018, buzz=.8, t60=2.2), 2.9, 1.1, -.15, '片名：三味线和弦')
# 尺八开场动机 M：A4（滑入）— Bb4 — A4（meri 落）… G4
put('shakuhachi', shaku('A4', 1.55, .75, slide=-2, swell=.6), 3.05, 1, .1, '尺八：动机 A4')
put('shakuhachi', shaku('Bb4', .42, .6, slide=0, swell=.1, breath=.7), 4.72, 1, .1)
put('shakuhachi', shaku('A4', .95, .66, slide=0, fall=-1.2, swell=.3), 5.12, 1, .1)
put('shamisen', sam('A3', .45), 4.72, .7, -.2)
# 旁白 L1 6.0–9.5：只留一个低音长音 + 零星三味线
put('shakuhachi', shaku('D4', 2.9, .42, slide=-1, swell=.8, breath=.8, rel=.6), 6.35, 1, .1, '尺八：低音 ro 长音（让位旁白）')
put('shamisen', sam('D3', .4), 7.6, .6, -.2)
put('shamisen', sam('D5', .75, t60=.8, buzz=.5), 10.1, .9, .15, '印章：三味线 チン')

# ================= C3 雨 72 BPM =================
bt = 60 / 72
beats = [11.5 + i * bt for i in range(7)]
for i, b in enumerate(beats):
    quiet = 12.2 < b < 14.3
    put('shamisen', sam('D3' if i % 2 == 0 else 'A2', (.5 if quiet else .66)), b, .8, -.15, '三味线慢脉动 72BPM' if i == 0 else None)
    if b + bt / 2 < 16.9:
        put('shamisen', sam('A3' if i % 3 else 'D4', .3 if quiet else .38, buzz=.4), b + bt / 2, .6, .1)   # すくい 轻上拨
put('shamisen', sam('Eb5', .72, t60=.8, buzz=.5), 16.0, .9, .15, '印章：三味线')
put('shakuhachi', shaku('G4', .7, .55, slide=-1.5, swell=.3), 14.45, 1, .05, '尺八应答')
put('shakuhachi', shaku('A4', .95, .58, slide=0, kari=.8, swell=.4), 15.15, 1, .05)

# ================= C4 破 96 BPM =================
bt = 60 / 96; e8 = bt / 2
pat = ['D4', 'A3', 'D4', 'Eb4', 'D4', 'A3', 'G3', 'A3']
t = 17.3; i = 0
while t < 22.25:
    quiet = 18.0 < t < 20.7
    v = (.44 if quiet else .56) * (1.0 if i % 2 == 0 else .75)
    put('shamisen', sam(pat[i % 8], v, buzz=.55), t, .75, -.1 + .2 * (i % 2), '三味线固定音型 96BPM' if i == 0 else None)
    if i % 4 == 2: put('taiko', shime(.42 if quiet else .55), t, .9, .3, '締太鼓' if i == 2 else None)
    if i % 8 == 7: put('taiko', shime(.3), t + e8 / 2, .9, .3)
    t += e8; i += 1
put('shamisen', sam('D5', .75, t60=.8, buzz=.5), 21.95, .9, .15, '印章：三味线')
for k, p in enumerate(['D3', 'A3', 'D4', 'Eb4', 'G4', 'A4', 'Bb4', 'D5']):
    put('shamisen', sam(p, .5 + k * .04, buzz=.6), 22.32 + k * .06, .8, -.3 + k * .08, '急平移：上行快速琶音' if k == 0 else None)

# ================= C5 急（44 s 版：起浪 → 高悬 → 倒下 → 冲击）=================
# 心跳：23.2 起间隔 0.9 × 0.84 递减（25.4 前与 42 s 版一致），起浪段继续缩到 0.15，27.3 接高悬滚奏
ts = []; t = 23.2; gap = .9
while t < 27.3:
    ts.append(t); gap = max(.15, gap * .84); t += gap
for j, t in enumerate(ts):
    prog = (t - 23.2) / 4.1
    v = .55 + .33 * prog
    if 23.5 < t < 25.4: v *= .8
    put('taiko', cut(odaiko(min(1, v)), max(.45, 3 * (ts[j + 1] - t)) if j + 1 < len(ts) else .45), t, .85, (rng.random() - .5) * .3, '大太鼓心跳起（渐快）' if j == 0 else None)
mark(25.4, 'taiko', '起浪：心跳继续加速 0.45→0.15 s')
# 高悬 27.3–28.42：每 0.07 s 一击，渐强到最密最响
t = 27.3; j = 0
while t < 28.40:
    k = (t - 27.3) / 1.1
    put('taiko', cut(odaiko(min(1, .82 + .18 * k)), .28), t, .42 + .2 * k, (-.2, .2)[j % 2], '高悬：太鼓滚奏 0.07 s 渐强' if j == 0 else None)
    t += .07; j += 1
mark(28.42, 'other', '吸气：28.42–28.5 全部收住')
# 低频涌起（other）：brown 噪声 + 低正弦，起浪 → 高悬渐强
def swell(d, f0, f1, g0=.05, g1=1.0):
    n = int(d * SR); tt = np.arange(n) / SR
    br = lpf(np.cumsum(rng.standard_normal(n)), 120, 3); br = hpf(br, 28, 2); br /= np.abs(br).max()
    f = f0 + (f1 - f0) * tt / d; sn = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = (g0 + (g1 - g0) * (tt / d) ** 1.8); y = (.7 * br + .45 * sn) * env
    y[:int(.2 * SR)] *= np.linspace(0, 1, int(.2 * SR))
    return (y / np.abs(y).max()).astype(np.float32)
put('other', swell(3.02, 42, 55), 25.4, .55, 0, '低频涌起')
# 三味线震音 25.4 起渐强 → 高悬持续到最高点
tr = P.pluck('shamisen', 'D4', 3.02, .75, trem=13, buzz=.8, t60=1.0)
tr = (tr * np.linspace(.15, 1, len(tr)) ** 1.5).astype(np.float32)
put('shamisen', tr, 25.4, .7, -.25, '三味线震音渐强')
tr2 = P.pluck('shamisen', 'A4', 2.12, .7, trem=14, buzz=.8, t60=1.0); tr2 = (tr2 * np.linspace(.1, 1, len(tr2)) ** 2).astype(np.float32)
put('shamisen', tr2, 26.3, .55, .25)
tr3 = P.pluck('shamisen', 'D5', 1.12, .7, trem=15, buzz=.8, t60=.8); tr3 = (tr3 * np.linspace(.3, 1, len(tr3))).astype(np.float32)
put('shamisen', tr3, 27.3, .5, 0, '高悬：三味线震音最高点')
# 尺八高音嘶鸣（muraiki）27.6–28.4
put('shakuhachi', shaku('D6', .72, .9, slide=-2, kari=.7, swell=.5, breath=2.2, rel=.08), 27.6, .62, .1, '尺八高音嘶鸣 muraiki')
# 倒下 28.5：重击
FALL = 28.5
put('taiko', odaiko(.95, big=True), FALL, .9, 0, '倒下：重击（太鼓 + 拍子木 + 三味线和弦）')
put('shamisen', P.strum('shamisen', ['D3', 'A3', 'D4', 'A4'], .3, .9, spread=.008, buzz=1.0), FALL, .75, 0)
put('hyoshigi', hyoshigi(.85), FALL, .7, .2)
# 第二波滚奏：比高悬略稀、低频更重，渐强推向冲击
t = 28.75; j = 0
while t < 30.28:
    k = (t - 28.75) / 1.53
    put('taiko', cut(odaiko(min(1, .6 + .38 * k), big=True), .35), t, .38 + .2 * k, (-.15, .15)[j % 2], '第二波滚奏' if j == 0 else None)
    t += .095 - .02 * k; j += 1
put('other', swell(1.8, 36, 48, .15, 1.0), 28.56, .7, 0)
# 三味线下行刮奏
for k, p in enumerate(['D5', 'Bb4', 'A4', 'G4', 'Eb4', 'D4', 'A3', 'G3', 'Eb3', 'D3']):
    put('shamisen', sam(p, .55 + k * .035, buzz=.8), 29.05 + k * .065, .8, .3 - k * .06, '三味线下行刮奏' if k == 0 else None)
trl = P.pluck('shamisen', 'D3', .9, .8, trem=14, buzz=.9, t60=1.0); trl = (trl * np.linspace(.3, 1, len(trl)) ** 1.5).astype(np.float32)
put('shamisen', trl, 29.75, .7, -.1)
# 冲击 30.36（泡沫铺满）
IMP = 30.36
put('taiko', odaiko(1.0, big=True), IMP, 1.5, 0, '冲击：大太鼓 + 三味线和弦 + 拍子木')
put('taiko', odaiko(.9, big=True), IMP + .004, .8, -.3)
put('shamisen', P.strum('shamisen', ['D3', 'A3', 'D4', 'A4'], .3, 1.0, spread=.008, buzz=1.0), IMP, 1.0, 0)
put('hyoshigi', hyoshigi(.9), IMP, .8, .2)

# ================= C7 回响（整体 +2.0 s）=================
O = 2.0
for i, t in enumerate([30.2, 30.7, 31.2, 31.7]):
    put('taiko', odaiko(.72 + .09 * i, big=True), t + O, 1.0, (-.1, .1, -.05, .05)[i], f'太鼓第{i+1}版')
put('shamisen', P.strum('shamisen', ['D3', 'A3', 'D4'], None, .5, spread=.12, buzz=.6, t60=1.8), 32.1 + O, .5, -.2, '三味线轻分解和弦')
put('shakuhachi', shaku('A4', 1.3, .55, slide=-2, swell=.5), 32.05 + O, .62, .1, '尺八：动机回响')
put('shakuhachi', shaku('Bb4', .4, .46, slide=0, swell=.1, breath=.7), 33.5 + O, .62, .1)
put('shakuhachi', shaku('A4', .75, .5, slide=0, fall=-.8, swell=.3), 33.9 + O, .62, .1)
put('shakuhachi', shaku('G4', .55, .5, slide=0, swell=.2), 34.75 + O, .75, .1)
put('shakuhachi', shaku('D4', 1.05, .55, slide=-1, swell=.5, rel=.4), 35.3 + O, 1, .1, '尺八：落在主音 D')
put('shamisen', sam('A4', .38, harmonic=True), 35.1 + O, .7, .3, '摘斗笠：三味线泛音')
put('shamisen', P.strum('shamisen', ['D3', 'A3', 'D4'], None, .9, spread=.02, buzz=.85, t60=2.4), 36.3 + O, 1.1, 0, '终印：三味线终止和弦 + 太鼓 + 拍子木')
put('taiko', odaiko(.85, big=True), 36.3 + O, .9, 0)
put('hyoshigi', hyoshigi(.7), 36.3 + O, .7, .25)

# ================= C8 尾 =================
put('shakuhachi', shaku('D5', 3.6, .5, slide=-2, fall=-1.0, swell=.7, breath=1.1, rel=.9), 37.0 + O, 1, .1, '尺八最后长音')
put('shamisen', sam('D3', .7, t60=4.2, buzz=.9), 38.4 + O, 1.0, -.1, '三味线末音 sawari 长余振')

# ================= 混响、静音、合成 =================
wet = {'shamisen': (.45, .2), 'shakuhachi': (.6, .3), 'taiko': (.65, .22), 'hyoshigi': (.35, .12), 'other': (.5, .2)}
for k, (sz, mx) in wet.items():
    if np.abs(stems[k]).max() > 0: stems[k] = S.room(stems[k], size=sz, mix=mx).astype(np.float32)
GAIN = {'shamisen': 1.0, 'shakuhachi': .8, 'taiko': .95, 'hyoshigi': .85, 'other': 1.0}
MA0, MA1 = 30.40, 32.2
IN0, IN1 = 28.41, 28.498   # 吸气
fade = int(.06 * SR); a0 = int(MA0 * SR); a1 = int(MA1 * SR)
tail = int(DUR * SR) - int(.2 * SR)
fi = int(.01 * SR); i0 = int(IN0 * SR); i1 = int(IN1 * SR)
for k in stems:
    x = stems[k] * GAIN[k]
    x[a0:a0 + fade] *= np.linspace(1, 0, fade)[:, None]
    x[a0 + fade:a1] = 0
    x[a1 - 1] = 0
    x[i0:i0 + fi] *= np.linspace(1, 0, fi)[:, None]; x[i0 + fi:i1] = 0
    # 44.0 前归零
    x[tail:] *= np.linspace(1, 0, N - tail)[:, None]
    stems[k] = x.astype(np.float32)
mix = sum(stems.values())
pk = np.abs(mix).max(); sc = .89 / pk
mix *= sc
for k in stems: stems[k] *= sc
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
for k, x in stems.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), x, SR, subtype='FLOAT')

# ================= 自检 =================
mono = mix.mean(1)
def rms_db(a, b):
    s = mono[int(a * SR):int(b * SR)]; r = np.sqrt(np.mean(s ** 2)) + 1e-12; return round(20 * np.log10(r), 1)
def cent(a, b):
    s = mono[int(a * SR):int(b * SR)]
    if np.abs(s).max() == 0: return 0
    sp = np.abs(np.fft.rfft(s * np.hanning(len(s)))); f = np.fft.rfftfreq(len(s), 1 / SR); return round(float((sp * f).sum() / sp.sum()), 0)
CUES = [('C1 印刷', 0, 2.9), ('C2 序', 2.9, 10.5), ('C3 雨', 10.5, 17.3), ('C4 破', 17.3, 22.9), ('C5a 急·心跳', 22.9, 25.4), ('C5b 起浪', 25.4, 27.3), ('C5c 高悬', 27.3, 28.5), ('C5d 倒下', 28.5, 30.4), ('C6 間', 30.4, 32.2), ('C7 回响', 32.2, 38.8), ('C8 尾', 38.8, 44.0)]
table = [dict(cue=n, t0=a, t1=b, rms_db=rms_db(a, b), peak=round(float(np.abs(mix[int(a * SR):int(b * SR)]).max()), 3), centroid_hz=cent(a, b)) for n, a, b in CUES]
VO = [('L1', 6.0, 9.5), ('L2', 12.3, 14.2), ('L3', 18.0, 20.6), ('L4', 23.5, 25.4), ('L5', 34.4, 37.1)]
vo = [dict(line=n, rms_db=rms_db(a, b), mid_1_4k_db=round(20 * np.log10(np.sqrt(np.mean(bpf(mono[int(a * SR):int(b * SR)], 1000, 4000) ** 2)) + 1e-12), 1)) for n, a, b in VO]
silent = bool(np.all(mix[int((MA0 + .061) * SR):int(MA1 * SR)] == 0))
def onset_err(t, win=.03):
    # 起音 = 首次超过「前 25 ms 本底 + 30% 余量」的样本（不会被前一击的衰减误导）
    s = int((t - win) * SR); seg = np.abs(mono[s:s + int(2 * win * SR)])
    pre = np.abs(mono[int((t - .03) * SR):int((t - .005) * SR)]).max(); thr = pre + .3 * (seg.max() - pre)
    i = int(np.argmax(seg > thr)); return round((s + i) / SR * 1000 - t * 1000, 1), round(float(seg.max()), 3)
ons = {str(t): dict(zip(['err_ms', 'peak'], onset_err(t))) for t in [.35, 1.05, 1.70, 2.30, 32.2, 32.7, 33.2, 33.7, FALL, IMP]}
report = dict(dur=len(mix) / SR, sr=SR, peak=round(float(np.abs(mix).max()), 3), ma_silent_30_46_to_32_2=silent, inhale_silent_28_42_to_28_498=bool(np.all(mix[int(28.42 * SR):int(IN1 * SR)] == 0)),
              impact=IMP, cues=table, voice_windows=vo, onsets=ons, events=EVENTS,
              notes='都节音阶 D Eb G A Bb；开场动机 A4–Bb4–A4(meri)；C7 回响落在 D4。44 s 版：25.4 后拉长巨浪（起浪/高悬/吸气/倒下/冲击 30.36），間 30.4–32.2，其后整体 +2 s。拍子木=合成硬木共振+claves+woodblock；太鼓=合成鼓皮(120→58Hz)+gran_cassa+toms low_mallet+frame_drum large；尺八=recorder62%+flute38% 采样→除以平滑包络去幅度颤动、f0 跟踪反向变速去音高颤动、滑入/meri/kari 变速、1–4k 气声。')
json.dump(report, open(os.path.join(HERE, 'score.json'), 'w'), ensure_ascii=False, indent=1, default=float)
print(json.dumps({k: report[k] for k in ['dur', 'peak', 'ma_silent_30_46_to_32_2', 'inhale_silent_28_42_to_28_498', 'onsets']}, ensure_ascii=False))
for r in table: print(r)
for r in vo: print(r)
