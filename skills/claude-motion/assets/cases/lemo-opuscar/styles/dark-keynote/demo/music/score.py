"""《Room to Think》配乐（dark-keynote 风格 demo）—— 极简主义错相，A 大调 / 升 F 小调游移，120 BPM。

一键重建（任何目录）：  .venv/bin/python styles/dark-keynote/demo/music/score.py
唯一数据源：../timeline.json（音符时间 t、关键点 K）。所有乐音严格落在 t 上（按采样起音偏移补偿）。
输出（本目录）：score.wav、stems/*.wav、score.json、CREDITS_music.txt、check.txt（自检数字）。

段落与三个"时间窗"：
  A  4.0 → K.freeze(15.0)      桌面→相册→收件箱→全部→插入→上升；15.000 起样本级截断（混响尾巴一起截）
  B  K.press(16.0) → K.silence2(33.0)   收拢和弦→分类→揭幕→大数字→呼吸；33.000 起为 0
  C  K.endCard(37.0) → dur(42.0)        最后一个柔和 A 大九，42 s 前淡到 0
每个窗单独渲染 + 单独过混响，然后按窗遮罩——所以窗外（含两段静音、0–4 s、33–37 s）是真 0。
"""
import os, sys, json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, stft, istft

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, REPO)
from core.audio import sampler as S          # noqa: E402
from core.audio.sfx import SR                # noqa: E402

TL = json.load(open(os.path.join(HERE, '..', 'timeline.json')))
K, DUR, S16, BEAT = TL['K'], float(TL['dur']), TL['s16'], TL['beat']
V1, V2, V3, VC = TL['voice1'], TL['voice2'], TL['voice3'], TL['voiceClean']
N = int(round(DUR * SR))

S.seed(20260926)
RNG = np.random.default_rng(98)

T_V2 = V2[0]['t']                 # 6.0 相册：voice2 同度进入 + 铺底
T_PHASE = 8.0                     # 收件箱：voice2 开始错相（t 里已算好）+ 低频脉冲
T_ALL = 10.0                      # 全部：voice3 钟琴 + 沙锤 + 铺底加 G#/D#
T_INS = K['inserts'][0]           # 12.0 插入：脉冲十六分、voice2 走音变亮
T_RISE = K['freeze'] - 1.0        # 14.0 上升
T_STOP = K['freeze']              # 15.0
T_PRESS = K['press']              # 16.0
T_REVEAL = K['reveal']            # 20.0
T_NUM = K['num']                  # 26.0
T_BREATH = K['numBack']           # 29.5
T_SIL2 = K['silence2']            # 33.0
T_END = K['endCard']              # 37.0

WIN = {'A': (V1[0]['t'] - .004, T_STOP), 'B': (T_PRESS, T_SIL2), 'C': (T_END, DUR)}
STEMS = ['marimba', 'vibes', 'glock', 'pad', 'pulse', 'bowed']
BUF = {s: {w: np.zeros((N, 2), np.float32) for w in WIN} for s in STEMS}
NOTES, PERC = [], []


def win_of(t):
    for w, (a, b) in WIN.items():
        if a - 0.01 <= t < b: return w
    raise ValueError(f'{t} 不在任何音乐窗内')


def ramp(t, t0, t1, v0, v1, p=1.0):
    u = float(np.clip((t - t0) / (t1 - t0), 0, 1)) ** p
    return v0 + (v1 - v0) * u


def onset_off(x, thr_db=-20.0, cap=0.010):
    """采样起音偏移：前 0.2 s 内第一次到达峰值 -20 dB 的样本号（上限 10 ms）"""
    a = np.abs(x[:int(.2 * SR)]); pk = a.max()
    if pk <= 0: return 0
    return min(int(np.argmax(a >= pk * 10 ** (thr_db / 20))), int(cap * SR))


def put(stem, x, t, gain=1.0, pan=0.0, align=True, w=None):
    """把单声道 x 摆进 stem 的时间窗缓冲；align=True 时让起音（-20 dB 点）正好落在 t 上"""
    buf = BUF[stem][w or win_of(t)]
    s = int(round(t * SR)) - (onset_off(x) if align else 0)
    if s < 0: x = x[-s:]; s = 0
    e = min(N, s + len(x))
    if e <= s: return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    buf[s:e, 0] += x[:e - s] * gain * l
    buf[s:e, 1] += x[:e - s] * gain * r


