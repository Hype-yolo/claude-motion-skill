"""物理建模拨弦（扩展 Karplus-Strong 数字波导）+ 模态合成（卡林巴 / 八音盒）。返回单声道 float32 @ SR。

    from core.audio import pluck as P
    x = P.pluck('guqin', 'D3', 4, vel=.7, bend=[(0.6, 0), (1.2, 2)], vib=(5, .25, 1.4))   # 古琴：按音上滑二度 + 吟猱
    y = P.pluck('guqin', 'A4', 3, harmonic=True)                                           # 泛音
    z = P.pluck('pipa', 'E4', 1.5, trem=14)                                                # 琵琶轮指
    w = P.pluck('shamisen', 'C4', 1.2)                                                    # 三味线（带 sawari 蜂鸣）

模型：分数延迟（三阶 Lagrange，可随时间变化→滑音/揉弦）+ 单极点损耗滤波（频率相关衰减）
+ 多级一阶全通（弦的刚性/非谐性）+ 拨弦位置梳状滤波 + 三味线/琵琶的 sawari 琴码碰撞非线性 + 琴体共鸣滤波器组。
"""
import numpy as np
from scipy.signal import butter, sosfilt, lfilter
try: from numba import njit
except ImportError: raise ImportError('pluck.py needs numba: install the music tier: sh plugin/skills/lemo-opuscar/scripts/setup.sh deps music') from None

try:
    from .sfx import SR
except ImportError:
    from sfx import SR

_rng = np.random.default_rng(11)


def midi(p):
    if isinstance(p, (int, float, np.integer, np.floating)): return float(p)
    import re
    m = re.fullmatch(r'\s*([A-Ga-g])([#sb]*)(-?\d+)\s*', str(p))
    if not m: raise ValueError(f'无法解析音高 {p!r}')
    return float(12 * (int(m.group(3)) + 1) + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[m.group(1).upper()]
                 + m.group(2).count('#') + m.group(2).count('s') - m.group(2).count('b'))


def _hz(m): return 440.0 * 2 ** ((m - 69) / 12)


# —— 波导核心（numba） ——
@njit(cache=True, fastmath=True)
def _loop(exc, D, g, p, ap, nap, buzz, thr):
    n = len(exc); M = 1
    while M < int(D.max()) + 16: M *= 2
    buf = np.zeros(M); out = np.zeros(n); w = 0; lp = 0.0
    st_x = np.zeros(8); st_y = np.zeros(8)
    for i in range(n):
        d = D[i]; r = w - d; ri = int(np.floor(r)); fr = r - ri
        x0 = buf[(ri - 1) & (M - 1)]; x1 = buf[ri & (M - 1)]; x2 = buf[(ri + 1) & (M - 1)]; x3 = buf[(ri + 2) & (M - 1)]
        # 三阶 Lagrange 分数延迟（fr∈[0,1)，在 x1..x2 之间）
        c0 = -fr * (fr - 1) * (fr - 2) / 6; c1 = (fr + 1) * (fr - 1) * (fr - 2) / 2
        c2 = -(fr + 1) * fr * (fr - 2) / 2; c3 = (fr + 1) * fr * (fr - 1) / 6
        v = c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3
        lp = (1 - p) * v + p * lp          # 损耗：单极点低通（高频衰减更快）
        s = g * lp
        for k in range(nap):               # 刚性：一阶全通级联（非谐性）
            y = ap * s + st_x[k] - ap * st_y[k]
            st_x[k] = s; st_y[k] = y; s = y
        if buzz > 0 and s > thr:           # sawari：弦撞琴码（单边软限幅 → 持续的明亮蜂鸣）
            s = thr + (s - thr) * (1 - buzz) + buzz * thr * np.tanh((s - thr) / (thr + 1e-9)) * .3
        o = exc[i] + s
        buf[w & (M - 1)] = o; out[i] = o; w += 1
    return out


def _ap_delay(a, f):
    """一阶全通 (a + z^-1)/(1 + a z^-1) 在频率 f 的相位延迟（样本）"""
    wv = 2 * np.pi * f / SR
    ph = np.angle((a + np.exp(-1j * wv)) / (1 + a * np.exp(-1j * wv)))
    return -np.unwrap(np.atleast_1d(ph)) / wv


def _lp_delay(p, f):
    wv = 2 * np.pi * f / SR
    return -np.angle((1 - p) / (1 - p * np.exp(-1j * wv))) / wv


def _body(x, modes, mix):
    """琴体共鸣：并联二阶带通（频率, Q, 增益）"""
    if not modes: return x
    y = np.zeros_like(x)
    for f, q, a in modes:
        if f >= SR / 2 * .95: continue
        bw = f / q; lo, hi = max(20, f - bw / 2), min(SR / 2 * .98, f + bw / 2)
        y += a * sosfilt(butter(1, [lo, hi], 'band', fs=SR, output='sos'), x)
    return x * (1 - mix) + y * mix * 2.5


