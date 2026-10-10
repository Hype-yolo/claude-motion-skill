"""whisper 自检：python core/tts/asr_check.py lines.json voices_dir
逐句对比原文与转写；前后补 0.6s 静音再转写（短句不补容易听错）；输出逐词时间戳 voices_dir/words.json（口型、断句用）
lines.json 里可加 "asr" 字段覆盖期望文本（专有名词、拟声词）"""
import sys, json, re, os, numpy as np, soundfile as sf, librosa
from faster_whisper import WhisperModel
m = WhisperModel(os.environ.get('WM','base.en'), device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower().replace("'", '').replace('-', ' ')).split()
bad, words = 0, {}
for L in json.load(open(sys.argv[1])):
    y, sr = sf.read(os.path.join(sys.argv[2], L['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = librosa.resample(y, orig_sr=sr, target_sr=16000); pad = np.zeros(int(.6 * 16000))
    segs, _ = m.transcribe(np.concatenate([pad, y, pad]).astype(np.float32), beam_size=5, language='en', word_timestamps=True)
    segs = list(segs); got = ' '.join(s.text.strip() for s in segs)
    words[L['id']] = [(w.word.strip(), round(w.start - .6, 3), round(w.end - .6, 3)) for s in segs for w in s.words]
    want = L.get('asr', L['text']); ok = norm(got) == norm(want); bad += not ok
    print(('OK  ' if ok else 'DIFF'), L['id'], '|', want, '→', got)
json.dump(words, open(os.path.join(sys.argv[2], 'words.json'), 'w'), indent=0)
print('mismatches:', bad)