def play(stem, inst, t, m, dur, vel, pan=0.0, gain=1.0, log=True, fx=None, **kw):
    x = S.note(inst, m, dur, vel, **kw)
    if fx is not None: x = fx(x)
    put(stem, x, t, gain, pan, align=(inst != 'vibraphone_bowed'))
    if log: NOTES.append([round(float(t), 4), inst, round(float(m), 3)])


# ——— 合成小工具 ———
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x, axis=0)
def bpf(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)
def hzm(m): return 440.0 * 2 ** ((np.asarray(m, float) - 69) / 12)


def saw_voice(m_env, detune_c, seed):
    """去谐锯齿 + 三角：m_env 为逐样本 midi 包络；返回 (n,2)"""
    r = np.random.default_rng(seed); n = len(m_env); out = np.zeros((n, 2))
    for k, (dc, pan) in enumerate([(-detune_c, -.7), (0, 0), (detune_c, .7)]):
        f = hzm(m_env + dc / 100); ph = (np.cumsum(f) / SR + r.random()) % 1.0
        saw = 2 * ph - 1
        l, rr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        out[:, 0] += saw * l; out[:, 1] += saw * rr
    f = hzm(m_env); ph = (np.cumsum(f) / SR + r.random()) % 1.0
    tri = 2 * np.abs(2 * ph - 1) - 1
    out += tri[:, None] * 1.2
    return out / 4


def pad_block(t0, t1, notes, seed, cut=(700, 700), rise=None):
    """铺底：notes=[(midi, 淡入起点, 淡入时长, 增益)]；rise=(起点, 终点, 半音) 音高爬升；cut=(起始截止, 终止截止) 线性打开"""
    n = int(round((t1 - t0) * SR)); tt = t0 + np.arange(n) / SR; out = np.zeros((n, 2))
    for j, (m, fi, fd, g) in enumerate(notes):
        me = np.full(n, float(m))
        if rise: me = me + rise[2] * np.clip((tt - rise[0]) / (rise[1] - rise[0]), 0, 1) ** 1.6
        env = np.clip((tt - fi) / fd, 0, 1); env = np.sin(env * np.pi / 2) ** 2
        out += saw_voice(me, 9 + 2 * j, seed + j) * (env * g)[:, None]
    a, b = lp(out, cut[0]), lp(out, cut[1])
    u = np.clip((tt - (rise[0] if rise else t0)) / ((rise[1] - rise[0]) if rise else 1), 0, 1)[:, None] if cut[0] != cut[1] else 0
    y = a * (1 - u) + b * u
    return hp(y, 60).astype(np.float32)


def put_st(stem, y, t0, w):
    s = int(round(t0 * SR)); e = min(N, s + len(y)); BUF[stem][w][s:e] += y[:e - s]


def thump(m, vel, tau=.11):
    """低频正弦脉冲：8 ms 起音 + 指数衰减 + 一点低通噪声"噗"，无下滑音（不做成 EDM 底鼓）"""
    d = tau * 5; t = np.arange(int(d * SR)) / SR; f = hzm(m)
    env = (1 - np.exp(-t / .008)) * np.exp(-t / tau)
    y = (np.sin(2 * np.pi * f * t) + .22 * np.sin(4 * np.pi * f * t)) * env
    puff = lp(RNG.standard_normal(len(t)), 380) * np.exp(-t / .012) * .5
    return ((y + puff) * vel * .35).astype(np.float32)


def shake(vel):
    d = .05; t = np.arange(int(d * SR)) / SR
    x = bpf(RNG.standard_normal(len(t)), 6000, 12500) * (1 - np.exp(-t / .002)) * np.exp(-t / .011)
    return (x * vel * .3).astype(np.float32)


def noise_sweep(t0, t1, f0, f1, seed):
    """噪声扫频（STFT 频域高斯带通，中心频率指数爬升）+ 指数渐强到顶"""
    n = int(round((t1 - t0) * SR)); x = np.random.default_rng(seed).standard_normal((n + 4096, 2))
    y = np.zeros_like(x)
    for c in range(2):
        f, tt, Z = stft(x[:, c], SR, nperseg=2048, noverlap=1536)
        u = np.clip(tt / (n / SR), 0, 1); fc = f0 * (f1 / f0) ** (u ** 1.3)
        G = np.exp(-.5 * (np.log(np.maximum(f[:, None], 1) / fc[None, :]) / .35) ** 2)
        _, yc = istft(Z * G, SR, nperseg=2048, noverlap=1536); y[:len(yc), c] = yc[:len(y)]
    y = y[:n]; tt = np.arange(n) / SR
    env = 10 ** ((-34 + 34 * (tt / (n / SR)) ** 1.8) / 20)
    return (y / (np.abs(y).max() + 1e-9) * env[:, None] * .5).astype(np.float32)


