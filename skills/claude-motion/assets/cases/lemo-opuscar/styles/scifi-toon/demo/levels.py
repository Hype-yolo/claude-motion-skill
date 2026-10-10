"""电平表：每 1 秒各声部 RMS（dBFS），用于配平检查。python levels.py"""
import numpy as np, soundfile as sf, sys, os
sys.argv = ['mix.py']; SAVE = {}
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mix.py')).read().replace("sf.write(os.path.join(HERE, 'mix.wav')", "SAVE['m'] = (mus * .42 * duck[:, None], sfxb * .8, vob, amb, mix); (lambda *a: None)(os.path.join(HERE, 'mix.wav')")
exec(compile(src, 'mix.py', 'exec'))
mus, sfx, vo, am, mx = SAVE['m']
db = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
print(' t   voice music  sfx   amb   mix')
for s in range(int(DUR)):
    a, b = s * SR, (s + 1) * SR
    print(f'{s:2d} ' + ' '.join(f'{db(x[a:b]):5.0f}' for x in (vo, mus, sfx, am, mx)))
