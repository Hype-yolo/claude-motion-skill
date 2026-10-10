# 旁白：Kokoro af_heart, speed .93 → ../voices/v01..v13.wav + dur.json
# 用法（仓库根）：.venv/bin/python styles/watercolor/demo/tts/gen.py   （OUT=dir 可改输出目录，默认 ../voices）
# 模型用 core/tts/ 里的同一份 kokoro-v1.0.onnx / voices-v1.0.bin（与原项目 tts/ 下的逐字节相同）
import soundfile as sf, json, numpy as np, os
OUT = os.path.abspath(os.environ['OUT']) if os.environ.get('OUT') else None
from kokoro_onnx import Kokoro
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
CORE = os.path.join(HERE, '..', '..', '..', '..', 'core', 'tts')
k = Kokoro(os.path.join(CORE, "kokoro-v1.0.onnx"), os.path.join(CORE, "voices-v1.0.bin"))
OUT = OUT or '../voices'; os.makedirs(OUT, exist_ok=True)
out={}
for name, txt in json.load(open('lines.json')):
    s, sr = k.create(txt, voice="af_heart", speed=0.93, lang="en-us")
    # trim silence
    a=np.abs(s); th=a.max()*0.01; nz=np.where(a>th)[0]; s=s[max(0,nz[0]-240):nz[-1]+2400]
    sf.write(f"{OUT}/{name}.wav", s, sr); out[name]=round(len(s)/sr,2); print(name, out[name])
json.dump(out, open(f'{OUT}/dur.json','w'))
