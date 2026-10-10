import json, re
import os as _os; _os.chdir(_os.path.dirname(_os.path.abspath(__file__)))   # 路径相对 demo/
from faster_whisper import WhisperModel
m = WhisperModel('medium', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^一-鿿0-9]', '', s)
for L in json.load(open('script.json')):
    segs, _ = m.transcribe(f"vo/{L['id']}.wav", language='zh', beam_size=5, initial_prompt='以下是普通话的句子。')
    got = ''.join(s.text for s in segs)
    print('OK  ' if norm(got)==norm(L['text']) else 'DIFF', L['id'], norm(L['text']), '→', norm(got))
