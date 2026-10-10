"""《Coffee Cup Chase》原创配乐：30 年代大乐队 / ragtime（144 BPM，4/4，30 小节 = 50.0 s）
运行：.venv/bin/python styles/rubber-hose/demo/music/score.py
乐器：core/audio/sampler.py 采样（VSCO 2 CE 小号/弱音小号/单簧管/大号/立式钢琴/军鼓/镲/底鼓；VCSL 木琴/木鱼/吊镲）
      + core/audio/pluck.py 班卓（物理建模）+ numpy 合成的滑哨、弹簧"啵嘤"、军鼓刷扫
输出：score.wav（48 kHz 立体声）、stems/*.wav、score.json（卡点 + cue + 自检）
所有时间点按 story.js 的 bar(b, beat) 计算（1 起算）。"""
import os, sys, json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S      # noqa: E402
from core.audio import pluck as PL       # noqa: E402
from core.audio.sfx import SR, add, limit  # noqa: E402

BPM = 144; BEAT = 60 / BPM; BAR = 4 * BEAT
def bar(b, beat=1.0): return (b - 1) * BAR + (beat - 1) * BEAT
DUR = bar(31)
N = int(round(DUR * SR))
VO = {'v1a': bar(4) + .15, 'v1b': bar(6) - 1.28, 'v2': bar(8), 'v3': bar(11, 2), 'v4': bar(15, 2), 'v5': bar(23, 3), 'v6': bar(27, 2)}
VOD = {'v1a': 1.856, 'v1b': 1.91, 'v2': .9, 'v3': 2.61, 'v4': 1.977, 'v5': 2.089, 'v6': 1.264}
plateCube = lambda i: bar(11, 2) + i * BEAT / 2
plateMug = lambda i: bar(12, 2) + i * BEAT

STEMS = ['brass', 'reeds', 'piano', 'banjo_tuba', 'drums_fx', 'xylo']
buf = {k: np.zeros((N, 2), np.float32) for k in STEMS}
HITS = {}

# 起音补偿：铜管/簧管采样发声有 15–30 ms 的起音，提前放置让重音落在拍点上（真人演奏也会提前送气）
LEAD = {'tuba_stac': .022, 'tuba': .025, 'trumpet': .018, 'trumpet_stac': .012, 'trumpet_mute': .02, 'trombone': .02, 'clarinet': .015, 'clarinet_stac': .008}
class Note(np.ndarray): pass
def put(stem, x, t, gain=1.0, pan=0.0):
    t = t - getattr(x, 'lead', 0.0)
    add(buf[stem], np.asarray(x, np.float32), t, gain, pan)

def nt(inst, pitch, dur, vel=.7, **kw):
    x = S.note(inst, pitch, dur, vel, **kw).view(Note); x.lead = LEAD.get(inst, 0.0); return x

# ——— 和弦 ———
CH = {  # (低音根音, 五度低音, 和弦中音区)
    'F': ('F2', 'C2', ['A3', 'C4', 'F4']), 'D7': ('D2', 'A1', ['F#3', 'C4', 'D4']), 'G7': ('G2', 'D2', ['F3', 'B3', 'D4']),
    'C7': ('C2', 'G1', ['E3', 'Bb3', 'C4']), 'Dm': ('D2', 'A1', ['F3', 'A3', 'D4']), 'Bb': ('Bb1', 'F2', ['F3', 'Bb3', 'D4']),
    'A7': ('A1', 'E2', ['G3', 'C#4', 'E4']), 'E7': ('E2', 'B1', ['G#3', 'D4', 'E4']), 'G': ('G2', 'D2', ['B3', 'D4', 'G4']),
    'Gm': ('G2', 'D2', ['Bb3', 'D4', 'G4']), 'A': ('A1', 'E2', ['A3', 'C#4', 'E4']), 'C': ('C2', 'G1', ['E3', 'G3', 'C4']),
    'Dm6': ('D2', 'A1', ['F3', 'B3', 'D4']), 'Fdim': ('F2', 'B1', ['Ab3', 'B3', 'D4']), 'Eb7': ('Eb2', 'Bb1', ['G3', 'Db4', 'Eb4']),
}
def up(p, k=12): return S.name(S.midi(p) + k)

def stride(b, chords, vel=.62, beats=(1, 2, 3, 4)):
    """跨步钢琴：1/3 拍低音（八度），2/4 拍中音区和弦（短）。chords = [前两拍, 后两拍]"""
    for bt in beats:
        c = chords[0] if bt <= 2 else chords[1]; root, fifth, tri = CH[c]; t = bar(b, bt)
        if bt in (1, 3):
            p = root if bt == 1 else fifth
            put('piano', nt('upright', p, BEAT * .8, vel), t, .9, -.15)
            put('piano', nt('upright', up(p), BEAT * .8, vel * .85), t, .7, -.15)
        else:
            for p in tri: put('piano', nt('upright', p, BEAT * .35, vel * .8), t, .55, .1)

