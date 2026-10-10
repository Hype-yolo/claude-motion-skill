"""Kokoro 本地配音（离线）：python core/tts/tts.py lines.json out_dir
lines.json = [{"id":..., "text":..., "voice":"bm_george", "speed":0.92, "lang":"en-us"}, ...]
  默认 voice=af_bella、speed=0.92、lang=en-us。中文用 "lang":"cmn" 加 zf_*/zm_* 声音（离线可用，音色一般）。
输出 out_dir/<id>.wav（24kHz，去首尾静音）与 out_dir/dur.json
模型：kokoro-v1.0.onnx / voices-v1.0.bin 放在本目录，下载：sh tools/fetch.sh voice（约 350 MB）
路径限制：espeak-ng（Kokoro 用它把文字转成音素）的数据目录，解析软链后的真实路径必须短于 160 字节（汉字算 3 字节），否则找不到数据、
         报一个指向别人机器上某个路径（编译 espeak-ng 的那台）的莫名其妙的错。库放在 ~/lemo-opuscar 之类的短路径下就没事；本脚本开工前会检查并说明。
要更自然的中文/日文等声音：core/tts/tts_zh.py（微软 edge-tts，要联网），接口和输出布局相同。
"""
import sys, json, os, re
if len(sys.argv) < 3 or sys.argv[1] in ('-h', '--help'):
    print(__doc__); sys.exit(0 if len(sys.argv) > 1 and sys.argv[1] in ('-h', '--help') else 2)
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
CJK = re.compile('[぀-ヿ㐀-鿿가-힯豈-﫿]')
DEFAULT_VOICE = {'cmn': 'zf_xiaoxiao'}
lines, out = json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2]

# 先查输入，再加载模型（模型要几秒）
wrong = [L['id'] for L in lines if L.get('lang', 'en-us').lower().startswith('en') and CJK.search(L['text'])]
if wrong:
    sys.exit(f"tts.py: line(s) {', '.join(map(str, wrong))} contain Chinese/Japanese/Korean text but lang is English, and Kokoro would read them as noise.\n"
             f"  offline: add \"lang\": \"cmn\" and a zf_*/zm_* voice to those lines;  more natural (needs network): python core/tts/tts_zh.py {sys.argv[1]} {out}")
model, voices = os.path.join(HERE, 'kokoro-v1.0.onnx'), os.path.join(HERE, 'voices-v1.0.bin')
if not (os.path.exists(model) and os.path.exists(voices)):
    sys.exit(f'tts.py: the Kokoro model is not in {HERE}.\n  install the voice tier: sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice   (from the library root; it also fetches the model, about 350 MB)')
ESPEAK_LIMIT = 160   # 实测：espeak-ng 数据目录的真实路径 ≤159 字节能用，≥160 字节找不到 phontab（软链先被解析，量的是真实路径）
try:
    import espeakng_loader
    espeak_dir = os.path.realpath(espeakng_loader.get_data_path())
except Exception:
    espeak_dir = None   # 装的不是 espeakng_loader（比如系统的 espeak-ng）：不检查，让 Kokoro 自己报错
if espeak_dir and len(espeak_dir.encode('utf-8')) >= ESPEAK_LIMIT:
    sys.exit(f"tts.py: this library sits under a folder path that is too long for the offline voice engine (espeak-ng).\n"
             f"  its data folder is {len(espeak_dir.encode('utf-8'))} bytes long (a Chinese character counts as 3), the limit is {ESPEAK_LIMIT - 1}:\n"
             f"    {espeak_dir}\n"
             f"  Move the library to a shorter path (e.g. LEMO_OPUSCAR_HOME=~/lemo-opuscar, or a shorter folder for the clone) and run\n"
             f"  `sh plugin/skills/lemo-opuscar/scripts/setup.sh deps` there (a moved .venv does not work). No need to move anything for tts_zh.py.")
try: from kokoro_onnx import Kokoro
except ImportError: sys.exit('tts.py: kokoro-onnx is missing: install the voice tier: sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice')
k = Kokoro(model, voices)
avail = k.get_voices()
for L in lines:
    v = L.get('voice') or DEFAULT_VOICE.get(L.get('lang', 'en-us'), 'af_bella')
    if v not in avail: sys.exit(f"tts.py: unknown voice '{v}' in line '{L['id']}'.\n  available: {', '.join(avail)}")
os.makedirs(out, exist_ok=True); dur = {}
for L in lines:
    lang = L.get('lang', 'en-us')
    a, sr = k.create(L['text'], voice=L.get('voice') or DEFAULT_VOICE.get(lang, 'af_bella'), speed=L.get('speed', .92), lang=lang)
    nz = np.where(np.abs(a) > (np.abs(a).max() if len(a) else 0) * .02)[0]
    if len(nz): a = a[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.08 * sr)]   # 去首尾静音；整段几乎无声就原样保留
    else: print('warning: line', L['id'], 'is silent', file=sys.stderr)
    sf.write(os.path.join(out, L['id'] + '.wav'), a, sr); dur[L['id']] = round(len(a) / sr, 3)
    print(L['id'], dur[L['id']], L['text'])
json.dump(dur, open(os.path.join(out, 'dur.json'), 'w', encoding='utf-8'), indent=1)