# —— 预设 ——
# t60: 基频处衰减到 -60dB 的秒数（高音会自动缩短）；damp: 损耗低通 0..0.9（越大越暗、高频死得越快）
# pos: 拨弦位置（0.5=弦中点，越小越靠琴码越亮）；exc: finger(三角位移) / pick(拨片,更亮) / bachi(三味线拨子)
# nap/ap: 全通级数与系数（刚性，钢弦大）；buzz/thr: sawari；body: 共鸣峰 (Hz, Q, 增益), bmix: 琴体比例
PRESETS = {
    'guqin':    dict(t60=7.0, damp=.45, pos=.13, exc='finger', nap=1, ap=-.05, bright=.35, body=[(95, 5, 1), (210, 6, .8), (420, 6, .5), (820, 5, .35), (1500, 4, .2)], bmix=.55, noise=.02, slide_noise=.5),
    'pipa':     dict(t60=2.8, damp=.18, pos=.09, exc='pick', nap=2, ap=-.12, bright=.8, body=[(190, 7, 1), (420, 7, .8), (900, 6, .6), (1900, 5, .4), (3300, 4, .25)], bmix=.45, noise=.05),
    'shamisen': dict(t60=1.4, damp=.12, pos=.06, exc='bachi', nap=2, ap=-.1, bright=.95, buzz=.6, thr=.18, body=[(260, 3, 1), (620, 3, .8), (1300, 3, .6), (2800, 3, .5)], bmix=.5, noise=.08, skin=.6),
    'koto':     dict(t60=3.5, damp=.3, pos=.22, exc='pick', nap=1, ap=-.06, bright=.55, body=[(140, 6, 1), (300, 6, .8), (640, 5, .5), (1300, 4, .3)], bmix=.5, noise=.03),
    'banjo':    dict(t60=1.1, damp=.1, pos=.1, exc='pick', nap=3, ap=-.2, bright=.9, body=[(380, 4, 1), (850, 4, .8), (1700, 4, .7), (3100, 3, .5)], bmix=.6, noise=.04, skin=.25),
    'acoustic_guitar': dict(t60=4.5, damp=.3, pos=.13, exc='pick', nap=2, ap=-.15, bright=.6, body=[(98, 8, 1), (204, 8, .9), (390, 6, .6), (560, 6, .5), (1050, 4, .3), (2400, 3, .15)], bmix=.5, noise=.03),
    'nylon_guitar': dict(t60=3.5, damp=.45, pos=.15, exc='finger', nap=1, ap=-.05, bright=.4, body=[(98, 8, 1), (200, 8, .9), (390, 6, .6), (560, 6, .4)], bmix=.5, noise=.02),
    'upright_bass_pizz': dict(t60=1.8, damp=.55, pos=.28, exc='finger', nap=1, ap=-.03, bright=.25, body=[(62, 5, 1), (105, 6, .9), (190, 5, .6), (400, 4, .3)], bmix=.55, noise=.02, thump=.35),
    'harp':     dict(t60=6.0, damp=.4, pos=.45, exc='finger', nap=1, ap=-.03, bright=.35, body=[(180, 5, 1), (380, 5, .7), (800, 4, .4)], bmix=.4, noise=.01),
    'kalimba':  dict(modal=True),
    'music_box': dict(modal=True),
}


def _excite(kind, N, vel, pos, bright, noise):
    """激励：初始位移形状（按拨弦位置的三角形）+ 少量噪声，按力度/亮度低通"""
    n = max(4, int(N))
    k = max(1, int(round(pos * n)))
    tri = np.concatenate([np.linspace(0, 1, k, endpoint=False), np.linspace(1, 0, n - k)])
    e = tri - tri.mean()
    if kind in ('pick', 'bachi'):   # 拨片：更尖锐的初始速度 + 高频
        e = e + (.4 if kind == 'pick' else .7) * np.diff(np.concatenate([[0], tri])) * n / 6
    e = e + noise * _rng.standard_normal(n) * (1 + vel)
    fc = float(np.clip(700 + 15000 * bright * vel ** 1.3, 400, SR / 2 * .9))
    e = sosfilt(butter(2, fc, 'low', fs=SR, output='sos'), np.concatenate([e, np.zeros(n)]))[:n]
    # 拨弦位置梳状（去掉节点处的谐波）
    d = int(round(pos * n)); e2 = e.copy(); e2[d:] -= e[:-d] * .6 if d > 0 else 0
    return e2 / (np.abs(e2).max() + 1e-9)