def oompah(b, chords, vel=.6, two_beat=False):
    """大号 oom（1、3 拍）+ 班卓 pah（2、4 拍扫弦）"""
    for bt in (1, 3):
        c = chords[0] if bt == 1 else chords[1]; root, fifth, tri = CH[c]
        p = up(root, 12) if S.midi(root) < 36 else root
        if bt == 3 and not two_beat: p = up(fifth, 12) if S.midi(fifth) < 36 else fifth
        if two_beat and bt == 3: continue
        put('banjo_tuba', nt('tuba_stac', p, BEAT * .6, vel), bar(b, bt), 1.25, -.1)
    for bt in (2, 4):
        if two_beat and bt == 2: continue
        c = chords[0] if bt == 2 else chords[1]; tri = CH[c][2]
        x = PL.strum('banjo', [up(p) for p in tri] + [up(tri[0], 24)], BEAT * .5, vel * .9, spread=.012)
        put('banjo_tuba', x, bar(b, bt) - .012, .55, .35)

def brush(b, vel=.5, beats=(1, 2, 3, 4)):
    """军鼓刷：每拍一记扫（带通噪声，慢起），2/4 拍加一记轻点"""
    rng = np.random.default_rng(int(b * 13))
    for bt in beats:
        n = int(BEAT * .9 * SR); w = rng.standard_normal(n)
        w = sosfilt(butter(2, [1800, 7000], 'band', fs=SR, output='sos'), w)
        e = np.linspace(0, 1, n) ** .5 * np.exp(-np.linspace(0, 4, n)); x = (w * e * .05 * vel).astype(np.float32)
        put('drums_fx', x, bar(b, bt), 1, .05)
        if bt in (2, 4): put('drums_fx', S.hit('snare2', 'taps', vel * .7), bar(b, bt), .9, 0)

def snare_back(b, vel=.6):
    for bt in (2, 4): put('drums_fx', S.hit('snare', 'on', vel), bar(b, bt), .8, 0)
    put('drums_fx', S.hit('bass_drum', None, vel * .8), bar(b, 1), .9, 0)
    put('drums_fx', S.hit('bass_drum', None, vel * .7), bar(b, 3), .9, 0)

def roll(t0, t1, v0=.3, v1=.8):
    """军鼓滚奏（采样 roll 变体按长度切）+ 渐强"""
    d = t1 - t0; x = S.hit('snare', 'roll', .8)
    if len(x) < d * SR: x = np.concatenate([x] * int(np.ceil(d * SR / len(x) + 1)))
    x = x[:int(d * SR)].copy(); x *= np.linspace(v0, v1, len(x), dtype=np.float32); x[-240:] *= np.linspace(1, 0, 240)
    put('drums_fx', x, t0, 1.0, 0)

def cymbal(t, vel=.8, short=False, pan=.1):
    put('drums_fx', S.hit('clash', 'short') if short else S.hit('crash', None, vel), t - .012, .75 if not short else .9, pan)

def slide(t0, d, f0, f1, vel=.25, stem='drums_fx', curve=1.0):
    """滑哨：正弦 + 气声，指数滑音，轻颤音"""
    n = int(d * SR); u = np.linspace(0, 1, n) ** curve
    f = f0 * (f1 / f0) ** u * (1 + .006 * np.sin(2 * np.pi * 6 * np.arange(n) / SR))
    ph = 2 * np.pi * np.cumsum(f) / SR
    breath = sosfilt(butter(2, [1500, 5000], 'band', fs=SR, output='sos'), np.random.default_rng(3).standard_normal(n)) * .08
    env = np.minimum(1, np.arange(n) / (.03 * SR)) * np.minimum(1, (n - np.arange(n)) / (.05 * SR))
    x = (np.sin(ph) + .12 * np.sin(2 * ph) + breath) * env * vel
    put(stem, x.astype(np.float32), t0, 1, .2)

def boing(t, vel=.35):
    """弹簧啵嘤：下行 FM 啁啾 + 颤"""
    d = .55; n = int(d * SR); tt = np.arange(n) / SR
    f = 220 * (1 + .9 * np.exp(-tt * 9)) * (1 + .12 * np.sin(2 * np.pi * 18 * tt) * np.exp(-tt * 3))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR + 2.2 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * np.exp(-tt * 5)) * np.exp(-tt * 4.5)
    put('drums_fx', (x * vel).astype(np.float32), t, 1, -.1)

