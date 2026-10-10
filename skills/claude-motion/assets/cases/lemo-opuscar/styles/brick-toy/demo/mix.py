# 混音：拟音（按 events.json）+ 旁白/对讲 + 配乐（旁白时压低）+ 室内底噪与钟表 → mix.wav
import sys, os, json, numpy as np, soundfile as sf, librosa
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../core/audio'))
from sfx import *
HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; N = int(DUR * SR)
sfxb, vob, amb = np.zeros((N, 2)), np.zeros((N, 2)), np.zeros((N, 2))

G = dict(click=.55, clack=.45, crash=.7, whoosh=.22, creak=.35, thump=.6, step=.18, ding=.35, title=.3, quindar=.25, rumble=.5, ignite=.9, roar=.55)
rng = np.random.default_rng(3)
for e in E['ev']:
    ty, t, v = e['type'], e['t'], e.get('v', 1.0); pan = float(rng.uniform(-.25, .25))
    if ty == 'click': x = click(e.get('pitch', 1.0) * rng.uniform(.95, 1.05), v)
    elif ty == 'clack': x = clack(rng.uniform(.8, 1.3), v)
    elif ty == 'crash': x = crash(v)
    elif ty == 'whoosh': x = whoosh(.35, v)
    elif ty == 'creak': x = creak(v)
    elif ty == 'thump': x = thump(v)
    elif ty == 'step': x = step(v)
    elif ty == 'ding': x = ding(v); pan = 0
    elif ty == 'title': x = pop(v); pan = 0
    elif ty == 'quindar': x = quindar(v); pan = 0
    elif ty == 'rumble': x = rumble(e['d'], v); pan = 0
    elif ty == 'ignite': x = ignite(v); pan = 0
    elif ty == 'roar': x = roar(e['d'], v); pan = 0
    else: continue
    add(sfxb, x, t, G[ty], pan)
# 倒计时的心跳鼓（72bpm）
for k in range(5): add(sfxb, heartbeat(.8), 32.9 + k * .833, .45)

# 旁白与对讲
VO = {'v1': .8, 'v2': 6.0, 'v3': 22.6, 'v4': 25.6, 'c3': 33.3, 'c2': 34.3, 'c1': 35.3, 'v5': 45.2}
for k, t in VO.items():
    y, sr = sf.read(os.path.join(HERE, 'voices', k + '.wav')); y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    if k.startswith('c'): y = radio(y) * .8
    else: y = compress(y / np.abs(y).max(), .3, 3.0)
    add(vob, y, t, 1.0)
add(vob, quindar(1, 2475), 35.3 + .75, .25)   # 对讲结束音

# 环境：室内底噪 + 钟表滴答（倒塌后的安静里最明显）
room = lp(brown(DUR), 250) * .02
amb[:, 0] += room; amb[:, 1] += np.roll(room, 997)
for k in range(int(DUR)):
    tick = hp(noise(.02), 3000) * env_exp(.02, .002) * (.05 if k % 2 else .04)
    add(amb, tick, k + .5, 1.0, .6)

# 配乐 + 旁白压低
mus, sr = sf.read(os.path.join(HERE, 'music', 'score.wav')); mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
act = np.abs(vob).max(1); from scipy.ndimage import maximum_filter1d, uniform_filter1d
duck = 1 - .42 * np.clip(uniform_filter1d(maximum_filter1d((act > .02).astype(float), int(.25 * SR)), int(.2 * SR)), 0, 1)
mix = mus * .74 * duck[:, None] + sfxb * .9 + vob * 1.0 * 10 ** (4 / 20) * .5 + amb
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
print('mix peak', np.abs(mix).max(), 'rms', np.sqrt((mix ** 2).mean()))
