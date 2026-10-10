"""Build lines.json (voice lines) from a content file: python lines.py content.json out.json"""
import json, sys
C = json.load(open(sys.argv[1])); v = C.get('voice', {})
L = [('hook', C['hook']['line'])] + [(f'step{i}', s['line']) for i, s in enumerate(C['steps'])] + [('tip', C['tip']['line']), ('outro', C['outro']['line'])]
import re
NUM = {'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5'}
asr = lambda t: re.sub(r'\b(Step|step) (one|two|three|four|five)\b', lambda m: m.group(1) + ' ' + NUM[m.group(2)], t)
json.dump([{'id': k, 'text': t, 'asr': asr(t), 'voice': v.get('id', 'bm_george'), 'speed': v.get('speed', 0.94)} for k, t in L], open(sys.argv[2], 'w'), indent=1)