def wood(t, vel=.6, v='c', pan=.25):
    put('drums_fx', S.hit('woodblock', v, vel), t, 1.0, pan)

def mel(inst, b0, notes, vel=.72, pan=0., stem='reeds', legato=.95, gain=1.0, shift=0):
    """notes = [(相对 b0 小节第 1 拍的拍数, 时值拍, 音高), ...]"""
    for off, d, p in notes:
        if p is None: continue
        pp = up(p, shift) if shift else p
        put(stem, nt(inst, pp, d * BEAT * legato, vel), bar(b0) + off * BEAT, gain, pan)

# ——— 原创主题（F 大调，4 小节，切分）———
THEME = [
    (0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'F5'), (1.5, 1, 'E5'), (2.5, .5, 'F5'), (3, .5, 'A5'), (3.5, .5, 'G5'),        # F
    (4, .5, 'F#5'), (4.5, 1, 'A5'), (5.5, .5, 'F#5'), (6, .5, 'D5'), (6.5, .5, 'C5'), (7, 1, 'A4'),                       # D7
    (8, .5, 'B4'), (8.5, .5, 'D5'), (9, .5, 'G5'), (9.5, 1, 'F5'), (10.5, .5, 'E5'), (11, .5, 'G5'), (11.5, .5, 'Bb4'),   # G7 C7
    (12, 1.5, 'A4'), (13.5, .5, 'C5'), (14, 1, 'F5'),                                                                     # F
]
THEME_CH = [['F', 'F'], ['D7', 'D7'], ['G7', 'C7'], ['F', 'F']]
def theme_part(lo, hi):  # 取主题 [lo, hi) 拍
    return [(o - lo, d, p) for o, d, p in THEME if lo <= o < hi]

# ======================= C1 片名进行曲 1–3 =======================
mel('trumpet', 1, theme_part(0, 8), .78, .2, 'brass')
mel('clarinet', 1, theme_part(0, 8), .7, -.25, 'reeds', shift=12, gain=.55)
mel('trombone', 1, [(o, d, up(p, -12)) for o, d, p in theme_part(0, 8)], .6, -.05, 'brass', gain=.45)
for b, c in [(1, THEME_CH[0]), (2, THEME_CH[1])]:
    stride(b, c, .6); oompah(b, c, .62); snare_back(b, .55)
# 第 3 小节：G7–C7 号角齐奏 + 滚奏渐强，第 4 拍滑哨上行（卷帘）
mel('trumpet_stac', 3, [(0, .5, 'B4'), (.5, .5, 'D5'), (1, .5, 'G5'), (1.5, .5, 'F5'), (2, 1, 'E5')], .8, .2, 'brass')
mel('clarinet_stac', 3, [(0, .5, 'D5'), (.5, .5, 'G5'), (1, .5, 'B5'), (1.5, .5, 'A5'), (2, 1, 'G5')], .7, -.25, 'reeds', gain=.6)
stride(3, THEME_CH[2], .6, beats=(1, 2, 3)); oompah(3, THEME_CH[2], .62)
roll(bar(3, 2), bar(4), .2, .7)
slide(bar(3, 4), BEAT, 500, 1900, .3)
HITS['roll_up_slide'] = bar(3, 4)
cymbal(bar(4), .8); HITS['title_cymbal'] = bar(4)

# ======================= C2 晨间慢拉格 4–7 =======================
# 懒洋洋的二拍子：大号 1 拍、班卓 3 拍（半速感），钢琴轻
put('piano', S.chord('upright', ['F3', 'A3', 'C4', 'F4'], BEAT * 2, .5), bar(4), .6, 0)
for b, c in [(4, ['F', 'F']), (5, ['C7', 'C7'])]:
    root, fifth, tri = CH[c[0]]
    put('banjo_tuba', nt('tuba_stac', up(root) if S.midi(root) < 36 else root, BEAT * .7, .5), bar(b), 1.2, -.1)
    put('banjo_tuba', nt('tuba_stac', up(fifth) if S.midi(fifth) < 36 else fifth, BEAT * .7, .45), bar(b, 3), 1.1, -.1)
    for bt in (2, 4): put('banjo_tuba', PL.strum('banjo', [up(p) for p in tri], BEAT * .4, .45, spread=.015), bar(b, bt), .4, .35)
    brush(b, .35)