def _pitch_curve(m, n, bend=None, vib=None, glide=None):
    """逐样本音高（midi）：bend=[(t,半音),...] 分段线性；vib=(Hz, 半音深度, 起始秒)；glide=(目标音高, 秒) 滑到"""
    t = np.arange(n) / SR; c = np.full(n, float(m))
    if bend:
        bt, bv = zip(*sorted(bend)); c += np.interp(t, bt, bv)
    if glide:
        tgt, gt = midi(glide[0]), glide[1]; c += (tgt - m) * np.clip(t / max(gt, 1e-3), 0, 1) ** 1.5
    if vib:
        rate, depth = vib[0], vib[1]; st = vib[2] if len(vib) > 2 else .3
        ramp = np.clip((t - st) / .4, 0, 1)
        c += depth * ramp * np.sin(2 * np.pi * rate * np.maximum(t - st, 0))
    return c


def _string(pr, m, dur, vel, harmonic=False, bend=None, vib=None, glide=None, trem=None, **kw):
    q = dict(pr); q.update({k: v for k, v in kw.items() if k in q or k in ('t60', 'damp', 'pos', 'bright', 'buzz', 'thr', 'bmix', 'noise')})
    f0 = _hz(m)
    n = int((dur + min(q['t60'], 4)) * SR) if dur is not None else int(q['t60'] * SR)
    pc = _pitch_curve(m, n, bend, vib, glide); f = _hz(pc)
    damp = q['damp']; ap, nap = q['ap'], q['nap']
    if harmonic:  # 泛音：只留高次、纯净，更长的钟声般衰减
        damp = min(.85, damp + .3); q['pos'] = .5; q['bright'] = .15; nap = 0; q['noise'] = 0
    # 高音衰减更快（真实弦：t60 大约随频率下降）
    t60 = q['t60'] * (1.8 if harmonic else 1) * (220 / max(f0, 30)) ** .35
    g = 10 ** (-3 / (t60 * f0))
    comp = _lp_delay(damp, f) + (nap * _ap_delay(ap, f) if nap else 0)
    D = SR / f - comp
    D = np.maximum(D, 4.0)
    N0 = SR / f0
    exc = np.zeros(n)
    hits = [0.0]
    if trem:  # 轮指/摇指：按 trem Hz 重复拨，力度略随机
        hits = list(np.arange(0, dur, 1 / trem))
    for i, th in enumerate(hits):
        v = vel * (1 if i == 0 else .75 + .2 * _rng.random())
        e = _excite(q['exc'], N0, v, q['pos'] * (1 + .15 * (_rng.random() - .5) * (i > 0)), q['bright'], q['noise']) * v
        s = int(th * SR); exc[s:s + len(e)] += e[:max(0, n - s)]
    y = _loop(exc, D, g, damp, ap, nap, q.get('buzz', 0.0) * (0 if harmonic else 1), q.get('thr', 1.0))
    if harmonic:  # 泛音：在基础上压掉基频以下的"弦身"感，加一点二倍泛音的钟感
        y = sosfilt(butter(2, f0 * .7, 'high', fs=SR, output='sos'), y)
    # 附加：三味线/班卓的鼓皮拍击、贝斯的指肚闷击、古琴按弦滑动的丝弦摩擦声
    if q.get('skin'):
        L = int(.03 * SR); nz = _rng.standard_normal(L) * np.exp(-np.arange(L) / (.006 * SR))
        y[:L] += q['skin'] * vel * sosfilt(butter(2, [300, 2500], 'band', fs=SR, output='sos'), nz) * 3
    if q.get('thump'):
        L = int(.06 * SR); tt = np.arange(L) / SR
        y[:L] += q['thump'] * vel * np.sin(2 * np.pi * 70 * tt) * np.exp(-tt / .015)
    if q.get('slide_noise') and (bend or glide or vib):
        sp = np.abs(np.gradient(pc)) * SR  # 半音/秒
        nz = sosfilt(butter(2, [900, 4500], 'band', fs=SR, output='sos'), _rng.standard_normal(n))
        env = np.convolve(np.minimum(sp / 8, 1), np.ones(480) / 480, 'same')
        y += q['slide_noise'] * .04 * vel * nz * env * np.exp(-np.arange(n) / (SR * t60 * .6))
    y = _body(y, q['body'], q['bmix'])
    if dur is not None:  # 止音：dur 之后按 0.12~0.35s 阻尼
        dn = int(dur * SR)
        if dn < n:
            rel = kw.get('release', .25 if not harmonic else .8)
            tt = np.arange(n - dn) / SR; y[dn:] *= np.exp(-6.9 * tt / max(rel, .01))
            y = y[:dn + int(rel * SR)]
    return y


