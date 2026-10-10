# subtitles from the film's voice events (same rule as film.js drawSubs): on 0.1 s before the line, off 0.6 s after it
import json, os, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
content = sys.argv[1] if len(sys.argv) > 1 else 'content.json'
W = os.environ.get('ENG_WORK') or D
E = json.load(open(os.path.join(W, 'events.json')))['ev']; C = json.load(open(os.path.join(D, content)))
text = {l['id']: l['text'] for l in C['voice']['lines']}
vo = [e for e in E if e['type'] == 'vo']
cues = [dict(t0=round(v['t'] - 0.1, 3), t1=round(min(v['t'] + v['dur'] + 0.6, vo[i + 1]['t'] - 0.2 if i + 1 < len(vo) else 1e9), 3), text=text[v['id']]) for i, v in enumerate(vo)]
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump(cues, open(os.path.join(W if W != D else os.path.join(D, 'out'), 'subs.json'), 'w'), indent=1)
for c in cues: print(c)