# ════════════════════ 窗 A：4.0 → 15.0 ════════════════════
# voice1 马林巴：pp→mp（4–6），6–12 维持 mp 缓升，12–15 推到 mf
for n in V1:
    t = n['t']
    vel = ramp(t, 4, 6, .26, .5) if t < 6 else ramp(t, 6, 12, .5, .58) if t < 12 else ramp(t, 12, T_STOP, .6, .78)
    vel += .04 if n['i'] in (0, 6) else 0
    play('marimba', 'marimba', t, n['m'], .55, vel, pan=-.38)


# voice2 颤音琴硬槌：6–8 同度；8 起按 t 错相；12 起走音 +15→+35 音分并变亮
def bright(b):
    def f(x):
        if b <= 0: return x
        k = 1 + 2.5 * b; ref = .12
        y = np.tanh(x / ref * k) / np.tanh(k) * ref            # 轻度饱和，多出上泛音
        return (y + b * .9 * hp(y, 2800)).astype(np.float32)   # 高架提亮
    return f


for n in V2:
    t = n['t']; m = n['m']
    cents = 0.0 if t < T_INS else ramp(t, T_INS, T_INS + 2, 15, 35)
    b = 0.0 if t < T_INS else ramp(t, T_INS, T_STOP, .25, 1.0)
    vel = ramp(t, T_V2, 8, .36, .46) if t < 8 else ramp(t, 8, 12, .46, .56) if t < 12 else ramp(t, 12, T_STOP, .62, .92)
    play('vibes', 'vibraphone_hard', t, m + cents / 100, .3, vel, pan=.4, release=.55, fx=bright(b))

# voice3 钟琴（音高已 +12）
for n in V3:
    t = n['t']
    play('glock', 'glockenspiel', t, n['m'], .45, ramp(t, T_ALL, T_STOP, .34, .6), pan=.12, release=.9)

# 铺底：6 起 A 持续（A2+E3），10 起加不协和 G#3 / D#4，12–14 缓升，14–15 爬升 +3 半音、截止频率打开、渐强到顶
padA = pad_block(T_V2, T_STOP, [(45, T_V2, 1.8, .9), (52, T_V2 + .3, 1.8, .7), (56, T_ALL, 1.2, .45), (63, T_ALL + .4, 1.2, .32)],
                 seed=11, cut=(650, 3200), rise=(T_RISE, T_STOP, 3.0))
tt = T_V2 + np.arange(len(padA)) / SR
gA = np.where(tt < T_INS, 1.0, np.interp(tt, [T_INS, T_RISE, T_STOP], [1.0, 1.35, 3.4]))
put_st('pad', padA * gA[:, None].astype(np.float32), T_V2, 'A')
put_st('pad', noise_sweep(T_RISE, T_STOP, 350, 9000, 5), T_RISE, 'A')      # 上升音效

# 低频正弦脉冲 A1：8–12 八分，12–15 十六分（重轻交替），14–15 渐强
t = T_PHASE
while t < T_STOP - 1e-6:
    if t < T_INS:
        put('pulse', thump(33, ramp(t, T_PHASE, T_INS, .55, .75)), t, align=False); step = 2 * S16
    else:
        acc = 1.0 if round((t - T_INS) / S16) % 2 == 0 else .6
        put('pulse', thump(33, acc * ramp(t, T_INS, T_STOP, .8, 1.25, 2), tau=.06), t, align=False); step = S16
    NOTES.append([round(t, 4), 'pulse_sine', 33]); t = round(t + step, 6)

# 噪声沙锤：10–15 十六分，反拍重
k = 0; t = T_ALL
while t < T_STOP - 1e-6:
    g = [.5, .25, .9, .3][k % 4] * ramp(t, T_ALL, T_STOP, .7, 1.3)
    put('pulse', shake(g), t, pan=.25 * (-1) ** k, align=False); PERC.append([round(t, 4), 'shaker_noise']); k += 1; t = round(T_ALL + k * S16, 6)

# ════════════════════ 窗 B：16.0 → 33.0 ════════════════════
AMAJ9 = [57, 61, 64, 68, 71]            # A3 C#4 E4 G#4 B4
# 16.0 收拢：全体齐奏 A 大九（不放 sub，那是拟音）
for m, p in [(45, -.15), (52, -.05)]:
    play('marimba', 'marimba', T_PRESS, m, 2.6, .95, pan=p, gain=1.8)