# 第 5 小节：尝一口——钢琴踮脚上行（每拍一个短音）
for i, p in enumerate(['C4', 'E4', 'G4', 'Bb4']): put('piano', nt('upright', p, BEAT * .3, .45), bar(5, 1 + i), .6, .15)
# 第 6 小节：6.1 低音酸涩音簇（"苦"），6.2/6.3/6.4 弱音小号 哇-哇-哇——（塞子开合）
put('piano', S.chord('upright', ['C2', 'Db2', 'Gb2', 'B2'], BEAT * 1.2, .55), bar(6), .7, -.1)
WAH = []
for i, (p, d) in enumerate([('Bb4', .9), ('A4', .9), ('Ab4', 1.9)]):
    t = bar(6, 2 + i); WAH.append((t, d * BEAT, i == 2))
    x = nt('trumpet_mute', p, d * BEAT, .82, release=.12)
    if i == 2:  # 最后一个长音：揉音（音量颤 + 轻微下滑）
        tt = np.arange(len(x)) / SR; x = x * (1 + .35 * np.sin(2 * np.pi * 5.5 * tt) * np.minimum(1, tt / .25)).astype(np.float32)
    # 塞子"哇"：时变低通 350 Hz→2600 Hz→(长音)
    n = len(x); cut = np.full(n, 2600.0); a = int(.12 * SR)
    cut[:a] = np.linspace(350, 2600, a)
    if i == 2: cut[int(.5 * SR):] = 2600 - 1900 * np.clip((np.arange(n - int(.5 * SR)) / SR) / .6, 0, 1)
    y = np.zeros(n, np.float32); zi = np.zeros((1, 2)); blk = 256
    for s0 in range(0, n, blk):
        sos = butter(1, float(cut[s0]), 'low', fs=SR, output='sos')
        seg, zi = sosfilt(sos, x[s0:s0 + blk], zi=zi)
        y[s0:s0 + blk] = seg
    put('brass', y, t, 2.2, .15)
    HITS[f'wah{i + 1}'] = t
put('banjo_tuba', nt('tuba', 'F2', BEAT * 3, .45), bar(6, 2), 1.0, -.1)
# 第 7 小节：7.1 偷看——大号+单簧管踮脚；7.2 全乐队停 + 钹闷音；7.3 啵嘤；7.4 滚奏
put('banjo_tuba', nt('tuba_stac', 'C3', BEAT * .4, .5), bar(7), 1.1, -.1)
put('reeds', nt('clarinet_stac', 'G4', BEAT * .3, .5), bar(7, 1.5), .9, -.25)
put('piano', S.chord('upright', ['E3', 'Bb3', 'C4', 'G4'], BEAT * .5, .7), bar(7, 2), .8, 0)
put('brass', nt('trumpet_stac', 'G5', BEAT * .4, .8), bar(7, 2), .9, .2)
cymbal(bar(7, 2), short=True); HITS['stop_7_2'] = bar(7, 2)
boing(bar(7, 3), .35); HITS['boing_7_3'] = bar(7, 3)
roll(bar(7, 4), bar(8), .3, 1.0)

# ======================= C3 追逐快步舞 8–10 =======================
CH_CHASE = [['F', 'F'], ['D7', 'G7']]
for i, b in enumerate([8, 9]):
    stride(b, CH_CHASE[i], .7); oompah(b, CH_CHASE[i], .7); snare_back(b, .7)
    for bt in np.arange(1, 5, .5): put('drums_fx', S.hit('snare2', 'taps', .35), bar(b, bt), .5, -.05)
cymbal(bar(8), .75)
# 旁白 "And they're off!"（8.1–8.3）期间号角休止；8.3 单簧管快速上行跑句 → 9.1 小号主题
run = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5']
mel('clarinet_stac', 8, [(2 + i * .25, .25, p) for i, p in enumerate(run)], .7, -.25, 'reeds', gain=.8)
mel('trumpet', 9, theme_part(0, 4), .85, .2, 'brass')
mel('clarinet', 9, [(o, d, up(p, -3) if False else p) for o, d, p in [(0, .5, 'F5'), (.5, .5, 'A5'), (1, .5, 'C6'), (1.5, 1, 'Bb5'), (2.5, .5, 'A5'), (3, .5, 'F5'), (3.5, .5, 'E5')]], .7, -.25, 'reeds', gain=.5)
# 10.1–10.2 乐队停（只剩烤面包机嘀嗒，拟音由混音做）；10.3 "叮" + 齐奏重音
put('xylo', nt('xylophone', 'F6', .6, .9), bar(10, 3), 1.1, .15); put('xylo', nt('xylophone', 'C7', .6, .8), bar(10, 3), .8, .15)
put('brass', S.chord('trumpet_stac', ['A4', 'C5', 'F5'], BEAT * .5, .9), bar(10, 3), 1.0, .2)
put('reeds', nt('clarinet_stac', 'A5', BEAT * .5, .8), bar(10, 3), .8, -.25)
put('piano', S.chord('upright', ['F2', 'F3', 'A3', 'C4', 'F4'], BEAT * .6, .8), bar(10, 3), .8, 0)
put('banjo_tuba', nt('tuba_stac', 'F2', BEAT * .5, .8), bar(10, 3), 1.3, -.1)
cymbal(bar(10, 3), .9); put('drums_fx', S.hit('bass_drum', None, .9), bar(10, 3), 1, 0)
HITS['ding_10_3'] = bar(10, 3)
# 10.4：单簧管滑音上行接橱柜
mel('clarinet_stac', 10, [(3 + i * .125, .125, p) for i, p in enumerate(['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C6'])], .6, -.25, 'reeds', gain=.7)

