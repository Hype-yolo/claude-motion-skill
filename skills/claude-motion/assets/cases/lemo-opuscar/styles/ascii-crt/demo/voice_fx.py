"""AI 声线处理：voices_raw/*.wav → voices/*.wav
轻度环调制（52Hz，湿 16%）+ 6ms 梳状共振（金属腔体感）+ 带通 140–7000Hz + 轻微饱和。whisper 不稳就降低 RING/COMB。"""
import json, os, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
D = os.path.dirname(os.path.abspath(__file__))
RING, COMB = .16, .22
lines = json.load(open(os.path.join(D, 'lines.json')))
os.makedirs(os.path.join(D, 'voices'), exist_ok=True)
dur = {}
for L in lines:
    y, sr = sf.read(os.path.join(D, 'voices_raw', L['id'] + '.wav'))
    t = np.arange(len(y)) / sr
    y = y * (1 - RING) + y * np.sin(2 * np.pi * 52 * t) * RING * 1.6
    k = int(.006 * sr); z = y.copy()
    for _ in range(3): z[k:] = z[k:] + COMB * z[:-k] * .8; 
    y = y * (1 - COMB) + z * COMB
    y = sosfilt(butter(2, [140, 7000], 'bandpass', fs=sr, output='sos'), y)
    y = np.tanh(y / np.abs(y).max() * 1.4) * .8
    sf.write(os.path.join(D, 'voices', L['id'] + '.wav'), y.astype(np.float32), sr)
    dur[L['id']] = round(len(y) / sr, 3)
json.dump(dur, open(os.path.join(D, 'voices', 'dur.json'), 'w'), indent=1)
print(dur)
