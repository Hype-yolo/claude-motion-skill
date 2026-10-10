"""独奏大提琴：一条从不中断的旋律线，音符落在笔的拐角上（events.json 里的 corners / 段落标记）。
cellos 低力度连奏模拟独奏；童年 cellos_pizz；结尾 hand_chimes。没有钢琴，没有弦乐铺底。
python styles/one-line/demo/music/score.py → music/score.wav + music/cues.json"""
import sys, os, json, numpy as np, soundfile as sf
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
sys.path.insert(0, ROOT)
from core.audio import sampler as S
from core.audio.sfx import SR, add
HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(HERE, '..', 'events.json')))
DUR = E['dur'] + 1.0
S.seed(7)

buf = np.zeros((int(DUR * SR), 2), np.float32)
PAN = -0.12   # 一把琴，坐在画家身边略偏左

def legato(notes, vel=.5, attack=.12, tail=.9, gain=1.0, overlap=.14, first_attack=None):
    """notes = [(t, pitch[, vel])]；每个音持续到下一个音起点 + overlap（连奏换弓）"""
    for i, n in enumerate(notes):
        t, p = n[0], n[1]; v = n[2] if len(n) > 2 else vel
        t1 = notes[i + 1][0] + overlap if i + 1 < len(notes) else t + tail
        a = first_attack if (i == 0 and first_attack) else attack
        for pp in (p if isinstance(p, (list, tuple)) else [p]):
            x = S.note('cellos', pp, max(.2, t1 - t), vel=v, attack=a, release=.45)
            add(buf, x, t, gain, PAN)

def pizz(notes, vel=.62, gain=1.0):
    for n in notes:
        x = S.note('cellos_pizz', n[1], .9, vel=n[2] if len(n) > 2 else vel)
        add(buf, x, n[0], gain, PAN + .05)

cues = {}
# A 握：D–F#–A，攥紧落在 D4（第一个指节 → 最后一个指节）
A = [(1.02, 'D3', .38), (2.43, 'F#3', .46), (3.31, 'A3', .5), (4.09, 'D4', .6)]
legato(A, first_attack=.9, tail=1.2, gain=1.25); cues['grip'] = 4.09
# B 风筝：拨奏。线往上爬（八分音符上行）→ 头发 → 风筝四个角 → 两个蝴蝶结 → 收线（下行）→ 头顶另一半
B = [(4.95, 'D3'), (5.19, 'F#3'), (5.43, 'A3'), (5.67, 'D4'), (5.905, 'E4'),
     (6.40, 'F#4'), (6.60, 'A4'), (6.757, 'B4'), (6.904, 'D5', .7), (7.185, 'A4'),
     (7.352, 'F#4'), (7.598, 'G4'), (7.759, 'F#4'), (7.902, 'E4'),
     (8.047, 'D4', .55), (8.168, 'C#4', .52), (8.383, 'B3', .5), (8.563, 'A3', .48), (8.904, 'F#3', .5), (9.2, 'E3', .5)]
pizz(B, gain=.42)
# C 骑车：弓奏回来，两个轮子各一句上行
C = [(9.62, 'D3', .42), (10.35, 'A3', .48), (10.9, 'D4', .52), (11.455, 'F#4', .56), (11.784, 'E4', .5),
     (12.478, 'D4', .5), (12.687, 'C#4', .5), (13.2, 'A3', .48), (13.792, 'B3', .5)]
legato(C, first_attack=.35)
# D 初恋：全曲最高、最歌唱的一句；第一次鼻尖相碰 = 最高音 B4，第二次 = A4
D = [(14.04, 'D4', .5), (14.706, 'E4', .52), (15.292, 'F#4', .56), (15.469, 'G4', .58), (15.891, 'A4', .62), (16.11, 'B4', .66),
     (16.9, 'A4', .58), (17.391, 'G4', .55), (17.765, 'F#4', .55), (18.241, 'G4', .57), (18.417, 'A4', .62), (18.935, 'F#4', .52), (19.392, 'D4', .5)]
legato(D, overlap=.18); cues['nose1'] = 16.11; cues['nose2'] = 18.417
# E 家：双音，平稳
Ech = [(19.868, ['G3', 'D4'], .44), (20.853, ['A3', 'E4'], .44), (21.337, ['F#3', 'D4'], .44), (21.816, ['E3', 'C#4'], .42), (22.075, ['D3', 'A3'], .42)]
legato(Ech, gain=1.0, attack=.2)
# F 失去：B3 → A3，停笔后 A3 渐弱到无；之后真静音；"goes on" 时一个很轻的 F#3 重新落弓
legato([(22.927, 'B3', .44), (23.483, 'A3', .42)], tail=1.0, gain=1.5)
cues['silence'] = [24.6, 26.85]
legato([(26.85, 'F#3', .32)], first_attack=.5, tail=.5, gain=1.5)
# G 孩子："握"的动机原样回来，高八度
G = [(27.056, 'D4', .4), (28.085, 'F#4', .46), (29.408, 'A4', .5), (30.093, 'D5', .56)]
legato(G, first_attack=.4, tail=1.0, gain=1.5)
# H 老年：低音区慢板往下走；拉远时音区缓缓升高；最后几根睫毛一音一根，落在主音 D
H = [(30.8, 'D3', .42), (32.4, 'C#3', .42), (33.5, 'B2', .45), (34.6, 'D3', .48), (35.6, 'F#3', .5), (36.6, 'A3', .54),
     (37.298, 'B3', .5), (37.854, 'A3', .46), (38.403, 'F#3', .44)]
legato(H, attack=.3, overlap=.2, gain=1.7)
legato([(38.8, ['D2', 'D3'], .48)], attack=.25, tail=2.6, gain=1.3); cues['final'] = 38.8
# I 交接：新线起笔一声手摇钟（新声部），片尾一个很轻的高音长音
add(buf, S.note('hand_chimes', 'D6', 4.0, vel=.55), 41.7, .9, .25); cues['chime'] = 41.7
add(buf, S.note('hand_chimes', 'A5', 3.5, vel=.35), 43.4, .6, .3)
legato([(44.3, 'A4', .26)], first_attack=1.2, tail=2.8, gain=1.6)

mix = S.room(buf, size=.55, mix=.22)
# 静音区连混响尾巴一起清零（20 ms 淡变）
a, b = cues['silence']; i0, i1 = int(a * SR), int(b * SR); f = int(.3 * SR)
g = np.ones(len(mix), np.float32); g[i0:i1] = 0; g[i0 - f:i0] = np.linspace(1, 0, f); g[i1:i1 + int(.02 * SR)] = np.linspace(0, 1, int(.02 * SR))
mix *= g[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * .8
sf.write(os.path.join(HERE, 'score.wav'), mix, SR)
json.dump(cues, open(os.path.join(HERE, 'cues.json'), 'w'), indent=1)
print('score.wav', len(mix) / SR, 's', cues)
print('\n'.join(S.credits(['cellos', 'cellos_pizz', 'hand_chimes'])))
