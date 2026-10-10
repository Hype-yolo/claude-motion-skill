"""timeline.js SUBS → out/srt.json (for core/render/srt.py). Run from the repo root."""
import json, os, subprocess
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subs = json.loads(subprocess.check_output(['node', '-e', "import('./timeline.js').then(m=>console.log(JSON.stringify(m.SUBS)))"], cwd=D))
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump([{'t0': s['t0'], 't1': s['t1'], 'text': s['text']} for s in subs], open(os.path.join(D, 'out', 'srt.json'), 'w'), indent=1)
dur = json.load(open(os.path.join(D, 'voices', 'dur.json')))
for s in subs:
    need = max(1.8, dur[s['id']] + .6); print(s['id'], 'hold %.2f s  need %.2f s  %s' % (s['t1'] - s['t0'], need, 'OK' if s['t1'] - s['t0'] >= need - 1e-6 else 'SHORT'))