# —— 模态：卡林巴 / 八音盒 ——
def _modal(kind, m, dur, vel, **kw):
    f0 = _hz(m); rng = _rng
    if kind == 'kalimba':
        # 钢片（一端固定悬臂梁）的实际分音比约 1 : 5.9 : 16.6，外加共鸣箱与指甲拨击声
        parts = [(1.0, 1.0, 1.0), (5.93, .22 * vel + .05, .16), (16.6, .06 * vel, .05), (2.0, .04, .5)]
        T = kw.get('t60', 2.6 * (330 / max(f0, 80)) ** .4)
        click_bp = (2000, 7000); click_a = .15; bodyf = [(260, 4, 1), (520, 4, .5)]; bmix = .25
    else:  # music_box：钢梳齿，高次分音更亮、衰减短，带机械拨齿的"嗒"声和轻微双齿拍频
        parts = [(1.0, 1.0, 1.0), (1.003, .35, .9), (6.27, .3 * vel + .08, .22), (17.55, .12 * vel, .07), (3.0, .05, .3)]
        T = kw.get('t60', 1.8 * (880 / max(f0, 200)) ** .5)
        click_bp = (3000, 12000); click_a = .25; bodyf = [(600, 3, 1), (1400, 3, .6)]; bmix = .2
    dn = int(((dur or T) + (T * .6 if dur else 0)) * SR); dn = min(dn, int(T * 1.6 * SR)) if dur is None else dn
    t = np.arange(dn) / SR; y = np.zeros(dn)
    for r, a, tf in parts:
        fr = f0 * r
        if fr > SR / 2 * .9: continue
        ph = rng.random() * 2 * np.pi
        y += a * np.sin(2 * np.pi * fr * t + ph) * np.exp(-6.9 * t / (T * tf))
    L = int(.012 * SR); nz = rng.standard_normal(L) * np.exp(-np.arange(L) / (.0015 * SR))
    y[:L] += click_a * vel * sosfilt(butter(2, click_bp, 'band', fs=SR, output='sos'), nz) * 4
    y[:64] *= np.linspace(0, 1, 64)
    y = _body(y, bodyf, bmix)
    if dur is not None:
        d0 = int(dur * SR)
        if d0 < len(y):
            rel = kw.get('release', T * .5); tt = np.arange(len(y) - d0) / SR; y[d0:] *= np.exp(-6.9 * tt / max(rel, .01))
    return y


def pluck(preset, pitch, dur=None, vel=.8, **kw):
    """preset: guqin/pipa/shamisen/koto/banjo/acoustic_guitar/nylon_guitar/upright_bass_pizz/harp/kalimba/music_box
    pitch: 'D3' 或 midi（可小数）；dur: 按住时长(s)，None=自然衰减完；vel 0..1
    kw: harmonic=True（泛音）、bend=[(t,半音)...]、vib=(Hz,深度半音,起始s)、glide=(目标音高,s)、trem=Hz（轮指/摇指）、
        以及覆盖预设参数 t60/damp/pos/bright/buzz/thr/bmix/noise、release"""
    if preset not in PRESETS: raise KeyError(f'未知预设 {preset!r}；可用 {list(PRESETS)}')
    m = midi(pitch); vel = float(np.clip(vel, .01, 1))
    pr = PRESETS[preset]
    y = _modal(preset, m, dur, vel, **kw) if pr.get('modal') else _string(pr, m, dur, vel, **kw)
    y = sosfilt(butter(1, 25, 'high', fs=SR, output='sos'), y)
    k = min(len(y), 960); y[-k:] *= np.linspace(1, 0, k)  # 尾部 20ms 淡出，防止截断咔哒
    # 电平：按最响 0.1s 窗的 rms 归一（与 sampler 的乐器电平大致相当），峰值不超过 0.9
    w = int(.1 * SR); r = np.sqrt(np.convolve(y[:int(1.5 * SR)] ** 2, np.ones(w) / w, 'valid').max() + 1e-12) if len(y) > w else np.abs(y).max() + 1e-9
    y = y * (.1 / r) * (vel / .8) ** 1.2
    pk = np.abs(y).max()
    if pk > .9: y *= .9 / pk
    return y.astype(np.float32)


def strum(preset, pitches, dur, vel=.8, spread=.025, up=False, **kw):
    """扫弦/琶音：依次拨出 pitches（up=True 从高到低），spread 为相邻弦间隔秒"""
    ps = list(pitches)[::-1] if up else list(pitches)
    xs = [pluck(preset, p, dur, vel * (1 - .05 * i), **kw) for i, p in enumerate(ps)]
    n = max(len(x) + int(i * spread * SR) for i, x in enumerate(xs)); out = np.zeros(n, np.float32)
    for i, x in enumerate(xs): s = int(i * spread * SR); out[s:s + len(x)] += x
    return out * np.float32(1 / np.sqrt(len(xs)))
