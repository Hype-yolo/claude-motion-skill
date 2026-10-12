"""程序化音效与混音工具（numpy/scipy）。所有函数返回单声道 float32 @ SR。"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
_rng = np.random.default_rng(7)


def t_(d): return np.arange(int(round(d * SR))) / SR   # 与 noise() 同样取整，避免长度差 1 相乘报错
def env_exp(d, tau): return np.exp(-t_(d) / tau)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(d): return _rng.standard_normal(int(round(d * SR)))
def norm(x, p=1.0): m = np.abs(x).max(); return x * (p / m) if m > 0 else x


def brown(d):
    w = np.cumsum(noise(d)); w -= np.linspace(w[0], w[-1], len(w)); return norm(hp(w, 20))


# —— 积木 / 玩具 ——
def click(pitch=1.0, v=1.0):
    """塑料积木扣合：极短噪声瞬态 + 两个高频共振 + 一点低频"""
    d = .06; tt = t_(d)
    tr = hp(noise(d), 2500) * env_exp(d, .0015)
    res = sum(a * np.sin(2 * np.pi * f * pitch * tt + _rng.random() * 6) * env_exp(d, tau)
              for f, a, tau in [(2900, .6, .012), (4600, .4, .008), (1500, .35, .018)])
    body = np.sin(2 * np.pi * 190 * pitch * tt) * env_exp(d, .01) * .5
    return norm(tr * .8 + res + body) * v


def clack(pitch=1.0, v=1.0):
    """积木砸在桌面上：木头的中频 + 塑料的高频"""
    d = .09; tt = t_(d); p = pitch * (.85 + _rng.random() * .3)
    x = hp(noise(d), 1200) * env_exp(d, .004) + sum(a * np.sin(2 * np.pi * f * p * tt) * env_exp(d, tau)
        for f, a, tau in [(1200, .6, .02), (2300, .5, .012), (380, .5, .03)])
    return norm(x) * v


def crash(v=1.0):
    d = .9; out = np.zeros(int(d * SR))
    for k in range(18):
        s = int((k / 18) ** 1.4 * .6 * SR); c = clack(.8 + _rng.random() * .6, .4 + _rng.random() * .6); out[s:s + len(c)] += c[:len(out) - s]
    out[:int(.2 * SR)] += lp(noise(.2), 400) * env_exp(.2, .05) * .8
    return norm(out) * v


def whoosh(d=.35, v=1.0):
    n = noise(d); tt = t_(d); out = np.zeros_like(n)
    for i in range(0, len(n), 480):   # 扫频带通
        hi = min(len(n), i + 480)     # 最后一块不足 480 个采样时按实际长度取（d 不是 0.01 s 整数倍也不会崩）
        f = 600 + 2600 * np.sin(np.pi * i / len(n)); seg = bp(n[max(0, i - 2000):hi], f * .7, f * 1.3)[-(hi - i):]; out[i:hi] = seg
    return norm(out * np.sin(np.pi * tt / d) ** 2) * v


def creak(v=1.0):
    d = .22; tt = t_(d); f0 = 70 + _rng.random() * 40
    saw = 2 * ((tt * f0 * (1 + .3 * np.sin(2 * np.pi * 9 * tt))) % 1) - 1
    return norm(bp(saw, 400, 3000) * (np.abs(np.sin(2 * np.pi * 23 * tt)) ** 3) * np.sin(np.pi * tt / d)) * v


def thump(v=1.0, f=70):
    d = .35; tt = t_(d)
    return norm(np.sin(2 * np.pi * f * tt * (1 - .3 * tt)) * env_exp(d, .07) + lp(noise(d), 300) * env_exp(d, .02) * .5) * v


def step(v=1.0):
    d = .05; tt = t_(d)
    return norm(hp(noise(d), 1800) * env_exp(d, .004) + np.sin(2 * np.pi * 2200 * tt) * env_exp(d, .006) * .5) * v


def ding(v=1.0):
    d = 1.6; tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau) for f, a, tau in [(1318, 1, .6), (2637, .5, .35), (3951, .3, .2), (1976, .25, .5), (5274, .15, .1)])
    return norm(x) * v


def pop(v=1.0):
    d = .18; tt = t_(d); f = 500 + 1400 * tt / d
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .05)) * v


def quindar(v=1.0, f=2525):
    d = .25; tt = t_(d); x = np.sin(2 * np.pi * f * tt); x[:240] *= np.linspace(0, 1, 240); x[-240:] *= np.linspace(1, 0, 240)
    return x * .5 * v


def rumble(d=1.5, v=1.0):
    return norm(lp(brown(d), 200)) * np.sin(np.pi * t_(d) / d / 2) ** 2 * v


def ignite(v=1.0):
    d = 1.8; tt = t_(d)
    sub = np.sin(2 * np.pi * 45 * tt * (1 - .25 * tt)) * env_exp(d, .5)
    burst = lp(noise(d), 1200) * env_exp(d, .35)
    return norm(sub * .9 + burst) * v


def roar(d, v=1.0):
    tt = t_(d); b = lp(brown(d), 700); crack = hp(noise(d), 3000) * (_rng.random(len(tt)) > .995) * 3
    e = np.minimum(1, tt / .4) * np.minimum(1, (d - tt) / .6)
    return norm(b + lp(crack, 6000) * .3) * e * v


def heartbeat(v=1.0):
    return (thump(1, 55) + np.pad(thump(.7, 50), (int(.22 * SR), 0))[:len(thump(1, 55))]) * v


# —— 人声 ——
def radio(x):
    """对讲机：带通 + 轻度失真 + 底噪"""
    y = bp(x, 380, 2800, 3); y = np.tanh(y * 3) / np.tanh(3)
    return norm(y + bp(_rng.standard_normal(len(y)), 1000, 4000) * .02) * .9


def compress(x, thr=.25, ratio=3.5, att=.004, rel=.08):
    env = np.zeros_like(x); a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); e = 0.0
    ax = np.abs(x)
    for i in range(len(x)):
        c = ax[i]; e = a * e + (1 - a) * c if c > e else r * e + (1 - r) * c; env[i] = e
    g = np.where(env > thr, (thr + (env - thr) / ratio) / np.maximum(env, 1e-9), 1.0)
    return x * g


def limit(x, ceil=.9, look=.005):
    """1D 前瞻限幅（多声道请逐声道调用）"""
    n = int(look * SR); pk = np.abs(x)
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    m = maximum_filter1d(pk, size=2 * n + 1); g = np.minimum(1, ceil / np.maximum(m, 1e-9)); g = uniform_filter1d(g, size=n)
    return x * g


def add(buf, x, at, gain=1.0, pan=0.0):
    s = int(at * SR)
    if s >= len(buf) or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    e = min(len(buf), s + len(x)); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[s:e, 0] += x[:e - s] * gain * l * 1.414; buf[s:e, 1] += x[:e - s] * gain * r * 1.414
