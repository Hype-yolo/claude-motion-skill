"""events.json (type 'sub') -> cues.json -> <slug>.srt via core/render/srt.py"""
import json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(D, '../../..'))
ev = json.load(open(os.path.join(D, 'events.json')))['ev']
cues = [{'t0': e['t'], 't1': e['t1'], 'text': e['text']} for e in ev if e['type'] == 'sub']
json.dump(cues, open(os.path.join(D, 'cues.json'), 'w'), indent=1)
subprocess.run([sys.executable, os.path.join(ROOT, 'core/render/srt.py'), os.path.join(D, 'cues.json'), os.path.join(D, '..', 'stained-glass.srt')], check=True)
print(len(cues), 'cues')
