"""Blueprint《The Cloud Catcher》原创配乐：巴洛克二声部创意曲，108 BPM，G 大调。
运行：.venv/bin/python styles/blueprint/demo/music/score.py
输出：score.wav（48k 立体声 47.5 s）、stems/*.wav、score.json（关键时间点 + 自检）
"""
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR

HERE = os.path.dirname(os.path.abspath(__file__))
S.seed(42)
BPM = 108; BEAT = 60 / BPM; BAR = 4 * BEAT; S16 = BEAT / 4; E8 = BEAT / 2
DUR = 47.5
def B(n, beat=0.0): return (n - 1) * BAR + beat * BEAT

HS, BS, ST, HP = [], [], [], []      # harpsichord / bassoon / strings(spic) / harp 事件
SUS = []                             # 弦乐长音（单独做包络）

# ——— 主题：1 小节 16 个十六分音符（齿轮：级进上行 + 分解和弦）———
THEME = ['G4', 'A4', 'B4', 'C5', 'D5', 'B4', 'G4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'D5', 'B4', 'G4']
ANSW  = ['D4', 'E4', 'F#4', 'G4', 'A4', 'F#4', 'D4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'A4', 'F#4', 'D4']
def seq(ev, inst, t0, notes, step, vel=.7, pan=0., dur=None, accent=True, g=1.0):
    for i, n in enumerate(notes):
        if n is None: continue
        v = vel * (1.08 if accent and i % 4 == 0 else .92)
        ev.append((t0 + i * step, inst, n, dur or step * 1.1, min(1, v), pan, g))
def tr(notes, semis):
    return [None if n is None else S.name(S.midi(n) + semis) for n in notes]

# 小节 1：弱起三个十六分音符
seq(HS, 'harpsichord', B(2) - 3 * S16, ['D4', 'E4', 'F#4'], S16, vel=.62, pan=.15, accent=False)
# 小节 2–3：主题独奏
seq(HS, 'harpsichord', B(2), THEME, S16, vel=.72, pan=.15)
seq(HS, 'harpsichord', B(3), ANSW, S16, vel=.70, pan=.15)
# 小节 4–5：巴松模仿（低声部主题），羽管键琴对题（八分音符）
seq(BS, 'bassoon_stac', B(4), tr(THEME, -24), S16, vel=.66, pan=-.25)
seq(HS, 'harpsichord', B(4), ['B4', 'C5', 'D5', 'E5', 'D5', 'C5', 'B4', 'A4'], E8, vel=.66, pan=.15)
seq(HS, 'harpsichord', B(5), ['D5', 'E5', 'F#5', 'G5', 'A5', 'F#5', 'D5', 'F#5', 'G5', 'A5', 'B5', 'A5', 'G5', 'F#5', 'E5', 'D5'], S16, vel=.72, pan=.15)
seq(BS, 'bassoon_stac', B(5), ['D3', 'C3', 'B2', 'A2', 'G2', 'A2', 'B2', 'C3'], E8, vel=.66, pan=-.25)
# 小节 6–7：模进上行 + 低音八度加厚 → 15.556 完全终止
seq(HS, 'harpsichord', B(6), ['E4', 'F#4', 'G4', 'A4', 'B4', 'G4', 'E4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'B4', 'G4', 'E4'], S16, vel=.74, pan=.15)
seq(BS, 'bassoon_stac', B(6), ['E3', 'D3', 'C3', 'B2', 'A2', 'B2', 'C3', 'D3'], E8, vel=.7, pan=-.25)
seq(HS, 'harpsichord', B(6), ['E3', 'D3', 'C3', 'B2', 'A2', 'B2', 'C3', 'D3'], E8, vel=.55, pan=-.1, accent=False)
seq(HS, 'harpsichord', B(7), ['A4', 'B4', 'C5', 'D5', 'E5', 'C5', 'A4', 'C5', 'B4', 'D5', 'G5', 'D5', 'C5', 'A4', 'F#4', 'A4'], S16, vel=.76, pan=.15)
seq(BS, 'bassoon_stac', B(7), ['C3', 'C3', 'A2', 'A2', 'D3', 'D3', 'D2', 'D2'], E8, vel=.72, pan=-.25)
seq(HS, 'harpsichord', B(7), ['C3', None, 'A2', None, 'D3', None, 'D2', None], E8, vel=.55, pan=-.1, accent=False)
# 小节 8：15.556 主和弦延长 → 16.667 起四个八分装配和弦
T_CAD = B(8)
for n in ['G2', 'D3', 'G3', 'B3', 'D4', 'G4']: HS.append((T_CAD, 'harpsichord', n, 1.0, .72, .1, 1))
BS.append((T_CAD, 'bassoon', 'G2', 1.02, .55, -.25, .9))
ASM = [B(8, 2), B(8, 2.5), B(8, 3), B(8, 3.5)]
ASM_CH = [['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['A3', 'D4', 'F#4'], ['C4', 'D4', 'F#4', 'A4']]
ASM_BS = ['G2', 'C3', 'D3', 'D2']
for t, ch, b in zip(ASM, ASM_CH, ASM_BS):
    for n in ch: HS.append((t, 'harpsichord', n, .18, .74, .1, 1))
    BS.append((t, 'bassoon_stac', b, .2, .72, -.25, 1))
    ST.append((t, 'cellos_spic', b, .2, .72, -.3, .9))
    ST.append((t, 'violins_spic', ch[-1], .2, .66, .35, .8))
# 小节 9–10：全体。主题 + 跳弓"齿轮咬合" + 巴松持续低音
seq(HS, 'harpsichord', B(9), THEME, S16, vel=.76, pan=.15)
seq(HS, 'harpsichord', B(10), ANSW, S16, vel=.74, pan=.15)
BS.append((B(9), 'bassoon', 'G2', 2 * BAR - .15, .5, -.25, .85))
pulse9 = ['G4', 'B4', 'D5', 'B4', 'C5', 'A4', 'D5', 'B4']
pulse10 = ['D4', 'F#4', 'A4', 'F#4', 'G4', 'B4', 'A4', 'F#4']
seq(ST, 'violins_spic', B(9), pulse9, E8, vel=.62, pan=.35, dur=.2, g=.8)
seq(ST, 'cellos_spic', B(9), ['G2', 'G3', 'G2', 'G3', 'C3', 'C3', 'D3', 'D3'], E8, vel=.66, pan=-.3, dur=.2, g=.9)
seq(ST, 'cellos_spic', B(10), ['D3', 'D3', 'D3', 'D3', 'G2', 'G2', 'D3', 'D3'], E8, vel=.66, pan=-.3, dur=.2, g=.9)
# 20.0 起小提琴上行音阶（吊臂抬起）
scale = ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C6', 'D6']
seq(ST, 'violins_spic', B(10), scale, S16, vel=.62, pan=.35, dur=.16, g=.8)
seq(ST, 'violins_spic', B(10) + 12 * S16, ['D6', 'B5', 'G5', 'D5'], S16, vel=.6, pan=.35, dur=.16, g=.75)
# 小节 11：逐个掉队 + 渐慢，最后一个巴松低音 ~23.9
rit = [0, .15, .31, .49, .70, .95, 1.25]
for k, (dt, n) in enumerate(zip(rit, ['G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4'])):
    HS.append((B(11) + dt, 'harpsichord', n, .2, .6 - .05 * k, .15, 1))
for k, n in enumerate(['G4', 'B4', 'D5']): ST.append((B(11) + k * E8, 'violins_spic', n, .2, .5 - .08 * k, .35, .7))
for k, n in enumerate(['G2', 'G3', 'G2', 'D3', 'G2']): ST.append((B(11) + [0, .28, .58, .92, 1.3][k], 'cellos_spic', n, .2, .55 - .06 * k, -.3, .8))
BS.append((B(11) + .2, 'bassoon_stac', 'D3', .2, .55, -.25, 1))
BS.append((B(11) + .9, 'bassoon_stac', 'B2', .22, .5, -.25, 1))
T_POOF = 23.9
BS.append((T_POOF, 'bassoon_stac', 'G2', .3, .62, -.1, 1.1))
# 小节 12–13：疑问三音
Q3 = [26.667, 26.944, 27.222]
for t, n, d in zip(Q3, ['B4', 'D5', 'E5'], [.12, .12, .08]):
    HS.append(dict(t=t, inst='harpsichord', pitch=n, dur=d, vel=.4, pan=.1, release=.08))
# 小节 14：Dsus4 悬置（弦乐长音 + 羽管键琴滚奏）
T_SUS = B(14)
for inst, n, pan in [('cellos', 'D3', -.3), ('violas', 'A3', -.05), ('violas', 'D4', -.05), ('violins', 'G4', .25), ('violins', 'A4', .3), ('violins', 'D5', .35)]:
    SUS.append(dict(t=T_SUS, inst=inst, pitch=n, dur=BAR + .05, vel=.62, pan=pan, attack=.35, release=.12))
for k, n in enumerate(['D3', 'G3', 'A3', 'D4', 'G4', 'A4', 'D5']): HS.append((T_SUS + k * .055, 'harpsichord', n, 1.2, .6, .1, 1))
for k, n in enumerate(['D3', 'A3', 'D4', 'G4', 'A4', 'D5']): HS.append((B(14, 2) + k * .05, 'harpsichord', n, 1.0, .56, .1, 1))
BS.append(dict(t=T_SUS, inst='bassoon', pitch='D2', dur=BAR + .05, vel=.45, pan=-.25, attack=.4, release=.12))
# 小节 15：31.111 解决到 G 大调，全体主题一个小节
T_RES = B(15)
seq(HS, 'harpsichord', T_RES, THEME, S16, vel=.8, pan=.15)
for n in ['G2', 'D3', 'G3', 'B3']: HS.append((T_RES, 'harpsichord', n, .5, .75, -.05, 1))
seq(BS, 'bassoon_stac', T_RES, tr(THEME, -24), S16, vel=.68, pan=-.25)
for inst, n, pan in [('cellos', 'G2', -.3), ('violas', 'D4', -.05), ('violins', 'B4', .3), ('violins', 'G5', .35)]:
    SUS.append(dict(t=T_RES, inst=inst, pitch=n, dur=BAR - .2, vel=.66, pan=pan, attack=.02, release=.4))
seq(ST, 'violins_spic', T_RES, pulse9, E8, vel=.6, pan=.35, dur=.2, g=.75)
seq(ST, 'cellos_spic', T_RES, ['G2', 'G3', 'G2', 'G3', 'C3', 'C3', 'D3', 'D3'], E8, vel=.64, pan=-.3, dur=.2, g=.85)
# 小节 16–18：竖琴 + 羽管键琴柔和分解和弦
ARP = {'G': ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3'], 'Em': ['E2', 'B2', 'E3', 'G3', 'B3', 'G3', 'E3', 'B2'],
       'C': ['C3', 'G3', 'C4', 'E4'], 'D': ['D3', 'A3', 'D4', 'F#4']}
seq(HP, 'harp', B(16), ARP['G'], E8, vel=.55, pan=-.15, dur=1.2, accent=False)
for k, n in enumerate(['B4', 'D5', 'G5', 'D5']): HS.append((B(16, k), 'harpsichord', n, .4, .45, .2, 1))
# 35.556 竖琴上行琶音顶点（花开）
bloom = ['E2', 'B2', 'E3', 'G3', 'B3', 'E4', 'G4', 'B4', 'E5', 'G5', 'B5', 'E6']
for k, n in enumerate(bloom): HP.append((B(17) + k * (1.44 / 12), 'harp', n, 2.0, .5 + .03 * k, -.15 + .03 * k, 1))
for k, n in enumerate(['G4', 'B4', 'E5']): HS.append((B(17, 2 + k * .5), 'harpsichord', n, .5, .42, .2, 1))
seq(HP, 'harp', B(18), ARP['C'] + ARP['D'], E8, vel=.52, pan=-.15, dur=1.2, accent=False)
for k, n in enumerate(['E5', 'C5', 'F#5', 'D5']): HS.append((B(18, k), 'harpsichord', n, .4, .42, .2, 1))
# 小节 19：40.0 全体终止和弦（印章同拍），然后羽管键琴单声部
T_STAMP = B(19)
for n in ['G2', 'D3', 'G3', 'B3', 'D4', 'G4']: HS.append((T_STAMP, 'harpsichord', n, .35, .8, .05, 1))
BS.append((T_STAMP, 'bassoon_stac', 'G2', .3, .75, -.25, 1.1))
ST.append((T_STAMP, 'cellos_spic', 'G2', .3, .78, -.3, 1)); ST.append((T_STAMP, 'violins_spic', 'G4', .3, .72, .3, .9))
ST.append((T_STAMP, 'violins_spic', 'D5', .3, .72, .35, .9)); ST.append((T_STAMP, 'violins_spic', 'B5', .3, .7, .4, .85))
for n in ['G2', 'D3', 'B3', 'G4']: HP.append((T_STAMP, 'harp', n, 1.2, .62, -.15, 1))
for k, n in enumerate(['D5', 'C5', 'B4', 'A4', 'G4', 'A4', 'B4']): HS.append((T_STAMP + BEAT * (1.0 + .5 * k), 'harpsichord', n, .3, .42 - .02 * k, .15, 1))
# 小节 20–21：主题增值（八分音符），落 G 大调主和弦
seq(HS, 'harpsichord', B(20), THEME[:12], E8, vel=.55, pan=.15)
seq(HP, 'harp', B(20), ['G2', None, 'D3', None, 'C3', None, 'D3', None, 'E3', None, 'D3', None], E8, vel=.42, pan=-.15, dur=1.0, accent=False)
T_END = B(21, 2)
for k, n in enumerate(['G2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4']): HS.append((T_END + k * .06, 'harpsichord', n, 2.0, .55, .1, 1))
for n in ['G2', 'D3', 'B3', 'G4', 'D5']: HP.append((T_END, 'harp', n, 2.4, .5, -.15, 1))
for inst, n, pan in [('cellos', 'G2', -.3), ('violas', 'D4', -.05), ('violins', 'B4', .3), ('violins', 'G5', .35)]:
    SUS.append(dict(t=B(20), inst=inst, pitch=n, dur=B(21, 4) + .3 - B(20), vel=.42, pan=pan, attack=1.2, release=1.0))

# ——— 渲染 ———
N = int(DUR * SR)
def rend(ev):
    x = S.render(ev, dur=DUR, master=False).astype(np.float32)
    return x[:N] if len(x) >= N else np.pad(x, ((0, N - len(x)), (0, 0)))
hs, bs, st, hp, sus = rend(HS), rend(BS), rend(ST), rend(HP), rend(SUS)
t = np.arange(N) / SR
# 悬置和弦包络：两次"呼吸" + 渐强，不解决
env = np.ones(N, np.float32)
m = (t >= T_SUS) & (t < T_RES)
tt = t[m] - T_SUS
breath = 1 + .35 * np.exp(-((tt - .30) / .16) ** 2) + .35 * np.exp(-((tt - (.30 + BEAT)) / .16) ** 2)
cres = .75 + .55 * np.clip((tt - (B(14, 2) - T_SUS)) / (T_RES - B(14, 2)), 0, 1) ** 1.5
env[m] = (breath * cres).astype(np.float32)
sus *= env[:, None]
strings = st + sus
stems = {'harpsichord': hs, 'bassoon': bs * 1.0, 'strings': strings, 'harp': hp}
# 各声部混响（小厅，巴洛克室内乐）
room = {'harpsichord': (.35, .16), 'bassoon': (.35, .15), 'strings': (.45, .2), 'harp': (.5, .22)}
for k in stems: stems[k] = S.room(stems[k], size=room[k][0], mix=room[k][1]).astype(np.float32)[:N]
# 静音门（含混响尾巴一起清零）
def gate(a, b, fade=.08):
    g = np.ones(N, np.float32)
    ia, ib = int(a * SR), int(b * SR); fl = int(fade * SR)
    g[ia:ib] = 0
    g[max(0, ia - fl):ia] = np.linspace(1, 0, ia - max(0, ia - fl))
    return g
G = gate(24.3, 26.6) * gate(27.4, 28.85, .06)
for k in stems: stems[k] *= G[:, None]
mix = sum(stems.values())
pk = np.abs(mix).max(); gain = 10 ** (-3 / 20) / pk
mix *= gain
for k in stems: stems[k] *= gain
assert np.isfinite(mix).all()
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
sf.write(os.path.join(HERE, 'score.wav'), mix, SR, subtype='PCM_24')
for k, v in stems.items(): sf.write(os.path.join(HERE, 'stems', k + '.wav'), v, SR, subtype='PCM_24')

# ——— 自检 ———
def rms_db(a, b, x=mix):
    s = x[int(a * SR):int(b * SR)]; r = np.sqrt(np.mean(s ** 2) + 1e-20); return round(20 * np.log10(r), 1)
def band(x, lo, hi):
    X = np.abs(np.fft.rfft(x.mean(1))) ** 2; f = np.fft.rfftfreq(len(x), 1 / SR)
    return float(X[(f >= lo) & (f < hi)].sum())
tot = band(mix, 20, 24000)
report = {
    'bpm': BPM, 'beat': BEAT, 'bar': BAR, 'dur': DUR, 'sr': SR, 'peak_dbfs': round(20 * np.log10(np.abs(mix).max()), 2),
    'clipped_samples': int((np.abs(mix) >= .999).sum()),
    'cues': {'pickup': B(2) - 3 * S16, 'title_downbeat': B(2), 'bassoon_enters': B(4), 'sequence': B(6), 'cadence_explode_max': T_CAD,
             'assembly_chords': ASM, 'machine_runs': B(9), 'violin_scale_boom_up': B(10), 'winddown': B(11), 'last_bassoon_poof': T_POOF,
             'question_notes': Q3, 'sus4_revision_cloud': T_SUS, 'breaths': [T_SUS + .30, T_SUS + .30 + BEAT], 'resolve_catch': T_RES,
             'rain_arps': B(16), 'harp_bloom': B(17), 'stamp': T_STAMP, 'augmented_theme': B(20), 'final_chord': T_END},
    'silence_rms_db': {'24.3-26.6': rms_db(24.35, 26.6), '27.4-28.85': rms_db(27.45, 28.85)},
    'section_rms_db': {'b2-3': rms_db(B(2), B(4)), 'b4-5': rms_db(B(4), B(6)), 'b6-7': rms_db(B(6), B(8)), 'b8': rms_db(B(8), B(9)),
                       'b9-10': rms_db(B(9), B(11)), 'b11': rms_db(B(11), 24.3), 'b14_sus': rms_db(B(14), B(15)), 'b15': rms_db(B(15), B(16)),
                       'b16-18': rms_db(B(16), B(19)), 'b19': rms_db(B(19), B(20)), 'b20-21': rms_db(B(20), 46.67)},
    'band_energy_frac': {k: round(band(mix, a, b) / tot, 4) for k, (a, b) in {'<120': (20, 120), '120-500': (120, 500), '500-2k': (500, 2000), '2k-8k': (2000, 8000), '>8k': (8000, 24000)}.items()},
    'stem_rms_db': {k: rms_db(0, DUR, v) for k, v in stems.items()},
}
json.dump(report, open(os.path.join(HERE, 'score.json'), 'w'), indent=1, default=float)
print(json.dumps(report, indent=1, default=float))
