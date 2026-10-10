"""整片混音的 whisper 回听：人声在音乐音效下是否仍听得清（逐词匹配率）"""
import sys, json, re, difflib, numpy as np, soundfile as sf, librosa, os
from faster_whisper import WhisperModel
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
y, sr = sf.read(os.path.join(H, 'mix.wav')); y = librosa.resample(y.mean(1), orig_sr=sr, target_sr=16000).astype(np.float32)
m = WhisperModel(os.environ.get('WM', 'medium.en'), device='cpu', compute_type='int8')
segs, _ = m.transcribe(y, beam_size=5, language='en')
got = ' '.join(s.text for s in segs)
norm = lambda s: re.sub(r'[^a-z0-9 ]', ' ', s.lower().replace("'", '')).split()
want = ' '.join(L.get('asr', L['text']) for L in json.load(open(os.path.join(H, 'lines.json'))))
a, b = norm(want), norm(got); sm = difflib.SequenceMatcher(a=a, b=b)
print(got); print('match %.1f%%' % (100 * sum(x.size for x in sm.get_matching_blocks()) / len(a)))
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op != 'equal': print(op, a[i1:i2], '→', b[j1:j2])
