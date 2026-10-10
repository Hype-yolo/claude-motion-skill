"""卡点自检：mix.wav 里每个画面事件附近（±80 ms）最近的起音，与事件时间比。
仓库根运行：.venv/bin/python styles/silkscreen-poster/demo/tools/cuecheck.py"""
import json, os, numpy as np, soundfile as sf, librosa
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
E = json.load(open(os.path.join(D, 'events.json')))
y, sr = sf.read(os.path.join(D, 'mix.wav'), always_2d=True); y = y.mean(1)
on = librosa.onset.onset_detect(y=y, sr=sr, hop_length=128, backtrack=True, units='time')
keep = ('pull', 'lift', 'band', 'name', 'item', 'swap', 'clack', 'endcard', 'squeegee')
bad, n, ds = 0, 0, []
for e in E['ev']:
    if e['type'] not in keep: continue
    n += 1; d = on[np.argmin(np.abs(on - e['t']))] - e['t']; ds.append(d)
    flag = '' if abs(d) <= 1 / 24 else '  <-- 超过 1 帧'
    bad += bool(flag); print(f"{e['t']:6.2f}  {e['type']:9s} {d*1000:+6.1f} ms{flag}")
print(f'{n} 个卡点，{n-bad} 个在 1 帧（41.7 ms）以内，中位 |误差| {np.median(np.abs(ds))*1000:.1f} ms')
