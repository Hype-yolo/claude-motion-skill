import soundfile as sf, json, numpy as np, sys, os
# 模型用仓库共享的 core/tts/；输出目录默认 demo/voices/，VO_DIR=... 可改（校验时别覆盖正式配音）
HERE = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(HERE, '../../../../core/tts')
VO = os.environ.get('VO_DIR', os.path.join(HERE, '../voices')); os.makedirs(VO, exist_ok=True)
from kokoro_onnx import Kokoro
k = Kokoro(os.path.join(CORE, "kokoro-v1.0.onnx"), os.path.join(CORE, "voices-v1.0.bin"))
d = json.load(open(os.path.join(VO, 'dur.json'))) if os.path.exists(os.path.join(VO, 'dur.json')) else {}
for name, txt in json.load(open(os.path.join(HERE, 'lines.json'))):
    if name not in sys.argv[1:]: continue
    s, sr = k.create(txt, voice="af_bella", speed=0.9, lang="en-us")
    a = np.abs(s); th = a.max() * 0.01; nz = np.where(a > th)[0]; s = s[max(0, nz[0] - 240):nz[-1] + 2400]
    sf.write(os.path.join(VO, f"{name}.wav"), s, sr); d[name] = round(len(s) / sr, 2); print(name, d[name])
json.dump(d, open(os.path.join(VO, 'dur.json'), 'w'))
