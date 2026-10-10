"""《Five-Second Astronaut》原创配乐：放克 / 流行融合（120 → 140 → 160 BPM，E 多利亚 → F# 多利亚 → G# 小调 → A 小调 → A 大调）
运行：.venv/bin/python styles/microgame/demo/music/score.py
输入：demo/timeline.json（全片速度网格）
输出：music/score.wav、music/stems/*.wav、music/score.json、music/CREDITS_music.txt

配器：drum_kit（十六分踩镲 + 军鼓鬼音 + 拍手）· 合成 slap 贝斯（拨弦体 + 高通 pop 音头 + 八度跳 + 滑音）
      · 铜管齐奏（trumpet_stac + alto_sax + trombone_stac 叠八度）· 电钢琴（vibraphone_hard + piano，5 Hz 颤音）
      · 每关的画风乐器（木琴 / 古琴 / 方波 / 颤音琴 + 萨克斯 / 脉冲波琶音 / 弱音小号 + 棘轮 / 响棒 + 钢琴）
"""
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
from core.audio import sampler as S, pluck as PL
from core.audio.sfx import SR, add, limit

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '../timeline.json')))
DUR = TL['dur']; N = int(round(DUR * SR))
SEG = {s['id']: s for s in TL['segs']}
S.seed(11); RNG = np.random.default_rng(11)
STEMS = ['drums', 'bass', 'brass', 'keys', 'color', 'jingles']
bus = {k: np.zeros((N, 2), np.float32) for k in STEMS}
KEY = {}          # 关键点：name -> 时间
def mark(name, t): KEY[name] = [round(float(x), 4) for x in t] if isinstance(t, (list, tuple)) else round(float(t), 4)