# ======================= C4 盘子木琴 11–14 =======================
# 编制变薄：钢琴轻 + 班卓；木琴上行八分音符 = 方糖脚步；大号上行四分音符 = 杯子脚步
for b, c in [(11, ['F', 'F']), (12, ['C7', 'C7']), (13, ['F', 'C7'])]:
    for bt in (2, 4): put('banjo_tuba', PL.strum('banjo', [up(p) for p in CH[c[0] if bt == 2 else c[1]][2]], BEAT * .4, .5, spread=.012), bar(b, bt), .45, .35)
    for bt in (1, 3):
        root, fifth, tri = CH[c[0] if bt == 1 else c[1]]
        put('piano', nt('upright', root if bt == 1 else fifth, BEAT * .6, .45), bar(b, bt), .7, -.15)
    brush(b, .3)
put('banjo_tuba', nt('tuba_stac', 'F2', BEAT * .6, .6), bar(11), 1.2, -.1)  # 11.1 落地
XY = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5']
for i, p in enumerate(XY):
    put('xylo', nt('xylophone', p, .5, .85), plateCube(i), 1.0, .15); HITS[f'plateCube{i}'] = plateCube(i)
put('xylo', nt('xylophone', 'C6', .7, .9), plateCube(6) + BEAT / 2, 1.0, .15)   # 登顶 ta-da
TU = ['F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'E3']
for i, p in enumerate(TU):
    put('banjo_tuba', nt('tuba_stac', p, BEAT * .7, .85), plateMug(i), 1.6, -.1); HITS[f'plateMug{i}'] = plateMug(i)
# 12–13 方糖在顶上得意：单簧管调皮的短句（避开 v3 旁白 11.2–12.4）
mel('clarinet_stac', 12, [(2, .5, 'E5'), (2.5, .5, 'G5'), (3, .5, 'Bb5'), (3.5, .5, 'G5')], .55, -.25, 'reeds', gain=.7)
mel('clarinet_stac', 13, [(0, .5, 'A5'), (.5, .5, 'F5'), (1, 1, 'C5')], .55, -.25, 'reeds', gain=.7)
slide(bar(13, 3), BEAT * 1.4, 1800, 420, .3); HITS['slide_13_3'] = bar(13, 3)
# 14.1 盘子塌：镲 + 通鼓过门 + 木琴/单簧管下行
cymbal(bar(14), .95); HITS['crash_14_1'] = bar(14)
for i in range(8): put('drums_fx', S.hit('drum_kit', ['tom_1', 'tom_2', 'tom_3', 'tom_4'][i // 2], .75), bar(14, 1.5 + i * .375), .8, -.2 + i * .05)
for i, p in enumerate(['C7', 'A6', 'F6', 'D6', 'C6', 'A5', 'F5', 'D5', 'C5', 'A4']): put('xylo', nt('xylophone', p if S.midi(p) >= 67 else 'G4', .3, .6), bar(14, 1.2 + i * .25), .6, .15)
mel('clarinet', 14, [(1, 2.5, 'C6')], .5, -.25, 'reeds', gain=.4)
roll(bar(14, 3), bar(15), .3, .9)
put('banjo_tuba', nt('tuba', 'A1' if False else 'A2', BEAT * 2, .6), bar(14, 3), .9, -.1)

# ======================= C5 危急快板 15–17（d 小调）=======================
OST = ['D2', 'A1', 'D2', 'Eb2']
for b in (15, 16, 17):
    for bt in range(4):
        p = OST[bt]; p = up(p) if S.midi(p) < 36 else p
        put('banjo_tuba', nt('tuba_stac', p, BEAT * .55, .75), bar(b, bt + 1), 1.4, -.1)
    # 单簧管低音颤音（A3–Bb3 32 分音符交替），第 17 小节半音爬升
    tr = ['A3', 'Bb3'] if b < 17 else None
    if tr:
        for k in range(32): put('reeds', nt('clarinet_stac', tr[k % 2], BEAT * .14, .45), bar(b) + k * BEAT / 8, .55, -.25)
    else:
        for k, p in enumerate(['A3', 'Bb3', 'B3', 'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'Bb4', 'B4', 'C5']):
            put('reeds', nt('clarinet_stac', p, BEAT * .22, .5 + k * .02), bar(b) + k * BEAT / 4, .6, -.25)
    # 通鼓滚
    for k in range(8): put('drums_fx', S.hit('drum_kit', 'tom_3' if k % 2 else 'tom_4', .45 + .03 * k), bar(b) + k * BEAT / 2, .32, -.1)
    # 钢琴低音 Dm 半拍重复
    for bt in (1, 3): put('piano', S.chord('upright', ['D2', 'A2', 'D3'], BEAT * .4, .55), bar(b, bt), .6, -.1)
# 小号短刺：反拍 Dm 和弦（旁白 v4 15.2–16.2 期间休止）
for b, bts in [(15, [1.5]), (16, [3.5, 4.5]), (17, [1.5, 2.5])]:
    for bt in bts: put('brass', S.chord('trumpet_stac', ['F4', 'A4', 'D5'], BEAT * .3, .8), bar(b, bt), .8, .2)
put('brass', S.chord('trumpet', ['D4', 'F4', 'A4'], BEAT * 1.4, .7), bar(16, 4) - BEAT * .5, .6, .2)  # 下决心
roll(bar(17), bar(18), .25, .75)
slide(bar(17), bar(18) - bar(17) - .03, 2000, 260, .3, curve=.8); HITS['stretch_slide'] = bar(17)
cymbal(bar(15), .6); HITS['agitato'] = bar(15)
# 18.1 硬切（见 GATES）；18.3 啵嘤 + 轻钢琴和弦
boing(bar(18, 3), .3); HITS['boing_18_3'] = bar(18, 3)
put('piano', S.chord('upright', ['F4', 'A4', 'C5', 'E5'], BEAT * 2.5, .42, strum=.03), bar(18, 3) + .05, .6, .05)

# ======================= C7 单簧管慢版 19–22 =======================
# 主题慢一倍（二分音符感）：19–20 = 主题第 1 小节，21 = 第 2 小节前半 + 叹息
slow = [(o * 2, d * 2, p) for o, d, p in theme_part(0, 4)]
mel('clarinet', 19, [(o, d, p) for o, d, p in slow if o < 8], .55, -.1, 'reeds', legato=.98, gain=1.1)
# 21：叹息（21.2 杯子叹气）：D5 → C5 → A4 下行
mel('clarinet', 21, [(0, .9, 'D5'), (1, 1, 'C5'), (2, 1.9, 'A4')], .5, -.1, 'reeds', legato=.98, gain=1.0)
for b, c in [(19, 'F'), (20, 'Dm'), (21, 'Bb')]:
    for bt in (1, 3):
        v = .38 if b < 21 else .32
        put('piano', S.chord('upright', [CH[c][0] if bt == 1 else CH[c][1]] + CH[c][2], BEAT * 1.6, v, strum=.02), bar(b, bt), .6, 0)
# 第 22 小节：停顿式——22.1 静（仅一个极轻的 C7sus 钢琴和弦开头即收）
put('piano', S.chord('upright', ['C3', 'F3', 'Bb3', 'C4'], BEAT * .6, .3), bar(22) - .0, .5, 0)
for i, bt in enumerate([2, 2.5, 3, 3.5]):
    wood(bar(22, bt), .45, 'c' if i % 2 == 0 else 'b', .3 if i % 2 == 0 else -.3); HITS[f'glance{i + 1}'] = bar(22, bt)
wood(bar(22, 4), .6, 'b', .2); wood(bar(22, 4.5), .7, 'a', .25)
HITS['hop'] = bar(22, 4); HITS['launch'] = bar(22, 4.5)
slide(bar(22, 4.5), BEAT * .95, 700, 1600, .18, curve=1.0)   # 飞过去的一小段上行滑哨
HITS['plop'] = bar(23)

# ======================= C8 甜蜜重奏 23–26（G 大调）=======================
put('xylo', nt('xylophone', 'D6', .8, .9), bar(23, 3), 1.0, .15); put('xylo', nt('xylophone', 'G6', 1.0, .95), bar(23, 3), 1.0, .15)
put('xylo', nt('xylophone', 'B6', 1.0, .8), bar(23, 3) + .06, .8, .15)
cymbal(bar(23, 3), .7); HITS['ding_sweet'] = bar(23, 3)
roll(bar(23, 4), bar(24), .25, .9)
G_CH = [['G', 'G'], ['E7', 'E7'], ['A7', 'D7'], ['G', 'G']]
for i, b in enumerate([24, 25, 26]):
    stride(b, G_CH[i], .78); oompah(b, G_CH[i], .8); snare_back(b, .8)
    for bt in np.arange(1, 5, .5): put('drums_fx', S.hit('snare2', 'taps', .4), bar(b, bt), .5, -.05)
cymbal(bar(24), .95); HITS['outchorus'] = bar(24)
# 旁白 v5（23.3–24.3）期间小号 mf、单簧管高音区装饰，25.1 起全开
mel('trumpet', 24, theme_part(0, 4), .7, .2, 'brass', shift=2, gain=.7)
mel('trumpet', 25, theme_part(4, 12), .9, .2, 'brass', shift=2, gain=1.0)
mel('trombone', 25, [(o, d, up(p, -10)) for o, d, p in theme_part(4, 12)], .75, -.05, 'brass', gain=.6)
mel('clarinet', 24, [(0, .5, 'D6'), (.5, .5, 'B5'), (1, .5, 'G5'), (1.5, .5, 'B5'), (2, 1, 'D6'), (3, 1, 'E6')], .5, -.25, 'reeds', gain=.45)
mel('clarinet', 25, [(o, d, up(p, 14)) for o, d, p in theme_part(4, 12)], .65, -.25, 'reeds', gain=.5)
for b in (24, 25, 26):
    for bt in (1, 2, 3, 4): put('drums_fx', S.hit('bass_drum', None, .55), bar(b, bt), .6, 0)   # 每拍重音 = 全厨房同拍

# ======================= C9 iris 尾句 27–28 =======================
stride(27, ['G', 'G'], .62); oompah(27, ['G', 'E7'], .62); brush(27, .45)
mel('trumpet', 27, [(0, 1.5, 'B4'), (1.5, .5, 'D5'), (2, 1, 'G5')], .6, .2, 'brass', gain=.6)   # v6 27.2 期间保持轻
stride(28, ['A7', 'D7'], .55, beats=(1, 2)); oompah(28, ['A7', 'D7'], .55)
mel('clarinet', 28, [(0, .5, 'E5'), (.5, .5, 'G5'), (1, .5, 'C#5'), (1.5, .5, 'E5')], .55, -.25, 'reeds', gain=.7)
# 28.3 结束和弦 + 大号低音（手把 iris 拉上）
t_end = bar(28, 3)
put('brass', S.chord('trumpet', ['B4', 'D5', 'G5'], BEAT * 1.6, .85), t_end, .9, .2)
put('reeds', nt('clarinet', 'G5', BEAT * 1.6, .75), t_end, .7, -.25)
put('piano', S.chord('upright', ['G1', 'G2', 'D3', 'G3', 'B3', 'D4', 'G4'], BEAT * 2, .8), t_end, .8, 0)
put('banjo_tuba', nt('tuba', 'G1' if False else 'G2', BEAT * 2, .9), t_end, 1.4, -.1)
put('banjo_tuba', nt('tuba_stac', 'D2' if False else 'D3', BEAT * .5, .7), t_end - BEAT * .5, 1.0, -.1)
cymbal(t_end, .8); put('drums_fx', S.hit('bass_drum', None, 1.0), t_end, 1.1, 0)
HITS['final_chord_28_3'] = t_end

# ======================= C10 片尾 29–30 =======================
stride(29, ['G', 'G'], .45, beats=(1, 2, 3, 4)); brush(29, .3)
mel('clarinet', 29, [(0, .5, 'D5'), (.5, .5, 'E5'), (1, .5, 'G5'), (1.5, 1, 'B5'), (2.5, .5, 'A5'), (3, 1, 'G5')], .5, -.2, 'reeds', gain=.8)
stride(30, ['C', 'G'], .42, beats=(1, 2))
put('piano', S.chord('upright', ['G1', 'G2', 'D3', 'G3', 'B3', 'E4', 'G4'], 2.6, .55, strum=.025), bar(30, 3), .8, 0)
put('reeds', nt('clarinet', 'B4', 2.2, .45), bar(30, 3), .6, -.2)
put('banjo_tuba', PL.strum('banjo', ['G3', 'B3', 'D4', 'G4'], .6, .5, spread=.02), bar(30, 3), .5, .35)

# ======================= 混响、门限、配平 =======================
room = S.room
for k in STEMS:
    buf[k] = room(buf[k], size=.22, mix=.14, damp=.6)

def gate(t0, t1, fade=.02, stems=STEMS, keep=None):
    a, b = int(t0 * SR), int(t1 * SR); f = int(fade * SR)
    for k in stems:
        x = buf[k]
        x[max(0, a - f):a] *= np.linspace(1, 0, min(f, a))[:, None]
        x[a:b] = 0
GATES = [
    (bar(7, 2) + .16, bar(7, 3) - .005, .06),   # 7.2 全乐队停（钹闷音后）→ 7.3
    (bar(10) + .02, bar(10, 3) - .004, .05),     # 10.1–10.2 乐队停
    (bar(18), bar(18, 3) - .002, .012),          # 18.1 硬切全静（含混响尾巴）
    (bar(23) + .02, bar(23, 3) - .003, .05),     # 23.1 扑通后静
]
# 第 7.2 的钹闷音本身要保留：先门限，再把闷音补回（钹在 drums_fx）
for t0, t1, f in GATES: gate(t0, t1, f)
# 22.1 附近只有木鱼：把 22.1 第 1 拍后半的钢琴余音压掉
gate(bar(22) + BEAT * .7, bar(22, 2) - .003, .08, stems=['piano', 'reeds'])

# 各组配平（按 99.99% 分位看峰，RMS 目标）：人声闪避由主混音做
GAIN = {'brass': 1.0, 'reeds': 1.0, 'piano': 1.25, 'banjo_tuba': .95, 'drums_fx': .8, 'xylo': .9}
mix = np.zeros((N, 2), np.float32)
for k in STEMS: mix += buf[k] * GAIN[k]
p9999 = float(np.quantile(np.abs(mix), .9999)); g = .84 / p9999
mix *= g
for k in STEMS: buf[k] *= g * GAIN[k]
pk = float(np.abs(mix).max())
if pk > .89:
    mix = np.stack([limit(mix[:, 0], .89), limit(mix[:, 1], .89)], 1).astype(np.float32)
for t0, t1, f in GATES: mix[int(t0 * SR):int(t1 * SR)] = 0

os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR, subtype='PCM_24')
for k in STEMS: sf.write(os.path.join(HERE, 'stems', k + '.wav'), buf[k], SR, subtype='PCM_24')

# ——— 自检 ———
m = mix.mean(1)
def band_db(lo, hi):
    F = np.fft.rfft(m); f = np.fft.rfftfreq(len(m), 1 / SR); tot = np.sum(np.abs(F) ** 2)
    return float(round(10 * np.log10(np.sum(np.abs(F[(f >= lo) & (f < hi)]) ** 2) / tot + 1e-12), 2))
rms_bar = [float(round(20 * np.log10(np.sqrt(np.mean(m[int(bar(b) * SR):int(bar(b + 1) * SR)] ** 2)) + 1e-9), 1)) for b in range(1, 31)]
silence_check = {f'{t0:.3f}-{t1:.3f}': float(np.abs(mix[int(t0 * SR) + 10:int(t1 * SR) - 10]).max()) for t0, t1, f in GATES}
out = {
    'bpm': BPM, 'dur': DUR, 'sr': SR, 'samples': N,
    'hits': {k: round(v, 4) for k, v in sorted(HITS.items(), key=lambda kv: kv[1])},
    'cues': {'C1_title': [0, bar(4)], 'C2_morning': [bar(4), bar(8)], 'C3_chase': [bar(8), bar(11)], 'C4_xylophone': [bar(11), bar(15)],
             'C5_agitato': [bar(15), bar(18)], 'silence': [bar(18), bar(18, 3)], 'C6_rebound': [bar(18, 3), bar(19)], 'C7_lonesome': [bar(19), bar(23)],
             'C8_stomp': [bar(23), bar(27)], 'C9_tag': [bar(27), bar(29)], 'C10_end': [bar(29), DUR]},
    'gates_silent_peak': silence_check,
    'check': {'peak_dbfs': float(round(20 * np.log10(np.abs(mix).max() + 1e-9), 2)), 'rms_dbfs': float(round(20 * np.log10(np.sqrt(np.mean(m ** 2))), 2)),
              'band_db': {'20-120': band_db(20, 120), '120-500': band_db(120, 500), '500-2k': band_db(500, 2000), '2k-8k': band_db(2000, 8000), '8k-20k': band_db(8000, 20000)},
              'rms_per_bar_db': rms_bar},
    'instruments': ['upright', 'trumpet', 'trumpet_stac', 'trumpet_mute', 'trombone', 'clarinet', 'clarinet_stac', 'tuba', 'tuba_stac', 'xylophone', 'snare', 'snare2', 'bass_drum', 'crash', 'clash', 'drum_kit', 'woodblock'],
}
out['credits'] = S.credits(out['instruments'])
json.dump(out, open(os.path.join(HERE, 'score.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(out['check'], ensure_ascii=False)); print(out['gates_silent_peak']); print(out['credits'])