for m, p in zip(AMAJ9, [-.4, -.2, 0, .2, .4]):
    play('vibes', 'vibraphone_hard', T_PRESS, m, 3.6, .95, pan=p, release=1.6, gain=1.9)
for m, p in [(85, -.25), (88, .25)]:
    play('glock', 'glockenspiel', T_PRESS, m, 2.5, .75, pan=p, release=1.5, gain=1.6)
# 弓奏颤音琴：16.0 渐强，拖到 ~21 s（L-cut 进揭幕）→ F#m11 → Dmaj9 → A（26 起的持续底）→ 呼吸段渐弱
BOWED = [
    (T_PRESS, AMAJ9, 1.9, 21.0 - T_PRESS, 1.3, .62),                        # A 大九
    (20.75, [54, 61, 64, 69, 71], .9, 23.0 - 20.75, 1.0, .4),               # F#m11：F#3 C#4 E4 A4 B4
    (22.85, [57, 61, 64, 66], .8, 25.9 - 22.85, .9, .38),                   # Dmaj9（D 在脉冲里）：A3 C#4 E4 F#4
    (T_NUM, [57, 64, 71, 73], .6, T_BREATH + .5 - T_NUM, 2.0, .44),         # A add9：26 起轻持续，30 起 2 s 渐弱
]
for t0, ms, att, d, rel, vel in BOWED:
    for j, m in enumerate(ms):
        play('bowed', 'vibraphone_bowed', t0, m, d, vel, pan=(j / (len(ms) - 1) - .5) * .9, attack=att, release=rel)

# voiceClean：18–20 分类（mf），20–26 揭幕（轻），30–33 呼吸（减法）。力度用 v。
for n in VC:
    t = n['t']; v = n['v']
    if t >= T_BREATH:   # 呼吸段：32.5 前的音都在 32.5 前制音，32.5 之后只留最后那个 A 的尾巴
        d = .9 if t >= K['toCaret'] - 1e-6 else max(.1, min(.6, K['toCaret'] - t - .12))
        play('marimba', 'marimba', t, n['m'], d, v * 1.25, pan=-.2, release=.12 if t < K['toCaret'] else .8)
    else:
        play('marimba', 'marimba', t, n['m'], .5, v * (1.15 if t < T_REVEAL else .72), pan=-.3 if t < T_REVEAL else -.35)

# 揭幕段四分音符低频脉冲（轻），跟着和弦根音：A1 → F#1 → D2
t = T_REVEAL
while t < T_NUM - 1e-6:
    m = 33 if t < 20.75 else 30 if t < 22.85 else 38
    put('pulse', thump(m, .42, tau=.13), t, align=False); NOTES.append([round(t, 4), 'pulse_sine', m]); t = round(t + BEAT, 6)

# 侧栏三个勾：颤音琴 C#6 / E6 / A6（时间读 K.checks）
for t, m, p in zip(K['checks'], [85, 88, 93], [.3, .35, .4]):
    play('vibes', 'vibraphone_hard', t, m, .8, .5, pan=p, release=1.4)

# 大数字：26.0 起铺底轻持续（A1+A2+E3，低通），29.5 起渐弱，32.3 归零
padB = pad_block(T_NUM, 32.4, [(33, T_NUM, .6, .5), (45, T_NUM, .6, .6), (52, T_NUM + .2, .8, .4)], seed=23, cut=(520, 520))
tt = T_NUM + np.arange(len(padB)) / SR
put_st('pad', padB * np.interp(tt, [T_NUM, T_BREATH, 32.3, 32.4], [1, 1, 0, 0])[:, None].astype(np.float32), T_NUM, 'B')
# 逐位锁定：马林巴 A4 B4 C#5 E5 A5（K.locks）
for t, m, vel in zip(K['locks'], [69, 71, 73, 76, 81], [.55, .6, .64, .68, .78]):
    play('marimba', 'marimba', t, m, .8, vel, pan=.1)
# 27.0 颤音琴硬槌 A 大九和弦点，尾巴拖进呼吸段
for m, p in zip(AMAJ9, [-.35, -.15, 0, .15, .35]):
    play('vibes', 'vibraphone_hard', K['locks'][-1], m, 3.0, .6, pan=p, release=1.5)
# 28.0 钟琴单音点在 "0.8"
play('glock', 'glockenspiel', K['line2'], 88, 1.5, .48, pan=.15, release=1.5)

