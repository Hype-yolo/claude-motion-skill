"""edge-tts 中文配音：python tts.py → vo/<id>.wav (48k mono, 去首尾静音) + vo/dur.json"""
import json, subprocess, os, numpy as np, soundfile as sf
import os as _os; _os.chdir(_os.path.dirname(_os.path.abspath(__file__)))   # 路径相对 demo/
V, RATE, PITCH = 'zh-CN-XiaoxiaoNeural', '+10%', '-2Hz'
lines = json.load(open('script.json')); dur = {}
for L in lines:
    mp3 = f"vo/{L['id']}.mp3"; wav = f"vo/{L['id']}.wav"
    r = L.get('rate', RATE)
    if not os.path.exists(mp3) or L.get('redo'):
        subprocess.run(['edge-tts', '--voice', V, f'--rate={r}', f'--pitch={PITCH}', '--text', L.get('say', L['text']), '--write-media', mp3], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ar', '48000', '-ac', '1', wav], check=True)
    a, sr = sf.read(wav); thr = np.abs(a).max() * .02; nz = np.where(np.abs(a) > thr)[0]
    a = a[max(0, nz[0] - int(.02 * sr)): nz[-1] + int(.12 * sr)]
    sf.write(wav, a, sr); dur[L['id']] = round(len(a) / sr, 3); print(L['id'], dur[L['id']], round(len(L['text'])/dur[L['id']],2))
json.dump(dur, open('vo/dur.json', 'w'), indent=1)
print('total', round(sum(dur.values()), 1))
