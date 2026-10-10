"""字幕 cues → ../woodcut.srt（规则同 film.js：t0 = 旁白起点 − 0.05，停留 ≥ max(1.8 s, 语音 + 0.6 s)）"""
import json, os, subprocess, sys
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); R = os.path.abspath(os.path.join(D, '../../..'))
K = json.load(open(os.path.join(D, 'timeline.json')))['keys']; dur = json.load(open(os.path.join(D, 'voices/dur.json')))
cues = [{'t0': round(K[l['id']] - .05, 3), 't1': round(K[l['id']] + max(1.8, dur[l['id']] + .6), 3), 'text': l['text']} for l in json.load(open(os.path.join(D, 'lines.json')))]
os.makedirs(os.path.join(D, 'out'), exist_ok=True); p = os.path.join(D, 'out/srt.json'); json.dump(cues, open(p, 'w'), indent=1)
subprocess.run([sys.executable, os.path.join(R, 'core/render/srt.py'), p, os.path.join(D, '../woodcut.srt')], check=True)
