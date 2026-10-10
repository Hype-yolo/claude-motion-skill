"""成片 whisper 抽查：从 mp4 里按旁白时间切片转写，并算 300–4000 Hz 频段的人声/背景 SNR。
python styles/dark-keynote/demo/tools/final_asr.py styles/dark-keynote/dark-keynote.mp4"""
import sys, os, json, re, subprocess, numpy as np, soundfile as sf, librosa
from faster_whisper import WhisperModel
from scipy.signal import butter, sosfilt, resample_poly
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); K = json.load(open(os.path.join(D, 'timeline.json')))['K']
lines = json.load(open(os.path.join(D, 'lines.json'))); dur = json.load(open(os.path.join(D, 'voices/dur.json')))
tmp = os.path.join(D, 'out', 'final_audio.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', sys.argv[1], '-ac', '1', '-ar', '16000', tmp], check=True)
y, sr = sf.read(tmp); m = WhisperModel('base.en', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower()).split()
sos = butter(4, [300, 4000], 'band', fs=sr, output='sos'); ok = 0
mix48, _ = sf.read(os.path.join(D, 'mix.wav'))
for L in lines:
    t0 = K['vo'][L['id']]; a, b = int((t0 - .3) * sr), int((t0 + dur[L['id']] + .3) * sr)
    segs, _ = m.transcribe(y[a:b].astype(np.float32), beam_size=5, language='en')
    got = ' '.join(s.text.strip() for s in segs); good = norm(got) == norm(L['text']); ok += good
    v, vs = sf.read(os.path.join(D, 'voices', L['id'] + '.wav')); v = resample_poly(v, sr, vs)
    seg = y[int(t0 * sr):int(t0 * sr) + len(v)]; vb = sosfilt(sos, v); sb = sosfilt(sos, seg)
    gain = np.dot(sb, vb) / (np.dot(vb, vb) + 1e-12); rest = sb - gain * vb
    snr = 10 * np.log10(np.sum((gain * vb) ** 2) / (np.sum(rest ** 2) + 1e-12))
    print(('OK  ' if good else 'DIFF'), L['id'], f'SNR {snr:+.1f} dB |', L['text'], '→', got)
print(f'{ok}/{len(lines)} OK')
