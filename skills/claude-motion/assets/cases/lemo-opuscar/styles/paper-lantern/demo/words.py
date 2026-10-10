import json, sys
import os as _os; _os.chdir(_os.path.dirname(_os.path.abspath(__file__)))   # 路径相对 demo/
from faster_whisper import WhisperModel
m = WhisperModel('medium', device='cpu', compute_type='int8')
out = {}
for lid in sys.argv[1:]:
    segs, _ = m.transcribe(f"vo/{lid}.wav", language='zh', word_timestamps=True, initial_prompt='以下是普通话的句子。')
    out[lid] = [(w.word, round(w.start, 2), round(w.end, 2)) for s in segs for w in s.words]
    print(lid, out[lid])
json.dump(out, open('vo/words.json', 'w'), ensure_ascii=False, indent=0)