# ════════════════════ 窗 C：37.0 → 42.0 ════════════════════
for j, m in enumerate(AMAJ9):
    play('bowed', 'vibraphone_bowed', T_END, m, 2.6, .5, pan=(j / 4 - .5) * .9, attack=1.1, release=2.2)
for m, p, vel in [(45, -.2, .5), (52, -.1, .46), (61, .1, .42), (71, .25, .4)]:
    play('marimba', 'marimba', T_END, m, 4.2, vel, pan=p, release=1.0)

# ════════════════════ 混响 → 窗遮罩 → 电平 ════════════════════
ROOM = {'marimba': (.32, .16), 'vibes': (.45, .2), 'glock': (.5, .22), 'bowed': (.62, .26), 'pad': (.4, .12), 'pulse': None}
GAIN = {'marimba': 1.0, 'vibes': .8, 'glock': .72, 'pad': .4, 'pulse': .5, 'bowed': 1.1}


def mask(w):
    a, b = WIN[w]; m = np.zeros(N, np.float32); ia, ib = int(round(a * SR)), int(round(b * SR))
    m[ia:ib] = 1
    fo = {'A': .002, 'B': .06, 'C': .0}[w]        # A 窗：2 ms 防爆音（像按暂停）；B 窗：60 ms；C 窗单独淡出
    if fo:
        k = int(fo * SR); m[ib - k:ib] = (np.cos(np.linspace(0, np.pi, k)) * .5 + .5)
    if w == 'C':
        fa, fb = int(round((DUR - 1.6) * SR)), int(round((DUR - .06) * SR))
        m[fa:fb] = (np.cos(np.linspace(0, np.pi, fb - fa)) * .5 + .5); m[fb:] = 0
    return m


stems = {}
for s in STEMS:
    acc = np.zeros((N, 2), np.float32)
    for w in WIN:
        x = BUF[s][w]
        if not x.any(): continue
        if ROOM[s]: x = S.room(x, size=ROOM[s][0], mix=ROOM[s][1])
        acc += x * mask(w)[:, None]
    stems[s] = acc * GAIN[s]

mix = sum(stems.values())
g = 10 ** (-1.0 / 20) / np.abs(mix).max()
for s in STEMS: stems[s] = (stems[s] * g).astype(np.float32)
mix = sum(stems.values()).astype(np.float32)

os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR, subtype='PCM_24')
for s in STEMS: sf.write(os.path.join(HERE, 'stems', f'{s}.wav'), stems[s], SR, subtype='PCM_24')

keys = dict(v1_first=V1[0]['t'], v2_first=V2[0]['t'], v2_phase=T_PHASE, v3_first=V3[0]['t'], inserts=T_INS, rise=T_RISE,
            stop=T_STOP, chord=T_PRESS, clean_first=VC[0]['t'], reveal=T_REVEAL,
            **{f'check{i + 1}': t for i, t in enumerate(K['checks'])},
            num=T_NUM, **{f'lock{i + 1}': t for i, t in enumerate(K['locks'])},
            num_chord=K['locks'][-1], line2_ping=K['line2'], breath=T_BREATH, last_note=max(n['t'] for n in VC),
            silence2=T_SIL2, final_chord=T_END, end=DUR)
NOTES.sort(key=lambda r: (r[0], r[1], r[2]))
json.dump(dict(keys=keys, gain_db=round(float(20 * np.log10(g)), 2), peak_dbfs=-1.0, sr=SR, dur=DUR,
               notes=NOTES, perc=PERC), open(os.path.join(HERE, 'score.json'), 'w'), ensure_ascii=False, indent=0)

used = sorted({r[1] for r in NOTES if not r[1].startswith('pulse')})
with open(os.path.join(HERE, 'CREDITS_music.txt'), 'w') as f:
    f.write('Music: "Room to Think" (dark-keynote demo) — original score, rendered by score.py\n\n')
    f.write('Sampled instruments used: ' + ', '.join(used) + '\n')
    f.write('Source: Versilian Community Sample Library (VCSL) by Versilian Studios / Sam Gossner — CC0 1.0 '
            '(https://github.com/sgossner/VCSL) — attribution not required, credited with thanks.\n')
    for line in S.credits(used): f.write(line + '\n')
    f.write('\nSynthesized in numpy (no license): pad (detuned saw/triangle), riser (noise sweep), low sine pulse, noise shaker.\n')
print(f'score.wav {len(mix) / SR:.3f}s  gain {20 * np.log10(g):+.2f} dB  notes {len(NOTES)}  perc {len(PERC)}')