def put(b, x, t, g=1.0, pan=0.0): add(bus[b], np.asarray(x, np.float32), t, g, pan)
def m(p): return S.midi(p) if isinstance(p, str) else p
def hz(p): return 440 * 2 ** ((m(p) - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bpf(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)

# ─── 时间工具（按段内拍号取绝对时间，可小数拍）───
def bt(sid, k):
    s = SEG[sid]; B = s['beatT']; i = int(np.floor(k)); f = k - i
    a = B[i] if i < len(B) else s['t1']; b = B[i + 1] if i + 1 < len(B) else s['t1']
    if i >= len(B): # 越界：按最后一拍长度外推
        L = s['t1'] - B[-1]; return s['t1'] + (k - len(B)) * L
    return a + (b - a) * f
def beatlen(sid, k=0): return bt(sid, k + 1) - bt(sid, k)

# ─── 音色 ───
PRE = .003   # tr() 已把起音对齐到 +3ms
def tr(x):
    """把起音对齐：切掉采样开头到 30% 峰值前 3ms 之间的部分，使"冲击点"落在放置时刻 + 3ms"""
    x = np.asarray(x); a = np.abs(x); i = int(np.argmax(a > .3 * a.max())); return x[max(0, i - int(.003 * SR)):]
def note(inst, p, d, v=.8): return tr(S.note(inst, p, d, vel=v))

def slap(p, d=.25, v=.9, pop=False, slide=0.0, slide_t=.08):
    """合成 slap 贝斯：锯齿状拨弦体（高次谐波衰减更快）+ 次低正弦 + 拇指/勾弦音头（带通噪声 + click）+ 滑音"""
    n = int((d + .06) * SR); t = np.arange(n) / SR
    f0 = hz(p); semis = slide * np.clip(t / max(slide_t, 1e-3), 0, 1) if slide else 0
    f = f0 * 2 ** (semis / 12) if slide else np.full(n, f0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.zeros(n)
    for k in range(1, 16):
        if f0 * k > 9000: break
        dec = 2.5 + k * (2.2 if pop else 1.6)
        body += np.sin(k * ph) / k ** (0.9 if pop else 1.15) * np.exp(-t * dec)
    body += .35 * np.sin(ph) * np.exp(-t * 3.0)
    env = np.minimum(1, t / .002) * np.where(t < d, 1, np.exp(-(t - d) / .02))
    x = np.tanh(body * env * (1.8 if pop else 1.4))
    nz = RNG.standard_normal(n) * np.exp(-t / (.006 if pop else .01))
    x += (bpf(nz, 1800, 6500) * (1.1 if pop else .5) if pop else bpf(nz, 500, 2500) * .6)
    ck = np.zeros(n); ck[:int(.0015 * SR)] = np.hanning(int(.003 * SR))[:int(.0015 * SR)]
    x += hp(ck, 1500) * (1.2 if pop else .5)
    return (hp(x, 38) * v * .5).astype(np.float32)

def square(p, d, v=.5, duty=.5, slide=0.0, vib=0.0):
    """带限方波 / 脉冲波（加法合成到 8 kHz），可滑音"""
    n = int(d * SR); t = np.arange(n) / SR
    semis = np.linspace(0, slide, n) if slide else 0
    f = hz(p) * 2 ** ((semis + vib * np.sin(2 * np.pi * 6 * t)) / 12) if (slide or vib) else np.full(n, hz(p))
    ph = 2 * np.pi * np.cumsum(f) / SR; x = np.zeros(n); fmax = float(np.max(f))
    for k in range(1, 40):
        if fmax * k > 8000: break
        a = (2 / (k * np.pi)) * np.sin(np.pi * k * duty)
        x += a * np.cos(k * ph)
    env = np.minimum(1, t / .003) * np.minimum(1, (d - t) / .015)
    return (x * env * v * .35).astype(np.float32)

def epiano(chord, d, v=.5):
    """电钢琴近似：vibraphone_hard + 轻钢琴，5 Hz 颤音"""
    out = None
    for i, p in enumerate(chord):
        a = note('vibraphone_hard', p, d, v * .8); b = note('piano', p, d, v * .45)
        L = max(len(a), len(b)); x = np.zeros(L); x[:len(a)] += a; x[:len(b)] += b
        out = x if out is None else (np.pad(out, (0, max(0, L - len(out)))) + np.pad(x, (0, max(0, len(out) - L))))
    t = np.arange(len(out)) / SR
    return (out * (1 + .16 * np.sin(2 * np.pi * 5 * t)) / len(chord) ** .5).astype(np.float32)

def bend(x, semis):
    """对采样做时变移调（semis 为与 x 同长或可广播的半音曲线），用相位累加重采样"""
    rate = 2 ** (np.asarray(semis) / 12.0)
    if np.ndim(rate) == 0: rate = np.full(len(x), rate)
    pos = np.cumsum(rate); pos = pos[pos < len(x) - 1]
    i = pos.astype(int); f = pos - i
    return (x[i] * (1 - f) + x[i + 1] * f).astype(np.float32)

def hit(inst, var, v=.8, d=None): return tr(S.hit(inst, var, v, d))
def kick(t, v=.9): put('drums', lp(hit('drum_kit', 'kick_drum_left', v), 9000), t, 1.0)
def snare(t, v=.8): put('drums', lp(hit('drum_kit', 'snare_1', v), 10000), t, .85, .05)
def ghost(t, v=.3): put('drums', lp(hit('drum_kit', 'snare_2', v), 8000), t, .45, .08)
def hat(t, v=.5, op=False): put('drums', lp(hit('drum_kit', 'hi_hat_open' if op else 'hi_hat_closed', v, .5 if op else .12), 9000), t, .42 if not op else .35, .3)
def crash(t, v=.8): put('drums', lp(hit('drum_kit', 'crash_left', v), 7500), t, .55, -.25)
def clap(t, v=.7): put('drums', lp(hit('claps', 'group', v), 9000), t, .5, -.1)
def tom(t, i, v=.7): put('drums', hit('drum_kit', f'tom_{i}', v), t, .7, (i - 2.5) * .2)

def stab(t, chord, v=.85, d=.16, g=1.0):
    """铜管齐奏：上面小号、中间萨克斯、下面长号（叠八度）"""
    top = chord[-2:]; mid = chord[1:-1] if len(chord) > 2 else chord[:1]
    for p in top: put('brass', note('trumpet_stac', p, d, v), t - PRE, .55 * g, .15)
    for p in mid: put('brass', note('alto_sax', p, d, v * .8), t - PRE, .32 * g, -.1)
    put('brass', note('trombone_stac', m(chord[0]) - 12 if m(chord[0]) >= 58 else chord[0], d, v), t - PRE, .55 * g, -.2)
def blow(t, p, d, v=.8, g=1.0, pan=0.0, inst='trumpet_stac'):
    put('brass', note(inst, p, d, v), t - PRE, g, pan)

def success(t, root='E4', name=None):
    """成功 jingle：铜管大调三连音上行（1-3-5-8）+ 拍手，≤0.5s"""
    r = m(root); step = .075
    for i, iv in enumerate([0, 4, 7, 12]):
        blow(t + i * step, r + iv, .14 if i < 3 else .3, .85, .5, .15)
        put('jingles', note('alto_sax', r + iv - 12, .14 if i < 3 else .28, .7), t + i * step - PRE, .3, -.15)
    put('jingles', note('glockenspiel', r + 24, .5, .6), t + 3 * step, .25, .3)
    clap(t + 3 * step, .8); clap(t + 3 * step + .02, .6)
    if name: mark(name, t)

def fail(t, notes, long_last=True, name=None, grunt=True, gong=True):
    """失败 jingle：长号半音下滑（每音带 portamento）+ 最后一音颤抖拖长 + 大号"咕噜" + 小锣"""
    tt = t
    for i, (p, d) in enumerate(notes):
        x = note('trombone', p, d + .1, .75)
        n = len(x); tc = np.arange(n) / SR
        last = (i == len(notes) - 1)
        semis = -.35 * np.clip(tc / d, 0, 1) if not last else (-1.0 * np.clip(tc / d, 0, 1) + (.35 * np.sin(2 * np.pi * 6.5 * tc) * np.clip((tc - .1) / .2, 0, 1)))
        y = bend(x, semis); y *= np.minimum(1, (d + .06 - np.arange(len(y)) / SR) / .06).clip(0, 1)
        put('jingles', y, tt - PRE, .75, -.1)
        tt += d
    if grunt: put('jingles', note('tuba_stac', m(notes[-1][0]) - 12, .25, .8), tt - notes[-1][1] + .02 - PRE, .6, .1)
    if gong: put('jingles', hit('gong2', 'small', .5), t + .02, .35, .3)
    if name: mark(name, t)

def guqin_harm(t, p='E5', g=.9):
    put('color', PL.pluck('guqin', p, 3.0, .7, harmonic=True), t, g, .2)
def guqin_slide(t, p, up=2, g=.9):
    put('color', PL.pluck('guqin', p, 2.2, .75, bend=[(0, 0), (.12, 0), (.45, up)], vib=(4.5, .15, .6)), t, g, .15)

def heartbeat(t, v=.9):
    for dt, vv in [(0, 1), (.2, .65)]:
        x = lp(hit('drum_kit', 'kick_drum_left', .6 * vv), 180)
        put('color', x, t + dt, 1.4 * v)

def scratch(t, d=.3):
    """刮碟：锯齿音高来回扫 + 带通噪声"""
    n = int(d * SR); tc = np.arange(n) / SR
    f = 300 + 900 * np.abs(np.sin(2 * np.pi * tc / d * 1.5))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (2 * ((ph / (2 * np.pi)) % 1) - 1) * .5 + bpf(RNG.standard_normal(n), 800, 3500) * .5
    x = bpf(x, 200, 5000) * np.hanning(n) ** .3
    put('color', x.astype(np.float32), t, .5, 0)

# ─── 和弦 / 贝斯根音表 ───
CH = {  # 电钢琴/铜管和弦（低→高），贝斯根音
    'Em7':  (['E3', 'G3', 'B3', 'D4'], 'E2'), 'A9': (['G3', 'B3', 'C#4', 'E4'], 'A2'),
    'Gmaj': (['G3', 'B3', 'D4', 'F#4'], 'G2'), 'Dsus': (['D3', 'G3', 'A3', 'D4'], 'D2'),
    'F#m7': (['F#3', 'A3', 'C#4', 'E4'], 'F#2'), 'B9': (['A3', 'C#4', 'D#4', 'F#4'], 'B2'),
    'G#m7': (['G#3', 'B3', 'D#4', 'F#4'], 'G#2'), 'Emaj7': (['G#3', 'B3', 'D#4', 'E4'], 'E2'), 'F#': (['F#3', 'A#3', 'C#4', 'F#4'], 'F#2'),
    'Am7':  (['A3', 'C4', 'E4', 'G4'], 'A2'), 'Fmaj7': (['A3', 'C4', 'E4', 'F4'], 'F2'), 'G6': (['G3', 'B3', 'D4', 'E4'], 'G2'),
    'A':    (['A3', 'C#4', 'E4', 'A4'], 'A2'), 'D/A': (['A3', 'D4', 'F#4', 'A4'], 'A2'), 'E7': (['G#3', 'B3', 'D4', 'E4'], 'E2'),
    'A69':  (['A3', 'C#4', 'F#4', 'B4', 'E5'], 'A2'),
}

# ─── 律动引擎 ───
KICK16 = [0, 7, 10]            # 一小节 16 格里的底鼓位置（放克：1、2 拍的"a"、3 拍）
BASS16 = [(0, 'r', False), (3, 'o', True), (6, 'r', False), (7, 'o', True), (10, 'r', False), (11, 'f', True), (14, 'o', True)]   # r=根 o=八度 f=五度；True=pop
def groove(sid, k0, k1, chords, drums=True, bass=True, keys=True, v=1.0, hatop=False, claps=True, busy=1.0):
    """在段 sid 的 [k0,k1) 拍区间铺放克律动；chords = 每小节(4 拍)的和弦名列表（循环）"""
    s = SEG[sid]
    for bi in range(int(np.floor(k0 * 4)), int(np.ceil(k1 * 4))):
        kb = bi / 4
        if kb < k0 - 1e-6 or kb >= k1 - 1e-6: continue
        t = bt(sid, kb); pos = bi % 16; bar = bi // 16
        ch, root = CH[chords[bar % len(chords)]]
        if drums:
            if pos in KICK16: kick(t, .85 * v)
            if pos in (4, 12): snare(t, .8 * v); (clap(t, .55 * v) if claps else None)
            elif pos in (2, 9, 13, 15) and busy > .5: ghost(t, .25 * v)
            hat(t, (.55 if pos % 2 == 0 else .32) * v, op=(hatop and pos % 4 == 2))
        if bass:
            for p16, kind, pp in BASS16:
                if p16 == pos:
                    rp = m(root) + (12 if kind == 'o' else 7 if kind == 'f' else 0)
                    put('bass', slap(rp, .16 if pp else .22, (.8 if pp else .95) * v, pop=pp), t, .9)
        if keys and pos in (2, 6, 11) and busy > .3:
            put('keys', epiano(ch, .22, .5 * v), t, .5, .2)

# ═══════════════════════ 各段 ═══════════════════════
def B(sid, k): return bt(sid, k)
E_R = 'E4'

# G1 PUMP（蜡笔 · 木琴）
stab(0.0, ['E3', 'G3', 'B3', 'D4', 'E4'], .95); crash(0.0, .7); mark('G1_cmd', 0.0)
groove('G1', 0, 8, ['Em7', 'A9'], keys=False, v=.8)
for i, t in enumerate([1.0, 1.5, 2.0, 2.5]):
    put('color', note('xylophone', ['E5', 'F#5', 'G5', 'A5'][i], .3, .85), t, .7, .25); put('bass', slap(m('E2') + 12, .14, .9, pop=True), t + .25, .6)
    mark(f'G1_pump{i+1}', t)
for i, p in enumerate(['B5', 'C#6', 'D6', 'E6', 'F#6', 'G6', 'A6', 'B6']):   # 3.0 浮起：上行刮奏
    put('color', note('xylophone', p, .2, .7), 3.0 + i * .045, .55, .3)
mark('G1_float', 3.0)
success(3.5, 'E4', 'G1_ok')

# S1 舞台 · 片名
crash(4.0, .8); kick(4.0, .9); mark('S1_in', 4.0)
RIFF = [(0, 'E4', 1), (3, 'G4', 1), (4, 'A4', 1), (6, 'B4', 1), (8, 'A4', 1), (10, 'G4', 1), (11, 'E4', 2), (14, 'D4', 1), (15, 'E4', 1)]
def riff(sid, k0, trans=0, v=.8, g=1.0, minor=False, lower=0, upto=16, frm=0):
    for p16, p, l in RIFF:
        if p16 >= upto or p16 < frm: continue
        pp = m(p) + trans - (1 if minor and p in ('G4',) else 0) - lower
        t = bt(sid, k0 + p16 / 4)
        blow(t, pp, .12 * l + .04, v, .45 * g, .15); blow(t, pp - 12, .12 * l + .04, v, .3 * g, -.2, 'trombone_stac')
for i, p in enumerate(['E4', 'G4', 'B4', 'D5', 'E5', 'G5']):   # 片名逐字亮：电钢琴十六分上行
    put('keys', epiano([p], .25, .55), 4.25 + i * .125, .55, .1)
mark('S1_title_run', 4.25)
groove('S1', 0, 7, ['Em7', 'A9'], v=.75)
groove('S1', 2, 6.2, ['Em7', 'A9'], drums=False, bass=False, keys=True, v=.6)   # 旁白下只保留电钢琴 + 律动
riff('S1', 0, v=.8, g=.9, upto=8)   # 4.0–5.0 前半 riff（5.0 起旁白）
for t in [bt('S1', 5.25), bt('S1', 5.75), bt('S1', 6.25)]: stab(t, ['E3', 'G3', 'A3', 'D4', 'E4'], .7, g=.6)
mark('S1_click_gap', 7.5)
for k in [7.5, 7.625, 7.75, 7.875]: tom(bt('S1', k), 1 + int((k - 7.5) * 8) % 4, .6)   # 7.75 起 tom 小过门

# G2 DON'T SNEEZE（水墨 · 古琴 + 木块）
stab(8.0, ['E3', 'G3', 'B3', 'D4', 'E4'], .9); mark('G2_cmd', 8.0)
groove('G2', 0, 4, ['Em7', 'A9'], keys=False, v=.7, claps=False, busy=.4)
for k in range(0, 8): put('color', hit('woodblock', 'b' if k % 2 else 'a', .5), bt('G2', k + .5), .35, -.3)
guqin_harm(8.5, 'E5'); mark('G2_dust', 8.5)
guqin_slide(9.5, 'A3', 2); guqin_slide(10.0, 'C4', 3); mark('G2_ah1', 9.5); mark('G2_ah2', 10.0)
mark('G2_silence', [10.0, 10.5])
kick(10.5, 1.0); crash(10.5, 1.0); stab(10.5, ['E3', 'G3', 'B3', 'D4', 'G4'], 1.0); mark('G2_achoo', 10.5)
for k in [5, 5.5]: hat(bt('G2', k), .4)
fail(11.0, [('D3', .22), ('C#3', .22), ('C3', .5)], name='G2_fail')

# S2 舞台（小调变体，铜管下行）
groove('S2', 0, 3, ['Em7', 'Em7'], v=.7)
for i, p in enumerate(['E4', 'D4', 'B3', 'G3']): blow(bt('S2', i * .5), p, .14, .7, .35, .1)
mark('S2_click_gap', 13.5)

# G3 STRAP IN（ASCII · 方波 + 电传）
stab(14.0, ['E3', 'G3', 'B3', 'D4', 'E4'], .9); mark('G3_cmd', 14.0)
groove('G3', 0, 8, ['Em7', 'A9'], keys=False, v=.75)
for k in range(0, 8 * 4):   # 电传咔嗒（很轻的高音 click）
    if k % 3 != 1: put('color', lp(hit('claves', None, .25), 7000), bt('G3', k / 4), .12, .4)
for i, t in enumerate([15.0, 15.5, 16.0]):
    put('color', square(['E5', 'G5', 'B5'][i], .18, .55), t, .6, -.2); mark(f'G3_belt{i+1}', t)
kick(16.5, 1.0); crash(16.5, .7); stab(16.5, ['E3', 'A3', 'B3', 'E4', 'G4'], .9); mark('G3_buckle', 16.5)
for dt in [0, .12]: put('color', square('E6', .08, .5), 17.0 + dt, .5, .2)
mark('G3_secured', 17.0)
success(17.5, 'E4', 'G3_ok')

# S3 舞台
groove('S3', 0, 3, ['Em7', 'A9'], v=.75); riff('S3', 0, v=.75, g=.7)
mark('S3_click_gap', 19.5)

# G4 CATCH（孔版 · 颤音琴 + 萨克斯长音）
stab(20.0, ['E3', 'G3', 'B3', 'D4', 'E4'], .9); mark('G4_cmd', 20.0)
groove('G4', 0, 6, ['Em7', 'A9'], keys=False, v=.6, busy=.4)
for k in range(1, 10):
    p = ['E4', 'G4', 'B4', 'D5', 'B4', 'G4', 'A4', 'C#5', 'E5'][k - 1]
    put('color', note('vibraphone', p, .6, .6), bt('G4', k * .5), .5, .3)
_sx = note('alto_sax', 'B4', 1.9, .55); put('color', _sx * np.minimum(1, np.arange(len(_sx)) / SR / .5), 20.5, .35, -.2)
stab(22.5, ['E3', 'G3', 'B3', 'D4', 'G4'], .95); kick(22.5, .9); mark('G4_catch', 22.5)
mark('G4_chomp_gap', 23.0)
groove('G4', 7, 8, ['Em7'], keys=False, v=.5)
success(23.5, 'E4', 'G4_ok')

# S4 舞台 · 按钮
groove('S4', 0, .5, ['Em7'], v=.6)
groove('S4', .5, 3, ['Em7'], drums=False, keys=False, v=.45)                      # 旁白：只剩轻贝斯
for i in range(16):   # 24.5–25.5 军鼓滚奏渐强
    t = 24.5 + i / 16
    put('drums', lp(hit('drum_kit', 'snare_2', .2 + .6 * i / 16), 9000), t, .3 + .5 * i / 16, .05)
kick(25.5, 1.0); crash(25.5, 1.0); stab(25.5, ['E3', 'B3', 'D4', 'E4', 'B4'], 1.0); mark('S4_button', 25.5)

# SPEED UP（120 → 140）：上行铜管半音爬 + 军鼓十六分 + 滚轮停三下
sp = SEG['SPEED']
for k in range(0, 16):
    t = bt('SPEED', k / 4)
    put('drums', lp(hit('drum_kit', 'snare_2', .35 + .4 * k / 16), 9000), t, .45, .05)
    if k % 2 == 0:
        p = m('E4') + k // 2 + 1
        blow(t, p, .12, .75, .45, .1); blow(t, p - 12, .12, .7, .3, -.2, 'trombone_stac')
    if k % 4 == 0: kick(t, .8)
for i, (k, ch) in enumerate([(1, ['G3', 'B3', 'D4', 'G4']), (2, ['A3', 'C#4', 'E4', 'A4']), (3, ['B3', 'D#4', 'F#4', 'B4'])]):
    t = bt('SPEED', k); stab(t, ch, .9, g=.9); kick(t, .9); mark(f'SPEED_reel{i+1}', t)
crash(bt('SPEED', 3), .6)
put('bass', slap('B1', .4, .9, slide=7, slide_t=.35), bt('SPEED', 3), .8)   # 滑进 F#

# ─── 第 2 轮：F# 多利亚 140 ───
F_R = 'F#4'
# G5 DODGE（像素 · 脉冲波琶音）
t0 = SEG['G5']['t0']; stab(t0, ['F#3', 'A3', 'C#4', 'E4', 'F#4'], .95); crash(t0, .7); mark('G5_cmd', t0)
groove('G5', 0, 6, ['F#m7', 'B9'], keys=False, v=.8)
arp = ['F#4', 'A4', 'C#5', 'E5', 'C#5', 'A4']
for k in range(4, 24):
    put('color', square(arp[k % 6], .09, .28, duty=.25), bt('G5', k / 4), .45, .3)
for i, (jt, ot) in enumerate([(28.51, 28.707), (29.15, 29.35), (29.79, 29.993)]):
    put('color', square('F#5', ot - jt + .05, .5, duty=.25, slide=7), jt, .55, -.2)
    put('bass', slap(m('F#2') + 12, .14, 1.0, pop=True), ot, .8); kick(ot, .7)
    mark(f'G5_over{i+1}', ot)
success(30.2, 'F#4', 'G5_ok')

# S5
s5 = SEG['S5']['t0']; groove('S5', 0, 1.5, ['F#m7'], v=.75)
stab(s5, ['F#3', 'A3', 'C#4', 'E4', 'F#4'], .8, g=.8); stab(bt('S5', .75), ['E3', 'G#3', 'B3', 'D4', 'E4'], .8, g=.7)
mark('S5_click_gap', 31.07)

# G6 ZIP（蓝图 · 弱音小号 + 棘轮）
t0 = SEG['G6']['t0']; stab(t0, ['F#3', 'A3', 'C#4', 'E4', 'F#4'], .9); mark('G6_cmd', t0)
groove('G6', 0, 6, ['F#m7', 'B9'], keys=False, v=.75)
for i, t in enumerate([32.35, 32.56, 32.78, 32.99, 33.21, 33.42]):
    blow(t, ['F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5'][i], .12, .75, .5, .25, 'trumpet_mute')
    for j in range(3): put('drums', lp(hit('hihat', 'closed', .35), 8000), t + j * .025, .35, .35)
    mark(f'G6_zip{i+1}', t)
kick(33.64, 1.0); crash(33.64, .7); stab(33.64, ['F#3', 'B3', 'C#4', 'F#4', 'A4'], .95); mark('G6_stamp', 33.64)

# S6
s6 = SEG['S6']['t0']; groove('S6', 0, 1.5, ['F#m7'], v=.75)
stab(s6, ['F#3', 'A3', 'C#4', 'E4', 'F#4'], .8, g=.8); stab(bt('S6', .75), ['E3', 'G#3', 'B3', 'D4', 'E4'], .8, g=.7)
mark('S6_click_gap', 34.5)

# G7 SALUTE（瑞士 · 响棒 + 钢琴断奏，极简；含即时回放）
t0 = SEG['G7']['t0']; stab(t0, ['F#3', 'A3', 'C#4', 'E4', 'F#4'], .9); mark('G7_cmd', t0)
for k in range(0, 4):
    tk = bt('G7', k); kick(tk, .6) if k % 2 == 0 else snare(tk, .45)
    put('color', hit('claves', None, .6), tk, .45, .2)
    put('keys', note('piano', ['F#4', 'A4'][k % 2], .12, .6), bt('G7', k + .5), .4, -.1)
    put('bass', slap('F#2', .18, .8), tk, .7)
for j in range(4): put('color', hit('claves', None, .4 + .1 * j), 35.564 + j * .05, .35, .2)
mark('G7_swing', 35.564)
put('color', hit('woodblock', 'c', .95), 35.993, .9, 0); put('bass', slap('F#2', .45, 1.0, slide=-7, slide_t=.4), 35.993, .9); mark('G7_bonk', 35.993)
for i, t in enumerate([36.21, 36.42]): put('color', hit('woodblock', 'a', .6 - .15 * i), t, .6, .3); mark(f'G7_bounce{i+1}', t)
scratch(36.421, .28); mark('G7_replay', [36.421, 37.278])
# 回放：半速——一个低长音 + 慢放的鼓
put('bass', slap('F#1', .8, .7), 36.45, .7)
put('drums', lp(bend(hit('drum_kit', 'kick_drum_left', .9), -12), 3000), 36.45, 1.0)
put('drums', lp(bend(hit('drum_kit', 'snare_1', .7), -12), 5000), 36.87, .7)
# 恢复原速
for k in [6, 6.5, 7]:
    tk = bt('G7', k); hat(tk, .4); put('color', hit('claves', None, .5), tk, .35, .2)
kick(37.278, .7); mark('G7_resume', 37.278)
fail(37.707, [('C#3', .16), ('C3', .3)], name='G7_fail', gong=False)

# S7：灯灭 → 真静音（只留心跳 + 低长音）
s7 = SEG['S7']['t0']; kick(s7, .9); stab(s7, ['F#2', 'C3', 'F#3', 'C4'], .9, d=.08); mark('S7_lightsoff', s7)
mark('S7_silence', [38.2, SEG['S7']['t1']])
SIL = [(10.0, 10.5, 'G2'), (38.2, SEG['S7']['t1'], 'S7'), (45.952, 47.452, 'B4')]

# BOSSIN（140 → 160）：上行铜管（比 SPEED 高一个全音）+ 定音鼓滚奏
for k in range(0, 16):
    t = bt('BOSSIN', k / 4)
    put('drums', hit('timpani', 'drum1' if k % 2 else 'drum2', .35 + .5 * k / 16), t, .55, -.1)
    if k % 2 == 0:
        p = m('F#4') + k // 2 + 1
        blow(t, p, .12, .8, .5, .1); blow(t, p - 12, .12, .75, .32, -.2, 'trombone_stac')
    if k % 4 == 0: kick(t, .75)
for i, k in enumerate([1, 2, 3]): stab(bt('BOSSIN', k), [['A3', 'C#4', 'E4', 'A4'], ['B3', 'D#4', 'F#4', 'B4'], ['C#4', 'E#4', 'G#4', 'C#5']][i], .9, g=.85)
put('bass', slap('C#2', .45, .95, slide=7, slide_t=.35), bt('BOSSIN', 3), .8)

# BOSS 160
bs = SEG['BOSS']
def BB(bar, beat=0): return bt('BOSS', bar * 4 + beat)
kick(BB(0), 1.0); crash(BB(0), .9); stab(BB(0), ['G#3', 'B3', 'D#4', 'F#4', 'G#4'], 1.0); mark('BOSS_land', BB(0))
groove('BOSS', 0, 12, ['G#m7', 'Emaj7', 'F#'], v=.95, hatop=True)
for bar in range(0, 3):   # 铜管反拍强奏
    for beat in [1.5, 3.5] if bar < 2 else [1.5]:
        stab(BB(bar, beat), CH[['G#m7', 'Emaj7', 'F#'][bar % 3]][0][-4:], .85, g=.7)
for beat in range(4): hat(BB(1, beat), .6, op=True); mark(f'BOSS_cloud{beat+1}', BB(1, beat))
mark('BOSS_pull', BB(2))
put('color', square('G#4', .3, .5, slide=12), 44.83 - .3 + .05, .5, .2); mark('BOSS_chute', 44.83)
put('color', square('G#5', .3, .5, slide=-14), 45.2, .5, .2); put('color', bpf(RNG.standard_normal(int(.12 * SR)), 300, 2000).astype(np.float32) * .3, 45.35, .5, .2); mark('BOSS_err', 45.2)
mark('BOSS_silence', [45.952, 47.452])
guqin_harm(46.0, 'E5'); guqin_slide(46.7, 'A3', 2); guqin_slide(47.08, 'C4', 3); mark('BOSS_dust', 46.0); mark('BOSS_ah1', 46.7); mark('BOSS_ah2', 47.08)
# B5 ACHOO：A 小调
kick(BB(4), 1.0); crash(BB(4), 1.0); put('drums', hit('bass_drum', None, 1.0), BB(4), .8); stab(BB(4), ['A3', 'C4', 'E4', 'G4', 'A4'], 1.0); mark('BOSS_achoo', BB(4))
for i, p in enumerate(['A4', 'C5', 'E5', 'A5']):
    t = BB(4, i); blow(t, p, .3 if i < 3 else .45, .9, .6, .15); blow(t, m(p) - 12, .3, .85, .4, -.2, 'trombone_stac'); put('brass', note('alto_sax', m(p) - 12, .3, .7), t - PRE, .3, -.05)
    mark(f'BOSS_canopy{i+1}', t)
groove('BOSS', 16, 28, ['Am7', 'Fmaj7', 'G6'], v=1.0, hatop=True)
THEME = [(0, 'A4', 2), (2, 'C5', 2), (4, 'E5', 1), (5, 'D5', 1), (6, 'C5', 2), (8, 'D5', 3), (11, 'C5', 1), (12, 'B4', 2), (14, 'G4', 1), (15, 'A4', 1),
         (16, 'E5', 2), (18, 'G5', 2), (20, 'F5', 1), (21, 'E5', 1), (22, 'D5', 2), (24, 'C5', 2), (26, 'B4', 1), (27, 'C5', 1), (28, 'A4', 4)]
for p16, p, l in THEME:
    t = BB(5, p16 / 4); d = beatlen('BOSS', 20) / 4 * l
    blow(t, p, d * .9 + .02, .85, .5, .15, 'trumpet_stac' if l < 2 else 'trumpet')
    put('brass', note('alto_sax', p, d * .9 + .02, .7), t - PRE, .35, -.15)
mark('BOSS_theme', BB(5))
kick(BB(7), 1.0); crash(BB(7), 1.0); put('drums', hit('bass_drum', None, 1.0), BB(7), .8); stab(BB(7), ['A3', 'C4', 'E4', 'A4', 'C5'], 1.0, d=.3); mark('BOSS_splash', BB(7))
groove('BOSS', 28, 30, ['Am7'], v=.8)
stab(52.7, ['F3', 'A3', 'C4', 'E4', 'A4'], .95); kick(52.7, .9); crash(52.7, .6); mark('BOSS_clear', 52.7)
mark('BOSS_pause', [53.2, 53.452])

# RESULT：A 大调舞台主题
rs = SEG['RESULT']['t0']
kick(rs, .9); crash(rs, .8); stab(rs, ['A3', 'C#4', 'E4', 'A4'], .9); mark('RESULT_in', rs)
groove('RESULT', 0, 10, ['A', 'D/A', 'E7', 'A'], v=.8)
riff('RESULT', 0, trans=5, v=.7, g=.55, upto=3)
riff('RESULT', 5 - 0, trans=5, v=.75, g=.6, upto=8)
for k in [1, 1.5, 2.5, 3.5]: put('keys', epiano(CH['A'][0], .25, .45), bt('RESULT', k), .45, .2)
# 53.8–55.3 旁白：铜管让位（只剩律动）
t = bt('RESULT', 7); stab(t, ['A3', 'C#4', 'E4', 'A4', 'C#5'], .95); put('jingles', note('glockenspiel', 'E7', .8, .7), t, .35, .3); mark('RESULT_salute', t)
put('jingles', note('glockenspiel', 'A7', .9, .75), 56.45, .35, .35); mark('RESULT_ding', 56.45)

# END：最后一个大和弦 + 小尾巴
es = SEG['END']['t0']
kick(es, 1.0); crash(es, .8); put('drums', hit('bass_drum', None, .9), es, .7)
for p in ['A3', 'C#4', 'F#4', 'B4', 'E5']: put('brass', note('trumpet' if m(p) >= 64 else 'trombone', p, 1.6, .75), es - PRE, .32, .1)
put('brass', note('trombone', 'A2', 1.6, .75), es - PRE, .4, -.2)
put('keys', epiano(CH['A69'][0], 2.2, .6), es, .6, .15)
put('bass', slap('A1', 1.2, 1.0), es, .9)
mark('END_chord', es)
put('bass', slap('A2', .35, .95, slide=12, slide_t=.25), 59.4, .9); put('drums', lp(hit('drum_kit', 'snare_1', .5), 8000), 59.4 + .3, .4)
mark('END_button', 59.4)

# ─── 真静音：鼓/贝斯/铜管/电钢琴在区间内清零（10ms 渐变），只留 color 里的心跳 / 古琴 / 低长音 ───
def gate(stems, a, b, fade=.01):
    ia, ib, f = int(a * SR), int(b * SR), int(fade * SR)
    g = np.ones(N, np.float32); g[ia:ib] = 0
    g[max(0, ia - f):ia] = np.linspace(1, 0, min(f, ia))
    g[ib:ib + f] = np.linspace(0, 1, len(g[ib:ib + f]))
    for s in stems: bus[s] *= g[:, None]
gate(['drums', 'bass', 'brass', 'keys', 'jingles'], 10.0, 10.5)
gate(['drums', 'bass', 'brass', 'keys', 'jingles', 'color'], 38.2, SEG['S7']['t1'])
gate(['drums', 'bass', 'brass', 'keys', 'jingles', 'color'], 45.952, 47.452)
# 允许的东西（加在静音之后）
for k in range(1, 4): heartbeat(bt('S7', k), .9)
heartbeat(bt('S7', 0) + .12, .8)
dn = int((SEG['S7']['t1'] - 38.2) * SR); tt = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 46.25 * tt) + .3 * np.sin(2 * np.pi * 92.5 * tt)) * np.minimum(1, tt / .3) * np.minimum(1, (tt[-1] - tt) / .15) * .12
put('color', drone.astype(np.float32), 38.2, 1.0)
for k in range(0, 4): heartbeat(bt('BOSS', 12 + k), .9)
guqin_harm(46.0, 'E5'); guqin_slide(46.7, 'A3', 2); guqin_slide(47.08, 'C4', 3)
# G2 静音区：只留古琴余音（古琴已在 color，未被门掉）
# 回放段的鼓/贝斯变半速：已单独写；把回放区间里的常规律动压低

# ─── 混合 ───
GAIN = {'drums': 1.0, 'bass': .5, 'brass': 1.15, 'keys': .95, 'color': .85, 'jingles': 1.0}
mix = sum(bus[k] * GAIN[k] for k in STEMS)
mix = lp(mix.T, 14000, 4).T.astype(np.float32)
pk = np.percentile(np.abs(mix), 99.99) / 1.35; mix *= .62 / max(pk, 1e-6)   # ×1.35 再进限幅 ≈ −16.5 LUFS
mix = np.stack([limit(mix[:, 0], .88), limit(mix[:, 1], .88)], 1)
fo = int(.4 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix[:N].astype(np.float32)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR)
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sc = .62 / max(pk, 1e-6)
for k in STEMS: sf.write(os.path.join(HERE, 'stems', k + '.wav'), np.clip(bus[k] * GAIN[k] * sc, -1, 1), SR)
json.dump({'dur': DUR, 'keys': KEY, 'silences': [[a, b, n] for a, b, n in SIL]}, open(os.path.join(HERE, 'score.json'), 'w'), indent=1)
open(os.path.join(HERE, 'CREDITS_music.txt'), 'w').write('Original score for "Five-Second Astronaut" (Microgame Frenzy), composed in code (score.py).\n' + '\n'.join(S.credits(['drum_kit', 'piano', 'trumpet_stac', 'trumpet', 'trumpet_mute', 'trombone', 'trombone_stac', 'tuba_stac', 'alto_sax', 'vibraphone', 'vibraphone_hard', 'xylophone', 'glockenspiel', 'claves', 'woodblock', 'claps', 'hihat', 'timpani', 'gong2', 'bass_drum'])) + '\nSynthesized: slap bass, square/pulse waves, record scratch, heartbeat drone (numpy). Guqin: core/audio/pluck.py physical model.\n')
print('score.wav', mix.shape, 'peak', float(np.abs(mix).max()))
