"""成片 whisper 抽查：按旁白时间从 mp4 切片转写（期望文本用 lines.json 的 asr 字段，没有就用 text），并算 300–4000 Hz 人声/背景 SNR。
用法（仓库根）：.venv/bin/python styles/hologram-hud/demo/tools/final_asr.py styles/hologram-hud/hologram-hud.mp4"""
import sys, os, json, re, subprocess, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
from scipy.signal import butter, sosfilt, resample_poly
D = os.environ.get('HH_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO = {v['id']: v for v in json.load(open(os.path.join(D, 'timeline.json')))['vo']}
lines = json.load(open(os.path.join(D, 'lines.json')))
tmp = os.path.join(D, 'out', 'final_audio.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', sys.argv[1], '-ac', '1', '-ar', '16000', tmp], check=True)
y, sr = sf.read(tmp); m = WhisperModel('base.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace('-', ' ')).split()
sos = butter(4, [300, 4000], 'band', fs=sr, output='sos'); ok = 0
for L in lines:
    t0 = VO[L['id']]['t']; v, vs = sf.read(os.path.join(D, 'voices', L['id'] + '.wav')); v = resample_poly(v, sr, vs)
    a, b = int((t0 - .3) * sr), int(t0 * sr) + len(v) + int(.3 * sr)
    segs, _ = m.transcribe(y[a:b].astype(np.float32), beam_size=5, language='en')
    got = ' '.join(s.text.strip() for s in segs); exp = L.get('asr', L['text']); good = norm(got) == norm(exp); ok += good
    seg = y[int(t0 * sr):int(t0 * sr) + len(v)]; vb = sosfilt(sos, v[:len(seg)]); sb = sosfilt(sos, seg)
    gain = np.dot(sb, vb) / (np.dot(vb, vb) + 1e-12); rest = sb - gain * vb
    snr = 10 * np.log10(np.sum((gain * vb) ** 2) / (np.sum(rest ** 2) + 1e-12))
    print(('OK  ' if good else 'DIFF'), L['id'], f'SNR {snr:+.1f} dB |', exp, '→', got)
print(f'{ok}/{len(lines)} OK')
